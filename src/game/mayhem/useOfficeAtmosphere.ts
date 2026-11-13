import { useEffect, useRef } from "react";
import { isBgmMuted, subscribeBgmMuted } from "@/game/bgm";
import { useSettings } from "@/game/settings";
import { officeStormGain } from "./officeAtmosphereRules";

/** Office-owned muffled rain and slow wind; never touches shared outdoor loops. */
export function useOfficeAtmosphere(active: boolean, powered: boolean) {
  const [settings] = useSettings();
  const latest = useRef({ active, powered, settings });
  latest.current = { active, powered, settings };
  const syncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const context = new AudioContext();
    const output = context.createGain();
    output.gain.value = 0;
    output.connect(context.destination);
    const sources: AudioBufferSourceNode[] = [];
    const nodes: AudioNode[] = [output];
    const gust = context.createOscillator();
    gust.frequency.value = 0.09;
    const gustDepth = context.createGain();
    gustDepth.gain.value = 0.16;
    nodes.push(gust, gustDepth);

    for (const wind of [false, true]) {
      const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
      const data = buffer.getChannelData(0);
      let body = 0;
      for (let i = 0; i < data.length; i++) {
        const noise = Math.random() * 2 - 1;
        body += (noise - body) * (wind ? 0.025 : 0.12);
        data[i] = body * (wind ? 3 : 1.5) + (wind ? 0 : noise * 0.18);
      }
      // Blend the loop seam rather than periodically clicking against the walls.
      const seam = Math.floor(context.sampleRate * 0.06);
      for (let i = 0; i < seam; i++) {
        const t = i / seam;
        data[data.length - seam + i] = data[data.length - seam + i] * (1 - t) + data[i] * t;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const highpass = context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = wind ? 55 : 180;
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = wind ? 420 : 950;
      const layer = context.createGain();
      layer.gain.value = wind ? 0.38 : 0.7;
      if (wind) gust.connect(gustDepth).connect(layer.gain);
      source.connect(highpass).connect(lowpass).connect(layer).connect(output);
      source.start();
      sources.push(source);
      nodes.push(highpass, lowpass, layer);
    }
    gust.start();
    const sync = () => {
      const { active: running, powered: lights, settings: prefs } = latest.current;
      output.gain.setTargetAtTime(officeStormGain(prefs.sfxVolume,
        lights && !isBgmMuted() && prefs.bgmVolume > 0, running), context.currentTime, 0.65);
    };
    syncRef.current = sync;
    sync();
    const resume = () => {
      if (latest.current.active) void context.resume().catch(() => {});
    };
    resume();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    const unsubscribe = subscribeBgmMuted(sync);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      syncRef.current = null;
      sources.forEach((source) => { source.stop(); source.disconnect(); });
      gust.stop();
      nodes.forEach((node) => node.disconnect());
      void context.close().catch(() => {});
    };
  }, []);

  useEffect(() => { syncRef.current?.(); }, [active, powered, settings.sfxVolume, settings.bgmVolume]);
}