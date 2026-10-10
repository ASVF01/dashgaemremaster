import { describe, expect, it } from "vitest";
import { stoneScrapeActive, usesCharacterActionSound, usesCharacterVoice } from "./characterSoundRules";

describe("M&M's Guy movement sound", () => {
  it.each(["jump", "dash", "superDash", "diveImpact"])("plays his voice for %s", (event) => {
    expect(usesCharacterVoice("mmguy", event)).toBe(true);
    expect(usesCharacterVoice("stick", event)).toBe(false);
  });
  it.each(["land", "slide", "step", "run", "hit", "shoot"])("does not play his voice for %s", (event) => {
    expect(usesCharacterVoice("mmguy", event)).toBe(false);
  });
  it("scrapes while moving on ground, including sliding", () => {
    expect(stoneScrapeActive("mmguy", true, 100, true)).toBe(true);
    expect(stoneScrapeActive("mmguy", true, -500, true)).toBe(true);
  });
  it("never scrapes in midair", () => {
    expect(stoneScrapeActive("mmguy", false, 500, true)).toBe(false);
  });
  it("stops at rest or when gameplay stops", () => {
    expect(stoneScrapeActive("mmguy", true, 0, true)).toBe(false);
    expect(stoneScrapeActive("mmguy", true, 500, false)).toBe(false);
    expect(stoneScrapeActive("stick", true, 500, true)).toBe(false);
  });
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