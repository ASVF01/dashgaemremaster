import { describe, expect, it } from "vitest";
import { characterPage, CHARACTER_SELECT_HOLD_MS } from "./characterSelectRules";

describe("character select rules", () => {
  it("keeps actual characters on page one", () => {
    for (const id of ["stick", "green", "dasher", "shadow", "x3mode"] as const) {
      expect(characterPage(id)).toBe(1);
    }
  });
  it("keeps M&M's Guy on the joke page", () => {
    expect(characterPage("mmguy")).toBe(2);
  });
  it("holds entry borders closed for three seconds", () => {
    expect(CHARACTER_SELECT_HOLD_MS).toBe(3000);
  });
});