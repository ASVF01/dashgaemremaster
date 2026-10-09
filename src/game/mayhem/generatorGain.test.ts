import { describe, expect, it } from "vitest";
import { advanceGenerator } from "./generatorGain";

describe("generator progress by night", () => {
  it("awards 5% per puzzle on Night 1", () => {
    expect(advanceGenerator(10, 1)).toBe(15);
  });
  it("awards 4% per puzzle on Night 2", () => {
    expect(advanceGenerator(10, 2)).toBe(14);
  });
  it("awards 3.5% per puzzle on Night 3", () => {
    expect(advanceGenerator(10, 3)).toBe(13.5);
  });
  it("awards 3% per puzzle on Night 4", () => {
    expect(advanceGenerator(10, 4)).toBe(13);
  });
  it("caps completion at 100% including fractional gains", () => {
    expect(advanceGenerator(98, 3)).toBe(100);
  });
});