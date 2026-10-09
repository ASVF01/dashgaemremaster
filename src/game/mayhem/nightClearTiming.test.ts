import { describe, expect, it } from "vitest";
import { nightClearEnvelope, NIGHT_CLEAR_DURATION } from "./nightClearTiming";

describe("night-clear synchronized fade", () => {
  it("holds the picture and sound until the final two seconds", () => {
    expect(nightClearEnvelope(0)).toBe(1);
    expect(nightClearEnvelope(NIGHT_CLEAR_DURATION - 2)).toBe(1);
  });
  it("fades the picture and sound together to zero", () => {
    expect(nightClearEnvelope(NIGHT_CLEAR_DURATION - 1)).toBeCloseTo(0.5);
    expect(nightClearEnvelope(NIGHT_CLEAR_DURATION)).toBe(0);
    expect(nightClearEnvelope(NIGHT_CLEAR_DURATION + 1)).toBe(0);
  });
});