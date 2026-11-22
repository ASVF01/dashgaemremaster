import { describe, it, expect } from "vitest";
import { usesSaiyanAura } from "./saiyanAura";

describe("invboi aura", () => {
  it("Old Timer gets the golden aura", () => expect(usesSaiyanAura("oldtimer")).toBe(true));
  it("classic characters keep the rainbow look", () => {
    for (const id of ["stick", "green", "dasher", "shadow", "x3mode", "mmguy"] as const) expect(usesSaiyanAura(id)).toBe(false);
  });
});
