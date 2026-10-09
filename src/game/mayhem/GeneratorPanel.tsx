import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { mayhemSfx } from "@/game/sfx";
import FlowPuzzle, { makeRandomFlowPairs } from "./minigames/FlowPuzzle";
import { startingPower, upgradedProgress, type NightUpgrades } from "./merchantRules";
import generatorArt from "@/assets/mayhem/generator-panel.png.asset.json";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/game/settings";
import { useGeneratorMusic } from "./useGeneratorMusic";
import { generatorReward } from "./generatorReward";
import doubleChargeArt from "@/assets/mayhem/generator-double-charge.png.asset.json";

type PuzzleKind = "simon" | "memory" | "flow";
type GeneratorProgress = { percent: number; round: number; kind: PuzzleKind; seed: number; memoryMatched: boolean[]; doubled?: boolean };

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

export function makeGeneratorProgress(upgrades: NightUpgrades = {}): GeneratorProgress {
  return { percent: startingPower(upgrades), round: 1, kind: upgrades.puzzle ?? randomKind(), seed: Math.floor(Math.random() * 0xFFFFFFFF), memoryMatched: Array(6).fill(false) };
}

export default function GeneratorPanel({ night, upgrades = {}, paused, closing = false, progress, onProgress, onClose, onComplete, lookRef }: {
  night: number;
  upgrades?: NightUpgrades;
  paused: boolean;
  closing?: boolean;
  lookRef?: RefObject<HTMLDivElement>;
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
  const [displayPercent, setDisplayPercent] = useState(progress.percent);
  const displayPercentRef = useRef(progress.percent);
  const [settings] = useSettings();
  const beatRef = useRef<HTMLDivElement>(null);
  useGeneratorMusic(displayPercent, !closing, paused && !closing, settings.bgmVolume, beatRef);
  const [rewarding, setRewarding] = useState(false);
  const rewardingRef = useRef(false);
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const simon = useMemo(() => seededValues(progress.seed, 5, 4), [progress.seed]);
  const deck = useMemo(() => shuffledDeck(progress.seed), [progress.seed]);
  const flowPairs = useMemo(() => makeRandomFlowPairs(6, 4, progress.seed), [progress.seed]);
  const matchedCards = progress.memoryMatched ?? Array(6).fill(false);

  useEffect(() => {
    const from = displayPercentRef.current;
    const target = progress.percent;
    if (target <= from) return;
    rewardingRef.current = true;
    setRewarding(true);
    mayhemSfx.generatorImpact(progress.doubled);
    if (progress.doubled) mayhemSfx.generatorParry();

    let elapsed = 0;
    let previous = performance.now();
    let lastTick = -1;
    let frame = 0;
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      if (!pausedRef.current) {
        elapsed = Math.min(600, elapsed + delta);
        const fraction = Math.min(1, elapsed / 600);
        const value = from + (target - from) * fraction;
        displayPercentRef.current = value;
        setDisplayPercent(value);
        const soundTick = Math.min(5, Math.floor(elapsed / 100));
        if (soundTick !== lastTick) { mayhemSfx.generatorCount(); lastTick = soundTick; }
        if (fraction >= 1) {
          rewardingRef.current = false;
          setRewarding(false);
          if (target >= 100) completeRef.current();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progress.percent]);

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
    if (rewardingRef.current) return;
    rewardingRef.current = true;
    const { percent, doubled } = generatorReward(progress.percent, upgradedProgress(0, night, progress.round, upgrades), Math.random());
    if (percent >= 100) {
      onProgress({ ...progress, percent: 100, doubled });
      return;
    }
    onProgress({
      percent,
      doubled,
      round: progress.round + 1,
      kind: upgrades.puzzle ?? randomKind(progress.kind),
      seed: Math.floor(Math.random() * 0xFFFFFFFF),
      memoryMatched: Array(6).fill(false),
    });
  };

  const pressSimon = (pad: number) => {
    if (paused || rewarding || showing) return;
    mayhemSfx.puzzlePad(pad);
    setLit(pad); window.setTimeout(() => setLit(null), 140);
    const next = [...simonInput, pad];
    if (pad !== simon[next.length - 1]) { mayhemSfx.puzzleWrong(); setSimonInput([]); setShowing(true); setLit(null); window.setTimeout(() => setReplay((r) => r + 1), 500); return; }
    if (next.length === simon.length) { setSimonInput([]); finishRound(); return; }
    setSimonInput(next);
  };

  const flipCard = (index: number) => {
    if (paused || rewarding || lock || matchedCards[index] || cards.includes(index)) return;
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

  return (
    <div className={`gen-overlay absolute inset-0 z-[78] flex items-center justify-center ${closing ? "gen-closing" : ""}`}>
      {rewarding && progress.doubled && <img className="gen-double-charge-art" src={doubleChargeArt.url} alt="" aria-hidden="true" draggable={false} style={{ animationPlayState: paused ? "paused" : "running" }} />}
      <div ref={lookRef} className="gen-look-layer">
      <div className="gen-panel">
        <div className={`gen-completion-view ${rewarding ? "gen-rewarding" : ""} ${rewarding && progress.doubled ? "gen-double-reward" : ""}`} style={{ animationPlayState: paused ? "paused" : "running" }}>
        <img className="gen-art" src={generatorArt.url} alt="Stevenson’s Ultra Power Generator 9000, COMPANY PACE" draggable={false} />
        <output className="gen-percent" aria-label="Generator progress">{Number(displayPercent.toFixed(1))}%</output>
        <div className="gen-progress" role="progressbar" aria-label="Generator power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayPercent}>
          <div className="gen-progress-fill" style={{ width: `${displayPercent}%` }} />
        </div>
        <div ref={beatRef} className="gen-task" onPointerOver={(event) => {
          if (paused || closing || !(event.target instanceof Element)) return;
          const control = event.target.closest("button");
          if (!control || control.disabled) return;
          if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
          mayhemSfx.generatorHover();
        }}>
          {progress.kind === "simon" && <div className="gen-puzzle-layout">
            <p className="gen-task-label">SIMON · {showing ? "SIGNAL" : `${simonInput.length} / ${simon.length}`}</p>
            <div className="gen-simon-grid">{PAD_LABELS.map((label, index) => {
              const on = lit === index;
              return <Button variant="ghost" key={label} type="button" onClick={() => pressSimon(index)} className={`gen-pad ${on ? "gen-control-on" : ""}`}>{label}</Button>;
            })}</div>
          </div>}
          {progress.kind === "memory" && <div className="gen-puzzle-layout">
            <p className="gen-task-label">MEMORY</p>
            <div className="gen-memory-grid">{deck.map((value, index) => {
              const visible = cards.includes(index) || matchedCards[index];
              return <Button variant="ghost" key={index} type="button" onClick={() => flipCard(index)} className={`gen-card ${visible ? "gen-control-on" : ""}`}>{visible ? PAD_LABELS[value] : "?"}</Button>;
            })}</div>
          </div>}
          {progress.kind === "flow" && <div className="gen-puzzle-layout"><p className="gen-task-label">FLOW</p><div className="gen-flow-board"><FlowPuzzle key={progress.seed} size={6} pairs={flowPairs} paused={paused || rewarding} onComplete={finishRound} /></div></div>}
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export type { GeneratorProgress };
