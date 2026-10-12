import { describe, expect, it } from "vitest";
import { characterPage, CHARACTER_SELECT_HOLD_MS } from "./characterSelectRules";

describe("character select rules", () => {
  it("keeps actual characters on page one", () => {
    for (const id of ["stick", "dasher", "shadow", "x3mode"] as const) {
      expect(characterPage(id)).toBe(1);
    }
  });
  it("keeps the joke characters on the joke page", () => {
    expect(characterPage("mmguy")).toBe(2);
    expect(characterPage("green")).toBe(2);
  });
  it("holds entry borders closed for three seconds", () => {
    expect(CHARACTER_SELECT_HOLD_MS).toBe(3000);
  });
});