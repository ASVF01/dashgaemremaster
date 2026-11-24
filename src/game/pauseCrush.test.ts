import { describe, it, expect } from "vitest";
import { crushCurve, setPauseCrush, isPauseCrushed } from "./bgm";

describe("pause-menu bitcrush curve", () => {
  it("quantizes to 2^bits distinct levels", () => {
    const curve = crushCurve(4, 1024);
    const distinct = new Set<number>();
    for (const v of curve) distinct.add(v);
    expect(distinct.size).toBe(16);
  });

  it("spans -1 to 1", () => {
    const curve = crushCurve(4, 1024);
    expect(curve[0]).toBeCloseTo(-1, 5);
    expect(curve[curve.length - 1]).toBeCloseTo(1, 5);
  });

  it("is monotonically non-decreasing", () => {
    const curve = crushCurve(4, 1024);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    }
  });

  it("tracks the pause-crush toggle state", () => {
    setPauseCrush(true);
    expect(isPauseCrushed()).toBe(true);
    setPauseCrush(false);
    expect(isPauseCrushed()).toBe(false);
  });
});
