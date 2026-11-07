import { useEffect, useRef, useState } from "react";
import { getSettings } from "@/game/settings";
import doorOpen from "@/assets/manager/door_open.png.asset.json";
import doorClosed from "@/assets/manager/door_closed.png.asset.json";
import frontRoom from "@/assets/manager/front_room.png.asset.json";
import frontTable from "@/assets/manager/front_table.png.asset.json";
import finalTip from "@/assets/manager/final_tip.png.asset.json";
import utilRoom from "@/assets/manager/util_room.png.asset.json";
import utilFull from "@/assets/manager/util_desk_full.png.asset.json";
import utilUsed from "@/assets/manager/util_desk_used.png.asset.json";
import ceilingImg from "@/assets/manager/ceiling.png.asset.json";
import ventImg from "@/assets/manager/vent.png.asset.json";
import nopeSfx from "@/assets/manager/nope.mp3.asset.json";
import ventWalkSfx from "@/assets/manager/ventwalk.wav.asset.json";
import {
  approach, edgeZone, stepYawTarget, officePitch, ventStepsCrossed, OFFICE_MAX_YAW, shuffledPorts, taskComplete, tryConnect, viewForKey,
  OFFICE_FURNITURE_SCALE, OFFICE_DESK_DEPTH, OFFICE_UTIL_DEPTH,
  WIRE_COLORS, type OfficeView, type WireColor,
} from "./managerOfficeRules";
import Terminal, { makeTerminalSession, type TerminalSession } from "./Terminal";
import { mayhemSfx } from "@/game/sfx";
import "./managerOffice.css";

const FACE_ASPECT = 553 / 949;
const DESK_DEPTH = OFFICE_DESK_DEPTH;
const UTIL_DEPTH = OFFICE_UTIL_DEPTH;
const FURNITURE_SCALE = OFFICE_FURNITURE_SCALE;

function vol() { return Math.max(0, Math.min(1, getSettings().sfxVolume ?? 0.7)); }
function playOnce(url: string, v = 1) {
  const a = new Audio(url); a.volume = vol() * v; a.play().catch(() => {});
}
function click() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "square"; o.frequency.value = 1800;
    g.gain.setValueAtTime(0.12 * vol(), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.04);
    setTimeout(() => ctx.close(), 200);
  } catch { /* noop */ }
}
function zap() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(90, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.35);
    g.gain.setValueAtTime(0.35 * vol(), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.42);
    setTimeout(() => ctx.close(), 600);
  } catch { /* noop */ }
}

/** Night 5 Manager's Office test room. Press "\" anywhere to open/close. No threats, no boss. */
export default function ManagerOffice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "\\" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return open ? <OfficeRoom onExit={() => setOpen(false)} /> : null;
}

function OfficeRoom({ onExit }: { onExit: () => void }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const cursorX = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const ventRef = useRef<HTMLImageElement>(null);
  const lookRight = useRef(false);
  const [flash, setFlash] = useState(false);
  const [view, setView] = useState<OfficeView>("desk");
  const viewRef = useRef(view); viewRef.current = view;
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [doorShut, setDoorShut] = useState(false);
  const [medUsed, setMedUsed] = useState(false);
  const [hp, setHp] = useState(50);
  const [tipOpen, setTipOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const crawlAudio = useRef<HTMLAudioElement | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  const [termSession, setTermSession] = useState<TerminalSession>(() => makeTerminalSession());
  const overlayOpen = tipOpen || taskOpen || termOpen;

  // Box dimensions: the front face exactly covers the screen when facing it.
  const P = Math.max(size.w / 2, size.h / (2 * FACE_ASPECT)) * 1.04;
  const S = 2 * P;
  const H = S * FACE_ASPECT;

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onMove = (e: PointerEvent) => {
      cursorX.current = (e.clientX / window.innerWidth) * 2 - 1;
      stageRef.current?.style.setProperty("--fx", `${e.clientX}px`);
      stageRef.current?.style.setProperty("--fy", `${e.clientY}px`);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { onExit(); return; }
      if (e.code === "KeyZ") { if (!e.repeat) { setFlash(true); click(); } return; }
      if (e.repeat) return;
      if (e.code === "KeyA") { setDoorShut((d) => !d); return; }
      if (e.code === "KeyG") {
        setTermOpen((o) => {
          lookRight.current = !o;
          if (o) mayhemSfx.terminalClose(); else mayhemSfx.terminalOpen();
          return !o;
        });
        setView("desk");
        return;
      }
      setView((v) => viewForKey(e.code, v));
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === "KeyZ") { setFlash(false); click(); } };
    window.addEventListener("keyup", onUp);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [onExit]);

  // One stepper: smooth yaw/pitch toward their targets.
  const overlayRef = useRef(overlayOpen); overlayRef.current = overlayOpen;
  useEffect(() => {
    let yaw = 0, target = 0, zone = 0, pitch = 0, last = performance.now(), raf = 0, audioT = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (lookRight.current) target = OFFICE_MAX_YAW;
      else if (!overlayRef.current) {
        const z = edgeZone(cursorX.current);
        target = stepYawTarget(target, zone, z);
        zone = z;
      }
      yaw = approach(yaw, target, dt, 14);
      // One vent jolt per crawl footstep in the sound.
      const a = crawlAudio.current;
      if (a) {
        const t = a.currentTime;
        if (ventStepsCrossed(audioT, t) > 0 && ventRef.current) {
          const v = ventRef.current;
          v.classList.remove("mo-shake"); void v.offsetWidth; v.classList.add("mo-shake");
        }
        audioT = t;
      } else audioT = 0;
      pitch = approach(pitch, officePitch(viewRef.current), dt, 6);
      if (worldRef.current) {
        worldRef.current.style.transform = `translateZ(${P}px) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [P]);

  // Vent crawl loop + cleanup.
  useEffect(() => {
    if (!crawling) return;
    const a = new Audio(ventWalkSfx.url); a.loop = true; a.volume = vol();
    a.play().catch(() => {});
    crawlAudio.current = a;
    return () => { a.pause(); crawlAudio.current = null; };
  }, [crawling]);

  const face = (w: number, h: number, transform: string): React.CSSProperties => ({
    width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform,
  });

  // A desk at fraction k of the wall distance, shrunk by k so it keeps its painted size,
  // with its legs resting on the floor.
  const prop = (w0: number, h0: number, turn: string, k: number): React.CSSProperties => {
    const w = w0 * FURNITURE_SCALE, h = h0 * FURNITURE_SCALE;
    return {
      width: w * k, height: h * k, marginLeft: (-w * k) / 2, marginTop: (-h * k) / 2,
      transform: `${turn}translateY(${H / 2 - (h * k) / 2}px) translateZ(${(-S / 2) * k}px)`,
    };
  };

  // Mobile: tap top/bottom strips to tilt.
  const onStagePointer = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    cursorX.current = (e.clientX / window.innerWidth) * 2 - 1;
    const y = e.clientY / window.innerHeight;
    if (y < 0.16) setView("ceiling");
    else if (y > 0.84) setView("desk");
  };

  return (
    <div ref={stageRef} className="mo-stage" style={{ perspective: `${P}px` }} onPointerDown={onStagePointer}>
      <div ref={worldRef} className="mo-world">
        {/* LEFT: door */}
        <div className="mo-face" style={face(S, H, `rotateY(90deg) translateZ(${-S / 2}px)`)}>
          <img src={doorShut ? doorClosed.url : doorOpen.url} alt="Office door" draggable={false} />
          <button className="mo-hot" style={{ left: "70.6%", top: "37.8%", width: "7.8%", height: "13.4%" }}
            aria-label="Door button" onClick={() => { setDoorShut((d) => !d); }} />
          <button className="mo-hot" style={{ left: "70.4%", top: "53.8%", width: "8.2%", height: "13.8%" }}
            aria-label="Blue button" onClick={() => playOnce(nopeSfx.url)} />
        </div>

        {/* FRONT: room */}
        <div className="mo-face" style={face(S, H, `translateZ(${-S / 2}px)`)}>
          <img src={frontRoom.url} alt="Manager's office" draggable={false} />
        </div>

        {/* RIGHT: utilities */}
        <div className="mo-face" style={face(S, H, `rotateY(-90deg) translateZ(${-S / 2}px)`)}>
          <img src={utilRoom.url} alt="Utilities room" draggable={false} />
        </div>

        {/* DESKS: standalone layers standing on the floor, in front of the walls */}
        <div className="mo-face mo-prop" style={prop(0.745 * S, 0.564 * H, "", DESK_DEPTH)}>
          <img src={frontTable.url} alt="Manager's desk" draggable={false} />
          <button className="mo-hot" style={{ left: "37.5%", top: "6%", width: "28%", height: "41%" }}
            aria-label="Terminal" onClick={() => { lookRight.current = false; setTaskOpen(true); }} />
          <button className="mo-hot" style={{ left: "17.8%", top: "70%", width: "10%", height: "18%" }}
            aria-label="Tip note" onClick={() => setTipOpen(true)} />
        </div>
        <div className="mo-face mo-prop" style={prop(S, 0.374 * H, "rotateY(-90deg) ", UTIL_DEPTH)}>
          <img src={medUsed ? utilUsed.url : utilFull.url} alt="Utilities desk" draggable={false} />
          {!medUsed && (
            <button className="mo-hot" style={{ left: "57.5%", top: "5%", width: "15.5%", height: "66%" }}
              aria-label="First aid kit" onClick={() => { setMedUsed(true); setHp(100); }} />
          )}
        </div>

        {/* FLOOR: plain grey like the walls */}
        <div className="mo-face mo-floor" style={face(S, S, `rotateX(90deg) translateZ(${-H / 2}px)`)} />

        {/* CEILING: vent */}
        <div className="mo-face" style={face(S, S, `rotateX(-90deg) translateZ(${-H / 2}px)`)}>
          <img src={ceilingImg.url} alt="Ceiling" draggable={false} />
          <img ref={ventRef} src={ventImg.url} alt="Vent" draggable={false} className="mo-vent" />
          <button className="mo-shock" onClick={() => { zap(); setCrawling(false); }}>SHOCK</button>
        </div>
      </div>

      {/* HUD */}
      <div className="mo-hud">
        <div>TEST ROOM · HP {hp}</div>
        <div className="mo-hint">mouse to edges = look · W vent · S desk · A door · G terminal · hold Z light · \ or ESC exit</div>
        {view === "ceiling" && (
          <button className="mo-test" onClick={() => setCrawling((c) => !c)}>
            {crawling ? "stop crawl" : "test: NEO-MATA crawl"}
          </button>
        )}
      </div>

      {flash && <div className="mo-flash" aria-hidden />}

      {tipOpen && (
        <div className="mo-overlay" onClick={() => setTipOpen(false)}>
          <img src={finalTip.url} alt="Your final tip" className="mo-tip" draggable={false} />
        </div>
      )}
      {termOpen && (
        <div className="mo-term">
          <Terminal paused={false} session={termSession} onSessionChange={setTermSession}
            onClose={() => { mayhemSfx.terminalClose(); lookRight.current = false; setTermOpen(false); }} />
        </div>
      )}
      {taskOpen && (
        <WireTask
          done={taskDone}
          onDone={() => setTaskDone(true)}
          onClose={() => { lookRight.current = false; setTaskOpen(false); }}
        />
      )}
    </div>
  );
}

function WireTask({ done, onDone, onClose }: { done: boolean; onDone: () => void; onClose: () => void }) {
  const [ports] = useState(() => shuffledPorts());
  const [linked, setLinked] = useState<WireColor[]>(done ? [...WIRE_COLORS] : []);
  const [held, setHeld] = useState<WireColor | null>(null);
  const finished = taskComplete(linked);
  useEffect(() => { if (finished && !done) onDone(); }, [finished, done, onDone]);

  return (
    <div className="mo-overlay" onClick={onClose}>
      <div className="mo-crt" onClick={(e) => e.stopPropagation()}>
        <div className="mo-crt-title">{finished ? "REROUTE COMPLETE" : "WIRE PATCH — match the colors"}</div>
        <svg className="mo-wires" viewBox="0 0 100 100" preserveAspectRatio="none">
          {linked.map((c) => (
            <line key={c} x1={12} y1={15 + WIRE_COLORS.indexOf(c) * 23} x2={88} y2={15 + ports.indexOf(c) * 23}
              className={`mo-w-${c}`} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="mo-ports">
          <div>{WIRE_COLORS.map((c) => (
            <button key={c} className={`mo-port mo-p-${c} ${held === c ? "held" : ""}`}
              disabled={linked.includes(c)} onClick={() => setHeld(c)} aria-label={`${c} plug`} />
          ))}</div>
          <div>{ports.map((c) => (
            <button key={c} className={`mo-port mo-p-${c}`} disabled={linked.includes(c)} aria-label={`${c} port`}
              onClick={() => { if (held) { setLinked((l) => tryConnect(l, held, c)); setHeld(null); } }} />
          ))}</div>
        </div>
        <div className="mo-crt-foot">click outside to close</div>
      </div>
    </div>
  );
}
