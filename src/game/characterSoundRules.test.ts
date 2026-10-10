import { describe, expect, it } from "vitest";
import { CHARACTER_ACTION_SOUNDS, usesCharacterActionSound } from "./characterSoundRules";

describe("M&M's Guy movement sound", () => {
  it.each(["jump", "land", "slide", "slideEnd", "step", "run", "skid", "mach", "superDash", "dash"])("uses the supplied sound for %s", (event) => {
    expect(usesCharacterActionSound("mmguy", event)).toBe(true);
  });
  it.each(["parryStart", "parryHit", "hit", "chaserHit", "fatalHit", "enemyKill", "pickup", "shoot", "win", "die", "glassShatter", "spawnWhoosh", "laserStart"])("keeps the original %s sound", (event) => {
    expect(usesCharacterActionSound("mmguy", event)).toBe(false);
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