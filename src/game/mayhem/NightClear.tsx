import { useEffect, useRef, useState } from "react";
import art from "@/assets/mayhem/completed-night.png.asset.json";
import sound from "@/assets/audio/night-complete.mp3.asset.json";
import { getSettings } from "@/game/settings";
import { isMuted, setMuted } from "@/game/sfx";
import { stopBgm } from "@/game/bgm";
import { NIGHT_CLEAR_DURATION, nightClearEnvelope, nightClearBeatScale } from "./nightClearTiming";

export default function NightClear({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [revealing, setRevealing] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const callbacks = useRef({ onReveal, onDone });
  callbacks.current = { onReveal, onDone };

  useEffect(() => {
    const previousMuted = isMuted();
    setMuted(true);
    stopBgm();
    const audio = new Audio(sound.url);
    audio.preload = "auto";
    audio.volume = getSettings().sfxVolume;
    let frame = 0;
    let revealTimer = 0;
    let cancelled = false;
    let fallbackStart: number | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let finished = false;
    const finish = () => {
      if (cancelled || finished) return;
      finished = true;
      audio.pause();
      callbacks.current.onReveal();
      setRevealing(true);
      revealTimer = window.setTimeout(() => callbacks.current.onDone(), 850);
    };
    const tick = () => {
      if (cancelled || finished) return;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : NIGHT_CLEAR_DURATION;
      const time = fallbackStart == null ? audio.currentTime : (performance.now() - fallbackStart) / 1000;
      const envelope = nightClearEnvelope(time, duration);
      audio.volume = getSettings().sfxVolume * envelope;
      // The exact same envelope drives both media; no independent fade timer.
      if (image.current) {
        image.current.style.opacity = String(envelope);
        image.current.style.setProperty("--night-clear-scale", String(reducedMotion.matches ? 1 : nightClearBeatScale(time)));
      }
      if (time >= duration || audio.ended) finish();
      else frame = requestAnimationFrame(tick);
    };
    audio.onended = finish;
    const fallback = () => { if (fallbackStart == null) fallbackStart = performance.now(); };
    audio.onerror = fallback;
    audio.play().catch(fallback);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(revealTimer);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setMuted(previousMuted);
    };
  }, []);

  return (
    <div className={`night-clear-screen absolute inset-0 z-[70] flex items-center justify-center overflow-hidden ${revealing ? "night-clear-reveal" : ""}`} role="status" aria-label="Night complete">
      {!revealing && <div className="night-clear-motion flex w-full justify-center"><img ref={image} src={art.url} alt="Night complete" className="night-clear-art w-[min(90%,900px)] max-h-[75vh] object-contain" draggable={false} /></div>}
    </div>
  );
}