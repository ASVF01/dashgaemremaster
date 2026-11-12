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

export const OFFICE_EDGE_ZONE = 0.55; // |cursor x| beyond this pans the head
export const OFFICE_PAN_SPEED = 160; // degrees per second at the very edge

/**
 * Edge-scroll look: pushing the cursor toward a side turns the head that way,
 * and the head stays there when the cursor stops or comes back to the middle.
 */
export function edgeScrollYaw(yaw: number, x: number, dt: number): number {
  const ax = Math.abs(x);
  if (ax <= OFFICE_EDGE_ZONE) return yaw;
  const push = Math.min(1, (ax - OFFICE_EDGE_ZONE) / (1 - OFFICE_EDGE_ZONE));
  const next = yaw + Math.sign(x) * push * OFFICE_PAN_SPEED * Math.min(dt, 0.05);
  return Math.max(-OFFICE_MAX_YAW, Math.min(OFFICE_MAX_YAW, next));
}

/** -1 / 0 / 1: which side edge zone the cursor is in. */
export function edgeZone(x: number): -1 | 0 | 1 {
  return x < -OFFICE_EDGE_ZONE ? -1 : x > OFFICE_EDGE_ZONE ? 1 : 0;
}

/**
 * Instant turn: entering a side zone swings the head one wall that way
 * (center → side, or the opposite side → center) and it stays put after.
 */
export function stepYawTarget(target: number, prevZone: number, zone: number): number {
  if (zone === 0 || zone === prevZone) return target;
  return Math.max(-OFFICE_MAX_YAW, Math.min(OFFICE_MAX_YAW, target + zone * OFFICE_MAX_YAW));
}

/**
 * Where the head should face for the current view. Looking up at the vent
 * pins the head straight up (0°) so tilting never spins the body around;
 * desk view keeps the normal edge stepping.
 */
export function yawTargetForView(view: OfficeView, target: number, prevZone: number, zone: number): number {
  if (view === "ceiling") return 0;
  return stepYawTarget(target, prevZone, zone);
}

/** Step hits (seconds) in ventwalk1.wav; the vent jolts once on each. */
export const VENT_STEP_TIMES = [0.164, 1.454, 2.513];

/** Steps crossed when audio time moves from prev to now (handles loop wrap). */
export function ventStepsCrossed(prev: number, now: number): number {
  if (now >= prev) return VENT_STEP_TIMES.filter((t) => t > prev && t <= now).length;
  return VENT_STEP_TIMES.filter((t) => t > prev || t <= now).length;
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

// ---------- Furniture (desks standing on the floor) ----------
/** Painted size multiplier for the desks: big enough to read, never filling the screen. */
export const OFFICE_FURNITURE_SCALE = 0.85;
/** How far into the room a desk stands (1 = flush with the wall, must stay under 1). */
export const OFFICE_DESK_DEPTH = 0.9;
export const OFFICE_UTIL_DEPTH = 0.9;

/**
 * Where a floor-standing desk actually lands on screen. A plane parked at depth k
 * is magnified by 1/k by the room's perspective, so shrinking a desk (or pushing it
 * back) lifts its top edge toward the middle of the view instead of burying it.
 */
export function propScreenBox(
  viewportW: number, viewportH: number, roomH: number,
  layoutW: number, layoutH: number, k: number,
) {
  const rise = roomH / 2 - layoutH / 2; // legs rest on the floor
  const center = viewportH / 2 + rise / k;
  const width = layoutW / k;
  const height = layoutH / k;
  return {
    width, height,
    left: viewportW / 2 - width / 2, right: viewportW / 2 + width / 2,
    top: center - height / 2, bottom: center + height / 2,
  };
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

/** NEO-MATA vent air: full tank drains in this many seconds while she sits in the vent. */
export const MATA_DRAIN_SECONDS = 20;
/** Shock jolt on her vent picture lasts exactly this long. */
export const MATA_SHOCK_MS = 500;
/** Air left after `dt` seconds of draining (never below 0). */
export function drainAir(air: number, dt: number): number {
  return Math.max(0, air - (100 / MATA_DRAIN_SECONDS) * dt);
}
/** Lower air = faster rattles and harder gauge shake: 700ms apart when full, 60ms when empty. */
export function airRattle(air: number): { intervalMs: number; shakePx: number } {
  const lack = 1 - Math.max(0, Math.min(100, air)) / 100;
  return { intervalMs: Math.round(700 - 640 * lack * lack), shakePx: Math.round(lack * 8 * 10) / 10 };
}
