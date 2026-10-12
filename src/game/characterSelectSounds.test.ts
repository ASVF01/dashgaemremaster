import { describe, expect, it } from "vitest";
import { sfx } from "./sfx";

// The character select uses three supplied samples:
// click = picking a character or flipping a page, negative = locked/not-ready
// characters, hover = hovering any UI in character select.
describe("character select sounds", () => {
  it("exposes the three supplied character-select cues", () => {
    expect(typeof sfx.charSelectClick).toBe("function");
    expect(typeof sfx.charSelectNegative).toBe("function");
    expect(typeof sfx.charSelectHover).toBe("function");
  });

  it("plays safely without an AudioContext (no crash in test env)", () => {
    expect(() => sfx.charSelectClick()).not.toThrow();
    expect(() => sfx.charSelectNegative()).not.toThrow();
    expect(() => sfx.charSelectHover()).not.toThrow();
  });
});
