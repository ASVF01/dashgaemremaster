// Pure rules for MAYHEM's floating HUD. Both the WASD exit prompts and the
// hand-drawn HP panel follow the smoothed gaze, but each lives on its own
// plane: a different swing, a slower ease that trails the prompts, and an idle
// sway of its own. That keeps the HP bar reading as a separate floating panel
// instead of a piece bolted onto the key prompts.

export type HudPlane = "nav" | "hp";

/** WASD prompt plane: the widest swing, glued to the raw smoothed gaze. */
export const NAV_DRIFT_MAX_X = 70;
export const NAV_DRIFT_MAX_Y = 32;
export const NAV_DRIFT_EASE_MS = 85;

/** HP plane: travels a short fraction of the prompt plane and lags behind it. */
export const HP_DRIFT_MAX_X = 26;
export const HP_DRIFT_MAX_Y = 14;
export const HP_DRIFT_EASE_MS = 190;

/** The HP panel breathes on its own clock even while the gaze holds still. */
export const HP_SWAY_AMP_PX = 2.5;
export const HP_SWAY_PERIOD_MS = 1500;

/** Hand-drawn tilt: the base lean plus a small lean into where you look. */
export const HP_TILT_BASE_DEG = -1.5;
export const HP_TILT_GAZE_DEG = 1.2;

const PLANE_SWING: Record<HudPlane, { x: number; y: number }> = {
  nav: { x: NAV_DRIFT_MAX_X, y: NAV_DRIFT_MAX_Y },
  hp: { x: HP_DRIFT_MAX_X, y: HP_DRIFT_MAX_Y },
};

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

/** Pixel offset for a HUD plane: it slides opposite the gaze, so panning the
 * mouse reads as turning your head. */
export function hudDrift(plane: HudPlane, gazeX: number, gazeY: number) {
  const swing = PLANE_SWING[plane];
  return { x: -clampUnit(gazeX) * swing.x, y: -clampUnit(gazeY) * swing.y };
}

/** Frame-rate independent ease toward the gaze. */
export function hudEase(dt: number, easeMs: number) {
  return 1 - Math.exp(-dt / Math.max(1, easeMs));
}

/** Independent idle bob: 0 at the clock's start, bounded by the amplitude. */
export function hpSway(clockMs: number) {
  return Math.sin((clockMs / HP_SWAY_PERIOD_MS) * Math.PI * 2) * HP_SWAY_AMP_PX;
}

/** Ink tilt in degrees: the authored lean, nudged by the horizontal gaze. */
export function hpTilt(gazeX: number) {
  return HP_TILT_BASE_DEG + clampUnit(gazeX) * HP_TILT_GAZE_DEG;
}

/** True while a head turn is covering the view, so HUD planes can hide. */
export function hudHiddenWhileTurning(turning: boolean) {
  return turning;
}
