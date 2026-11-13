import { useEffect, useRef } from "react";
import { isBgmMuted, pauseBgm, resumeBgm, subscribeBgmMuted } from "@/game/bgm";
import { useSettings } from "@/game/settings";
import officeTrack from "@/assets/audio/office_rotatatron.ogg.asset.json";
import { crushOfficeChannel } from "./officeMusicProcessing";

/** Dry, genuinely bitcrushed soundtrack owned by the office, not its console. */
export function useOfficeMusic(active = true) {
  const activeRef = useRef(active); activeRef.current = active;
  const startRef = useRef<(() => void) | null>(null);
  const [settings] = useSettings();
  const gain = useRef<GainNode | null>(null);
  const volume = useRef(settings.bgmVolume);
  volume.current = settings.bgmVolume;

  useEffect(() => {
    const context = new AudioContext();
    const output = context.createGain();
    output.connect(context.destination);
    gain.current = output;
    let source: AudioBufferSourceNode | null = null;
    let disposed = false;
    const abort = new AbortController();
    const sync = () => {
      output.gain.value = isBgmMuted() ? 0 : Math.max(0, Math.min(1, volume.current)) * 0.55;
    };
    sync();
    pauseBgm();
    const play = () => {
      if (!disposed && activeRef.current) void context.resume().catch(() => {});
    };
    const load = async () => {
      try {
        const response = await fetch(officeTrack.url, { signal: abort.signal });
        if (!response.ok) throw new Error(`Office music load failed (${response.status})`);
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        if (disposed) return;
        const crushed = context.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          crushed.getChannelData(channel).set(crushOfficeChannel(decoded.getChannelData(channel), decoded.sampleRate));
        }
        source = context.createBufferSource();
        source.buffer = crushed;
        source.loop = true;
        source.playbackRate.value = 0.82;
        source.connect(output);
        const src = source;
        let started = false;
        startRef.current = () => {
          if (disposed || !activeRef.current) return;
          if (!started) {
            started = true;
            src.start();
          }
          play();
        };
        if (activeRef.current) startRef.current();
      } catch (error) {
        if (!disposed) console.warn("Office soundtrack could not load", error);
      }
    };
    void load();
    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    const unsubscribe = subscribeBgmMuted(sync);
    return () => {
      disposed = true;
      abort.abort();
      unsubscribe();
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
      try { source?.stop(); } catch { /* never started */ }
      source?.disconnect();
      output.disconnect();
      gain.current = null;
      startRef.current = null;
      void context.close().catch(() => {});
      resumeBgm();
    };
  }, []);

  // Music waits for its cue (Task 1 finished), then starts from the top.
  useEffect(() => {
    if (active) {
      startRef.current?.();
    } else if (gain.current?.context.state === "running") {
      void gain.current.context.suspend().catch(() => {});
    }
  }, [active]);

  useEffect(() => {
    if (gain.current) gain.current.gain.value = isBgmMuted() ? 0 : Math.max(0, Math.min(1, settings.bgmVolume)) * 0.55;
  }, [settings.bgmVolume]);
}
