import { describe, expect, it } from "vitest";
import { CHARACTER_ACTION_SOUNDS, usesCharacterActionSound } from "./characterSoundRules";

describe("M&M's Guy universal action sound", () => {
  it.each(CHARACTER_ACTION_SOUNDS)("uses the supplied sound for %s", (event) => {
    expect(usesCharacterActionSound("mmguy", event)).toBe(true);
  });
  it("does not replace other characters' footsteps", () => {
    expect(usesCharacterActionSound("stick", "step")).toBe(false);
    expect(usesCharacterActionSound("green", "run")).toBe(false);
  });
  it("leaves menu and environmental sounds alone", () => {
    expect(usesCharacterActionSound("mmguy", "menuClick")).toBe(false);
    expect(usesCharacterActionSound("mmguy", "rainStart")).toBe(false);
    expect(usesCharacterActionSound("mmguy", "bossRoar")).toBe(false);
  });
});