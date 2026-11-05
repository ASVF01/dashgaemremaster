import { describe, expect, it } from "vitest";
import { canExitNightTitle, NIGHT_STATIC_MS, NIGHT_TITLE_HOLD_MS } from "./nightIntroRules";

describe("authored night start", () => {
  it("shows static for 0.5 seconds", () => expect(NIGHT_STATIC_MS).toBe(500));
  it("holds entered text for 3.5 seconds", () => {
    expect(NIGHT_TITLE_HOLD_MS).toBe(3500);
    expect(canExitNightTitle(4599, true)).toBe(false);
    expect(canExitNightTitle(4600, true)).toBe(true);
  });
  it("cannot finish while assets are still loading", () => {
    expect(canExitNightTitle(99999, false)).toBe(false);
    expect(canExitNightTitle(99999, true)).toBe(true);
  });
});