// Background music player. Per-level tracks, gapless looping via HTMLAudioElement.loop.
import bgmTutorial from "@/assets/audio/bgm_tutorial.mp3";
import type { LevelId } from "@/game/level";

const TRACKS: Partial<Record<LevelId, string>> = {
  tutorial: bgmTutorial,
};

let current: HTMLAudioElement | null = null;
let currentSrc: string | null = null;
let muted = false;
let volume = 0.35;

function ensureAudio(src: string): HTMLAudioElement {
  if (current && currentSrc === src) return current;
  // tearing down a previous track
  if (current) {
    current.pause();
    current.src = "";
  }
  const a = new Audio(src);
  a.loop = true;        // gapless loop on the same element
  a.preload = "auto";
  a.volume = muted ? 0 : volume;
  current = a;
  currentSrc = src;
  return a;
}

export function playBgmFor(levelId: LevelId) {
  const src = TRACKS[levelId];
  if (!src) {
    stopBgm();
    return;
  }
  const a = ensureAudio(src);
  // Some browsers may reject autoplay until a user gesture — caller usually
  // invokes this from a click (Play button) so this should be fine.
  const p = a.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

export function stopBgm() {
  if (current) {
    current.pause();
    current.currentTime = 0;
  }
}

export function pauseBgm() {
  if (current) current.pause();
}

export function resumeBgm() {
  if (current) {
    const p = current.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }
}

export function setBgmMuted(v: boolean) {
  muted = v;
  if (current) current.volume = muted ? 0 : volume;
}

export function setBgmVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (current && !muted) current.volume = volume;
}
