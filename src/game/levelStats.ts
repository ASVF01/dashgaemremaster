// Per-level personal best tracking. Stored in localStorage so it persists
// across sessions. Marathon is tracked separately (whole-run timer).
import { useEffect, useState } from "react";
import type { LevelId } from "@/game/level";

export type LevelStat = {
  bestTimeMs: number | null;
  bestScore: number;
  plays: number;
};

const KEY = "dashgaem_level_stats_v1";

export type LevelStats = Partial<Record<LevelId, LevelStat>>;

function load(): LevelStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LevelStats;
  } catch {
    return {};
  }
}

function save(s: LevelStats) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function recordLevelResult(id: LevelId, timeMs: number, score: number) {
  const s = load();
  const prev = s[id] ?? { bestTimeMs: null, bestScore: 0, plays: 0 };
  const next: LevelStat = {
    bestTimeMs: prev.bestTimeMs == null ? timeMs : Math.min(prev.bestTimeMs, timeMs),
    bestScore: Math.max(prev.bestScore, score),
    plays: prev.plays + 1,
  };
  s[id] = next;
  save(s);
  // notify listeners
  window.dispatchEvent(new CustomEvent("dashgaem-level-stats"));
}

export function useLevelStats(): LevelStats {
  const [stats, setStats] = useState<LevelStats>(() => load());
  useEffect(() => {
    const onUpdate = () => setStats(load());
    window.addEventListener("dashgaem-level-stats", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("dashgaem-level-stats", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);
  return stats;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const totalSec = ms / 1000;
  if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = (totalSec - m * 60).toFixed(2).padStart(5, "0");
    return `${m}:${s}`;
  }
  return `${totalSec.toFixed(2)}s`;
}
