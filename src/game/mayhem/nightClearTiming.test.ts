import { describe, expect, it } from "vitest";
import { nightClearEnvelope, NIGHT_CLEAR_DURATION, nightClearBeatScale, NIGHT_CLEAR_FIRST_BEAT } from "./nightClearTiming";

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

describe("night-clear soundtrack beats", () => {
  it("starts on the completion track's first beat and repeats at 120 BPM", () => {
    expect(nightClearBeatScale(0)).toBe(1);
    expect(nightClearBeatScale(NIGHT_CLEAR_FIRST_BEAT)).toBeCloseTo(1.065);
    expect(nightClearBeatScale(NIGHT_CLEAR_FIRST_BEAT + 0.5)).toBeCloseTo(1.065);
    expect(nightClearBeatScale(NIGHT_CLEAR_FIRST_BEAT + 0.35)).toBe(1);
  });
  it("relaxes to original size without undershooting between beats", () => {
    const scales = Array.from({ length: 50 }, (_, i) => nightClearBeatScale(NIGHT_CLEAR_FIRST_BEAT + i / 100));
    expect(Math.min(...scales)).toBe(1);
    expect(scales[10]).toBeLessThan(scales[0]);
    expect(scales[20]).toBeLessThan(scales[10]);
  });
});