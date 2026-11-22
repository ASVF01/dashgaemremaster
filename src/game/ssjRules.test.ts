import { describe, it, expect } from "vitest";
import { ssjPhase, ssjZoom, ssjShakeX, ssjExpired, SSJ_DURATION } from "./ssjRules";

describe("Old Timer SSJ transformation", () => {
  it("charges for 1.3s, then screams", () => {
    expect(ssjPhase(1.29)).toBe("charge");
    expect(ssjPhase(1.31)).toBe("scream");
    expect(ssjPhase(3)).toBe("done");
  });
  it("zooms in during the charge and snaps back out at 1.3s", () => {
    expect(ssjZoom(1.29)).toBeGreaterThan(1.4);
    expect(ssjZoom(1.3)).toBeLessThan(1);
  });
  it("only shakes during the scream", () => {
    expect(ssjShakeX(0.5)).toBe(0);
    expect(ssjShakeX(1.31)).not.toBe(0);
  });
  it("holds the transformed state for 20 seconds, then expires", () => {
    expect(SSJ_DURATION).toBe(20);
    expect(ssjExpired(0)).toBe(false);
    expect(ssjExpired(19.98)).toBe(false);
    expect(ssjExpired(20)).toBe(true);
  });
});
