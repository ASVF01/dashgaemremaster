import { useEffect, useRef } from "react";
import { isBgmMuted, pauseBgm, resumeBgm, subscribeBgmMuted } from "@/game/bgm";
import { useSettings } from "@/game/settings";
import officeTrack from "@/assets/audio/office_rotatatron.ogg.asset.json";

/** Dry, pre-crushed soundtrack owned by the office, not the console overlay. */
export function useOfficeMusic() {
  const [settings] = useSettings();
  const audio = useRef<HTMLAudioElement | null>(null);
  const volume = useRef(settings.bgmVolume);
  volume.current = settings.bgmVolume;

  useEffect(() => {
    const track = new Audio(officeTrack.url);
    track.loop = true;
    track.playbackRate = 0.82;
    track.preservesPitch = false;
    const sync = () => { track.volume = isBgmMuted() ? 0 : Math.max(0, Math.min(1, volume.current)) * 0.55; };
    sync();
    audio.current = track;
    pauseBgm();
    const play = () => { void track.play().catch(() => {}); };
    play();
    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    const unsubscribe = subscribeBgmMuted(sync);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
      track.pause();
      track.removeAttribute("src");
      track.load();
      audio.current = null;
      resumeBgm();
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.volume = isBgmMuted() ? 0 : Math.max(0, Math.min(1, settings.bgmVolume)) * 0.55;
  }, [settings.bgmVolume]);
}