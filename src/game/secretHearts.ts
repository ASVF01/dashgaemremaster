// Secret hearts hidden in INK ALLEY, PAPER CUTS and OVERDRIVE. Finding all
// three and beating every other level unlocks THE HEARTBREAKER.
import { useEffect, useState } from "react";
import type { LevelId, LevelMeta } from "@/game/level";
import type { LevelStats } from "@/game/levelStats";

export const HEART_LEVELS: LevelId[] = ["scribble-1", "scribble-2", "scribble-3"];
const KEY = "dashgaem_secret_hearts_v1";
const EVT = "dashgaem-secret-hearts";

export function loadHearts(): LevelId[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function collectHeart(id: LevelId) {
  const h = loadHearts();
  if (h.includes(id)) return;
  try { localStorage.setItem(KEY, JSON.stringify([...h, id])); } catch { /* noop */ }
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* noop */ }
}
export function useHearts(): LevelId[] {
  const [h, setH] = useState(loadHearts);
  useEffect(() => {
    const on = () => setH(loadHearts());
    window.addEventListener(EVT, on); window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  return h;
}

/** Levels that must be beaten: every visible, playable level except the secret boss and the marathon. */
export function requiredLevels(levels: LevelMeta[]): LevelId[] {
  return levels.filter(l => !l.hidden && !l.locked && l.id !== "heartbreaker" && l.id !== "celestial-marathon").map(l => l.id);
}

export function heartbreakerUnlocked(levels: LevelMeta[], stats: LevelStats, hearts: LevelId[]): boolean {
  return requiredLevels(levels).every(id => (stats[id]?.plays ?? 0) > 0) && HEART_LEVELS.every(id => hearts.includes(id));
}

/** Heart spot: just above the highest platform, a reward for climbing. */
export function secretHeartSpot(platforms: { x: number; y: number; w: number }[]): { x: number; y: number } | null {
  if (!platforms.length) return null;
  const top = platforms.reduce((a, b) => (b.y < a.y ? b : a));
  return { x: top.x + top.w / 2, y: top.y - 45 };
}
