// Lightweight settings store with localStorage persistence and a tiny
// pub/sub so the game loop can read live values without re-rendering React.
import { useEffect, useState } from "react";

export type Settings = {
  /** Block jumping while in the slide state (prevents slide-jump spam). */
  noJumpWhileSliding: boolean;
  /** Show on-screen FPS counter. */
  showFps: boolean;
  /** Reduce screen shake intensity. */
  reduceShake: boolean;
  /** Reduce particle/glitch fx for performance / motion sensitivity. */
  reducedFx: boolean;
  /** Play a faint heartbeat sound when HP is critical (1). */
  lowHpHeartbeat: boolean;
  /** Master SFX volume 0..1. */
  sfxVolume: number;
  /** Master BGM volume 0..1. */
  bgmVolume: number;
};

export const DEFAULT_SETTINGS: Settings = {
  noJumpWhileSliding: true,
  showFps: false,
  reduceShake: false,
  reducedFx: false,
  lowHpHeartbeat: true,
  sfxVolume: 0.7,
  bgmVolume: 0.7,
};

const KEY = "dashgaem_settings_v1";

let current: Settings = loadInitial();
const listeners = new Set<(s: Settings) => void>();

function loadInitial(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* noop */ }
}

export function getSettings(): Settings { return current; }

export function setSettings(next: Partial<Settings>) {
  current = { ...current, ...next };
  persist();
  listeners.forEach((l) => l(current));
}

export function resetSettings() {
  current = { ...DEFAULT_SETTINGS };
  persist();
  listeners.forEach((l) => l(current));
}

export function useSettings(): [Settings, (next: Partial<Settings>) => void, () => void] {
  const [state, setState] = useState<Settings>(current);
  useEffect(() => {
    const fn = (s: Settings) => setState(s);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return [state, setSettings, resetSettings];
}
