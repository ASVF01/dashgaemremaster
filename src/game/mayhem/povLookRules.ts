// Pure rules for the MAYHEM first-person look: a bounded, edge-weighted pan.
// The room stays a flat 2D pan (scale + translate only) — the cursor's
// distance from screen center decides how far the view drifts, with a small
// dead zone in the middle and a smooth clamp at the edges.
export const LOOK_DEADZONE = 0.14; // fraction of the half-screen with no pan
export const LOOK_MAX_X = 36; // px of pan at the screen edge (peek = 1)
export const LOOK_MAX_Y = 13;

export interface LookPan {
  x: number;
  y: number;
}

/** Maps a cursor position (-1..1) to a pan weight (-1..1): dead zone around
 * the center, then a smoothstep ramp that flattens out at the edge. */
export function edgeWeight(v: number, deadzone = LOOK_DEADZONE): number {
  const clamped = Math.max(-1, Math.min(1, v));
  const a = Math.abs(clamped);
  if (a <= deadzone) return 0;
  const t = (a - deadzone) / (1 - deadzone);
  return Math.sign(clamped) * t * t * (3 - 2 * t);
}

/** Pixel offset for the room layer: the room drifts opposite the cursor, so
 * sweeping the mouse feels like turning your head. `peek` widens the pan when
 * pressed against a keyhole. */
export function lookOffset(x: number, y: number, peek = 1, maxX = LOOK_MAX_X, maxY = LOOK_MAX_Y): LookPan {
  return { x: -edgeWeight(x) * maxX * peek, y: -edgeWeight(y) * maxY * peek };
}
