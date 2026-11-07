import { useEffect, useRef, useState } from "react";
import { shuffledPorts, taskComplete, tryConnect, WIRE_COLORS, type WireColor } from "./managerOfficeRules";
import {
  addSurge, CONSOLE_TASKS, makeCodeRound, makeSimonSequence, SIMON_BUTTONS, SURGE_HOLD_PER_SEC, SURGE_TAP, TASK_ROUNDS,
  type ConsoleProgress,
} from "./officeConsoleRules";

const TITLES = { power: "TASK 1 · POWER ON", code: "TASK 2 · CODE", simon: "TASK 3 · SIMON", wire: "TASK 4 · WIRES", surge: "TASK 5 · SURGE" };

/** Night 5 desk console (CRT in front of you). Progress is owned by the office so closing never resets it. */
export default function DeskConsole({ progress, onRound, onClose }: { progress: ConsoleProgress; onRound: () => void; onClose: () => void }) {
  const kind = CONSOLE_TASKS[progress.task];
  const total = TASK_ROUNDS[kind];
  return (
    <div className="mo-overlay" onClick={onClose}>
      <div className="mo-crt" onClick={(e) => e.stopPropagation()}>
        <div className="mo-crt-title">{progress.done ? "ALL TASKS COMPLETE" : `${TITLES[kind]}${total > 1 ? ` [${progress.round}/${total}]` : ""}`}</div>
        <div className="mo-con-body">
          {progress.done ? <p>Console online. (Boss not added yet.)</p> : (
            <>
              {kind === "power" && <PowerTask onDone={onRound} />}
              {kind === "code" && <CodeTask key={progress.round} onDone={onRound} />}
              {kind === "simon" && <SimonTask key={progress.round} round={progress.round} onDone={onRound} />}
              {kind === "wire" && <WireTask key={progress.round} onDone={onRound} />}
              {kind === "surge" && <SurgeTask onDone={onRound} />}
            </>
          )}
        </div>
        <div className="mo-crt-foot">click outside or G to close</div>
      </div>
    </div>
  );
}

function PowerTask({ onDone }: { onDone: () => void }) {
  const [sw, setSw] = useState(false);
  const [plug, setPlug] = useState(false);
  const [crank, setCrank] = useState(0);
  useEffect(() => { if (crank >= 100) { const t = setTimeout(onDone, 600); return () => clearTimeout(t); } }, [crank, onDone]);
  return (
    <div className="mo-con-col">
      <button className="mo-con-btn" disabled={sw} onClick={() => setSw(true)}>{sw ? "SWITCH ON" : "1. FLIP SWITCH"}</button>
      <button className="mo-con-btn" disabled={!sw || plug} onClick={() => setPlug(true)}>{plug ? "PLUGGED IN" : "2. PLUG IN"}</button>
      <button className="mo-con-btn" disabled={!plug || crank >= 100} onClick={() => setCrank((c) => Math.min(100, c + 10))}>
        {crank >= 100 ? "LIGHTS ON!" : `3. CRANK (${crank}%)`}
      </button>
    </div>
  );
}

function CodeTask({ onDone }: { onDone: () => void }) {
  const [r] = useState(() => makeCodeRound());
  const [wrong, setWrong] = useState(-1);
  const hint = r.options[r.answer].split("").map((d, i) => (i === r.hintPos ? d : "_")).join(" ");
  return (
    <div className="mo-con-col">
      <div className="mo-con-grid">
        {r.options.map((o, i) => (
          <button key={o} className={`mo-con-btn ${wrong === i ? "bad" : ""}`} onClick={() => (i === r.answer ? onDone() : setWrong(i))}>{o}</button>
        ))}
      </div>
      <div className="mo-con-hint">HINT: {hint}</div>
    </div>
  );
}

function SimonTask({ round, onDone }: { round: number; onDone: () => void }) {
  const [seq, setSeq] = useState(() => makeSimonSequence(round));
  const [lit, setLit] = useState(-1);
  const [showing, setShowing] = useState(true);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!showing) return;
    let i = 0; let on = false;
    const id = setInterval(() => {
      if (on) { setLit(-1); on = false; i++; if (i >= seq.length) { clearInterval(id); setShowing(false); } }
      else { setLit(seq[i]); on = true; }
    }, 320);
    return () => clearInterval(id);
  }, [showing, seq]);
  const press = (b: number) => {
    if (showing) return;
    if (b !== seq[pos]) { setSeq(makeSimonSequence(round)); setPos(0); setShowing(true); return; }
    if (pos + 1 >= seq.length) onDone(); else setPos(pos + 1);
  };
  return (
    <div className="mo-con-col">
      <div className="mo-simon">
        {Array.from({ length: SIMON_BUTTONS }, (_, b) => (
          <button key={b} className={`mo-simon-b mo-s${b} ${lit === b ? "lit" : ""}`} onClick={() => press(b)} aria-label={`Button ${b + 1}`} />
        ))}
      </div>
      <div className="mo-con-hint">{showing ? "watch…" : `repeat ${pos}/${seq.length}`}</div>
    </div>
  );
}

function WireTask({ onDone }: { onDone: () => void }) {
  const [ports] = useState(() => shuffledPorts());
  const [linked, setLinked] = useState<WireColor[]>([]);
  const [held, setHeld] = useState<WireColor | null>(null);
  const finished = taskComplete(linked);
  useEffect(() => { if (finished) { const t = setTimeout(onDone, 400); return () => clearTimeout(t); } }, [finished, onDone]);
  return (
    <div className="mo-con-wires">
      <svg className="mo-wires" viewBox="0 0 100 100" preserveAspectRatio="none">
        {linked.map((c) => (
          <line key={c} x1={12} y1={12.5 + WIRE_COLORS.indexOf(c) * 25} x2={88} y2={12.5 + ports.indexOf(c) * 25}
            className={`mo-w-${c}`} strokeWidth={3} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mo-ports">
        <div>{WIRE_COLORS.map((c) => (
          <button key={c} className={`mo-port mo-p-${c} ${held === c ? "held" : ""}`} disabled={linked.includes(c)} onClick={() => setHeld(c)} aria-label={`${c} plug`} />
        ))}</div>
        <div>{ports.map((c) => (
          <button key={c} className={`mo-port mo-p-${c}`} disabled={linked.includes(c)} aria-label={`${c} port`}
            onClick={() => { if (held) { setLinked((l) => tryConnect(l, held, c)); setHeld(null); } }} />
        ))}</div>
      </div>
    </div>
  );
}

function SurgeTask({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const holding = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "KeyE") holding.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === "KeyE") holding.current = false; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    let last = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (holding.current) setPct((p) => addSurge(p, SURGE_HOLD_PER_SEC * dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useEffect(() => { if (pct >= 100) onDone(); }, [pct, onDone]);
  return (
    <div className="mo-con-col">
      <div className="mo-gen-bar"><div style={{ width: `${pct}%` }} /><span>{Math.floor(pct)}%</span></div>
      <button className="mo-con-btn" onClick={() => setPct((p) => addSurge(p, SURGE_TAP))}>HOLD E · or TAP HERE</button>
    </div>
  );
}
