import { describe, it, expect, beforeEach } from "vitest";
import { ssjAudio } from "./ssjAudio";

// Stand-in for the browser's <audio>: records what was started and stopped so
// the tests can see which cues are actually audible right now.
class FakeAudio {
  static created: FakeAudio[] = [];
  src: string;
  loop = false;
  volume = 1;
  paused = true;
  constructor(src: string) {
    this.src = src;
    FakeAudio.created.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const audible = () => FakeAudio.created.filter((a) => !a.paused && a.src !== "");

describe("Old Timer SSJ audio lifecycle", () => {
  beforeEach(() => {
    FakeAudio.created = [];
    (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
  });

  it("power-down stops the looping aura sound and plays the off cue", () => {
    ssjAudio.charge();
    ssjAudio.burst();
    expect(audible().length).toBeGreaterThan(0);
    ssjAudio.powerOff();
    const still = audible();
    expect(still.length).toBe(1);
    expect(still[0].src).toContain("ssj_off");
  });

  it("never plays the off cue when no transformation happened", () => {
    ssjAudio.stop();
    ssjAudio.powerOff();
    expect(audible().length).toBe(0);
  });
});
