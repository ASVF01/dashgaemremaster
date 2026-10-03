import { useEffect, useMemo, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
import FlowPuzzle, { makeRandomFlowPairs } from "./minigames/FlowPuzzle";

type PuzzleKind = "simon" | "memory" | "flow";
type GeneratorProgress = { percent: number; round: number; kind: PuzzleKind; seed: number; memoryMatched: boolean[] };

const PAD_LABELS = ["A", "B", "C", "D"];

function seededValues(seed: number, count: number, range: number) {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * range);
  });
}

function shuffledDeck(seed: number) {
  const deck = [0, 0, 1, 1, 2, 2];
  let state = seed >>> 0;
  for (let index = deck.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swap = Math.floor((state / 4294967296) * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

function randomKind(previous?: PuzzleKind): PuzzleKind {
  const kinds: PuzzleKind[] = ["simon", "memory", "flow"];
  const choices = previous ? kinds.filter((kind) => kind !== previous) : kinds;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function makeGeneratorProgress(): GeneratorProgress {
  return { percent: 0, round: 1, kind: randomKind(), seed: Math.floor(Math.random() * 0xFFFFFFFF), memoryMatched: Array(6).fill(false) };
}

export default function GeneratorPanel({ paused, progress, onProgress, onClose, onComplete }: {
  paused: boolean;
  progress: GeneratorProgress;
  onProgress: (next: GeneratorProgress) => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [showing, setShowing] = useState(progress.kind === "simon");
  const [lit, setLit] = useState<number | null>(null);
  const [simonInput, setSimonInput] = useState<number[]>([]);
  const [cards, setCards] = useState<number[]>([]);
  const [lock, setLock] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const simon = useMemo(() => seededValues(progress.seed, 5, 4), [progress.seed]);
  const deck = useMemo(() => shuffledDeck(progress.seed), [progress.seed]);
  const flowPairs = useMemo(() => makeRandomFlowPairs(6, 3, progress.seed), [progress.seed]);
  const matchedCards = progress.memoryMatched ?? Array(6).fill(false);

  useEffect(() => {
    setShowing(progress.kind === "simon");
    setLit(null);
    setSimonInput([]);
    setCards([]);
    setLock(false);
  }, [progress.round, progress.kind]);

  useEffect(() => {
    if (progress.kind !== "simon") return;
    let step = 0;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      if (step >= simon.length * 2) { window.clearInterval(timer); setLit(null); setShowing(false); return; }
      setLit(step % 2 === 0 ? simon[Math.floor(step / 2)] : null);
      step += 1;
    }, 440);
    return () => window.clearInterval(timer);
  }, [progress.kind, progress.round, simon]);

  const finishRound = () => {
    const percent = Math.min(100, progress.percent + 3);
    mayhemSfx.terminalDone();
    if (percent >= 100) {
      onProgress({ ...progress, percent: 100 });
      onComplete();
      return;
    }
    onProgress({
      percent,
      round: progress.round + 1,
      kind: randomKind(progress.kind),
      seed: Math.floor(Math.random() * 0xFFFFFFFF),
      memoryMatched: Array(6).fill(false),
    });
  };

  const pressSimon = (pad: number) => {
    if (paused || showing) return;
    mayhemSfx.terminalSelect();
    setLit(pad); window.setTimeout(() => setLit(null), 140);
    const next = [...simonInput, pad];
    if (pad !== simon[next.length - 1]) { setSimonInput([]); setShowing(true); window.setTimeout(() => setShowing(false), 700); return; }
    if (next.length === simon.length) { setSimonInput([]); finishRound(); return; }
    setSimonInput(next);
  };

  const flipCard = (index: number) => {
    if (paused || lock || matchedCards[index] || cards.includes(index)) return;
    const next = [...cards, index]; setCards(next); mayhemSfx.terminalSelect();
    if (next.length < 2) return;
    setLock(true);
    window.setTimeout(() => {
      if (deck[next[0]] === deck[next[1]]) {
        const matched = [...matchedCards]; matched[next[0]] = true; matched[next[1]] = true;
        if (matched.every(Boolean)) finishRound();
        else onProgress({ ...progress, memoryMatched: matched });
      }
      setCards([]); setLock(false);
    }, 520);
  };

  return (
    <div className="absolute inset-0 z-[78] flex items-center justify-center bg-[hsl(var(--hell-black))]/90 p-4">
      <div className="relative w-[min(660px,94vw)] border-4 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-panel))] p-4 shadow-[0_0_50px_hsl(var(--hell-black))]">
        <div className="mb-4 flex items-center justify-between border-b border-[hsl(var(--hell-steel))] pb-3 font-pixel text-[hsl(var(--hell-muted))]">
          <span>GENERATOR // {progress.kind.toUpperCase()}</span>
          <button type="button" onClick={onClose} className="border border-[hsl(var(--hell-steel))] px-3 py-2 text-[9px]">CLOSE</button>
        </div>
        <div className="mb-5">
          <div className="mb-2 flex justify-between font-pixel text-[9px] text-[hsl(var(--hell-muted))]"><span>RESTORE POWER</span><span>{progress.percent}%</span></div>
          <div className="h-4 border-2 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] p-0.5"><div className="h-full bg-[hsl(var(--hell-terminal))] transition-[width] duration-300" style={{ width: `${progress.percent}%` }} /></div>
        </div>
        {progress.kind === "simon" && <div>
          <p className="mb-4 text-center font-pixel text-[9px] text-[hsl(var(--hell-muted))]">{showing ? "WATCH THE SIGNAL" : `${simonInput.length} / ${simon.length}`}</p>
          <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">{PAD_LABELS.map((label, index) => <button key={label} type="button" onClick={() => pressSimon(index)} className={`aspect-square border-2 font-pixel text-2xl transition ${lit === index ? "border-[hsl(var(--hell-terminal))] bg-[hsl(var(--hell-terminal))] text-[hsl(var(--hell-black))]" : "border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] text-[hsl(var(--hell-muted))]"}`}>{label}</button>)}</div>
        </div>}
        {progress.kind === "memory" && <div>
          <p className="mb-4 text-center font-pixel text-[9px] text-[hsl(var(--hell-muted))]">MATCH THE THREE SIGNAL PAIRS</p>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">{deck.map((value, index) => {
            const visible = cards.includes(index) || matchedCards[index];
            return <button key={index} type="button" onClick={() => flipCard(index)} className="aspect-[4/3] border-2 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] font-pixel text-2xl text-[hsl(var(--hell-terminal))]">{visible ? PAD_LABELS[value] : "?"}</button>;
          })}</div>
        </div>}
        {progress.kind === "flow" && <div className="mx-auto max-w-[460px]"><p className="mb-3 text-center font-pixel text-[9px] text-[hsl(var(--hell-muted))]">CONNECT MATCHING SIGNALS</p><FlowPuzzle key={progress.seed} size={6} pairs={flowPairs} paused={paused} onComplete={finishRound} /></div>}
      </div>
    </div>
  );
}

export type { GeneratorProgress };
