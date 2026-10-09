import { useEffect, useRef, type RefObject } from "react";
import glitchy from "@/assets/audio/generator-amen-glitchy.wav.asset.json";
import fury from "@/assets/audio/generator-amen-fury.wav.asset.json";
import { setNightBgmDuck } from "./nightAudio";
import { crushGeneratorSamples, generatorBeatPulse, GENERATOR_BEAT_SECONDS, generatorMusicState } from "./generatorMusicRules";

type Track = "glitchy" | "fury";
const urls = { glitchy: glitchy.url, fury: fury.url };
const rawBuffers = new Map<Track, Promise<ArrayBuffer>>();

class GeneratorMusic {
  private context = new AudioContext();
  private master = this.context.createGain();
  private buffers = new Map<Track, AudioBuffer>();
  private sources = new Map<Track, { source: AudioBufferSourceNode; gain: GainNode }>();
  private state = generatorMusicState(0);
  private active = true;
  private paused = false;
  private disposed = false;
  private volume = 0;
  private musicSeconds = 0;
  private lastClock = 0;

  beatPulse() {
    const now = this.context.currentTime;
    const source = this.sources.get("glitchy")?.source;
    if (source) this.musicSeconds += Math.max(0, now - this.lastClock) * source.playbackRate.value;
    this.lastClock = now;
    return this.active && !this.paused && source ? generatorBeatPulse(this.state.track === "fury" ? 50 : 0, this.musicSeconds) : 0;
  }

  constructor() {
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    for (const track of ["glitchy", "fury"] as const) {
      let request = rawBuffers.get(track);
      if (!request) {
        request = fetch(urls[track]).then((response) => {
          if (!response.ok) throw new Error("Generator music unavailable");
          return response.arrayBuffer();
        });
        rawBuffers.set(track, request);
      }
      void request.then(async (data) => {
        if (this.disposed) return;
        const decoded = await this.context.decodeAudioData(data.slice(0));
        if (this.disposed) return;
        const crushed = this.context.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          crushed.getChannelData(channel).set(crushGeneratorSamples(decoded.getChannelData(channel)));
        }
        this.buffers.set(track, crushed);
        this.sync();
      }).catch(() => { rawBuffers.delete(track); });
    }
  }

  update(percent: number, active: boolean, paused: boolean, volume: number) {
    this.state = generatorMusicState(percent);
    this.active = active;
    this.volume = Math.max(0, Math.min(1, volume)) * 0.55;
    if (paused !== this.paused) {
      this.paused = paused;
      if (paused) void this.context.suspend().catch(() => {});
      else void this.context.resume().catch(() => {});
    }
    this.sync();
  }

  private sync() {
    if (this.disposed) return;
    const c = this.context;
    const track = this.state.track;
    if (this.active && this.buffers.size === 2 && this.sources.size === 0) {
      const startAt = c.currentTime + 0.02;
      this.lastClock = startAt;
      for (const id of ["glitchy", "fury"] as const) {
      const buffer = this.buffers.get(id);
      if (!buffer) continue;
      const source = c.createBufferSource();
      const gain = c.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopEnd = GENERATOR_BEAT_SECONDS * 16;
      source.playbackRate.value = this.state.rate;
      gain.gain.value = 0;
      source.connect(gain).connect(this.master);
      this.sources.set(id, { source, gain });
      source.start(startAt);
      }
      if (!this.paused) void c.resume().catch(() => {});
    }
    const ready = this.sources.has(track);
    for (const [id, layer] of this.sources) {
      layer.source.playbackRate.setTargetAtTime(this.state.rate, c.currentTime, 0.06);
      layer.gain.gain.setTargetAtTime(id === track || !ready ? 1 : 0, c.currentTime, 0.035);
    }
    this.master.gain.setTargetAtTime(this.active ? this.volume : 0, c.currentTime, this.active ? 0.2 : 0.1);
    setNightBgmDuck(this.active && ready ? 0 : 1);
  }

  dispose() {
    this.disposed = true;
    setNightBgmDuck(1);
    const c = this.context;
    void c.resume().catch(() => {});
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setTargetAtTime(0, c.currentTime, 0.1);
    for (const { source } of this.sources.values()) source.stop(c.currentTime + 0.5);
    window.setTimeout(() => { void c.close().catch(() => {}); }, 550);
  }
}

export function useGeneratorMusic(percent: number, active: boolean, paused: boolean, volume: number, beatRef?: RefObject<HTMLDivElement>) {
  const music = useRef<GeneratorMusic | null>(null);
  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
    const controller = new GeneratorMusic();
    music.current = controller;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const tick = () => {
      const pulse = controller.beatPulse();
      beatRef?.current?.style.setProperty("--gen-beat", String(reduced.matches ? 0 : pulse));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); controller.dispose(); music.current = null; };
  }, [beatRef]);
  useEffect(() => { music.current?.update(percent, active, paused, volume); }, [percent, active, paused, volume]);
}