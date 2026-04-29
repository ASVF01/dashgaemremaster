// Gamepad → keyboard bridge.
//
// Rather than threading a second input source through every game system,
// we poll the Gamepad API each animation frame and synthesize the SAME
// keyboard events the keyboard pipeline already listens for. This means
// rebindable keys, touch controls, and the controller all funnel through
// the same code paths — no duplication of dash / parry / super-dash logic.
//
// Mapping (Standard Gamepad):
//   Left stick X / D-pad left/right → ArrowLeft / ArrowRight
//   Left stick Y / D-pad up/down    → (up = jump, down = slide — same as touch)
//   A (button 0)                    → Space      (jump)
//   B (button 1)                    → ShiftLeft  (slide)
//   X (button 2)                    → KeyJ       (parry)
//   Y (button 3)                    → KeyK       (dash)
//   RT (button 7) / RB (button 5)   → KeyK       (dash / hold = super dash)
//   LT (button 6) / LB (button 4)   → ShiftLeft  (slide)
//   Start (button 9)                → Enter
//
// Codes match what useKeybinds defaults to so the game's matchesAction()
// recognises them without any extra wiring.

const STICK_DEADZONE = 0.35;
const TRIGGER_THRESHOLD = 0.5;

// Synthetic key codes we may emit. Tracked so we can release everything
// cleanly when a controller disconnects mid-press.
type SynthCode =
  | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"
  | "Space" | "ShiftLeft" | "KeyJ" | "KeyK" | "Enter";

const ALL_CODES: SynthCode[] = [
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Space", "ShiftLeft", "KeyJ", "KeyK", "Enter",
];

function fire(type: "keydown" | "keyup", code: SynthCode) {
  const evt = new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true });
  window.dispatchEvent(evt);
}

let started = false;

// Vibration support. We re-resolve the active gamepad each call rather than
// caching a reference because Gamepad objects in some browsers are snapshots
// and the cached one quickly goes stale (its actuator stops working).
//
// PlayStation pad notes:
//   - DualShock 4 / DualSense expose dual-rumble through `vibrationActuator`
//     in Chromium and Safari (Standard Gamepad mapping).
//   - Older Firefox builds expose `hapticActuators[]` with a `.pulse(value, ms)`
//     method instead — we fall back to that.
//   - DualSense's adaptive triggers ("trigger-rumble") aren't appropriate for
//     a generic "speed cue" so we stick with classic dual-rumble.
type VibrationActuator = {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
  pulse?: (value: number, duration: number) => Promise<unknown>;
};
type HapticActuator = { pulse?: (value: number, duration: number) => Promise<unknown> };
type PadWithHaptics = Gamepad & {
  vibrationActuator?: VibrationActuator;
  hapticActuators?: HapticActuator[];
};

export type GamepadActions = {
  connected: boolean;
  blocked: boolean;
  id: string;
  mapping: string;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  slide: boolean;
  parry: boolean;
  dash: boolean;
  menu: boolean;
};

const EMPTY_ACTIONS: GamepadActions = {
  connected: false,
  blocked: false,
  id: "",
  mapping: "",
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  slide: false,
  parry: false,
  dash: false,
  menu: false,
};

export function safeGetGamepads(): readonly (Gamepad | null)[] {
  try {
    return navigator.getGamepads ? navigator.getGamepads() : [];
  } catch {
    // Some embedded previews/browsers block the Gamepad API by permissions policy.
    return [];
  }
}

export function isGamepadBlocked(): boolean {
  try {
    if (!navigator.getGamepads) return false;
    navigator.getGamepads();
    return false;
  } catch {
    return true;
  }
}

function pressed(gp: Gamepad, idx: number, threshold = TRIGGER_THRESHOLD): boolean {
  const b = gp.buttons[idx];
  if (!b) return false;
  return typeof b === "object" ? (b.pressed || b.value > threshold) : (b as unknown as number) > threshold;
}

function axis(gp: Gamepad, idx: number): number {
  const v = gp.axes[idx];
  return Number.isFinite(v) ? v : 0;
}

function axisPressed(gp: Gamepad, idx: number, dir: -1 | 1, threshold = STICK_DEADZONE): boolean {
  const v = axis(gp, idx);
  return dir < 0 ? v < -threshold : v > threshold;
}

function actionsFromPad(gp: Gamepad): GamepadActions {
  const id = (gp.id || "").toLowerCase();
  const isNonStandard = gp.mapping !== "standard";
  const isPlayStation =
    id.includes("playstation") ||
    id.includes("dualshock") ||
    id.includes("dualsense") ||
    id.includes("wireless controller") ||
    id.includes("054c");

  // D-pad hat fallback: old PlayStation reports can encode all d-pad states
  // in one axis instead of buttons 12-15.
  let hatUp = false, hatDown = false, hatLeft = false, hatRight = false;
  if (gp.axes.length > 9) {
    const h = axis(gp, 9);
    const near = (target: number) => Math.abs(h - target) < 0.16;
    hatUp = near(-1) || near(-0.71) || near(1);
    hatRight = near(-0.43) || near(-0.14) || near(0.14);
    hatDown = near(0.14) || near(0.43) || near(0.71);
    hatLeft = near(0.71) || near(1) || near(-1);
  }

  const left =
    axisPressed(gp, 0, -1) || axisPressed(gp, 2, -1) || axisPressed(gp, 6, -1) ||
    pressed(gp, 14) || hatLeft;
  const right =
    axisPressed(gp, 0, 1) || axisPressed(gp, 2, 1) || axisPressed(gp, 6, 1) ||
    pressed(gp, 15) || hatRight;
  const up =
    axisPressed(gp, 1, -1, 0.65) || axisPressed(gp, 3, -1, 0.65) || axisPressed(gp, 7, -1) ||
    pressed(gp, 12) || hatUp;
  const down =
    axisPressed(gp, 1, 1, 0.65) || axisPressed(gp, 3, 1, 0.65) || axisPressed(gp, 7, 1) ||
    pressed(gp, 13) || hatDown;

  // User's requested PlayStation binds:
  //   R1 slide, R2 dash, Cross jump, left/right or right stick move, Square parry.
  // Standard: Cross=0, Square=2. Common raw DS4: Square=0, Cross=1.
  const rawPlayStation = isPlayStation && isNonStandard;
  const jump = rawPlayStation ? pressed(gp, 1) : pressed(gp, 0);
  const parry = rawPlayStation ? pressed(gp, 0) : pressed(gp, 2);
  const slide = pressed(gp, 5);

  // R2 is normally button 7, but a few browser/driver stacks expose it as an
  // axis. Only treat positive trigger-like axes as dash when the pad is not
  // using the standard mapping to avoid right-stick false positives.
  const dashAxis = isNonStandard && (axis(gp, 4) > 0.45 || axis(gp, 5) > 0.45 || axis(gp, 8) > 0.45);
  const dash = pressed(gp, 7, 0.25) || dashAxis;
  const menu = pressed(gp, 9) || pressed(gp, 0);

  return {
    connected: true,
    blocked: false,
    id: gp.id || "unknown gamepad",
    mapping: gp.mapping || "",
    left: left && !right,
    right: right && !left,
    up: up && !down,
    down: down && !up,
    jump,
    slide,
    parry,
    dash,
    menu,
  };
}

export function getGamepadActions(): GamepadActions {
  const blocked = isGamepadBlocked();
  if (blocked) return { ...EMPTY_ACTIONS, blocked: true };
  for (const gp of safeGetGamepads()) {
    if (gp && gp.connected) return actionsFromPad(gp);
  }
  return EMPTY_ACTIONS;
}

export function rumble(opts: { duration?: number; strong?: number; weak?: number } = {}) {
  const duration = opts.duration ?? 120;
  const strong = Math.max(0, Math.min(1, opts.strong ?? 0.6));
  const weak   = Math.max(0, Math.min(1, opts.weak   ?? 0.4));
  try {
    const pads = safeGetGamepads();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const pad = gp as PadWithHaptics;

      // 1) Modern path — works for Xbox, DualShock 4, DualSense in Chromium/Safari.
      if (pad.vibrationActuator?.playEffect) {
        pad.vibrationActuator.playEffect("dual-rumble", {
          startDelay: 0,
          duration,
          strongMagnitude: strong,
          weakMagnitude: weak,
        }).catch(() => { /* mid-effect rejection — ignore */ });
        return;
      }

      // 2) Single-channel fallback (some Chromium builds expose only .pulse).
      if (pad.vibrationActuator?.pulse) {
        pad.vibrationActuator.pulse(Math.max(strong, weak), duration).catch(() => {});
        return;
      }

      // 3) Firefox legacy path — DualShock 4 often shows up here.
      const haptics = pad.hapticActuators;
      if (haptics && haptics.length > 0) {
        // Drive every motor we can find at the higher of the two magnitudes.
        const power = Math.max(strong, weak);
        for (const h of haptics) h.pulse?.(power, duration)?.catch?.(() => {});
        return;
      }
    }
  } catch { /* vibration is best-effort */ }
}



/** Start the controller polling loop. Idempotent. */
export function startGamepadBridge(): () => void {
  if (started) return () => {};
  started = true;

  // Per-code held state so we only emit edges (keydown on press, keyup on release).
  const held: Record<SynthCode, boolean> = {
    ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
    Space: false, ShiftLeft: false, KeyJ: false, KeyK: false, Enter: false,
  };

  function set(code: SynthCode, want: boolean) {
    if (want === held[code]) return;
    held[code] = want;
    fire(want ? "keydown" : "keyup", code);
  }

  let raf = 0;
  const tick = () => {
    const pads = safeGetGamepads();
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }

    if (!gp) {
      // No controller — release anything we were holding.
      for (const c of ALL_CODES) if (held[c]) set(c, false);
      raf = requestAnimationFrame(tick);
      return;
    }

    const actions = actionsFromPad(gp);

    set("ArrowLeft",  actions.left);
    set("ArrowRight", actions.right);
    set("ArrowUp",    actions.up);
    set("ArrowDown",  actions.down);
    set("Space",      actions.jump);
    set("ShiftLeft",  actions.slide);
    set("KeyJ",       actions.parry);
    set("KeyK",       actions.dash);
    set("Enter",      actions.menu);

    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // Optional: log connect/disconnect for debugging.
  const onConnect = (e: GamepadEvent) => {
    // eslint-disable-next-line no-console
    console.log("[gamepad] connected:", e.gamepad.id);
  };
  const onDisconnect = (e: GamepadEvent) => {
    // eslint-disable-next-line no-console
    console.log("[gamepad] disconnected:", e.gamepad.id);
    for (const c of ALL_CODES) if (held[c]) set(c, false);
  };
  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onDisconnect);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("gamepadconnected", onConnect);
    window.removeEventListener("gamepaddisconnected", onDisconnect);
    for (const c of ALL_CODES) if (held[c]) set(c, false);
    started = false;
  };
}
