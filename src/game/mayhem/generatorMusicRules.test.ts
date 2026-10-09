import { describe, expect, it } from "vitest";
import { crushGeneratorSamples, generatorBeatPulse, generatorMusicState } from "./generatorMusicRules";

describe("generator soundtrack", () => {
  it("enables button beats only at 50% and repeats them at 170 BPM", () => {
    expect(generatorBeatPulse(49.99, 0)).toBe(0);
    expect(generatorBeatPulse(50, 0)).toBe(1);
    expect(generatorBeatPulse(50, 60 / 170)).toBeCloseTo(1);
    expect(generatorBeatPulse(75, 30 / 170)).toBe(0);
  });
  it("starts slow and accelerates toward original speed by 50%", () => {
    expect(generatorMusicState(0).rate).toBeCloseTo(0.65);
    expect(generatorMusicState(25).rate).toBeCloseTo(0.825);
    expect(generatorMusicState(50).rate).toBe(1);
  });
  it("switches from Glitchy to Fury at exactly 50%", () => {
    expect(generatorMusicState(49.99).track).toBe("glitchy");
    expect(generatorMusicState(50).track).toBe("fury");
  });
  it("keeps Fury at original speed for the rest of the generator", () => {
    expect(generatorMusicState(75)).toEqual({ track: "fury", rate: 1 });
    expect(generatorMusicState(100)).toEqual({ track: "fury", rate: 1 });
  });
  it("bitcrushes samples using quantization and sample hold", () => {
    const input = new Float32Array([0.11, 0.2, 0.3, 0.4, -0.23]);
    expect(Array.from(crushGeneratorSamples(input))).toEqual([0.125, 0.125, 0.125, 0.125, -0.21875]);
  });
});