import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings } from "@/game/settings";
import kidAttackAuraSfxUrl from "@/assets/mayhem/kid_attack_aura.mp3";
import kidAttackChargeSfxUrl from "@/assets/mayhem/kid_attack_charge.mp3";
import kidAttackCockingSfxUrl from "@/assets/mayhem/kid_attack_cocking.mp3";
import kidLaserPitchHigh from "@/assets/mayhem/kid_laser_pitch_high.mp3";
import kidLaserPitchHighMid from "@/assets/mayhem/kid_laser_pitch_high_mid.mp3";
import kidLaserPitchLow from "@/assets/mayhem/kid_laser_pitch_low.mp3";
import kidLaserPitchLowMid from "@/assets/mayhem/kid_laser_pitch_low_mid.mp3";
import kidLaserPitchOriginal from "@/assets/mayhem/kid_laser_pitch_original.mp3";
import mataDeathSfxUrl from "@/assets/mayhem/mata_death.mp3";
import { chooseOfficeDeathVideo, OFFICE_DEATH_VIDEOS } from "./officeDeathVideos";
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
import VentArtwork from "./VentArtwork";
import shockSfxUrl from "@/assets/audio/Shock.ogg";
import mataShockedSfxUrl from "@/assets/audio/mata_shocked.mp3";
import nopeSfx from "@/assets/manager/nope.mp3.asset.json";
import doorGifted from "@/assets/manager/door_gifted.png.asset.json";
import metalWalkSfx from "@/assets/manager/metalwalk2.wav.asset.json";
import knockSfx from "@/assets/manager/knock2.wav.asset.json";
import ventWalkSfx from "@/assets/manager/ventwalk.wav.asset.json";
import {
  drainAir, GIFTED_DOOR_CLOSE_MS, GIFTED_REOPEN_DEATH_MS, GIFTED_WAIT_MS,
  KID_BLAST_MS, KID_DAMAGE, KID_TELEGRAPH_MS, MATA_DEATH_BLACK_MS, MATA_SHOCK_MS,
  KID_SHOT_INTERVAL_MS, KID_SHOTS_PER_ATTACK, KID_WARNING_MS,
  isLaserHit, mataRattleProfile, approach, edgeZone, yawTargetForView, officePitch, ventStepsCrossed, OFFICE_MAX_YAW, viewForKey, type OfficeView,
} from "./managerOfficeRules";
import { mayhemSfx } from "@/game/sfx";
import DeskConsole from "./DeskConsole";
import { useOfficeMusic } from "./useOfficeMusic";
import { completeRound, startConsole, CONSOLE_TASKS, TASK_ROUNDS } from "./officeConsoleRules";
import "./managerOffice.css";

const FACE_ASPECT = 553 / 949;
type KidLaserState = "idle" | "telegraph" | "blast";
const KID_ATTACK_WARNING_SOUNDS = [
  kidAttackChargeSfxUrl,
  kidAttackAuraSfxUrl,
  kidAttackCockingSfxUrl,
];
const KID_LASER_BLAST_SOUNDS = [
  kidLaserPitchOriginal,
  kidLaserPitchLow,
  kidLaserPitchLowMid,
  kidLaserPitchHighMid,
  kidLaserPitchHigh,
];

function vol() { return Math.max(0, Math.min(1, getSettings().sfxVolume ?? 0.7)); }
function playOnce(url: string, v = 1) {
  const a = new Audio(url); a.volume = Math.max(0, Math.min(1, vol() * v)); a.play().catch(() => {});
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
function playLaserBlast() {
  const sound = KID_LASER_BLAST_SOUNDS[Math.floor(Math.random() * KID_LASER_BLAST_SOUNDS.length)];
  playOnce(sound, 0.35);
}
/** Night 5 Manager's Office test room. Press "\" anywhere to open/close. No threats, no boss. */
export default function ManagerOffice() {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState(0);
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
  return open ? <OfficeRoom key={run} onExit={() => setOpen(false)} onRestart={() => setRun((r) => r + 1)} /> : null;
}

function OfficeDeathScreen({ onRestart }: { onRestart: () => void }) {
  const [clip] = useState(() => chooseOfficeDeathVideo(OFFICE_DEATH_VIDEOS));
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) {
      setPlaybackFailed(true);
      return;
    }

    let active = true;
    video.muted = true;
    audio.volume = vol();
    void video.play().catch((error: unknown) => {
      if (!active) return;
      console.error("Death video playback failed", error);
      setPlaybackFailed(true);
    });
    void audio.play().then(() => {
      if (active) {
        audio.currentTime = video.currentTime;
        setAudioPlaybackBlocked(false);
      }
    }).catch((error: unknown) => {
      if (!active) return;
      console.error("Death soundtrack playback failed", error);
      setAudioPlaybackBlocked(true);
    });

    return () => {
      active = false;
      video.pause();
      audio.pause();
    };
  }, [clip]);

  const syncAudio = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || audio.paused) return;
    if (Math.abs(video.currentTime - audio.currentTime) > 0.15) {
      audio.currentTime = video.currentTime;
    }
  };

  const enableAudio = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    audio.currentTime = video.currentTime;
    void audio.play().then(() => {
      setAudioPlaybackBlocked(false);
    }).catch((error: unknown) => {
      console.error("Death soundtrack playback failed", error);
      setAudioPlaybackBlocked(true);
    });
  };

  return (
    <div className="mo-death" role="dialog" aria-label="You died">
      <video
        ref={videoRef}
        src={clip.video}
        muted
        playsInline
        onEnded={onRestart}
        onTimeUpdate={syncAudio}
        onError={() => setPlaybackFailed(true)}
        className="mo-death-video"
      />
      <audio
        ref={audioRef}
        src={clip.audio}
        preload="auto"
        onError={() => setAudioPlaybackBlocked(true)}
      />
      {(audioPlaybackBlocked || playbackFailed) && (
        <div className="mo-death-controls">
          {audioPlaybackBlocked && <button className="mo-death-action" onClick={enableAudio}>Enable audio</button>}
          {playbackFailed && <button className="mo-death-action" onClick={onRestart}>Restart night</button>}
        </div>
      )}
    </div>
  );
}

function MataDeathScreen({ onRestart }: { onRestart: () => void }) {
  const [phase, setPhase] = useState<"flash" | "black" | "video">("flash");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (phase !== "black") return;
    const timer = window.setTimeout(() => setPhase("video"), MATA_DEATH_BLACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "flash") return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = vol();
    void audio.play().then(() => setAudioBlocked(false)).catch((error: unknown) => {
      console.error("NEO-MATA death sound playback failed", error);
      setAudioBlocked(true);
    });
    return () => audio.pause();
  }, [phase]);

  const playDeathSound = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().then(() => setAudioBlocked(false)).catch((error: unknown) => {
      console.error("NEO-MATA death sound playback failed", error);
      setAudioBlocked(true);
    });
  };

  if (phase === "video") return <OfficeDeathScreen onRestart={onRestart} />;

  return (
    <div className={`mo-death${phase === "flash" ? " mo-mata-death" : ""}`} role="dialog" aria-label="You died">
      {phase === "flash" && (
        <>
          <div className="mo-mata-death-flash" aria-hidden />
          <audio
            ref={audioRef}
            src={mataDeathSfxUrl}
            preload="auto"
            onEnded={() => setPhase("black")}
            onError={() => setAudioBlocked(true)}
          />
          {audioBlocked && <button className="mo-death-action" onClick={playDeathSound}>Play death sound</button>}
        </>
      )}
    </div>
  );
}

function OfficeRoom({ onExit, onRestart }: { onExit: () => void; onRestart: () => void }) {
  const [consoleProg, setConsoleProg] = useState(startConsole);
  const [dead, setDead] = useState(false);
  const deadRef = useRef(dead); deadRef.current = dead;
  const [deathCause, setDeathCause] = useState<"gifted" | "mata" | null>(null);
  const die = useCallback((cause: "gifted" | "mata" = "gifted") => {
    if (deadRef.current) return;
    deadRef.current = true;
    setDeathCause(cause);
    setDead(true);
  }, []);
  useOfficeMusic(!dead && (consoleProg.task > 0 || consoleProg.done)); // music begins once Task 1 lights the room
  const worldRef = useRef<HTMLDivElement>(null);
  const cursorX = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const ventRef = useRef<SVGSVGElement | HTMLImageElement>(null);
  const assignVentRef = useCallback((node: SVGSVGElement | HTMLImageElement | null) => {
    ventRef.current = node;
  }, []);
  const lookRight = useRef(false);
  const [flash, setFlash] = useState(false);
  const [view, setView] = useState<OfficeView>("desk");
  const viewRef = useRef(view); viewRef.current = view;
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [kidLaser, setKidLaser] = useState<{ state: KidLaserState; y: number }>({ state: "idle", y: 0 });
  const kidLaserRef = useRef(kidLaser); kidLaserRef.current = kidLaser;
  const mouseYRef = useRef(window.innerHeight / 2);
  const kidAttackActiveRef = useRef(false);
  const kidWarningTimerRef = useRef<number | null>(null);
  const kidTelegraphTimerRef = useRef<number | null>(null);
  const kidBlastTimerRef = useRef<number | null>(null);
  const kidShotTimerRef = useRef<number | null>(null);
  const kidJoltTimerRef = useRef<number | null>(null);
  const setKidLaserPhase = useCallback((state: KidLaserState, y: number) => {
    kidLaserRef.current = { state, y };
    setKidLaser(kidLaserRef.current);
  }, []);
  const triggerBilly = useCallback(() => {
    if (deadRef.current || kidAttackActiveRef.current) return;
    kidAttackActiveRef.current = true;
    KID_ATTACK_WARNING_SOUNDS.forEach((sound) => playOnce(sound));
    kidWarningTimerRef.current = window.setTimeout(() => {
      kidWarningTimerRef.current = null;
      const fireShot = (shot: number) => {
        if (deadRef.current) {
          kidAttackActiveRef.current = false;
          setKidLaserPhase("idle", mouseYRef.current);
          return;
        }
        const y = mouseYRef.current;
        setKidLaserPhase("telegraph", y);
        kidTelegraphTimerRef.current = window.setTimeout(() => {
          kidTelegraphTimerRef.current = null;
          if (deadRef.current) {
            kidAttackActiveRef.current = false;
            setKidLaserPhase("idle", y);
            return;
          }
          if (isLaserHit(mouseYRef.current, y)) {
            setHp((hp) => Math.max(0, hp - KID_DAMAGE));
            stageRef.current?.classList.remove("mo-kid-hit");
            void stageRef.current?.offsetWidth;
            stageRef.current?.classList.add("mo-kid-hit");
            if (kidJoltTimerRef.current !== null) window.clearTimeout(kidJoltTimerRef.current);
            kidJoltTimerRef.current = window.setTimeout(() => {
              stageRef.current?.classList.remove("mo-kid-hit");
              kidJoltTimerRef.current = null;
            }, 220);
          }
          setKidLaserPhase("blast", y);
          playLaserBlast();
          kidBlastTimerRef.current = window.setTimeout(() => {
            kidBlastTimerRef.current = null;
            setKidLaserPhase("idle", y);
            if (shot + 1 >= KID_SHOTS_PER_ATTACK) {
              kidAttackActiveRef.current = false;
              return;
            }
            kidShotTimerRef.current = window.setTimeout(() => {
              kidShotTimerRef.current = null;
              fireShot(shot + 1);
            }, KID_SHOT_INTERVAL_MS - KID_TELEGRAPH_MS - KID_BLAST_MS);
          }, KID_BLAST_MS);
        }, KID_TELEGRAPH_MS);
      };
      fireShot(0);
    }, KID_WARNING_MS);
  }, [setKidLaserPhase]);
  useEffect(() => () => {
    if (kidWarningTimerRef.current !== null) window.clearTimeout(kidWarningTimerRef.current);
    if (kidTelegraphTimerRef.current !== null) window.clearTimeout(kidTelegraphTimerRef.current);
    if (kidBlastTimerRef.current !== null) window.clearTimeout(kidBlastTimerRef.current);
    if (kidShotTimerRef.current !== null) window.clearTimeout(kidShotTimerRef.current);
    if (kidJoltTimerRef.current !== null) window.clearTimeout(kidJoltTimerRef.current);
  }, []);
  const [doorShut, setDoorShut] = useState(false);
  const doorShutRef = useRef(doorShut); doorShutRef.current = doorShut;
  const [gifted, setGifted] = useState(false);
  const giftedRef = useRef(gifted); giftedRef.current = gifted;
  const giftedLeaveAtRef = useRef<number | null>(null);
  // The Gifted kills if the door is left open too long or reopened while she waits.
  useEffect(() => {
    if (!gifted) {
      giftedLeaveAtRef.current = null;
      return;
    }
    const t = setTimeout(() => {
      if (giftedRef.current && !doorShutRef.current) die();
    }, GIFTED_DOOR_CLOSE_MS);
    return () => clearTimeout(t);
  }, [gifted, die]);
  useEffect(() => {
    if (!gifted || dead) return;
    if (doorShut) {
      if (giftedLeaveAtRef.current === null) giftedLeaveAtRef.current = Date.now() + GIFTED_WAIT_MS;
      const wait = Math.max(0, giftedLeaveAtRef.current - Date.now());
      const t = setTimeout(() => {
        if (giftedRef.current && doorShutRef.current && !deadRef.current) {
          playOnce(knockSfx.url);
          setGifted(false);
        }
      }, wait);
      return () => clearTimeout(t);
    }
    if (giftedLeaveAtRef.current !== null) {
      const t = setTimeout(() => {
        if (giftedRef.current && !doorShutRef.current && !deadRef.current) die();
      }, GIFTED_REOPEN_DEATH_MS);
      return () => clearTimeout(t);
    }
  }, [gifted, doorShut, dead, die]);
  const [medUsed, setMedUsed] = useState(false);
  const [hp, setHp] = useState(50);
  const [tipOpen, setTipOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(true); // Task 1 is the first thing the player does
  const advanceConsole = useCallback(() => setConsoleProg(completeRound), []);
  // NEO-MATA: crawl (vent jolts per step) -> sits in the vent draining air -> SHOCK sends her off.
  const [mata, setMata] = useState<"off" | "crawl" | "vent" | "shocked">("off");
  const crawling = mata === "crawl";
  const [air, setAir] = useState(100);
  const crawlAudio = useRef<HTMLAudioElement | null>(null);
  const overlayOpen = tipOpen || taskOpen;
  const shock = useCallback(() => {
    if (mata === "vent") {
      playOnce(shockSfxUrl);
      playOnce(mataShockedSfxUrl, 1.8);
      setMata("shocked");
    } else if (mata === "crawl") {
      setMata("off");
    }
  }, [mata]);

  // Flat panel size: each wall picture covers the screen when facing it.
  const PW = Math.max(size.w, size.h / FACE_ASPECT);
  const PH = PW * FACE_ASPECT;
  // Box turn: camera fixed at the cube centre, so the facing wall always fills the screen (no pull-back).
  const P = PW / 2;

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onMove = (e: PointerEvent) => {
      cursorX.current = (e.clientX / window.innerWidth) * 2 - 1;
      mouseYRef.current = e.clientY;
      stageRef.current?.style.setProperty("--fx", `${e.clientX}px`);
      stageRef.current?.style.setProperty("--fy", `${e.clientY}px`);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { onExit(); return; }
      if (deadRef.current) return;
      if (e.code === "KeyZ") { if (!e.repeat) { setFlash(true); click(); } return; }
      if (e.repeat) return;
      if (e.code === "Digit2" || e.code === "Numpad2") { triggerBilly(); return; }
      if (viewRef.current === "ceiling" && (
        e.code === "Space" || e.key === " " || e.code === "KeyF" || e.key.toLowerCase() === "f"
      )) {
        e.preventDefault();
        shock();
        return;
      }
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
  }, [onExit, shock, triggerBilly]);

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
          v.classList.remove("mo-shake"); void v.getBoundingClientRect(); v.classList.add("mo-shake");
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
    a.onended = () => setMata((m) => (m === "crawl" ? "vent" : m));
    a.play().catch(() => {});
    crawlAudio.current = a;
    return () => { a.pause(); crawlAudio.current = null; };
  }, [crawling]);

  // Air drains while she sits in the vent; an empty tank triggers NEO-MATA's death sequence.
  useEffect(() => {
    if (mata !== "vent" || dead) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(); const dt = (now - last) / 1000; last = now;
      setAir((a) => drainAir(a, dt));
    }, 50);
    return () => clearInterval(id);
  }, [mata, dead]);
  useEffect(() => {
    if (mata === "vent" && air <= 0 && !dead) {
      setMata("off");
      die("mata");
    }
  }, [mata, air, dead, die]);
  const airRef = useRef(air); airRef.current = air;
  useEffect(() => {
    if (mata !== "vent" || dead) return;
    let ctx: AudioContext | null = null;
    let src: AudioBufferSourceNode | null = null;
    let filter: BiquadFilterNode | null = null;
    let gain: GainNode | null = null;
    let startedAt = 0;

    try {
      ctx = new AudioContext();
      startedAt = performance.now();
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let body = 0;
      let heldGrain = 0;
      const holdEvery = Math.max(1, Math.round(ctx.sampleRate / 8000));
      for (let i = 0; i < length; i++) {
        if (i % holdEvery === 0) heldGrain = Math.random() * 2 - 1;
        const grain = heldGrain;
        body = body * 0.93 + grain * 0.07;
        const sample = (body * 2.5 + grain * 0.15) * (0.7 + 0.3 * Math.sin(i * 0.002));
        data[i] = Math.round(Math.max(-1, Math.min(1, sample)) * 127) / 127;
      }

      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4200, ctx.currentTime);

      gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);

      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    } catch { /* noop */ }

    const update = setInterval(() => {
      if (!ctx || !src || !gain || !filter) return;
      const rattle = mataRattleProfile(airRef.current);
      const now = ctx.currentTime;
      src.playbackRate.setTargetAtTime(rattle.playbackRate, now, 0.05);
      filter.frequency.setTargetAtTime(rattle.cutoffHz, now, 0.05);
      const fadeIn = Math.min(1, (performance.now() - startedAt) / 800);
      gain.gain.setTargetAtTime(rattle.volume * vol() * fadeIn, now, 0.05);
    }, 50);

    return () => {
      clearInterval(update);
      try {
        src?.stop();
        src?.disconnect();
        filter?.disconnect();
        gain?.disconnect();
        if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      } catch { /* noop */ }
    };
  }, [mata, dead]);
  useEffect(() => {
    if (mata !== "shocked") return;
    const t = setTimeout(() => { setMata("off"); setAir(100); }, MATA_SHOCK_MS);
    return () => clearTimeout(t);
  }, [mata]);


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
          <VentArtwork onVentRef={assignVentRef} src={ventImg.url}
            alt={mata === "vent" || mata === "shocked" ? "NEO-MATA in the vent" : "Vent"}
            present={mata === "vent" || mata === "shocked"} shocked={mata === "shocked"} />
          <button className="mo-shock" onClick={shock}>SHOCK</button>
        </div>
      </div>

      {/* HUD */}
      <div className="mo-hud">
        <div>TEST ROOM · HP {hp} · {consoleProg.done ? "TASKS DONE" : `TASK ${consoleProg.task + 1}/5 [${consoleProg.round}/${TASK_ROUNDS[CONSOLE_TASKS[consoleProg.task]]}]`}</div>
        <div className="mo-hint">mouse to edges = look · W vent · S desk · A door · 1 GIFTED · 2 NEO-KID laser · G console · E surge · hold Z light · \ or ESC exit</div>
        {view === "ceiling" && (
          <button className="mo-test" onClick={() => setMata((m) => (m === "off" ? "crawl" : "off"))}>
            {mata === "off" ? "test: NEO-MATA crawl" : "send NEO-MATA away"}
          </button>
        )}
      </div>

      {mata === "vent" && (
        <div className="mo-air" style={{ "--gauge-jitter": `${Math.min(1.5, (100 - air) * 0.015)}px` } as React.CSSProperties}>
          <div className="mo-air-label">AIR {Math.ceil(air)}%</div>
          <div className="mo-air-bar"><div style={{ width: `${air}%` }} /></div>
        </div>
      )}

      {consoleProg.task === 0 && !consoleProg.done
        ? <div className={`mo-dark${flash ? " lit" : ""}`} aria-hidden />
        : flash && <div className="mo-flash" aria-hidden />}

      {kidLaser.state !== "idle" && (
        <div className={`mo-kid-laser ${kidLaser.state}`} style={{ top: kidLaser.y }} aria-hidden />
      )}
      {tipOpen && (
        <div className="mo-overlay" onClick={() => setTipOpen(false)}>
          <img src={finalTip.url} alt="Your final tip" className="mo-tip" draggable={false} />
        </div>
      )}
      {taskOpen && (
        <DeskConsole progress={consoleProg} onRound={advanceConsole}
          onClose={() => { mayhemSfx.terminalClose(); setTaskOpen(false); }} />
      )}
      {dead && (deathCause === "mata"
        ? <MataDeathScreen onRestart={onRestart} />
        : <OfficeDeathScreen onRestart={onRestart} />)}
    </div>
  );
}
