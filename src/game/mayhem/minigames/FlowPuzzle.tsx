import { useMemo, useRef, useState } from "react";

type Point = [number, number];
type Pair = { color: string; start: Point; end: Point; solution: Point[] };
type FlowPuzzleProps = { size: number; pairs: Pair[]; paused?: boolean; onComplete: () => void };

const keyOf = ([x, y]: Point) => `${x}:${y}`;
const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

export default function FlowPuzzle({ size, pairs, paused = false, onComplete }: FlowPuzzleProps) {
  const [paths, setPaths] = useState<Record<number, Point[]>>({});
  const active = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const terminals = useMemo(() => new Map(pairs.flatMap((pair, index) => [[keyOf(pair.start), index], [keyOf(pair.end), index]] as const)), [pairs]);

  const finishIfDone = (next: Record<number, Point[]>) => {
    const solved = pairs.every((pair, index) => {
      const path = next[index];
      return path?.length === pair.solution.length && path.every((point, step) => samePoint(point, pair.solution[step]));
    });
    if (solved) window.setTimeout(onComplete, 260);
  };

  const begin = (pairIndex: number, point: Point) => {
    if (paused) return;
    active.current = pairIndex;
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
      finishIfDone(next);
      return next;
    });
  };

  const stop = () => { active.current = null; };
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
            className="relative aspect-square border border-[hsl(var(--hell-steel))]/25"
          >
            {filled && <i className="absolute inset-[18%] opacity-70" style={{ backgroundColor: color }} />}
            {terminal != null && <i className="absolute inset-[22%] rounded-full border-2 border-[hsl(var(--hell-black))]" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />}
          </button>
        );
      })}
    </div>
  );
}

export const GENERATOR_FLOW_PAIRS: Pair[] = [
  { color: "#ef4444", start: [0, 0], end: [5, 0], solution: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]] },
  { color: "#38bdf8", start: [0, 2], end: [5, 2], solution: [[0,2],[1,2],[2,2],[3,2],[4,2],[5,2]] },
  { color: "#facc15", start: [0, 4], end: [5, 4], solution: [[0,4],[1,4],[2,4],[3,4],[4,4],[5,4]] },
];

export const ERROR_FLOW_PAIRS: Pair[] = [
  { color: "#ef4444", start: [0,0], end: [8,0], solution: Array.from({ length: 9 }, (_, x) => [x,0] as Point) },
  { color: "#38bdf8", start: [0,2], end: [8,2], solution: Array.from({ length: 9 }, (_, x) => [x,2] as Point) },
  { color: "#facc15", start: [0,4], end: [8,4], solution: Array.from({ length: 9 }, (_, x) => [x,4] as Point) },
  { color: "#4ade80", start: [0,6], end: [8,6], solution: Array.from({ length: 9 }, (_, x) => [x,6] as Point) },
  { color: "#f472b6", start: [0,8], end: [8,8], solution: Array.from({ length: 9 }, (_, x) => [x,8] as Point) },
];
