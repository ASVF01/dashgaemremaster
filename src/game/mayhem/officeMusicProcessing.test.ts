import { describe, expect, it } from "vitest";
import { crushOfficeChannel } from "./officeMusicProcessing";

describe("office soundtrack bitcrush", () => {
  it("reduces amplitude to five-bit steps instead of leaving clean audio", () => {
    const input = Float32Array.from([0.123, -0.234, 0.456, 1, -1]);
    const output = crushOfficeChannel(input, 6000);
    expect(Array.from(output)).toEqual([0.125, -0.25, 0.4375, 0.9375, -1]);
    expect(output).not.toEqual(input);
  });

  it("holds eight samples at 48 kHz without altering track length", () => {
    const input = Float32Array.from({ length: 17 }, (_, i) => i / 20);
    const output = crushOfficeChannel(input, 48000);
    expect(Array.from(output.slice(0, 8))).toEqual(Array(8).fill(0));
    expect(Array.from(output.slice(8, 16))).toEqual(Array(8).fill(0.375));
    expect(output[16]).toBe(0.8125);
    expect(output.length).toBe(input.length);
  });
});