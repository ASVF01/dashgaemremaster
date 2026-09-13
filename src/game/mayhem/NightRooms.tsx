// MAYHEM — first-person room navigation (the "night" shift).
//
// Office, camera system, hallway, storage room, and terminal navigation.
import { useEffect, useMemo, useRef, useState } from "react";
import officeArt from "@/assets/mayhem/THE_OFFICE.png.asset.json";
import officeMeowArt from "@/assets/mayhem/THE_OFFICE_red_guy_meow.png.asset.json";
import doorArt from "@/assets/mayhem/THE_DOOR.png.asset.json";
import keyholeArt from "@/assets/mayhem/THE_KEYHOLE.png.asset.json";
import hallwayArt from "@/assets/mayhem/THE_HALLWAY.png.asset.json";
import packArt from "@/assets/mayhem/storage_pack.png.asset.json";
import packUsedArt from "@/assets/mayhem/storage_used.png.asset.json";
import Terminal from "./Terminal";
import CameraSystem from "./CameraSystem";
import { startNightBgm, stopNightBgm } from "./nightAudio";
import { isMuted, setMuted, mayhemSfx } from "@/game/sfx";
import { isBgmMuted, setBgmMuted, stopBgm } from "@/game/bgm";


type View = "office" | "door" | "keyhole" | "hallway" | "storage" | "storageKeyhole";

const HOLD_MS = 3000;

// Pure room-transition map — kept outside the component so the key handler
// can compute the next view (and its sound) without a state updater.
function nextView(v: View, k: string): View {
  switch (v) {
    case "office":
      if (k === "a") return "door";
      return v;
    case "door":
      if (k === "e") return "keyhole";
      if (k === "w") return "hallway";
      if (k === "d") return "office";
      return v;
    case "keyhole":
      if (k === "e" || k === "d" || k === "s") return "door";
      return v;
    case "hallway":
      if (k === "a") return "storage";
      if (k === "d") return "door";
      return v;
    case "storage":
      if (k === "e") return "storageKeyhole";
      if (k === "d" || k === "w") return "hallway";
      return v;
    case "storageKeyhole":
      if (k === "e" || k === "d" || k === "s") return "storage";
      return v;
    default:
      return v;
  }
}

// Realistic-ish movement sounds per transition.
function playMoveSound(from: View, to: View) {
  if (to === "keyhole" || to === "storageKeyhole") { mayhemSfx.keyhole(); return; }
  if (from === "keyhole" || from === "storageKeyhole") { mayhemSfx.turn(); return; }
  if (from === "hallway" || to === "hallway" || from === "storage" || to === "storage") { mayhemSfx.roomSwitch(); return; }
  if (from === "office" || to === "office") { mayhemSfx.walk(2); return; }
  mayhemSfx.turn();
}

function makeDust(): { id: number; left: number; top: number; size: number; duration: number; delay: number; driftX: number; driftY: number; opacity: number }[] {
  return Array.from({ length: 78 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.floor(Math.random() * 4),
    duration: 5.5 + Math.random() * 7.5,
    delay: -(Math.random() * 11),
    driftX: -28 + Math.random() * 57,
    driftY: -42 - Math.random() * 54,
    opacity: 0.12 + Math.random() * 0.24,
  }));
}

export default function NightRooms() {
  const [view, setView] = useState<View>("office");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraEntry, setCameraEntry] = useState<"idle" | "pullback" | "rush">("idle");
  const [redGuyMeowing, setRedGuyMeowing] = useState(false);
  const [packUsed, setPackUsed] = useState(false);
  const [hold, setHold] = useState(0); // 0..1 progress on the health pack
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const terminalOpenRef = useRef(terminalOpen);
  terminalOpenRef.current = terminalOpen;
  const cameraOpenRef = useRef(cameraOpen);
  cameraOpenRef.current = cameraOpen;
  const cameraEntryRef = useRef(cameraEntry);
  cameraEntryRef.current = cameraEntry;
  const cameraEntryTimers = useRef<number[]>([]);
  const meowTimer = useRef<number | null>(null);
  const [dust, setDust] = useState(makeDust);

  const openCamera = () => {
    if (cameraOpenRef.current || cameraEntryRef.current !== "idle") return;
    cameraEntryRef.current = "pullback";
    setCameraEntry("pullback");
    mayhemSfx.cameraOpen();
    cameraEntryTimers.current.push(window.setTimeout(() => {
      cameraEntryRef.current = "rush";
      setCameraEntry("rush");
      cameraOpenRef.current = true;
      setCameraOpen(true);
    }, 520));
    cameraEntryTimers.current.push(window.setTimeout(() => {
      cameraEntryRef.current = "idle";
      setCameraEntry("idle");
    }, 1020));
  };

  useEffect(() => () => {
    cameraEntryTimers.current.forEach((timer) => window.clearTimeout(timer));
    if (meowTimer.current != null) window.clearTimeout(meowTimer.current);
  }, []);

  const meowRedGuy = () => {
    if (redGuyMeowing) return;
    setRedGuyMeowing(true);
    mayhemSfx.meow();
    if (meowTimer.current != null) window.clearTimeout(meowTimer.current);
    meowTimer.current = window.setTimeout(() => {
      setRedGuyMeowing(false);
      meowTimer.current = null;
    }, 1000);
  };

  // Randomize dust placement every time we enter a non-keyhole room so the
  // atmosphere never feels like the same particles are glued to the camera.
  useEffect(() => {
    if (view !== "keyhole" && view !== "storageKeyhole") {
      setDust(makeDust());
    }
  }, [view]);

  // ---- keyboard navigation ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (!["a", "d", "w", "s", "e"].includes(k)) return;
      e.preventDefault();
      if (cameraOpenRef.current) {
        if (k === "w" || k === "s") {
          mayhemSfx.cameraClose();
          setCameraOpen(false);
        }
        return;
      }
      if (cameraEntryRef.current !== "idle") return;
      // terminal: s toggles it; while open, navigation keys are ignored
      if (k === "s") {
        if (terminalOpenRef.current) {
          mayhemSfx.terminalClose();
          setTerminalOpen(false);
          return;
        }
        // the terminal lives in the storage room only
        if (viewRef.current === "storage") {
          mayhemSfx.terminalOpen();
          setTerminalOpen(true);
          return;
        }
      }
      if (terminalOpenRef.current) return;
      if (k === "w" && viewRef.current === "office") {
        openCamera();
        return;
      }
      const from = viewRef.current;
      const to = nextView(from, k);
      if (to !== from) {
        playMoveSound(from, to);
        setView(to);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- press-and-hold on the health pack ----
  const stopHold = () => {
    holdStart.current = null;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setHold(0);
  };
  const startHold = () => {
    if (packUsed || holdStart.current != null) return;
    holdStart.current = performance.now();
    const tick = () => {
      if (holdStart.current == null) return;
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
      setHold(p);
      if (p >= 1) {
        holdStart.current = null;
        raf.current = null;
        setHold(0);
        setPackUsed(true);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); }, []);

  // ---- audio: silence every other sound, play the muffled night track ----
  useEffect(() => {
    const prevSfxMuted = isMuted();
    const prevBgmMuted = isBgmMuted();
    setMuted(true);
    setBgmMuted(true);
    stopBgm(0.3);
    startNightBgm();
    return () => {
      stopNightBgm();
      setMuted(prevSfxMuted);
      setBgmMuted(prevBgmMuted);
    };
  }, []);


  const art =
    view === "office" ? (redGuyMeowing ? officeMeowArt.url : officeArt.url) :
    view === "door" ? doorArt.url :
    view === "keyhole" || view === "storageKeyhole" ? keyholeArt.url :
    view === "hallway" ? hallwayArt.url :
    packUsed ? packUsedArt.url : packArt.url;

  const hint =
    view === "office" ? "[ W ] CCTV SYSTEM   [ A ] TURN TO THE DOOR" :
    view === "door" ? "[ E ] KEYHOLE   [ W ] HALLWAY   [ D ] TURN BACK" :
    view === "keyhole" ? "[ E ] STOP LOOKING" :
    view === "hallway" ? "[ A ] STORAGE   [ D ] OFFICE" :
    view === "storage" ? (packUsed ? "[ S ] TERMINAL   [ E ] KEYHOLE   [ D ] HALLWAY" : "HOLD THE HEALTH PACK   [ S ] TERMINAL   [ E ] KEYHOLE   [ D ] HALLWAY") :
    "[ E ] STOP LOOKING";

  const label =
    view === "office" ? "THE OFFICE" :
    view === "door" ? "THE DOOR" :
    view === "keyhole" || view === "storageKeyhole" ? "THE KEYHOLE" :
    view === "hallway" ? "THE HALLWAY" :
    "THE STORAGE";

  // ---- mouse look ----
  // Cursor position (-1..1) drives a smoothed counter-drift of the room, so
  // sweeping the mouse feels like turning your head. Keyhole views peek
  // further because you're pressed against the door.
  const lookRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  const zoomCur = useRef(1.1);
  const peek = view === "keyhole" || view === "storageKeyhole" ? 1.22 : 1;
  const peekRef = useRef(peek);
  peekRef.current = peek;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    target.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };

  useEffect(() => {
    let id = 0;
    const tick = () => {
      cur.current.x += (target.current.x - cur.current.x) * 0.08;
      cur.current.y += (target.current.y - cur.current.y) * 0.08;
      const el = lookRef.current;
      if (el) {
        const p = peekRef.current;
        // terminal open: zoom in toward the player's face (lower-center) and
        // damp the head drift so the panel feels like it's in front of you
        const zoomed = terminalOpenRef.current;
        const keyhole = p > 1; // pressed against the door: narrow the FOV
        const cameraEntryState = cameraEntryRef.current;
        const zoomT = cameraEntryState === "pullback" ? 1.05 : cameraEntryState === "rush" ? 3.0 : zoomed ? 2.1 : keyhole ? 1.35 : 1.1;
        const zoomEase = cameraEntryState === "rush" ? 0.16 : 0.075;
        zoomCur.current += (zoomT - zoomCur.current) * zoomEase;
        const scale = zoomCur.current;
        const damp = zoomed ? 0.35 : 1;
        const tyOff = zoomed ? -60 : 0;
        const entrySlide = cameraEntryState === "rush" ? Math.min(1, Math.max(0, (scale - 1.1) / 4.1)) : 0;
        const tx = (-cur.current.x * 34 * p * damp) - 18 * entrySlide;
        const ty = (-cur.current.y * 18 * p * damp) + tyOff * (scale - 1.1) + 34 * entrySlide;
        const rx = -cur.current.y * 1.6 * damp;
        const ry = cur.current.x * 2.4 * damp;
        el.style.transform =
          `scale(${scale}) translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);


  return (
    <div
      className="absolute inset-0 z-[50] select-none overflow-hidden bg-black"
      style={{ perspective: "1200px" }}
      onMouseMove={onMove}
      onMouseLeave={() => { target.current.x = 0; target.current.y = 0; }}
    >
      {/* mouse-look layer: the room drifts opposite the cursor */}
      <div ref={lookRef} className="absolute inset-0 will-change-transform">
        <img
          key={view + (packUsed ? "-used" : "")}
          src={art}
          alt={label}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: "mayhemRoomFade 180ms ease-out" }}
        />

        {view === "office" && !cameraOpen && cameraEntry === "idle" && (
          <>
            <button
              type="button"
              aria-label="Open CCTV camera system"
              onClick={openCamera}
              className="absolute border-2 border-transparent hover:border-white/60"
              style={{ left: "37.5%", top: "39%", width: "25%", height: "22%" }}
            />
            <button
              type="button"
              aria-label="Pet the little red guy"
              onClick={meowRedGuy}
              className="absolute cursor-pointer border-2 border-transparent hover:border-white/40"
              style={{ left: "65.5%", top: "46%", width: "12%", height: "27%" }}
            />
          </>
        )}

        {/* health pack hotspot — only in the storage room */}
        {view === "storage" && !packUsed && (
          <button
            type="button"
            aria-label="Use health pack"
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={(e) => { e.preventDefault(); startHold(); }}
            onTouchEnd={stopHold}
            className="absolute border-2 border-transparent hover:border-[hsl(var(--hell-warning))]/60"
            style={{ left: "59%", top: "40%", width: "16%", height: "26%" }}
          />
        )}

        {view !== "keyhole" && view !== "storageKeyhole" && (
          <div aria-hidden="true" className="mayhem-dust-field pointer-events-none absolute inset-0">
            {dust.map((particle) => (
              <i
                key={particle.id}
                className="mayhem-dust-particle"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  opacity: particle.opacity,
                  animationDuration: `${particle.duration}s`,
                  animationDelay: `${particle.delay}s`,
                  "--dust-x": `${particle.driftX}px`,
                  "--dust-y": `${particle.driftY}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>

      <div aria-hidden="true" className="mayhem-pov-vignette pointer-events-none absolute inset-0" />

      {hold > 0 && (
        <div className="pointer-events-none absolute left-1/2 bottom-24 w-56 -translate-x-1/2">
          <div className="h-2 w-full border border-white/50 bg-black/60">
            <div className="h-full bg-[hsl(var(--hell-warning))]" style={{ width: `${hold * 100}%` }} />
          </div>
          <div className="mt-1 text-center font-pixel text-[9px] text-white/70">HOLD...</div>
        </div>
      )}

      <div aria-hidden="true" className="hell-static pointer-events-none absolute inset-0 opacity-40" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-10 text-center">
        <div className="font-pixel text-[10px] tracking-[0.3em] text-white/80">{label}</div>
        <div className="font-pixel text-[9px] text-[hsl(var(--hell-muted))]">{hint}</div>
      </div>

      {terminalOpen && <Terminal onClose={() => setTerminalOpen(false)} />}
      {cameraOpen && <CameraSystem onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
