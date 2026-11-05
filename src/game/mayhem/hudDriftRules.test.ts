import { describe, expect, it } from "vitest";
import {
  HP_DRIFT_EASE_MS,
  HP_DRIFT_MAX_X,
  HP_DRIFT_MAX_Y,
  HP_SWAY_AMP_PX,
  HP_SWAY_PERIOD_MS,
  HP_TILT_BASE_DEG,
  HP_TILT_GAZE_DEG,
  NAV_DRIFT_EASE_MS,
  NAV_DRIFT_MAX_X,
  NAV_DRIFT_MAX_Y,
  hudDrift,
  hudEase,
  hpSway,
  hpTilt,
} from "./hudDriftRules";

describe("MAYHEM floating HUD drift", () => {
  it("slides both planes opposite the gaze like a head turn", () => {
    expect(hudDrift("nav", 1, 1)).toEqual({ x: -NAV_DRIFT_MAX_X, y: -NAV_DRIFT_MAX_Y });
    expect(hudDrift("hp", 1, 1)).toEqual({ x: -HP_DRIFT_MAX_X, y: -HP_DRIFT_MAX_Y });
    expect(hudDrift("hp", -0.5, 0.25)).toEqual({ x: HP_DRIFT_MAX_X * 0.5, y: -HP_DRIFT_MAX_Y * 0.25 });
    expect(hudDrift("hp", 0, 0)).toEqual({ x: -0, y: -0 });
  });

  it("keeps the HP panel on a smaller plane than the WASD prompts", () => {
    const nav = hudDrift("nav", 1, 1);
    const hp = hudDrift("hp", 1, 1);
    expect(Math.abs(hp.x)).toBeLessThan(Math.abs(nav.x));
    expect(Math.abs(hp.y)).toBeLessThan(Math.abs(nav.y));
    expect(hudDrift("hp", 3, -3)).toEqual({ x: -HP_DRIFT_MAX_X, y: HP_DRIFT_MAX_Y }); // soft-clamped
  });

  it("lets the HP panel trail the prompts instead of moving as one slab", () => {
    const dt = 16;
    expect(hudEase(dt, HP_DRIFT_EASE_MS)).toBeLessThan(hudEase(dt, NAV_DRIFT_EASE_MS));
    expect(hudEase(dt, NAV_DRIFT_EASE_MS)).toBeGreaterThan(0);
  });

  it("gives the HP panel its own idle sway", () => {
    expect(hpSway(0)).toBe(0);
    expect(Math.abs(hpSway(HP_SWAY_PERIOD_MS / 4))).toBeCloseTo(HP_SWAY_AMP_PX);
    expect(hpSway(HP_SWAY_PERIOD_MS)).toBeCloseTo(0);
    expect(Math.abs(hpSway(1234))).toBeLessThanOrEqual(HP_SWAY_AMP_PX);
  });

  it("keeps the authored ink tilt, leaning only slightly into the gaze", () => {
    expect(hpTilt(0)).toBeCloseTo(HP_TILT_BASE_DEG);
    expect(hpTilt(1)).toBeCloseTo(HP_TILT_BASE_DEG + HP_TILT_GAZE_DEG);
    expect(hpTilt(-1)).toBeCloseTo(HP_TILT_BASE_DEG - HP_TILT_GAZE_DEG);
    expect(hpTilt(5)).toBeCloseTo(HP_TILT_BASE_DEG + HP_TILT_GAZE_DEG);
  });
});
