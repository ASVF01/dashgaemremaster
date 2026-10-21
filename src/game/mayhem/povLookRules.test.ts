import { describe, expect, it } from "vitest";
import { edgeWeight, lookOffset, LOOK_DEADZONE, LOOK_MAX_X, LOOK_MAX_Y } from "./povLookRules";

describe("pov look pan", () => {
  it("holds still inside the center dead zone", () => {
    expect(edgeWeight(0)).toBe(0);
    expect(edgeWeight(LOOK_DEADZONE)).toBe(0);
    expect(edgeWeight(-LOOK_DEADZONE / 2)).toBe(0);
  });
  it("reaches full pan at the screen edge", () => {
    expect(edgeWeight(1)).toBe(1);
    expect(edgeWeight(-1)).toBe(-1);
    expect(edgeWeight(2)).toBe(1); // soft-clamped, never overshoots
  });
  it("ramps up monotonically past the dead zone", () => {
    const mid = edgeWeight(0.5);
    const far = edgeWeight(0.8);
    expect(mid).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(mid);
    expect(far).toBeLessThan(1);
  });
  it("drifts the room opposite the cursor and widens when peeking", () => {
    expect(lookOffset(1, 1)).toEqual({ x: -LOOK_MAX_X, y: -LOOK_MAX_Y });
    expect(lookOffset(1, 0, 1.22).x).toBeCloseTo(-LOOK_MAX_X * 1.22);
    expect(lookOffset(0.05, -0.05)).toEqual({ x: -0, y: -0 });
  });
});
