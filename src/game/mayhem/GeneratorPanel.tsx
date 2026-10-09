import { useEffect, useMemo, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
import FlowPuzzle, { makeRandomFlowPairs } from "./minigames/FlowPuzzle";
import { advanceGenerator } from "./generatorGain";

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

export default function GeneratorPanel({ night, paused, progress, onProgress, onClose, onComplete }: {
  night: number;
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
  const [replay, setReplay] = useState(0);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const simon = useMemo(() => seededValues(progress.seed, 5, 4), [progress.seed]);
  const deck = useMemo(() => shuffledDeck(progress.seed), [progress.seed]);
  const flowPairs = useMemo(() => makeRandomFlowPairs(6, 4, progress.seed), [progress.seed]);
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
      const litPad = step % 2 === 0 ? simon[Math.floor(step / 2)] : null;
      setLit(litPad);
      if (litPad !== null) mayhemSfx.puzzleSignal(litPad);
      step += 1;
    }, 440);
    return () => window.clearInterval(timer);
  }, [progress.kind, progress.round, simon, replay]);

  const finishRound = () => {
    const percent = advanceGenerator(progress.percent, night);
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
    mayhemSfx.puzzlePad(pad);
    setLit(pad); window.setTimeout(() => setLit(null), 140);
    const next = [...simonInput, pad];
    if (pad !== simon[next.length - 1]) { mayhemSfx.puzzleWrong(); setSimonInput([]); setShowing(true); setLit(null); window.setTimeout(() => setReplay((r) => r + 1), 500); return; }
    if (next.length === simon.length) { setSimonInput([]); finishRound(); return; }
    setSimonInput(next);
  };

  const flipCard = (index: number) => {
    if (paused || lock || matchedCards[index] || cards.includes(index)) return;
    const next = [...cards, index]; setCards(next); mayhemSfx.puzzleFlip();
    if (next.length < 2) return;
    setLock(true);
    window.setTimeout(() => {
      if (deck[next[0]] === deck[next[1]]) {
        mayhemSfx.puzzleMatch();
        const matched = [...matchedCards]; matched[next[0]] = true; matched[next[1]] = true;
        if (matched.every(Boolean)) finishRound();
        else onProgress({ ...progress, memoryMatched: matched });
      }
      else mayhemSfx.puzzleMiss();
      setCards([]); setLock(false);
    }, 520);
  };

  const SEGMENTS = 20;
  const litSegments = Math.round((progress.percent / 100) * SEGMENTS);
  const padHues = [0, 45, 139, 210];

  return (
    <div className="absolute inset-0 z-[78] flex items-center justify-center bg-[hsl(var(--hell-black))]/90 p-4">
      <div className="gen-panel w-[min(680px,94vw)]">
        <span className="gen-rivet left-2 top-2"><span className="gen-screw-slot" /></span>
        <span className="gen-rivet right-2 top-2"><span className="gen-screw-slot" /></span>
        <span className="gen-rivet bottom-2 left-2"><span className="gen-screw-slot" /></span>
        <span className="gen-rivet bottom-2 right-2"><span className="gen-screw-slot" /></span>

        <div className="gen-hazard" />

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <span className={`gen-lamp ${progress.percent >= 100 ? "gen-lamp-on" : "gen-lamp-warn"}`} />
            <div>
              <div className="font-pixel text-[11px] tracking-[0.25em] text-[hsl(var(--hell-muted))]">AUX GENERATOR · MK-II</div>
              <div className="font-pixel text-[8px] tracking-[0.2em] text-[hsl(var(--hell-steel))]">TASK_{progress.kind.toUpperCase()}.EXE · ROUND {progress.round}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="gen-close px-3 py-2 font-pixel text-[9px] tracking-[0.2em]">CLOSE</button>
        </div>

        <div className="mx-5 mb-4 border border-[hsl(var(--hell-steel))]/50 bg-[hsl(var(--hell-black))]/60 px-4 py-3">
          <div className="mb-2 flex items-end justify-between font-pixel">
            <span className="text-[9px] tracking-[0.3em] text-[hsl(var(--hell-muted))]">RESTORE POWER</span>
            <span className="text-[18px] leading-none text-[hsl(var(--hell-terminal))]" style={{ textShadow: "0 0 10px hsl(var(--hell-terminal) / 0.7)" }}>{progress.percent}<span className="text-[10px]">%</span></span>
          </div>
          <div className="flex h-4 gap-[3px] border border-[hsl(var(--hell-steel))]/60 bg-[hsl(var(--hell-black))] p-[3px]">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <span key={i} className={`gen-seg ${i < litSegments ? (progress.percent >= 90 ? "gen-seg-hot" : "gen-seg-on") : ""} transition-all duration-300`} />
            ))}
          </div>
        </div>

        <div className="gen-screen mx-5 mb-5 p-5">
          {progress.kind === "simon" && <div>
            <p className="mb-4 text-center font-pixel text-[9px] tracking-[0.3em] text-[hsl(var(--hell-muted))]">{showing ? "▸ WATCH THE SIGNAL ◂" : `REPEAT IT BACK · ${simonInput.length} / ${simon.length}`}</p>
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">{PAD_LABELS.map((label, index) => {
              const hue = padHues[index];
              const on = lit === index;
              return <button key={label} type="button" onClick={() => pressSimon(index)} className="gen-pad aspect-square font-pixel text-2xl transition-[filter,box-shadow] duration-75"
                style={{
                  color: on ? `hsl(${hue} 90% 65%)` : "hsl(var(--hell-steel))",
                  borderColor: on ? `hsl(${hue} 90% 55%)` : undefined,
                  boxShadow: on ? `inset 0 0 24px hsl(${hue} 90% 50% / 0.45), 0 0 22px hsl(${hue} 90% 50% / 0.6), 0 4px 0 hsl(var(--hell-black))` : undefined,
                  textShadow: on ? `0 0 12px hsl(${hue} 90% 60%)` : undefined,
                }}>{label}</button>;
            })}</div>
          </div>}
          {progress.kind === "memory" && <div>
            <p className="mb-4 text-center font-pixel text-[9px] tracking-[0.3em] text-[hsl(var(--hell-muted))]">MATCH THE THREE SIGNAL PAIRS</p>
            <div className="mx-auto grid max-w-md grid-cols-3 gap-3">{deck.map((value, index) => {
              const visible = cards.includes(index) || matchedCards[index];
              return <button key={index} type="button" onClick={() => flipCard(index)} className="gen-card aspect-[4/3] font-pixel text-2xl transition-colors duration-100"
                style={visible ? { color: "hsl(var(--hell-terminal))", borderColor: "hsl(var(--hell-terminal))", textShadow: "0 0 12px hsl(var(--hell-terminal) / 0.8)", boxShadow: "inset 0 0 18px hsl(var(--hell-terminal) / 0.25), 0 3px 0 hsl(var(--hell-black))" } : { color: "hsl(var(--hell-steel))" }}>{visible ? PAD_LABELS[value] : "?"}</button>;
            })}</div>
          </div>}
          {progress.kind === "flow" && <div className="mx-auto max-w-[460px]"><p className="mb-3 text-center font-pixel text-[9px] tracking-[0.3em] text-[hsl(var(--hell-muted))]">CONNECT MATCHING SIGNALS</p><FlowPuzzle key={progress.seed} size={6} pairs={flowPairs} paused={paused} onComplete={finishRound} /></div>}
        </div>

        <div className="gen-hazard" />
      </div>
    </div>
  );
}

export type { GeneratorProgress };
