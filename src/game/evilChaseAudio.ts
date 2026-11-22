import bff1 from "@/assets/evil-chase/bff1.ogg.asset.json";
import bff2 from "@/assets/evil-chase/bff2.ogg.asset.json";
import bff3 from "@/assets/evil-chase/bff3.ogg.asset.json";
import bff4 from "@/assets/evil-chase/bff4.ogg.asset.json";
import { isBgmMuted, subscribeBgmMuted } from "./bgm";
import { getSettings } from "./settings";
import { radiusMix, type RadiusBand } from "./evilChaseRules";

export const BFF_URLS = [bff1.url, bff2.url, bff3.url, bff4.url];
// Original Ogg granule length, verified from all three supplied short stems.
// Chromium decodes an extra 992 padded frames; never loop that padding.
export const BFF_PHRASE_SECONDS = 419168 / 44100;
/** Align the long chase phrase to eight short bars, rounding only to sample frames. */
export function phraseFrames(shortFrames: number, index: number): number {
  return shortFrames * (index === 3 ? 8 : 1);
}

export class EvilChaseAudio {
  private context: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private gains: GainNode[] = [];
  private master: GainNode | null = null;
  private disposed = false;
  private active = false;
  private band: RadiusBand = 0;
  private lastVolume = -1;
  private unsubscribe: () => void;
  private abort = new AbortController();
  private unlock = () => {
    if (this.active && this.context?.state === "suspended") void this.context.resume().catch(() => {});
  };

  constructor() {
    this.unsubscribe = subscribeBgmMuted(() => this.updateVolume());
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
    void this.prepare();
  }

  private async prepare() {
    try {
      const context = new AudioContext();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = 0;
      this.master.connect(context.destination);
      const buffers = await Promise.all(BFF_URLS.map(async url => {
        const res = await fetch(url, { signal: this.abort.signal });
        if (!res.ok) throw new Error("Radius music unavailable");
        return context.decodeAudioData(await res.arrayBuffer());
      }));
      if (this.disposed) return;
      const when = context.currentTime + 0.04;
      buffers.forEach((buffer, index) => {
        // Ogg rounding may differ by a few frames. Align whole phrases without
        // crossfading away beats or inserting silence at the seam.
        const length = phraseFrames(Math.round(BFF_PHRASE_SECONDS * context.sampleRate), index);
        const aligned = context.createBuffer(buffer.numberOfChannels, length, context.sampleRate);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const input = buffer.getChannelData(ch), output = aligned.getChannelData(ch);
          output.set(input.subarray(0, length));
          for (let i = input.length; i < length; i++) output[i] = input[i % input.length];
        }
        const source = context.createBufferSource();
        source.buffer = aligned;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = aligned.duration;
        const gain = context.createGain();
        gain.gain.value = radiusMix(this.band)[index];
        source.connect(gain).connect(this.master ?? context.destination);
        source.start(when); // All four share one sample-accurate clock.
        this.sources.push(source); this.gains.push(gain);
      });
      this.updateVolume();
      if (!this.active) await context.suspend();
      else await context.resume();
    } catch (error) {
      if (!this.disposed) console.warn("Could not load evil-chase music", error);
    }
  }

  private updateVolume() {
    const volume = isBgmMuted() || !this.active ? 0 : getSettings().bgmVolume * 0.65;
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(volume, now, 0.04);
    }
    this.lastVolume = getSettings().bgmVolume;
  }

  setActive(active: boolean) {
    if (this.disposed) return;
    if (active !== this.active) {
      this.active = active;
      this.updateVolume();
      if (active) this.unlock();
      else if (this.context?.state === "running") void this.context.suspend().catch(() => {});
    }
    if (this.lastVolume !== getSettings().bgmVolume) this.updateVolume();
  }

  setBand(band: RadiusBand) {
    if (band === this.band || this.disposed) return;
    this.band = band;
    const context = this.context;
    if (!context) return;
    radiusMix(band).forEach((value, index) => {
      const gain = this.gains[index];
      if (!gain) return;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(value, now, band === 0 ? 0.08 : 0.035);
    });
  }

  dispose() {
    this.disposed = true;
    this.abort.abort(); this.unsubscribe();
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch { /* stopped */ } }
    for (const gain of this.gains) gain.disconnect();
    this.master?.disconnect();
    void this.context?.close().catch(() => {});
    this.sources = []; this.gains = [];
  }
}