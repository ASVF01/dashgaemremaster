import { useEffect, useMemo, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";

type Point = [number, number];
type Pair = { color: string; start: Point; end: Point; solution: Point[] };
type FlowPuzzleProps = { size: number; pairs: Pair[]; paused?: boolean; onComplete: () => void };

const keyOf = ([x, y]: Point) => `${x}:${y}`;
const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

function isFlowSolved(pairs: Pair[], paths: Record<number, Point[]>) {
  return pairs.every((pair, index) => {
    const path = paths[index];
    if (!path || path.length < 2) return false;
    const first = path[0];
    const last = path[path.length - 1];
    return (samePoint(first, pair.start) && samePoint(last, pair.end))
      || (samePoint(first, pair.end) && samePoint(last, pair.start));
  });
}

export default function FlowPuzzle({ size, pairs, paused = false, onComplete }: FlowPuzzleProps) {
  const [paths, setPaths] = useState<Record<number, Point[]>>({});
  const [held, setHeld] = useState<number | null>(null);
  const [pulse, setPulse] = useState<{ point: Point; color: string; id: number } | null>(null);
  const pulseId = useRef(0);
  const active = useRef<number | null>(null);
  const completed = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const terminals = useMemo(() => new Map(pairs.flatMap((pair, index) => [[keyOf(pair.start), index], [keyOf(pair.end), index]] as const)), [pairs]);

  useEffect(() => {
    setPaths({});
    setPulse(null);
    active.current = null;
    completed.current = false;
  }, [pairs, size]);

  const finishIfDone = (next: Record<number, Point[]>) => {
    if (!completed.current && isFlowSolved(pairs, next)) {
      completed.current = true;
      window.setTimeout(onComplete, 260);
    }
  };

  const begin = (pairIndex: number, point: Point) => {
    if (paused) return;
    const pair = pairs[pairIndex];
    setPulse({ point: samePoint(point, pair.start) ? pair.end : pair.start, color: pair.color, id: ++pulseId.current });
    active.current = pairIndex;
    setHeld(pairIndex);
    mayhemSfx.puzzleGrab(1 + pairIndex * 0.12);
    setPaths((current) => ({ ...current, [pairIndex]: [point] }));
  };

  const enter = (point: Point) => {
    const pairIndex = active.current;
    if (paused || pairIndex == null) return;
    setPaths((current) => {
      const path = current[pairIndex] ?? [];
      const last = path[path.length - 1];
      if (!last || Math.abs(last[0] - point[0]) + Math.abs(last[1] - point[1]) !== 1) return current;
      if (path.some((item) => samePoint(item, point))) return current;
      const terminalOwner = terminals.get(keyOf(point));
      if (terminalOwner != null && terminalOwner !== pairIndex) return current;
      const occupied = Object.entries(current).some(([index, points]) => Number(index) !== pairIndex && points.some((item) => samePoint(item, point)));
      if (occupied) return current;
      const next = { ...current, [pairIndex]: [...path, point] };
      const pr = pairs[pairIndex];
      const first = path[0];
      const endsAt = first && (samePoint(first, pr.start) ? pr.end : pr.start);
      if (endsAt && samePoint(point, endsAt)) mayhemSfx.puzzleConnect();
      else mayhemSfx.puzzleStep(path.length);
      finishIfDone(next);
      return next;
    });
  };

  const stop = () => { if (active.current != null) mayhemSfx.puzzleRelease(); active.current = null; setHeld(null); };
  const pathCells = useMemo(() => {
    const cells = new Map<string, { color: string; pair: number }>();
    Object.entries(paths).forEach(([index, points]) => points.forEach((point) => cells.set(keyOf(point), { color: pairs[Number(index)].color, pair: Number(index) })));
    return cells;
  }, [paths, pairs]);

  return (
    <div
      ref={boardRef}
      className="grid aspect-square w-full touch-none border-2 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))]"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      {Array.from({ length: size * size }, (_, index) => {
        const point: Point = [index % size, Math.floor(index / size)];
        const terminal = terminals.get(keyOf(point));
        const filled = pathCells.get(keyOf(point));
        const pairIndex = terminal ?? filled?.pair;
        const color = pairIndex == null ? undefined : pairs[pairIndex].color;
        const pressed = terminal != null && held === terminal && paths[terminal]?.[0] && samePoint(paths[terminal][0], point);
        return (
          <button
            key={index}
            type="button"
            aria-label={`Flow cell ${point[0] + 1}, ${point[1] + 1}`}
            onPointerDown={(event) => {
              event.preventDefault();
              if (terminal != null) begin(terminal, point);
              else enter(point);
            }}
            onPointerEnter={(event) => { if (event.buttons === 1 || active.current != null) enter(point); }}
            className="relative aspect-square border border-[hsl(var(--hell-steel))]/25 transition-colors hover:bg-[hsl(var(--hell-steel))]/15"
          >
            {filled && <i className={`absolute inset-[18%] transition-opacity ${held === pairIndex ? "opacity-90" : "opacity-70"}`} style={{ backgroundColor: color }} />}
            {pulse && samePoint(pulse.point, point) && <span key={pulse.id} aria-hidden="true" className="flow-target-pulse" style={{ color: pulse.color, animationPlayState: paused ? "paused" : "running" }}>
              {[0, 1, 2].map((ring) => <i key={ring} className="flow-target-ring" onAnimationEnd={ring === 2 ? () => setPulse((current) => current?.id === pulse.id ? null : current) : undefined} />)}
            </span>}
            {terminal != null && <i className={`absolute inset-[22%] rounded-full border-2 border-[hsl(var(--hell-black))] transition-transform duration-75 ${pressed ? "scale-75 brightness-75" : "scale-100"}`} style={{ backgroundColor: color, boxShadow: pressed ? `inset 0 3px 6px hsl(var(--hell-black)), 0 0 18px ${color}` : `0 0 10px ${color}` }} />}
          </button>
        );
      })}
    </div>
  );
}

const FLOW_COLORS = [
  "hsl(var(--flow-red))",
  "hsl(var(--flow-blue))",
  "hsl(var(--flow-yellow))",
  "hsl(var(--flow-green))",
  "hsl(var(--flow-pink))",
];

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Builds a different, fully-covered, guaranteed-solvable Flow board from a seed. */
export function makeRandomFlowPairs(size: number, pairCount: number, seed: number): Pair[] {
  const random = seededRandom(seed);
  const vertical = random() > 0.5;
  const reverse = random() > 0.5;
  const mirror = random() > 0.5;
  let route: Point[] = [];

  for (let line = 0; line < size; line += 1) {
    const forward = line % 2 === 0;
    for (let offset = 0; offset < size; offset += 1) {
      const along = forward ? offset : size - 1 - offset;
      const x = vertical ? line : along;
      const y = vertical ? along : line;
      route.push([mirror ? size - 1 - x : x, y]);
    }
  }
  if (reverse) route = route.reverse();

  const minimum = 4;
  const lengths: number[] = [];
  let remaining = route.length;
  for (let index = 0; index < pairCount; index += 1) {
    const pairsLeft = pairCount - index;
    if (pairsLeft === 1) {
      lengths.push(remaining);
      break;
    }
    const max = remaining - minimum * (pairsLeft - 1);
    const ideal = Math.floor(remaining / pairsLeft);
    const spread = Math.max(0, Math.min(ideal - minimum, max - ideal));
    const length = ideal + Math.floor((random() * 2 - 1) * (spread + 1));
    lengths.push(Math.max(minimum, Math.min(max, length)));
    remaining -= lengths[lengths.length - 1];
  }

  let cursor = 0;
  return lengths.map((length, index) => {
    const solution = route.slice(cursor, cursor + length);
    cursor += length;
    return {
      color: FLOW_COLORS[index % FLOW_COLORS.length],
      start: solution[0],
      end: solution[solution.length - 1],
      solution,
    };
  });
}

export type { Pair, Point };
