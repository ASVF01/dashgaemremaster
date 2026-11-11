import { useCallback, useEffect, useRef, useState } from "react";
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
import doorGifted from "@/assets/manager/door_gifted.png.asset.json";
import metalWalkSfx from "@/assets/manager/metalwalk2.wav.asset.json";
import knockSfx from "@/assets/manager/knock2.wav.asset.json";
import ventWalkSfx from "@/assets/manager/ventwalk.wav.asset.json";
import {
  approach, edgeZone, yawTargetForView, officePitch, ventStepsCrossed, OFFICE_MAX_YAW, viewForKey, type OfficeView,
} from "./managerOfficeRules";
import { mayhemSfx } from "@/game/sfx";
import DeskConsole from "./DeskConsole";
import { useOfficeMusic } from "./useOfficeMusic";
import { completeRound, startConsole, CONSOLE_TASKS, TASK_ROUNDS } from "./officeConsoleRules";
import "./managerOffice.css";

const FACE_ASPECT = 553 / 949;

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
  useOfficeMusic();
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
  const [gifted, setGifted] = useState(false);
  // THE GIFTED: shut the door while she is there, she waits 3.5s, knocks, and leaves.
  useEffect(() => {
    if (!gifted || !doorShut) return;
    const t = setTimeout(() => { playOnce(knockSfx.url); setGifted(false); }, 3500);
    return () => clearTimeout(t);
  }, [gifted, doorShut]);
  const [medUsed, setMedUsed] = useState(false);
  const [hp, setHp] = useState(50);
  const [tipOpen, setTipOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(true); // Task 1 is the first thing the player does
  const [consoleProg, setConsoleProg] = useState(startConsole);
  const advanceConsole = useCallback(() => setConsoleProg(completeRound), []);
  const [crawling, setCrawling] = useState(false);
  const crawlAudio = useRef<HTMLAudioElement | null>(null);
  const overlayOpen = tipOpen || taskOpen;

  // Flat panel size: each wall picture covers the screen when facing it.
  const PW = Math.max(size.w, size.h / FACE_ASPECT);
  const PH = PW * FACE_ASPECT;
  // Box turn: camera fixed at the cube centre, so the facing wall always fills the screen (no pull-back).
  const P = PW / 2;

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
      if (e.code === "Digit1" || e.code === "Numpad1") {
        setGifted((g) => { if (!g) playOnce(metalWalkSfx.url); return true; });
        return;
      }
      if (e.code === "KeyA") { setDoorShut((d) => !d); return; }
      if (e.code === "KeyG") {
        setTaskOpen((o) => {
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
      const ceiling = viewRef.current === "ceiling";
      if (lookRight.current && !ceiling) target = OFFICE_MAX_YAW;
      else if (!overlayRef.current) {
        const z = ceiling ? 0 : edgeZone(cursorX.current);
        target = yawTargetForView(viewRef.current, target, zone, z);
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

  // Vent crawl: plays once through, one jolt per footstep, then stops.
  useEffect(() => {
    if (!crawling) return;
    const a = new Audio(ventWalkSfx.url); a.loop = false; a.volume = vol();
    a.onended = () => setCrawling(false);
    a.play().catch(() => {});
    crawlAudio.current = a;
    return () => { a.pause(); crawlAudio.current = null; };
  }, [crawling]);

  // Flat panel at grid column col (-1 left, 0 front, 1 right) and row (0 room, -1 ceiling).
  const panel = (col: number, row = 0): React.CSSProperties => {
    const h = row ? PW : PH;
    const turn = row ? "rotateX(-90deg)" : col ? `rotateY(${-col * 90}deg)` : "";
    const depth = row ? PH / 2 : P;
    return { width: PW, height: h, left: -PW / 2, top: -h / 2, transform: `${turn} translateZ(${-depth}px)` };
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
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><filter id="mo-ink-wobble"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="3" /></filter></svg>
      <div ref={worldRef} className="mo-world">
        {/* LEFT: door */}
        <div className="mo-face" style={panel(-1)}>
          <img src={doorShut ? doorClosed.url : gifted ? doorGifted.url : doorOpen.url} alt="Office door" draggable={false} />
          <button className="mo-hot" style={{ left: "70.6%", top: "37.8%", width: "7.8%", height: "13.4%" }}
            aria-label="Door button" onClick={() => { setDoorShut((d) => !d); }} />
          <button className="mo-hot" style={{ left: "70.4%", top: "53.8%", width: "8.2%", height: "13.8%" }}
            aria-label="Blue button" onClick={() => playOnce(nopeSfx.url)} />
        </div>

        {/* FRONT: room */}
        <div className="mo-face" style={panel(0)}>
          <img src={frontRoom.url} alt="Manager's office" draggable={false} />
          <div className="mo-desk">
            <img src={frontTable.url} alt="Manager's desk" draggable={false} />
            <button className="mo-hot" style={{ left: "37.5%", top: "6%", width: "28%", height: "41%" }}
              aria-label="Generator" onClick={() => { mayhemSfx.terminalOpen(); setTaskOpen(true); }} />
            <button className="mo-hot" style={{ left: "17.8%", top: "70%", width: "10%", height: "18%" }}
              aria-label="Tip note" onClick={() => setTipOpen(true)} />
          </div>
        </div>

        {/* RIGHT: utilities */}
        <div className="mo-face" style={panel(1)}>
          <img src={utilRoom.url} alt="Utilities room" draggable={false} />
          <div className="mo-util-desk">
            <img src={medUsed ? utilUsed.url : utilFull.url} alt="Utilities desk" draggable={false} />
            {!medUsed && (
              <button className="mo-hot" style={{ left: "57.5%", top: "5%", width: "15.5%", height: "66%" }}
                aria-label="First aid kit" onClick={() => { setMedUsed(true); setHp(100); }} />
            )}
          </div>
        </div>

        {/* CEILING: one strip above all three walls, vent above the desk */}
        <div className="mo-face" style={panel(0, -1)}>
          <img src={ceilingImg.url} alt="Ceiling" draggable={false} />
          <img ref={ventRef} src={ventImg.url} alt="Vent" draggable={false} className="mo-vent" />
          <button className="mo-shock" onClick={() => { zap(); setCrawling(false); }}>SHOCK</button>
        </div>
      </div>

      {/* HUD */}
      <div className="mo-hud">
        <div>TEST ROOM · HP {hp} · {consoleProg.done ? "TASKS DONE" : `TASK ${consoleProg.task + 1}/5 [${consoleProg.round}/${TASK_ROUNDS[CONSOLE_TASKS[consoleProg.task]]}]`}</div>
        <div className="mo-hint">mouse to edges = look · W vent · S desk · A door · 1 test GIFTED · G console · E surge · hold Z light · \ or ESC exit</div>
        {view === "ceiling" && (
          <button className="mo-test" onClick={() => setCrawling((c) => !c)}>
            {crawling ? "stop crawl" : "test: NEO-MATA crawl"}
          </button>
        )}
      </div>

      {consoleProg.task === 0 && !consoleProg.done
        ? <div className={`mo-dark${flash ? " lit" : ""}`} aria-hidden />
        : flash && <div className="mo-flash" aria-hidden />}

      {tipOpen && (
        <div className="mo-overlay" onClick={() => setTipOpen(false)}>
          <img src={finalTip.url} alt="Your final tip" className="mo-tip" draggable={false} />
        </div>
      )}
      {taskOpen && (
        <DeskConsole progress={consoleProg} onRound={advanceConsole}
          onClose={() => { mayhemSfx.terminalClose(); setTaskOpen(false); }} />
      )}
    </div>
  );
}
