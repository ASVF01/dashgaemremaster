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

export function rumble(opts: { duration?: number; strong?: number; weak?: number } = {}) {
  const duration = opts.duration ?? 120;
  const strong = Math.max(0, Math.min(1, opts.strong ?? 0.6));
  const weak   = Math.max(0, Math.min(1, opts.weak   ?? 0.4));
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
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

  function pressed(gp: Gamepad, idx: number): boolean {
    const b = gp.buttons[idx];
    if (!b) return false;
    return typeof b === "object" ? (b.pressed || b.value > TRIGGER_THRESHOLD) : (b as unknown as number) > TRIGGER_THRESHOLD;
  }

  let raf = 0;
  const tick = () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }

    if (!gp) {
      // No controller — release anything we were holding.
      for (const c of ALL_CODES) if (held[c]) set(c, false);
      raf = requestAnimationFrame(tick);
      return;
    }

    // Detect non-standard mapping (some Firefox + DualShock 4 cases). When
    // mapping !== "standard", button indices are device-specific. We sniff
    // the id for "PLAYSTATION" / "DualShock" / "DualSense" / vendor 054c
    // and apply the common DS4-on-Firefox layout:
    //   0 X(cross), 1 O(circle), 2 □(square), 3 △(triangle),
    //   4 L1, 5 R1, 6 L2, 7 R2, 8 share, 9 options, 10 L3, 11 R3,
    //   12 up, 13 down, 14 left, 15 right
    // which happens to match Standard, so even non-standard PS pads usually
    // "just work" with the indices below — but the dpad axis (axis 9 hat)
    // needs handling for the truly legacy non-standard path.
    const isNonStandard = gp.mapping !== "standard";
    const id = (gp.id || "").toLowerCase();
    const isPlayStation =
      id.includes("playstation") ||
      id.includes("dualshock") ||
      id.includes("dualsense") ||
      id.includes("054c");      // Sony USB vendor id

    // Axes (left stick) + dpad.
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;

    // Hat-switch dpad fallback: many non-standard PS pads encode the dpad as
    // a single axis (axis 9) with discrete values for each direction.
    let hatLeft = false, hatRight = false, hatUp = false, hatDown = false;
    if (isNonStandard && isPlayStation && gp.axes.length > 9) {
      const h = gp.axes[9];
      // Values cluster near these multiples of 1/7. Use windows for slop.
      const near = (target: number) => Math.abs(h - target) < 0.15;
      hatUp    = near(-1) || near(-0.71) || near(-0.43);
      hatRight = near(-0.43) || near(-0.14) || near(0.14);
      hatDown  = near(0.14) || near(0.43) || near(0.71);
      hatLeft  = near(0.71) || near(1) || near(-1);
    }

    const left  = ax < -STICK_DEADZONE || pressed(gp, 14) || hatLeft;
    const right = ax >  STICK_DEADZONE || pressed(gp, 15) || hatRight;
    const up    = ay < -STICK_DEADZONE || pressed(gp, 12) || hatUp;
    const down  = ay >  STICK_DEADZONE || pressed(gp, 13) || hatDown;

    set("ArrowLeft",  left  && !right);
    set("ArrowRight", right && !left);

    // Face buttons. Indices match between Xbox Standard and PS Standard,
    // so the same numbers work for DualShock/DualSense:
    //   PS Cross    = idx 0  → jump (Xbox A)
    //   PS Circle   = idx 1  → slide (Xbox B)
    //   PS Square   = idx 2  → parry (Xbox X)
    //   PS Triangle = idx 3  → dash  (Xbox Y)
    const a = pressed(gp, 0);
    const b = pressed(gp, 1);
    const x = pressed(gp, 2);
    const y = pressed(gp, 3);
    const lb = pressed(gp, 4);
    const rb = pressed(gp, 5);
    const lt = pressed(gp, 6);
    const rt = pressed(gp, 7);
    const start = pressed(gp, 9); // PS: Options

    // Jump: Cross / A / up direction
    set("Space", a || up);
    // Slide / dive: Circle / B / L1 / L2 / down direction
    set("ShiftLeft", b || lb || lt || down);
    // Parry: Square / X
    set("KeyJ", x);
    // Dash / hold for super dash: Triangle / Y / R1 / R2
    set("KeyK", y || rt || rb);
    // Menu confirm: Options / Start
    set("Enter", start);

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
