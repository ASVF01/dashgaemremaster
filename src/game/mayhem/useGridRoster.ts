// MAYHEM — 12×12 night grid. Characters spawn on the top row at random
// columns and wander (4 directions only) toward the hall entry at the bottom
// middle. Movement chance per roll scales with the night's AI level. Reaching
// the hall entry, an enemy waits one roll, then steps into the hallway.
import { useCallback, useEffect, useRef, useState } from "react";

export const GRID_SIZE = 12;
export const OFFICE_CELL = { x: 5, y: GRID_SIZE - 1 } as const;
export const GRID_ROLL_MS = 5000;

export type GridEnemyId = "gifted" | "anydroid" | "neokid" | "neomata";

export interface GridCharacterDef {
  id: GridEnemyId;
  name: string;
  tag: string;
  color: string;
  /** Nights on which this enemy hunts. */
  nights: number[];
}

/** Future enemies plug in here — add nights once their rules exist. */
export const GRID_ROSTER: GridCharacterDef[] = [
  { id: "gifted", name: "THE GIFTED", tag: "TG", color: "hsl(var(--hell-warning))", nights: [2, 3, 4] },
  { id: "anydroid", name: "ANYDROID - B", tag: "AB", color: "hsl(200 80% 60%)", nights: [2, 3, 4] },
  { id: "neokid", name: "NEO - KID", tag: "NK", color: "hsl(50 90% 55%)", nights: [] },
  { id: "neomata", name: "NEO - MATA", tag: "NM", color: "hsl(300 60% 60%)", nights: [] },
];

export interface GridCharacter extends GridCharacterDef { x: number; y: number; inHall: boolean }

export function rosterForNight(night: number) {
  return GRID_ROSTER.filter((d) => d.nights.includes(night));
}

/** Night 1 → ~10% per roll, ramping to ~40% by night 4 (AI level / 20). */
export function moveChance(aiLevel: number) {
  return Math.min(1, Math.max(0, aiLevel / 20));
}

const DIRS = [
  { dx: 0, dy: 1, w: 3 },
  { dx: -1, dy: 0, w: 1.5 },
  { dx: 1, dy: 0, w: 1.5 },
  { dx: 0, dy: -1, w: 0.4 },
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

const atEntry = (c: { x: number; y: number }) => c.x === OFFICE_CELL.x && c.y === OFFICE_CELL.y;

function spawnRoster(night: number): GridCharacter[] {
  const cols = Array.from({ length: GRID_SIZE }, (_, i) => i).sort(() => Math.random() - 0.5);
  return rosterForNight(night).map((d, i) => ({ ...d, x: cols[i % GRID_SIZE], y: 0, inHall: false }));
}

export function useGridRoster(night: number, aiLevel: number, active: boolean, paused: boolean) {
  const [characters, setCharacters] = useState<GridCharacter[]>(() => spawnRoster(night));
  const [moveCount, setMoveCount] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const chance = moveChance(aiLevel);
      let moved = false;
      setCharacters((list) => {
        const hallTaken = list.some((c) => c.inHall);
        let entered = hallTaken;
        return list.map((c) => {
          if (c.inHall) return c;
          if (atEntry(c)) {
            // Only one enemy works the hallway at a time.
            if (entered) return c;
            entered = true;
            return { ...c, inHall: true };
          }
          if (Math.random() >= chance) return c;
          moved = true;
          return { ...c, ...stepCharacter(c) };
        });
      });
      if (moved) setMoveCount((n) => n + 1);
    }, GRID_ROLL_MS);
    return () => window.clearInterval(id);
  }, [aiLevel, active]);

  /** Send an enemy back to a random top-row column. */
  const sendBack = useCallback((id: GridEnemyId) => {
    setCharacters((list) => list.map((c) => c.id === id ? { ...c, x: Math.floor(Math.random() * GRID_SIZE), y: 0, inHall: false } : c));
    setMoveCount((n) => n + 1);
  }, []);

  /** Test hook: put an enemy straight into the hallway (adds it if absent tonight). */
  const summon = useCallback((id: GridEnemyId) => {
    setCharacters((list) => {
      if (list.some((c) => c.inHall)) return list;
      const def = GRID_ROSTER.find((d) => d.id === id)!;
      const placed = { ...def, x: OFFICE_CELL.x, y: OFFICE_CELL.y, inHall: true };
      return list.some((c) => c.id === id) ? list.map((c) => (c.id === id ? { ...c, ...placed } : c)) : [...list, placed];
    });
    setMoveCount((n) => n + 1);
  }, []);

  return { characters, moveCount, sendBack, summon };
}
