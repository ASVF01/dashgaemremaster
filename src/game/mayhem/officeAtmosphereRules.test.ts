import { describe, expect, it } from "vitest";
import { officeStormGain } from "./officeAtmosphereRules";

describe("Night 5 storm mixing", () => {
  it("plays during the unpowered first task", () => {
    expect(officeStormGain(1, false)).toBe(0.18);
  });
  it("ducks beneath audible office music after power returns", () => {
    expect(officeStormGain(1, true)).toBe(0.1);
  });
  it("follows SFX volume and stops on death", () => {
    expect(officeStormGain(0, false)).toBe(0);
    expect(officeStormGain(0.5, false)).toBe(0.09);
    expect(officeStormGain(1, true, false)).toBe(0);
  });
});