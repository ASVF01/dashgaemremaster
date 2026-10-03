import { useEffect, useMemo, useRef, useState } from "react";
import { mayhemSfx } from "@/game/sfx";
import FlowPuzzle, { GENERATOR_FLOW_PAIRS } from "./minigames/FlowPuzzle";

type Stage = "simon" | "memory" | "flow" | "done";
type GeneratorProgress = { stage: Stage; memoryMatched: boolean[] };

const SIMON = [0, 2, 1, 3, 2];
const PAD_LABELS = ["A", "B", "C", "D"];

export default function GeneratorPanel({ paused, progress, onProgress, onClose, onComplete }: {
  paused: boolean;
  progress: GeneratorProgress;
  onProgress: (next: GeneratorProgress) => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [showing, setShowing] = useState(true);
  const [lit, setLit] = useState<number | null>(null);
  const [simonInput, setSimonInput] = useState<number[]>([]);
  const [cards, setCards] = useState<number[]>([]);
  const [lock, setLock] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const deck = useMemo(() => [0, 1, 2, 1, 2, 0], []);

  useEffect(() => {
    if (progress.stage !== "simon") return;
    let step = 0;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      if (step >= SIMON.length * 2) { window.clearInterval(timer); setLit(null); setShowing(false); return; }
      setLit(step % 2 === 0 ? SIMON[Math.floor(step / 2)] : null);
      step += 1;
    }, 440);
    return () => window.clearInterval(timer);
  }, [progress.stage]);

  const pressSimon = (pad: number) => {
    if (paused || showing) return;
    mayhemSfx.terminalSelect();
    setLit(pad); window.setTimeout(() => setLit(null), 140);
    const next = [...simonInput, pad];
    if (pad !== SIMON[next.length - 1]) { setSimonInput([]); setShowing(true); window.setTimeout(() => setShowing(false), 700); return; }
    if (next.length === SIMON.length) { onProgress({ ...progress, stage: "memory" }); setSimonInput([]); return; }
    setSimonInput(next);
  };

  const flipCard = (index: number) => {
    if (paused || lock || progress.memoryMatched[index] || cards.includes(index)) return;
    const next = [...cards, index]; setCards(next); mayhemSfx.terminalSelect();
    if (next.length < 2) return;
    setLock(true);
    window.setTimeout(() => {
      if (deck[next[0]] === deck[next[1]]) {
        const matched = [...progress.memoryMatched]; matched[next[0]] = true; matched[next[1]] = true;
        if (matched.every(Boolean)) onProgress({ stage: "flow", memoryMatched: matched });
        else onProgress({ ...progress, memoryMatched: matched });
      }
      setCards([]); setLock(false);
    }, 520);
  };

  return (
    <div className="absolute inset-0 z-[78] flex items-center justify-center bg-[hsl(var(--hell-black))]/90 p-4">
      <div className="relative w-[min(660px,94vw)] border-4 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-panel))] p-4 shadow-[0_0_50px_hsl(var(--hell-black))]">
        <div className="mb-4 flex items-center justify-between border-b border-[hsl(var(--hell-steel))] pb-3 font-pixel text-[hsl(var(--hell-muted))]">
          <span>GENERATOR // {progress.stage.toUpperCase()}</span>
          <button type="button" onClick={onClose} className="border border-[hsl(var(--hell-steel))] px-3 py-2 text-[9px]">CLOSE</button>
        </div>
        {progress.stage === "simon" && <div>
          <p className="mb-4 text-center font-pixel text-[9px] text-[hsl(var(--hell-muted))]">{showing ? "WATCH THE SIGNAL" : `${simonInput.length} / ${SIMON.length}`}</p>
          <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">{PAD_LABELS.map((label, index) => <button key={label} type="button" onClick={() => pressSimon(index)} className={`aspect-square border-2 font-pixel text-2xl transition ${lit === index ? "border-[hsl(var(--hell-terminal))] bg-[hsl(var(--hell-terminal))] text-[hsl(var(--hell-black))]" : "border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] text-[hsl(var(--hell-muted))]"}`}>{label}</button>)}</div>
        </div>}
        {progress.stage === "memory" && <div>
          <p className="mb-4 text-center font-pixel text-[9px] text-[hsl(var(--hell-muted))]">MATCH THE THREE SIGNAL PAIRS</p>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">{deck.map((value, index) => {
            const visible = cards.includes(index) || progress.memoryMatched[index];
            return <button key={index} type="button" onClick={() => flipCard(index)} className="aspect-[4/3] border-2 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] font-pixel text-2xl text-[hsl(var(--hell-terminal))]">{visible ? PAD_LABELS[value] : "?"}</button>;
          })}</div>
        </div>}
        {progress.stage === "flow" && <div className="mx-auto max-w-[460px]"><p className="mb-3 text-center font-pixel text-[9px] text-[hsl(var(--hell-muted))]">CONNECT MATCHING SIGNALS</p><FlowPuzzle size={6} pairs={GENERATOR_FLOW_PAIRS} paused={paused} onComplete={() => { onProgress({ ...progress, stage: "done" }); mayhemSfx.terminalDone(); onComplete(); }} /></div>}
      </div>
    </div>
  );
}

export type { GeneratorProgress };
