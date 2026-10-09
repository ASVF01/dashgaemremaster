// MAYHEM — 12×12 night grid. Characters spawn on the top row at random
// columns and wander (4 directions only) toward the office at the bottom
// middle. Movement chance per roll scales with the night's AI level.
import { useEffect, useRef, useState } from "react";

export const GRID_SIZE = 12;
export const OFFICE_CELL = { x: 5, y: GRID_SIZE - 1 } as const;
export const GRID_ROLL_MS = 5000;

export interface GridCharacterDef {
  id: string;
  name: string;
  /** Short tag drawn on the map. */
  tag: string;
  /** CSS color token (hsl var) for the marker. */
  color: string;
  enabled: boolean;
}

/** Future enemies plug in here — flip `enabled` once their rules exist. */
export const GRID_ROSTER: GridCharacterDef[] = [
  { id: "gifted", name: "THE GIFTED", tag: "TG", color: "hsl(var(--hell-warning))", enabled: false },
  { id: "anydroid", name: "ANYDROID - B", tag: "AB", color: "hsl(200 80% 60%)", enabled: false },
  { id: "neokid", name: "NEO - KID", tag: "NK", color: "hsl(50 90% 55%)", enabled: false },
  { id: "neomata", name: "NEO - MATA", tag: "NM", color: "hsl(300 60% 60%)", enabled: false },
];

export interface GridCharacter extends GridCharacterDef { x: number; y: number }

/** Night 1 → ~10% per roll, ramping to ~40% by night 4 (AI level / 20). */
export function moveChance(aiLevel: number) {
  return Math.min(1, Math.max(0, aiLevel / 20));
}

const DIRS = [
  { dx: 0, dy: 1, w: 3 },   // down (away from the top)
  { dx: -1, dy: 0, w: 1.5 },
  { dx: 1, dy: 0, w: 1.5 },
  { dx: 0, dy: -1, w: 0.4 }, // rarely back up
];

export function stepCharacter(c: { x: number; y: number }, rand = Math.random) {
  const options = DIRS.filter((d) => {
    const nx = c.x + d.dx, ny = c.y + d.dy;
    return nx >= 0 && ny >= 0 && nx < GRID_SIZE && ny < GRID_SIZE;
  });
  const total = options.reduce((s, d) => s + d.w, 0);
  let r = rand() * total;
  for (const d of options) {
    r -= d.w;
    if (r <= 0) return { x: c.x + d.dx, y: c.y + d.dy };
  }
  const d = options[options.length - 1];
  return { x: c.x + d.dx, y: c.y + d.dy };
}

function spawnRoster(): GridCharacter[] {
  const cols = Array.from({ length: GRID_SIZE }, (_, i) => i).sort(() => Math.random() - 0.5);
  return GRID_ROSTER.filter((d) => d.enabled).map((d, i) => ({ ...d, x: cols[i % GRID_SIZE], y: 0 }));
}

export function useGridRoster(aiLevel: number, active: boolean, paused: boolean) {
  const [characters, setCharacters] = useState<GridCharacter[]>(spawnRoster);
  const [moveCount, setMoveCount] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const chance = moveChance(aiLevel);
      let moved = false;
      setCharacters((list) => list.map((c) => {
        if (c.x === OFFICE_CELL.x && c.y === OFFICE_CELL.y) return c;
        if (Math.random() >= chance) return c;
        moved = true;
        return { ...c, ...stepCharacter(c) };
      }));
      if (moved) setMoveCount((n) => n + 1);
    }, GRID_ROLL_MS);
    return () => window.clearInterval(id);
  }, [aiLevel, active]);

  return { characters, moveCount };
}
