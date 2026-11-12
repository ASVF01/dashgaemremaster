import { useEffect, useRef, useState } from "react";
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
    <div className="mo-overlay" onClick={onClose}>
      <div className="mo-crt" onClick={(e) => e.stopPropagation()}>
        <div className="mo-crt-title">{progress.done ? "ALL TASKS COMPLETE" : `${TITLES[kind]}${total > 1 ? ` [${progress.round}/${total}]` : ""}`}</div>
        <div className="mo-con-body" onPointerOver={(e) => {
          const btn = (e.target as Element).closest("button");
          if (btn && !btn.contains(e.relatedTarget as Node | null)) mayhemSfx.generatorHover();
        }}>
          {progress.done ? <p>Console online. (Boss not added yet.)</p> : (
            <>
              {kind === "power" && <PowerTask onDone={onRound} />}
              {kind === "code" && <CodeTask key={progress.round} onDone={() => { mayhemSfx.generatorImpact(false); onRound(); }} />}
              {kind === "simon" && <SimonTask key={progress.round} round={progress.round} onDone={() => { mayhemSfx.generatorImpact(false); onRound(); }} />}
              {kind === "wire" && <WireTask key={progress.round} onDone={() => { mayhemSfx.generatorImpact(false); onRound(); }} />}
              {kind === "surge" && <SurgeTask onDone={onRound} />}
            </>
          )}
        </div>
        <div className="mo-crt-foot">click outside or G to close</div>
      </div>
    </div>
  );
}

function sfx(url: string, v = 1) {
  const a = new Audio(url); a.volume = Math.max(0, Math.min(1, (getSettings().sfxVolume ?? 0.7) * v)); a.play().catch(() => {});
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

function PowerTask({ onDone }: { onDone: () => void }) {
  const [sw, setSw] = useState(false);
  const [plug, setPlug] = useState<{ x: number; y: number } | null>(null); // drag pos while held
  const [plugged, setPlugged] = useState(false);
  const [angle, setAngle] = useState(0); // total degrees cranked
  const [lights, setLights] = useState(false);
  const rigRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const genRef = useRef<HTMLDivElement>(null);
  const hum = useHum();
  const crankLast = useRef<number | null>(null);
  const nextClick = useRef(30);
  const charge = Math.min(100, (angle / 360) * CRANK_PER_TURN);

  // Completion timer lives in a ref and is never cleared on unmount: closing the
  // console during "LIGHTS ON!" must still advance to Task 2 and light the room.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (charge < 100 || doneTimer.current != null) return;
    setLights(true); hum.stop(); sfx(lightsSfx.url); mayhemSfx.generatorImpact(false);
    doneTimer.current = setTimeout(onDone, 0); // lights come on the instant the crank finishes
  }, [charge, onDone]);

  const rel = (e: React.PointerEvent) => {
    const r = rigRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const plugDown = (e: React.PointerEvent) => {
    if (!sw || plugged) return;
    (e.target as Element).setPointerCapture(e.pointerId); setPlug(rel(e));
  };
  const plugMove = (e: React.PointerEvent) => { if (plug) setPlug(rel(e)); };
  const plugUp = (e: React.PointerEvent) => {
    if (!plug) return;
    const s = socketRef.current!.getBoundingClientRect();
    const near = Math.hypot(e.clientX - (s.left + s.width / 2), e.clientY - (s.top + s.height / 2)) < 60;
    setPlug(null);
    if (near) { setPlugged(true); snap(); mayhemSfx.generatorImpact(false); }
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
    setAngle((prev) => {
      const n = prev + d;
      if (n >= nextClick.current) { nextClick.current = n + 45; sfx(windupSfx.url, 0.8); }
      hum.set(Math.min(100, (n / 360) * CRANK_PER_TURN));
      return n;
    });
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
          <button className={`mo-pw-lever ${sw ? "on" : ""}`} disabled={sw} onClick={() => { setSw(true); snap(); hum.start(); }} aria-label="Flip power switch">
            <span className="mo-pw-arm" />
          </button>
          <div className={`mo-pw-crank ${plugged ? "" : "dead"}`}>
            <div ref={hubRef} className="mo-pw-hub" onPointerDown={crankDown} onPointerMove={crankMove} onPointerUp={crankUp} onPointerCancel={crankUp}>
              <div className="mo-pw-crankarm" style={{ transform: `rotate(${angle}deg)` }}><span className="mo-pw-knob" /></div>
            </div>
          </div>
          <div className="mo-pw-leds"><i className={sw ? "" : "red"} /><i className={plugged ? "green" : ""} /></div>
        </div>
      </div>

      <svg className="mo-pw-cable" width="100%" height="100%">
        <path d={`M${src.x},${src.y} C${src.x + 40},${midY} ${head.x},${midY} ${head.x},${head.y}`} />
      </svg>
      <div className={`mo-pw-plug ${plug ? "held" : ""} ${!sw ? "dead" : ""}`} style={{ left: head.x, top: head.y }}
        onPointerDown={plugDown} onPointerMove={plugMove} onPointerUp={plugUp} aria-label="Power plug" />

      <div className="mo-pw-console">
        <div className="mo-pw-label">CONSOLE IN</div>
        <div ref={socketRef} className={`mo-pw-socket ${plugged ? "on" : ""}`}><b /><b /></div>
      </div>

      <div className="mo-con-hint mo-pw-hint">
        {lights ? "LIGHTS ON!" : !sw ? "flip the Stevenson's switch" : !plugged ? "plug the Stevenson into the console" : `crank the Stevenson · ${Math.floor(charge)}%`}
      </div>
    </div>
  );
}

/** Generator hum: starts on the switch, rises in pitch and volume with the crank charge. */
function useHum() {
  const ref = useRef<{ ctx: AudioContext; o: OscillatorNode; g: GainNode } | null>(null);
  useEffect(() => () => { const h = ref.current; if (h) { try { h.o.stop(); } catch { /* */ } void h.ctx.close(); } }, []);
  return {
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
  };
}

function CodeTask({ onDone }: { onDone: () => void }) {
  const [r] = useState(() => makeCodeRound());
  const [wrong, setWrong] = useState(-1);
  const hint = r.options[r.answer].split("").map((d, i) => (i === r.hintPos ? d : "_")).join(" ");
  return (
    <div className="mo-code-rig">
      <div className="mo-con-col">
        <div className="mo-con-label">CONSOLE</div>
        <div className="mo-con-grid">
          {r.options.map((o, i) => (
            <button key={o} className={`mo-con-btn ${wrong === i ? "bad" : ""}`} onClick={() => { if (i === r.answer) onDone(); else { setWrong(i); buzz(); } }}>{o}</button>
          ))}
        </div>
      </div>
      <div className="mo-stev">
        <div className="mo-con-label">STEVENSON TERMINAL</div>
        <div className="mo-stev-screen">{hint}</div>
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
      else { setLit(seq[i]); on = true; }
    }, 600);
    return () => clearInterval(id);
  }, [showing, seq]);
  const press = (b: number) => {
    if (showing) return;
    mayhemSfx.generatorCount();
    if (b !== seq[pos]) { buzz(); setSeq(makeSimonSequence(round)); setPos(0); setShowing(true); return; }
    if (pos + 1 >= seq.length) onDone(); else setPos(pos + 1);
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
  const completed = useRef(false);
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
          <button key={c} className={`mo-port mo-p-${c} ${held === c ? "held" : ""}`} disabled={linked.includes(c)} onClick={() => { mayhemSfx.terminalSelect(); setHeld(c); }} aria-label={`${c} plug`} />
        ))}</div>
        <div>{ports.map((c) => (
          <button key={c} className={`mo-port mo-p-${c}`} disabled={linked.includes(c)} aria-label={`${c} port`}
            onClick={() => {
              if (!held || completed.current) return;
              const next = tryConnect(linked, held, c);
              if (next.length > linked.length) mayhemSfx.puzzleConnect(); else buzz();
              setLinked(next);
              setHeld(null);
              if (taskComplete(next)) { completed.current = true; onDone(); }
            }} />
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
