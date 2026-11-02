import { describe, expect, it } from "vitest";
import { sfx } from "./sfx";

// The three core UI cues are synthesized with clean two-operator FM voices
// (no samples, no generative audio): a glassy hover chirp, a rising E5 -> B5
// confirm bell, and a muted descending back blip.
describe("clean FM UI sounds", () => {
  it("exposes the three UI cues", () => {
    expect(typeof sfx.menuHover).toBe("function");
    expect(typeof sfx.menuConfirm).toBe("function");
    expect(typeof sfx.menuBack).toBe("function");
  });

  it("plays safely without an AudioContext (no crash in test env)", () => {
    expect(() => sfx.menuHover()).not.toThrow();
    expect(() => sfx.menuConfirm()).not.toThrow();
    expect(() => sfx.menuBack()).not.toThrow();
  });
});
