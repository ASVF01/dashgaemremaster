import { describe, expect, it } from "vitest";
import { airRattle, drainAir, MATA_SHOCK_MS } from "./managerOfficeRules";

describe("NEO-MATA vent air", () => {
  it("drains a full tank in 20 seconds and never goes negative", () => {
    expect(drainAir(100, 10)).toBe(50);
    expect(drainAir(100, 20)).toBe(0);
    expect(drainAir(5, 10)).toBe(0);
  });
  it("rattles slowly when full and ultra fast when empty", () => {
    expect(airRattle(100)).toEqual({ intervalMs: 700, shakePx: 0 });
    expect(airRattle(0)).toEqual({ intervalMs: 60, shakePx: 8 });
    expect(airRattle(30).intervalMs).toBeLessThan(airRattle(70).intervalMs);
  });
  it("shock shake lasts half a second", () => {
    expect(MATA_SHOCK_MS).toBe(500);
  });
});
