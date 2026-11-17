import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSettings } from "@/game/settings";
import { mayhemSfx } from "@/game/sfx";
import windupSfx from "@/assets/crank_windup.wav.asset.json";
import lightsSfx from "@/assets/lights_on.mp3.asset.json";
import GeneratorArtwork from "./GeneratorArtwork";
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
    <div className="mo-overlay mo-console-overlay" onClick={onClose}>
      <div className="mo-crt" onClick={(e) => e.stopPropagation()}>
        <div className="mo-console-screen">
          <div className="mo-crt-title">{progress.done ? "ALL TASKS COMPLETE" : `${TITLES[kind]}${total > 1 ? ` [${progress.round}/${total}]` : ""}`}</div>
          <div className="mo-con-body" onPointerOver={(e) => {
            const btn = (e.target as Element).closest("button");
            if (btn && !btn.contains(e.relatedTarget as Node | null)) mayhemSfx.generatorHover();
          }}>
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
    </div>
  );
}

function sfx(url: string, v = 1) {
  const a = new Audio(url); a.volume = Math.max(0, Math.min(1, (getSettings().sfxVolume ?? 0.7) * v)); a.play().catch(() => {});
}
function mechClick(pitch = 1) {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, (getSettings().sfxVolume ?? 0.7) * 0.35));

    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = "square";
    snapOsc.frequency.setValueAtTime(1150 * pitch, t);
    snapOsc.frequency.exponentialRampToValueAtTime(220, t + 0.025);
    snapGain.gain.setValueAtTime(vol, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    snapOsc.connect(snapGain).connect(ctx.destination);
    snapOsc.start(t);
    snapOsc.stop(t + 0.035);

    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(58 * pitch, t + 0.008);
    thudOsc.frequency.exponentialRampToValueAtTime(28, t + 0.09);
    thudGain.gain.setValueAtTime(vol * 1.1, t + 0.008);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    thudOsc.connect(thudGain).connect(ctx.destination);
    thudOsc.start(t + 0.008);
    thudOsc.stop(t + 0.1);

    setTimeout(() => { void ctx.close(); }, 140);
  } catch { /* noop */ }
}
function snap() {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "square"; o.frequency.setValueAtTime(320, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.3 * (getSettings().sfxVolume ?? 0.7), ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12); setTimeout(() => ctx.close(), 300);
  } catch { /* noop */ }
}

function buzz() {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = 90;
    g.gain.setValueAtTime(0.25 * (getSettings().sfxVolume ?? 0.7), ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36); setTimeout(() => ctx.close(), 500);
  } catch { /* noop */ }
}

/** One full crank turn = this much charge. 5 turns to 100%. */
const CRANK_PER_TURN = 20;

export function PowerTask({ onDone, socketEl, onPlugged }: { onDone: () => void; socketEl?: () => HTMLElement | null; onPlugged?: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setTimeout(() => tick((n) => n + 1), 450); return () => clearTimeout(t); }, []);
  const [sw, setSw] = useState(false);
  const [plug, setPlug] = useState<{ x: number; y: number } | null>(null); // drag pos while held
  const [plugged, setPlugged] = useState(false);
  const [charge, setCharge] = useState(0);
  const angle = useRef(0);
  const shownCharge = useRef(0);
  const [lights, setLights] = useState(false);
  const rigRef = useRef<HTMLDivElement>(null);
  const localSocket = useRef<HTMLDivElement>(null);
  const socketRef = { get current() { return (socketEl?.() as HTMLDivElement | null) ?? localSocket.current; } };
  const hubRef = useRef<HTMLDivElement>(null);
  const crankArmRef = useRef<HTMLDivElement>(null);
  const genRef = useRef<HTMLDivElement>(null);
  const hum = useHum();
  const crankLast = useRef<number | null>(null);
  const nextClick = useRef(30);

  // Completion timer lives in a ref and is never cleared on unmount: closing the
  // console during "LIGHTS ON!" must still advance to Task 2 and light the room.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (charge < 100 || doneTimer.current != null) return;
    setLights(true); hum.stop(); sfx(lightsSfx.url);
    doneTimer.current = setTimeout(onDone, 0); // lights come on the instant the crank finishes
  }, [charge, hum, onDone]);

  const rel = (e: React.PointerEvent) => {
    const r = rigRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const plugDown = (e: React.PointerEvent) => {
    if (!sw || plugged) return;
    (e.target as Element).setPointerCapture(e.pointerId); setPlug(rel(e)); mayhemSfx.puzzleGrab(0.9);
  };
  const plugMove = (e: React.PointerEvent) => { if (plug) setPlug(rel(e)); };
  const plugUp = (e: React.PointerEvent) => {
    if (!plug) return;
    const s = socketRef.current!.getBoundingClientRect();
    const near = Math.hypot(e.clientX - (s.left + s.width / 2), e.clientY - (s.top + s.height / 2)) < 60;
    setPlug(null);
    if (near) { setPlugged(true); onPlugged?.(); snap(); mechClick(1.2); mayhemSfx.puzzleConnect(); mayhemSfx.generatorImpact(false); } else mayhemSfx.puzzleRelease();
  };

  const hubAngle = (e: React.PointerEvent) => {
    const r = hubRef.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const crankDown = (e: React.PointerEvent) => {
    if (!plugged || lights) return;
    (e.target as Element).setPointerCapture(e.pointerId); crankLast.current = hubAngle(e);
  };
  const crankMove = (e: React.PointerEvent) => {
    if (crankLast.current == null || lights) return;
    const a = hubAngle(e); let d = a - crankLast.current;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    crankLast.current = a;
    if (d <= 0) return; // clockwise only, ratchet holds
    angle.current += d;
    if (crankArmRef.current) {
      crankArmRef.current.style.transform = `rotate(${angle.current}deg)`;
    }
    const nextCharge = Math.min(100, (angle.current / 360) * CRANK_PER_TURN);
    const wholeCharge = Math.floor(nextCharge);
    if (wholeCharge !== shownCharge.current) {
      shownCharge.current = wholeCharge;
      setCharge(wholeCharge);
      if (wholeCharge % 5 === 0) mayhemSfx.generatorCount();
    }
    if (angle.current >= nextClick.current) {
      nextClick.current = angle.current + 45;
      sfx(windupSfx.url, 0.8); mechClick(0.7 + nextCharge / 200); mayhemSfx.puzzleStep(Math.floor(angle.current / 45));
    }
    hum.set(nextCharge);
  };
  const crankUp = () => { crankLast.current = null; };

  // Plug head: hanging off the Stevenson generator's side when idle, under the finger while dragging, seated when plugged.
  const rig = rigRef.current?.getBoundingClientRect();
  const sock = socketRef.current?.getBoundingClientRect();
  const gen = genRef.current?.getBoundingClientRect();
  const src = rig && gen ? { x: gen.right - rig.left - 4, y: gen.top - rig.top + gen.height * 0.62 } : { x: 380, y: 140 };
  const home = { x: src.x + 34, y: src.y + 70 };
  const head = plugged && rig && sock ? { x: sock.left - rig.left + sock.width / 2, y: sock.top - rig.top + sock.height / 2 } : plug ?? home;
  const midY = Math.max(src.y, head.y) + 60;

  return (
    <div className={`mo-pw ${lights ? "lit" : ""}`} ref={rigRef}>
      {/* The actual Stevenson's Ultra Power Generator 9000, sitting next to the console */}
      <div ref={genRef} className={`mo-stv ${plugged ? "live" : ""}`}>
        <GeneratorArtwork className="mo-stv-art" />
        <div className="mo-stv-bar"><div style={{ width: `${charge}%` }} /></div>
        <div className="mo-stv-box">
          <button className={`mo-pw-lever ${sw ? "on" : ""}`} disabled={sw} onClick={() => { setSw(true); snap(); mechClick(0.8); mayhemSfx.puzzleConnect(); hum.start(); }} aria-label="Flip power switch">
            <span className="mo-pw-arm" />
          </button>
          {plugged && <div className="mo-pw-crank mo-pw-crank-pop">
            <div ref={hubRef} className="mo-pw-hub" onPointerDown={crankDown} onPointerMove={crankMove} onPointerUp={crankUp} onPointerCancel={crankUp}>
              <div ref={crankArmRef} className="mo-pw-crankarm"><span className="mo-pw-knob" /></div>
            </div>
          </div>}
          <div className="mo-pw-leds"><i className={sw ? "" : "red"} /><i className={plugged ? "green" : ""} /></div>
        </div>
      </div>

      <svg className="mo-pw-cable" width="100%" height="100%">
        <path d={`M${src.x},${src.y} C${src.x + 40},${midY} ${head.x},${midY} ${head.x},${head.y}`} />
      </svg>
      <div className={`mo-pw-plug ${plug ? "held" : ""} ${!sw ? "dead" : ""}`} style={{ left: head.x, top: head.y }}
        onPointerDown={plugDown} onPointerMove={plugMove} onPointerUp={plugUp} aria-label="Power plug" />

      {!socketEl && <div className="mo-pw-console">
        <div className="mo-pw-label">CONSOLE</div>
        <div ref={localSocket} className={`mo-pw-socket ${plugged ? "on" : ""}`}><b /><b /></div>
      </div>}

    </div>
  );
}

/** Generator hum: starts on the switch, rises in pitch and volume with the crank charge. */
function useHum() {
  const ref = useRef<{ ctx: AudioContext; o: OscillatorNode; g: GainNode } | null>(null);
  useEffect(() => () => { const h = ref.current; if (h) { try { h.o.stop(); } catch { /* */ } void h.ctx.close(); } }, []);
  return useMemo(() => ({
    start() {
      if (ref.current) return;
      try {
        const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
        o.type = "sawtooth"; o.frequency.value = 38; g.gain.value = 0.04 * (getSettings().sfxVolume ?? 0.7);
        o.connect(lp).connect(g).connect(ctx.destination); o.start(); ref.current = { ctx, o, g };
      } catch { /* noop */ }
    },
    set(charge: number) {
      const h = ref.current; if (!h) return;
      const t = h.ctx.currentTime;
      h.o.frequency.setTargetAtTime(38 + charge * 1.4, t, 0.08);
      h.g.gain.setTargetAtTime((0.04 + charge * 0.0012) * (getSettings().sfxVolume ?? 0.7), t, 0.08);
    },
    stop() {
      const h = ref.current; if (!h) return; ref.current = null;
      h.g.gain.setTargetAtTime(0, h.ctx.currentTime, 0.15);
      setTimeout(() => { try { h.o.stop(); } catch { /* */ } void h.ctx.close(); }, 800);
    },
  }), []);
}

function CodeTask({ onDone }: { onDone: () => void }) {
  const [r] = useState(() => makeCodeRound());
  const [wrong, setWrong] = useState(-1);
  const [success, setSuccess] = useState(-1);
  const [locked, setLocked] = useState(false);

  const finalHint = `HINT: [ ${r.options[r.answer].split("").map((d, i) => (i === r.hintPos ? d : "_")).join(" ")} ]`;

  const handleChoice = (i: number) => {
    if (locked) return;
    mechClick();
    mayhemSfx.generatorCount?.();

    if (i === r.answer) {
      setLocked(true);
      setSuccess(i);
      mayhemSfx.puzzleConnect?.();
      window.setTimeout(() => onDone(), 180);
      return;
    }

    setWrong(i);
    setLocked(true);
    buzz();
    window.setTimeout(() => {
      setWrong(-1);
      setLocked(false);
    }, 300);
  };

  return (
    <div className="mo-code-rig">
      <div className="mo-con-col">
        <div className="mo-con-label">CONSOLE</div>
        <div className="mo-con-grid">
          {r.options.map((o, i) => (
            <button
              key={o}
              className={`mo-con-btn ${wrong === i ? "bad" : ""} ${success === i ? "mo-con-btn-success" : ""}`}
              disabled={locked}
              onClick={() => handleChoice(i)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
      <div className="mo-stev">
        <GeneratorArtwork className="mo-stev-art" />
        <output className="mo-stev-screen" aria-label={`Generator code hint: ${finalHint}`}>
          {finalHint}
        </output>
      </div>
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
      else { setLit(seq[i]); mayhemSfx.puzzleSignal(seq[i]); on = true; }
    }, 600);
    return () => clearInterval(id);
  }, [showing, seq]);
  const press = (b: number) => {
    if (showing) return;
    mechClick(0.8 + b * 0.12);
    mayhemSfx.puzzleSignal(b);
    if (b !== seq[pos]) { mayhemSfx.puzzleWrong(); setSeq(makeSimonSequence(round)); setPos(0); setShowing(true); return; }
    if (pos + 1 >= seq.length) { mayhemSfx.puzzleConnect(); setTimeout(onDone, 200); } else setPos(pos + 1);
  };
  return (
    <div className="mo-con-col">
      <div className="mo-simon">
        {Array.from({ length: SIMON_BUTTONS }, (_, b) => (
          <button key={b} className={`mo-simon-b mo-s${b} ${lit === b ? "lit" : ""}`} onClick={() => press(b)} aria-label={`Button ${"ABCDEF"[b]}`}>{"ABCDEF"[b]}</button>
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
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [jiggle, setJiggle] = useState<{ color: WireColor; id: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const jiggleId = useRef(0);
  const completed = useRef(false);
  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!held || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setCursor({
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    });
  };
  const wirePath = (x1: number, y1: number, x2: number, y2: number) =>
    `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.max(y1, y2) + 20} ${x2} ${y2}`;
  return (
    <div className="mo-con-wires" onPointerMove={pointerMove}>
      <svg ref={svgRef} className="mo-wires" viewBox="0 0 100 100" preserveAspectRatio="none">
        {linked.map((c) => (
          <path key={`${c}-${jiggle?.color === c ? jiggle.id : 0}`}
            d={wirePath(12, 12.5 + WIRE_COLORS.indexOf(c) * 25, 88, 12.5 + ports.indexOf(c) * 25)}
            className={`mo-wire-path mo-w-${c}${jiggle?.color === c ? " mo-wire-jiggle" : ""}`}
            strokeWidth={6} vectorEffect="non-scaling-stroke" />
        ))}
        {held && cursor && (
          <path d={wirePath(12, 12.5 + WIRE_COLORS.indexOf(held) * 25, cursor.x, cursor.y)}
            className={`mo-wire-path mo-w-${held} mo-wire-live`} strokeWidth={6} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div className="mo-ports">
        <div className="mo-wire-plugs">{WIRE_COLORS.map((c) => (
          <button key={c} className={`mo-port mo-wire-plug mo-p-${c} ${held === c ? "held" : ""}`} disabled={linked.includes(c)} onClick={() => { mechClick(0.9); mayhemSfx.terminalSelect(); setHeld(c); }} aria-label={`${c} plug`} />
        ))}</div>
        <div className="mo-wire-terminals">{ports.map((c) => (
          <button key={c} className={`mo-port mo-wire-terminal mo-p-${c}`} disabled={linked.includes(c)} aria-label={`${c} port`}
            onClick={() => {
              if (!held || completed.current) return;
              mechClick(0.9);
              const next = tryConnect(linked, held, c);
              if (next.length > linked.length) mayhemSfx.puzzleConnect(); else buzz();
              setLinked(next);
              if (next.length > linked.length) setJiggle({ color: held, id: ++jiggleId.current });
              setHeld(null);
              setCursor(null);
              if (taskComplete(next)) { completed.current = true; onDone(); }
            }} />
        ))}</div>
      </div>
    </div>
  );
}

function SurgeTask({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [complete, setComplete] = useState(false);
  const inputs = useRef({ key: false, pointer: false });
  const startedAt = useRef({ key: 0, pointer: 0 });
  const completed = useRef(false);
  const charge = useRef(pct);
  charge.current = pct;
  const hum = useHum();

  const addTap = useCallback((click: boolean) => {
    if (completed.current) return;
    if (click) mechClick(0.7);
    setPct((value) => addSurge(value, SURGE_TAP));
  }, []);
  const beginHold = useCallback((source: "key" | "pointer") => {
    if (completed.current || inputs.current[source]) return;
    inputs.current[source] = true;
    startedAt.current[source] = performance.now();
    mechClick(0.7);
    hum.start();
  }, [hum]);
  const endHold = useCallback((source: "key" | "pointer", countTap: boolean) => {
    if (!inputs.current[source]) return;
    inputs.current[source] = false;
    if (countTap && performance.now() - startedAt.current[source] < 180) addTap(false);
    if (!inputs.current.key && !inputs.current.pointer) hum.stop();
  }, [addTap, hum]);

  useEffect(() => {
    const activeInputs = inputs.current;
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && !e.repeat) beginHold("key");
    };
    const up = (e: KeyboardEvent) => { if (e.code === "KeyE") endHold("key", true); };
    const pointerUp = () => endHold("pointer", true);
    const pointerCancel = () => endHold("pointer", false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    let last = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (activeInputs.key || activeInputs.pointer) {
        setPct((value) => addSurge(value, SURGE_HOLD_PER_SEC * dt));
        hum.set(charge.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      activeInputs.key = false;
      activeInputs.pointer = false;
      hum.stop();
    };
  }, [beginHold, endHold, hum]);
  useEffect(() => {
    if (pct < 100 || completed.current) return;
    completed.current = true;
    inputs.current.key = false;
    inputs.current.pointer = false;
    hum.stop();
    mechClick(0.5);
    setComplete(true);
    window.setTimeout(onDone, 350);
  }, [hum, onDone, pct]);

  return (
    <div className={`mo-surge-console${pct >= 70 ? " amber" : ""}${complete ? " complete" : ""}`}>
      <div className="mo-surge-title">EMERGENCY SURGE BREAKER</div>
      <div className="mo-surge-readout">
        <span>CAPACITOR CHARGE</span>
        <output>{Math.floor(pct)}%</output>
      </div>
      <div
        className={`mo-surge-meter${pct >= 70 ? " amber" : ""}`}
        role="meter"
        aria-label="Capacitor charge"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(pct)}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={pct >= (i + 1) * 5 ? "active" : ""} aria-hidden="true" />
        ))}
      </div>
      <button
        className="mo-surge-breaker"
        disabled={complete}
        aria-label="Charge emergency surge breaker"
        onPointerDown={() => beginHold("pointer")}
        onPointerUp={() => endHold("pointer", true)}
        onPointerCancel={() => endHold("pointer", false)}
        onClick={(e) => { if (e.detail === 0) addTap(true); }}
      >
        <span className="mo-surge-lever" aria-hidden="true" />
        <span>CHARGE BREAKER</span>
      </button>
      <div className="mo-surge-hint">HOLD E OR PRESS AND HOLD · TAP TO PULSE</div>
    </div>
  );
}
