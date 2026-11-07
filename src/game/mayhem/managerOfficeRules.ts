// Pure rules for the Night 5 Manager's Office test room: a box room the
// camera turns inside of (Frickbear's-style 3D pan). Mouse X turns the head
// left/right; W/S (or tapping top/bottom) tilt between desk and ceiling vent.
import { edgeWeight } from "./povLookRules";

export const OFFICE_MAX_YAW = 90; // degrees: face the door / utilities walls head-on
export const OFFICE_CEILING_PITCH = 90; // degrees tilted up when looking at the vent
export const OFFICE_DEADZONE = 0.12;
export const OFFICE_TURN_RATE = 7; // exp smoothing per second

export type OfficeView = "desk" | "ceiling";

/** Cursor x in -1..1 → yaw in degrees. Positive yaw = looking right. */
export function officeYaw(x: number): number {
  return edgeWeight(x, OFFICE_DEADZONE) * OFFICE_MAX_YAW;
}

export function officePitch(view: OfficeView): number {
  return view === "ceiling" ? OFFICE_CEILING_PITCH : 0;
}

/** Keyboard: only W and S move the view (left/right is mouse-only). */
export function viewForKey(code: string, current: OfficeView): OfficeView {
  if (code === "KeyW") return "ceiling";
  if (code === "KeyS") return "desk";
  return current;
}

/** Frame-rate independent approach toward a target. */
export function approach(current: number, target: number, dt: number, rate = OFFICE_TURN_RATE): number {
  return target + (current - target) * Math.exp(-rate * Math.min(dt, 0.05));
}

// ---------- Wire patch task ----------
export const WIRE_COLORS = ["cyan", "pink", "yellow", "lime"] as const;
export type WireColor = (typeof WIRE_COLORS)[number];

/** Right-hand port order: a shuffle that is never identical to the left side. */
export function shuffledPorts(rand: () => number = Math.random): WireColor[] {
  for (;;) {
    const a = [...WIRE_COLORS];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((c, i) => c !== WIRE_COLORS[i])) return a;
  }
}

/** A connection only counts when the colors match. */
export function tryConnect(done: WireColor[], from: WireColor, to: WireColor): WireColor[] {
  if (from !== to || done.includes(from)) return done;
  return [...done, from];
}

export function taskComplete(done: WireColor[]): boolean {
  return WIRE_COLORS.every((c) => done.includes(c));
}
