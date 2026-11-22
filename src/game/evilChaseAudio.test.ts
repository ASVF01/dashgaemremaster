import { afterEach, describe, expect, it, vi } from "vitest";
import { EvilChaseAudio, phraseFrames, BFF_PHRASE_SECONDS } from "./evilChaseAudio";

vi.mock("./bgm", () => ({ isBgmMuted: () => false, subscribeBgmMuted: () => () => {} }));
vi.mock("./settings", () => ({ getSettings: () => ({ bgmVolume: 0.7 }) }));

afterEach(() => vi.unstubAllGlobals());

describe("radius soundtrack", () => {
  it("aligns BFF4 to precisely eight BFF1 phrases", () => {
    expect(BFF_PHRASE_SECONDS * 44100).toBe(419168);
    expect(phraseFrames(419168, 0)).toBe(419168);
    expect(phraseFrames(419168, 1)).toBe(419168);
    expect(phraseFrames(419168, 2)).toBe(419168);
    expect(phraseFrames(419168, 3)).toBe(3353344);
  });

  it("starts all four native gapless loops on one clock and releases every source on exit", async () => {
    const sources: { loop: boolean; loopStart: number; loopEnd: number; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }[] = [];
    const close = vi.fn(async () => {});
    const makeGain = () => ({ gain: { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
    const buffer = { numberOfChannels: 1, length: 64, duration: 64 / 44100, getChannelData: () => new Float32Array(64) };
    class Context {
      currentTime = 12; sampleRate = 44100; state = "running"; destination = {};
      close = close; suspend = vi.fn(async () => {}); resume = vi.fn(async () => {});
      createGain = makeGain;
      decodeAudioData = vi.fn(async () => buffer);
      createBuffer = (_channels: number, length: number) => ({ ...buffer, length, duration: length / 44100, getChannelData: () => new Float32Array(length) });
      createBufferSource = () => {
        const s = { loop: false, loopStart: 0, loopEnd: 0, start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(() => ({ connect: vi.fn() })) };
        sources.push(s); return s;
      };
    }
    vi.stubGlobal("AudioContext", Context);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
    const audio = new EvilChaseAudio();
    audio.setActive(true);
    await vi.waitFor(() => expect(sources).toHaveLength(4));
    for (const source of sources) {
      expect(source.loop).toBe(true);
      expect(source.start).toHaveBeenCalledWith(12.04);
      expect(source.loopStart).toBe(0);
    }
    expect(sources[3].loopEnd).toBe(sources[0].loopEnd * 8);
    expect(sources[0].loopEnd).toBe(419168 / 44100);
    audio.dispose();
    for (const source of sources) expect(source.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});