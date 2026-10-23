// MAYHEM — first-person room navigation (the "night" shift).
//
// Office, camera system, hallway, storage room, and terminal navigation.
import { useEffect, useMemo, useRef, useState } from "react";
import officeArt from "@/assets/mayhem/THE_OFFICE.png.asset.json";
import officeMeowArt from "@/assets/mayhem/THE_OFFICE_red_guy_meow.png.asset.json";
import doorArt from "@/assets/mayhem/THE_DOOR.png.asset.json";
import herHalluBaseArt from "@/assets/mayhem/THE_DOOR_HER_HALLU.png.asset.json";
import herHalluArt1 from "@/assets/mayhem/THE_DOOR_HER_TWEAK_1.png.asset.json";
import herHalluArt2 from "@/assets/mayhem/THE_DOOR_HER_TWEAK_2.png.asset.json";
import herHalluArt3 from "@/assets/mayhem/THE_DOOR_HER_TWEAK_3.png.asset.json";
import herHalluAudio from "@/assets/audio/her-hallu.mp3.asset.json";
import keyholeArt from "@/assets/mayhem/THE_KEYHOLE.png.asset.json";
import hallwayArt from "@/assets/mayhem/THE_HALLWAY.png.asset.json";
import packArt from "@/assets/mayhem/storage_pack.png.asset.json";
import packUsedArt from "@/assets/mayhem/storage_used.png.asset.json";

import Terminal, { TERMINAL_ASSET_URLS } from "./Terminal";
import hallNicky from "@/assets/mayhem/encounter/hall-nicky.png.asset.json";
import hallAnb1 from "@/assets/mayhem/encounter/hall-anb-1.png.asset.json";
import hallAnb2 from "@/assets/mayhem/encounter/hall-anb-2.png.asset.json";
import keyholeNicky from "@/assets/mayhem/encounter/keyhole-nicky.png.asset.json";
import keyholeAnb from "@/assets/mayhem/encounter/keyhole-anb.png.asset.json";
import keyholeAnbStun from "@/assets/mayhem/encounter/keyhole-anb-stun.png.asset.json";
import keyholeAnbLeave from "@/assets/mayhem/encounter/keyhole-anb-leave.png.asset.json";
import gridNicky from "@/assets/mayhem/encounter/grid-nicky.png.asset.json";
import gridNickyRage from "@/assets/mayhem/encounter/grid-nicky-rage.png.asset.json";
import gridAnb from "@/assets/mayhem/encounter/grid-anb.png.asset.json";
import tip1 from "@/assets/mayhem/encounter/tip-1.png.asset.json";
import tip2 from "@/assets/mayhem/encounter/tip-2.png.asset.json";
import tip3 from "@/assets/mayhem/encounter/tip-3.png.asset.json";
import tip4 from "@/assets/mayhem/encounter/tip-4.png.asset.json";
import enterHallSfx from "@/assets/audio/encounter/enter-hall.ogg.asset.json";
import twitchSfx from "@/assets/audio/encounter/twitch-crushed.ogg.asset.json";
import blockedSfx from "@/assets/audio/encounter/door-blocked.ogg.asset.json";
import screamSfx from "@/assets/audio/encounter/scream2-crushed.ogg.asset.json";
import shieldSfx from "@/assets/audio/encounter/shield-break.mp3.asset.json";
import loadingSfx from "@/assets/audio/encounter/loading.ogg.asset.json";
import animMove1 from "@/assets/audio/AnimMove1.wav.asset.json";
import animMove4 from "@/assets/audio/AnimMove4.wav.asset.json";
import { anbOutcome, HALL_ENTRY_MS, inOfficeRooms, lockdownAllows, lookingAtAnb, nickyOutcome, staringAtThreat, tipsForNight } from "./encounterRules";
import { lookOffset } from "./povLookRules";
import newAnimInHallSfx from "@/assets/audio/NewAnimInHall.wav.asset.json";
import runAwaySfx from "@/assets/audio/encounter/metal-run-away.wav.asset.json";
import type { GridEnemyId } from "./useGridRoster";

const TIP_ARTS: Record<number, string> = { 1: tip1.url, 2: tip2.url, 3: tip3.url, 4: tip4.url };
let sfxVol = 1;
function playOnce(url: string, gain = 1) {
  try { const a = new Audio(url); a.volume = Math.min(1, gain * sfxVol); void a.play().catch(() => {}); return a; } catch { return null; }
}
import { makeTerminalSession, type TerminalSession } from "./Terminal";
import GridMap from "./GridMap";
import gridShutdownSfx from "@/assets/audio/grid-shutdown.ogg.asset.json";

const GRID_MAX_VIEW_MS = 20000;
import GeneratorPanel, { makeGeneratorProgress, type GeneratorProgress } from "./GeneratorPanel";
import { useGridRoster } from "./useGridRoster";
import { preloadNightBgm, startNightBgm, stopNightBgm, pauseNightBgm, resumeNightBgm } from "./nightAudio";
import { getMayhemNight, mayhemAiLevel, setMayhemNight } from "@/game/progress";
import { isMuted, setMuted, setNightSfxVolume, mayhemSfx, preloadMayhemSfx } from "@/game/sfx";
import { isBgmMuted, setBgmMuted, stopBgm } from "@/game/bgm";
import { useSettings } from "@/game/settings";
import { Button } from "@/components/ui/button";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { enemyMoveMultiplier, type NightUpgrades } from "./merchantRules";


type View = "office" | "door" | "keyhole" | "hallway" | "storage" | "storageKeyhole" | "storageDoor";

const HOLD_MS = 3000;
const INTRO_MIN_MS = 2600;

const NIGHT_IMAGE_URLS = [
  officeArt.url,
  officeMeowArt.url,
  doorArt.url,
  keyholeArt.url,
  hallwayArt.url,
  packArt.url,
  packUsedArt.url,
  ...TERMINAL_ASSET_URLS,
  hallNicky.url, hallAnb1.url, hallAnb2.url, keyholeNicky.url, keyholeAnb.url, keyholeAnbStun.url, keyholeAnbLeave.url,
  gridNicky.url, gridNickyRage.url, gridAnb.url,
];


function preloadNightImages(): Promise<void> {
  return Promise.all(NIGHT_IMAGE_URLS.map((url) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  }))).then(() => undefined);
}

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
      if (k === "a") return "storageDoor";
      if (k === "d" || k === "w") return "hallway";
      return v;
    case "storageKeyhole":
      if (k === "e" || k === "d" || k === "s") return "storage";
      return v;
    case "storageDoor":
      if (k === "d" || k === "s") return "storage";
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
  if (from === "office" || to === "office" || from === "door" || to === "door") { mayhemSfx.turn(); return; }
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

export default function NightRooms({ paused = false, upgrades = {}, onNightComplete, onRetry }: { paused?: boolean; upgrades?: NightUpgrades; onNightComplete: () => void; onRetry?: () => void }) {
  const [settings] = useSettings();
  const [view, setView] = useState<View>("office");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalSession, setTerminalSession] = useState<TerminalSession>(() => ({ initialized: false, error: null, videoTime: 0, videoDone: false, puzzleSeed: Math.floor(Math.random() * 0xFFFFFFFF) }));
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorClosing, setGeneratorClosing] = useState(false);
  const generatorClosingRef = useRef(false);
  generatorClosingRef.current = generatorClosing;
  const [generatorProgress, setGeneratorProgress] = useState<GeneratorProgress>(() => makeGeneratorProgress(upgrades));
  const [generatorOnline, setGeneratorOnline] = useState(false);
  // Night 1 hallucination: at 90%+ generator power the player is forced off
  // the panel, turned to THE DOOR, and "HER" flickers through three tweaks.
  const [hallu, setHallu] = useState<number | null>(null);
  const halluFiredRef = useRef(false);
  const halluAudioRef = useRef<HTMLAudioElement | null>(null);
  const [storageDoorClosed, setStorageDoorClosed] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraEntry, setCameraEntry] = useState<"idle" | "pullback" | "rush">("idle");
  const [redGuyMeowing, setRedGuyMeowing] = useState(false);
  const [packUsed, setPackUsed] = useState(false);
  const [hold, setHold] = useState(0); // 0..1 progress on the health pack
  const [nightReady, setNightReady] = useState(false);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [hp] = useState(100);
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const nightReadyRef = useRef(false);
  const deadRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const terminalOpenRef = useRef(terminalOpen);
  terminalOpenRef.current = terminalOpen;
  const generatorOpenRef = useRef(generatorOpen);
  generatorOpenRef.current = generatorOpen;
  const cameraOpenRef = useRef(cameraOpen);
  cameraOpenRef.current = cameraOpen;
  const cameraEntryRef = useRef(cameraEntry);
  cameraEntryRef.current = cameraEntry;
  const cameraEntryTimers = useRef<number[]>([]);
  const meowTimer = useRef<number | null>(null);
  const [dust, setDust] = useState(makeDust);
  const [night] = useState(getMayhemNight);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [dead, setDead] = useState<null | "blackout">(null);
  const [deathDone, setDeathDone] = useState(false);
  nightReadyRef.current = nightReady;
  deadRef.current = dead !== null;
  const grid = useGridRoster(night, mayhemAiLevel(night) * enemyMoveMultiplier(upgrades), nightReady && !dead, paused);
  const [tip] = useState(() => { const list = tipsForNight(night); return list[Math.floor(Math.random() * list.length)]; });
  const [loaded, setLoaded] = useState(false);

  // ---- hallway threats (Nicky / AN-B) ----
  const [threat, setThreat] = useState<null | { id: GridEnemyId; phase: "active" | "stun" | "leave" }>(null);
  const threatRef = useRef(threat);
  threatRef.current = threat;
  const threatElapsed = useRef(0);
  const staredMs = useRef(0);
  const twitchRef = useRef<HTMLAudioElement | null>(null);
  const [anbFrame, setAnbFrame] = useState(0);
  const stopTwitch = () => { twitchRef.current?.pause(); };
  const [threatAtKeyhole, setThreatAtKeyhole] = useState(false);
  useEffect(() => { if (!threat) setThreatAtKeyhole(false); }, [threat]);
  const entryCueRef = useRef<HTMLAudioElement | null>(null);
  const stopEntryCue = () => { entryCueRef.current?.pause(); entryCueRef.current = null; };
  const threatLeft = () => { stopEntryCue(); playOnce(runAwaySfx.url, 0.9); };
  // Leaving the office during the 5.1s entry cue cuts it and plays the hall-entry sound.
  useEffect(() => {
    if (!entryCueRef.current || inOfficeRooms(view)) return;
    stopEntryCue();
    if (threatRef.current && threatElapsed.current < HALL_ENTRY_MS) playOnce(enterHallSfx.url, 0.9);
  }, [view]);

  // Test keys: 1 summons Nicky, 2 summons AN-B into the hallway.
  const summonRef = useRef(grid.summon);
  summonRef.current = grid.summon;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Digit1" || e.code === "Numpad1") summonRef.current("gifted");
      if (e.code === "Digit2" || e.code === "Numpad2") summonRef.current("anydroid");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (threatRef.current || dead) return;
    const entering = grid.characters.find((c) => c.inHall && (c.id === "gifted" || c.id === "anydroid"));
    if (!entering) return;
    threatElapsed.current = 0;
    staredMs.current = 0;
    setThreat({ id: entering.id, phase: "active" });
    if (inOfficeRooms(viewRef.current)) entryCueRef.current = playOnce(newAnimInHallSfx.url, 0.9);
    else playOnce(enterHallSfx.url, 0.9);
  }, [grid.characters, dead]);

  useEffect(() => {
    if (!threat || threat.id !== "anydroid") return;
    const id = window.setInterval(() => setAnbFrame((f) => 1 - f), 220);
    return () => window.clearInterval(id);
  }, [threat]);

  useEffect(() => {
    if (!threat || threat.phase !== "active" || paused || dead) return;
    const id = window.setInterval(() => {
      threatElapsed.current += 100;
      // For the first 5.1s they're only in the hallway; the keyhole stays empty.
      const atKeyhole = threatElapsed.current >= HALL_ENTRY_MS;
      if (atKeyhole) setThreatAtKeyhole(true);
      const v = viewRef.current === "keyhole" && !atKeyhole ? "door" : viewRef.current;
      if (threat.id === "gifted") {
        if (staringAtThreat(v)) staredMs.current += 100;
        const out = nickyOutcome(v, threatElapsed.current, staredMs.current);
        if (out === "kill") { stopEntryCue(); setDead("blackout"); setThreat(null); }
        else if (out === "leave") { threatLeft(); grid.sendBack("gifted"); setThreat(null); }
        return;
      }
      if (lookingAtAnb(v)) {
        staredMs.current += 100;
        if (!twitchRef.current) { twitchRef.current = new Audio(twitchSfx.url); twitchRef.current.loop = true; }
        twitchRef.current.volume = Math.min(1, 0.8 * sfxVol);
        if (twitchRef.current.paused) void twitchRef.current.play().catch(() => {});
      } else stopTwitch();
      const out = anbOutcome(staredMs.current, threatElapsed.current);
      if (out === "stun") {
        stopTwitch();
        playOnce(screamSfx.url, 0.9);
        playOnce(shieldSfx.url, 0.9);
        setThreat({ id: "anydroid", phase: "stun" });
      } else if (out === "breach") {
        stopTwitch();
        stopEntryCue();
        setDead("blackout");
        setThreat(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [threat, paused, dead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!threat || threat.id !== "anydroid" || threat.phase === "active") return;
    const t = window.setTimeout(() => {
      if (threat.phase === "stun") { setThreat({ id: "anydroid", phase: "leave" }); return; }
      playOnce(Math.random() < 0.5 ? animMove1.url : animMove4.url, 0.9);
      threatLeft();
      grid.sendBack("anydroid");
      setThreat(null);
    }, threat.phase === "stun" ? 800 : 900);
    return () => window.clearTimeout(t);
  }, [threat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { twitchRef.current?.pause(); }, []);
  useEffect(() => { if (paused) stopTwitch(); }, [paused]);
  useEffect(() => {
    if (!dead) return;
    stopNightBgm();
    setCameraOpen(false);
    setTerminalOpen(false);
    setGeneratorOpen(false);
    if (dead === "blackout") { const t = window.setTimeout(() => setDeathDone(true), 1600); return () => window.clearTimeout(t); }
  }, [dead]);

  const closeGenerator = () => {
    if (!generatorOpenRef.current || generatorClosingRef.current) return;
    generatorClosingRef.current = true;
    mayhemSfx.terminalClose();
    setGeneratorClosing(true);
  };

  useEffect(() => {
    if (!generatorClosing) return;
    const timer = window.setTimeout(() => {
      setGeneratorOpen(false);
      setGeneratorClosing(false);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
    return () => window.clearTimeout(timer);
  }, [generatorClosing]);


  const HALLU_ARTS = [herHalluArt1, herHalluArt2, herHalluArt3];
  useEffect(() => {
    if (halluFiredRef.current || night !== 1 || generatorOnline) return;
    if (generatorProgress.percent < 90) return;
    halluFiredRef.current = true;
    if (generatorOpenRef.current) closeGenerator();
    setTerminalOpen(false);
    setCameraOpen(false);
    setView("door");
    viewRef.current = "door";
    setHallu(0);
    pauseNightBgm();
    const audio = new Audio(herHalluAudio.url);
    audio.volume = 0.9 * settings.sfxVolume;
    halluAudioRef.current = audio;
    void audio.play().catch(() => {});
    let last = 0;
    const cycle = window.setInterval(() => {
      let next = Math.floor(Math.random() * 3);
      if (next === last) next = (next + 1) % 3;
      last = next;
      setHallu(next);
    }, 200);
    const stop = window.setTimeout(() => {
      window.clearInterval(cycle);
      audio.pause();
      audio.currentTime = 0;
      halluAudioRef.current = null;
      setHallu(null);
      resumeNightBgm();
    }, 3000);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(stop);
      audio.pause();
      halluAudioRef.current = null;
    };
  }, [generatorProgress.percent, night, generatorOnline]);

  // The title card doubles as the loader. It remains visible long enough to
  // read while room art, camera feeds, terminal art, SFX, and music decode.
  const loadingAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    let revealTimer: number | null = null;
    const minimum = new Promise<void>((resolve) => {
      revealTimer = window.setTimeout(resolve, INTRO_MIN_MS);
    });
    const loadingAudio = playOnce(loadingSfx.url, 0.8);
    if (loadingAudio) loadingAudio.loop = true;
    loadingAudioRef.current = loadingAudio;
    Promise.allSettled([preloadNightImages(), preloadMayhemSfx(), preloadNightBgm(), minimum]).then(() => {
      if (cancelled) return;
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      if (revealTimer != null) window.clearTimeout(revealTimer);
      loadingAudio?.pause();
    };
  }, []);

  const beginNight = () => {
    if (!loaded || introLeaving) return;
    setIntroLeaving(true);
    window.setTimeout(() => { loadingAudioRef.current?.pause(); setNightReady(true); }, 480);
  };
  useEffect(() => {
    if (!loaded || nightReady) return;
    const go = () => beginNight();
    window.addEventListener("keydown", go);
    return () => window.removeEventListener("keydown", go);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const [gridDown, setGridDown] = useState(false);
  const gridDownRef = useRef(false);
  gridDownRef.current = gridDown;
  // Accumulated grid viewing time. It persists when the grid is closed (never
  // cools down or resets) and only stops counting while paused.
  const [gridUseMs, setGridUseMs] = useState(0);
  const gridUseRef = useRef(0);
  useEffect(() => {
    if (!cameraOpen || paused || gridDown) return;
    const id = window.setInterval(() => {
      gridUseRef.current = Math.min(GRID_MAX_VIEW_MS, gridUseRef.current + 100);
      setGridUseMs(gridUseRef.current);
      if (gridUseRef.current >= GRID_MAX_VIEW_MS) {
        try { const a = new Audio(gridShutdownSfx.url); a.volume = 0.8; void a.play().catch(() => {}); } catch { /* noop */ }
        setGridDown(true);
        cameraOpenRef.current = false;
        setCameraOpen(false);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [cameraOpen, paused, gridDown]);

  const openCamera = () => {
    if (gridDownRef.current) { mayhemSfx.puzzleMiss(); return; }
    if (cameraOpenRef.current || cameraEntryRef.current !== "idle") return;
    cameraEntryRef.current = "pullback";
    setCameraEntry("pullback");
    mayhemSfx.cameraOpen();
    cameraEntryTimers.current.push(window.setTimeout(() => {
      cameraEntryRef.current = "rush";
      setCameraEntry("rush");
      cameraOpenRef.current = true;
      setCameraOpen(true);
      mayhemSfx.cameraCrtOn();
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
      if (e.repeat || pausedRef.current || !nightReadyRef.current || deadRef.current) return;
      const k = e.key.toLowerCase();
      if (!["a", "d", "w", "s", "e", "g"].includes(k)) return;
      e.preventDefault();
      if (cameraOpenRef.current) {
        if (k === "w" || k === "s") {
          mayhemSfx.cameraClose();
          setCameraOpen(false);
        }
        return;
      }
      if (cameraEntryRef.current !== "idle") return;
      if (generatorOpenRef.current) {
        if (k === "g" || k === "s") closeGenerator();
        return;
      }
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
          setTerminalSession((current) => current.initialized ? current : makeTerminalSession());
          setTerminalOpen(true);
          return;
        }
      }
      if (terminalOpenRef.current) return;
      if (k === "g" && viewRef.current === "office" && !generatorOnline) {
        mayhemSfx.terminalOpen();
        setGeneratorOpen(true);
        return;
      }
      if (k === "e" && viewRef.current === "storageDoor") {
        mayhemSfx.terminalSelect();
        setStorageDoorClosed((closed) => !closed);
        return;
      }
      if (k === "w" && viewRef.current === "office") {
        openCamera();
        return;
      }
      const from = viewRef.current;
      const to = nextView(from, k);
      if (to !== from && threatRef.current && !lockdownAllows(to, from)) {
        playOnce(blockedSfx.url, 0.9);
        return;
      }
      if (to !== from) {
        playMoveSound(from, to);
        // Room transitions reuse the mouse-look system: the head snaps
        // toward the turn direction, then eases back to center exactly
        // like a mouse sweep (same smoothing + rotation).
        const turn = (() => {
          // office → door (turning right toward the door)
          if (from === "office" && to === "door") return { x: 0.85, y: 0, z: 0 };
          // door → hallway (entering the hall: look swings right to center)
          if (from === "door" && to === "hallway") return { x: 0.85, y: 0, z: 0 };
          // hallway → door (stepping back: a quick zoom-out snap)
          if (from === "hallway" && to === "door") return { x: 0, y: 0, z: -0.09 };
          // hallway → storage (entering storage: look swings right to center)
          if (from === "hallway" && to === "storage") return { x: 0.85, y: 0, z: 0 };
          // door → office (turning away from the door: look swings left to center)
          if (from === "door" && to === "office") return { x: -0.85, y: 0, z: 0 };
          // generic turns follow the key direction
          if (k === "a") return { x: -0.5, y: 0, z: 0 };
          if (k === "d") return { x: 0.5, y: 0, z: 0 };
          if (k === "w") return { x: 0, y: 0.55, z: 0 };
          return { x: 0, y: 0, z: 0 };
        })();
        cur.current.x = turn.x;
        cur.current.y = turn.y;
        target.current.x = 0;
        target.current.y = 0;
        zoomNudge.current = turn.z;
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

  // Night sfx follow the SFX VOLUME slider.
  useEffect(() => { setNightSfxVolume(settings.sfxVolume); sfxVol = settings.sfxVolume; }, [settings.sfxVolume]);

  // ---- audio: silence every other sound, play the muffled night track ----
  useEffect(() => {
    const prevSfxMuted = isMuted();
    const prevBgmMuted = isBgmMuted();
    setMuted(true);
    setBgmMuted(true);
    stopBgm(0.3);
    if (nightReady) startNightBgm();
    return () => {
      stopNightBgm();
      setMuted(prevSfxMuted);
      setBgmMuted(prevBgmMuted);
    };
  }, [nightReady]);


  const threatArt = (() => {
    if (!threat) return null;
    if (view === "hallway") return threat.id === "gifted" ? hallNicky.url : (anbFrame ? hallAnb2.url : hallAnb1.url);
    if (view === "keyhole" && threatAtKeyhole) {
      if (threat.id === "gifted") return keyholeNicky.url;
      return threat.phase === "stun" ? keyholeAnbStun.url : threat.phase === "leave" ? keyholeAnbLeave.url : keyholeAnb.url;
    }
    return null;
  })();
  const art = threatArt ??
    (view === "office" ? (redGuyMeowing ? officeMeowArt.url : officeArt.url) :
    view === "door" ? (hallu !== null ? herHalluBaseArt.url : doorArt.url) :
    view === "keyhole" || view === "storageKeyhole" ? keyholeArt.url :
    view === "storageDoor" ? doorArt.url :
    view === "hallway" ? hallwayArt.url :
    packUsed ? packUsedArt.url : packArt.url);

  const monitorSpot = { left: "37.5%", top: "39%", width: "25%", height: "22%" };
  const redGuySpot = { left: "65.5%", top: "46%", width: "12%", height: "27%" };
  const packSpot = { left: "59%", top: "40%", width: "16%", height: "26%" };
  const storageDoorControlSpot = { left: "76%", top: "38%", width: "12%", height: "24%" };

  const hint =
    view === "office" ? `[ W ] CCTV SYSTEM   [ A ] TURN TO THE DOOR${generatorOnline ? "   GENERATOR ONLINE" : "   [ G ] GENERATOR"}` :
    view === "door" ? "[ E ] KEYHOLE   [ W ] HALLWAY   [ D ] TURN BACK" :
    view === "keyhole" ? "[ E ] STOP LOOKING" :
    view === "hallway" ? "[ A ] STORAGE   [ D ] OFFICE" :
    view === "storage" ? (packUsed ? "[ S ] TERMINAL   [ A ] THE DOOR   [ E ] KEYHOLE   [ D ] HALLWAY" : "HOLD THE HEALTH PACK   [ S ] TERMINAL   [ A ] THE DOOR   [ E ] KEYHOLE   [ D ] HALLWAY") :
    view === "storageDoor" ? `[ E ] ${storageDoorClosed ? "OPEN" : "CLOSE"} METAL DOOR   [ D ] STORAGE` :
    "[ E ] STOP LOOKING";

  const label =
    view === "office" ? "THE OFFICE" :
    view === "door" ? "THE DOOR" :
    view === "keyhole" || view === "storageKeyhole" ? "THE KEYHOLE" :
    view === "storageDoor" ? "THE DOOR" :
    view === "hallway" ? "THE HALLWAY" :
    "THE STORAGE";

  // ---- mouse look ----
  // Cursor position (-1..1) drives a smoothed counter-drift of the room, so
  // sweeping the mouse feels like turning your head. Keyhole views peek
  // further because you're pressed against the door.
  const lookRef = useRef<HTMLDivElement | null>(null);
  const generatorLookRef = useRef<HTMLDivElement | null>(null);
  const flipTabRef = useRef<HTMLButtonElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  // Zoom nudge for the hallway→door step-back — eased back to center.
  const zoomNudge = useRef(0);
  const zoomCur = useRef(1.22);
  const peek = view === "keyhole" || view === "storageKeyhole" ? 1.22 : 1;
  const peekRef = useRef(peek);
  peekRef.current = peek;

  // Soft circular reticle: follows the raw cursor, hidden whenever an
  // overlay (terminal, generator, grid, death) needs the normal pointer.
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const cursorPx = useRef({ x: 0, y: 0 });
  const cursorVisible = useRef(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    target.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    cursorPx.current.x = e.clientX - r.left;
    cursorPx.current.y = e.clientY - r.top;
    cursorVisible.current = true;
  };

  useEffect(() => {
    let id = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tick = () => {
      if (pausedRef.current) { id = requestAnimationFrame(tick); return; }
      cur.current.x += (target.current.x - cur.current.x) * 0.08;
      cur.current.y += (target.current.y - cur.current.y) * 0.08;
      const gx = reducedMotion.matches ? 0 : -cur.current.x * 14;
      const gy = reducedMotion.matches ? 0 : -cur.current.y * 5;
      if (generatorLookRef.current) {
        generatorLookRef.current.style.transform = `translate(${gx}px, ${gy}px)`;
      }
      if (flipTabRef.current) {
        flipTabRef.current.style.transform = `translateX(-50%) translate(${gx * 0.6}px, ${gy * 0.4}px)`;
      }
      // ease the zoom nudge back to center
      zoomNudge.current *= 0.86;
      if (Math.abs(zoomNudge.current) < 0.002) zoomNudge.current = 0;
      const el = lookRef.current;
      if (el) {
        const p = peekRef.current;
        // Terminal open: lock the player's gaze, tighten the FOV slightly,
        // and keep the room centered behind the raised panel.
        const zoomed = terminalOpenRef.current;
        if (zoomed) {
          target.current.x = 0;
          target.current.y = 0;
        }
        const keyhole = p > 1; // pressed against the door: narrow the FOV
        const cameraEntryState = cameraEntryRef.current;
        const zoomT = cameraEntryState === "pullback" ? 1.05 : cameraEntryState === "rush" ? 3.0 : zoomed ? 1.3 : keyhole ? 1.55 : 1.22;
        const zoomEase = cameraEntryState === "rush" ? 0.16 : 0.075;
        zoomCur.current += (zoomT - zoomCur.current) * zoomEase;
        const scale = zoomCur.current + zoomNudge.current;
        const damp = zoomed ? 0 : 1;
        const entrySlide = cameraEntryState === "rush" ? Math.min(1, Math.max(0, (scale - 1.1) / 4.1)) : 0;
        // Flat 2D pan: scale + translate only. The offset comes from the
        // edge-weighted curve — dead zone at center, smooth clamp at edges.
        const off = lookOffset(cur.current.x, cur.current.y, p);
        const tx = (reducedMotion.matches ? 0 : off.x * damp) - 18 * entrySlide;
        const ty = (reducedMotion.matches ? 0 : off.y * damp) + 34 * entrySlide;
        el.style.transform =
          `scale(${scale}) translate(${tx}px, ${ty}px)`;
      }
      if (cursorRef.current) {
        cursorRef.current.style.opacity = cursorVisible.current ? "1" : "0";
        cursorRef.current.style.transform =
          `translate(${cursorPx.current.x}px, ${cursorPx.current.y}px) translate(-50%, -50%)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);


  return (
    <div
      className={`absolute inset-0 z-[50] select-none overflow-hidden bg-black ${nightReady && !paused && !terminalOpen && !generatorOpen && !cameraOpen && !dead && cameraEntry === "idle" ? "cursor-none" : ""}`}
      onMouseMove={onMove}
      onMouseLeave={() => { target.current.x = 0; target.current.y = 0; cursorVisible.current = false; }}
    >
      {!nightReady && (
        <div
          onClick={beginNight}
          className={`mayhem-night-intro absolute inset-0 z-[120] overflow-hidden bg-black ${loaded ? "cursor-pointer" : ""} ${introLeaving ? "mayhem-night-intro-exit" : ""}`}
        >
          <img src={TIP_ARTS[tip]} alt={`Tip ${tip}`} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute inset-x-0 bottom-[6%] text-center font-pixel text-[clamp(11px,1.6vw,18px)] text-white drop-shadow-[0_0_6px_black]">
            {loaded ? <span className="mayhem-tip-blink">Press or click anything to continue</span> : <span className="text-white/50">LOADING...</span>}
          </div>
        </div>
      )}

      {/* mouse-look layer: the room drifts opposite the cursor */}
      <div
        ref={lookRef}
        className={`absolute inset-0 will-change-transform transition-[filter] duration-300 ${terminalOpen ? "blur-[3px] brightness-75" : "blur-0 brightness-100"}`}
      >
        <img
          key={view + (packUsed ? "-used" : "") + (threat ? "-" + threat.id : "")}
          src={art}
          alt={label}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: "mayhemRoomFade 180ms ease-out" }}
        />

        {view === "door" && hallu !== null && (
          <img
            src={HALLU_ARTS[hallu].url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}

        {view === "office" && !cameraOpen && cameraEntry === "idle" && (
          <>
            <button
              type="button"
              aria-label="Open tracking grid"
              onClick={openCamera}
              className="absolute border-2 border-transparent hover:border-white/60"
              style={monitorSpot}
            />
            <button
              type="button"
              aria-label="Pet the little red guy"
              onClick={meowRedGuy}
              className="absolute cursor-pointer border-2 border-transparent hover:border-white/40"
              style={redGuySpot}
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
            style={packSpot}
          />
        )}

        {view === "storageDoor" && (
          <>
            <div className={`pointer-events-none absolute inset-y-0 left-1/2 w-[42%] -translate-x-1/2 border-x-8 border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))] transition-transform duration-500 ${storageDoorClosed ? "translate-y-0" : "-translate-y-[82%]"}`} />
            <button
              type="button"
              aria-label={storageDoorClosed ? "Open storage door" : "Close storage door"}
              onClick={() => { mayhemSfx.terminalSelect(); setStorageDoorClosed((closed) => !closed); }}
              className="absolute border-2 border-transparent hover:border-[hsl(var(--hell-warning))]/70"
              style={storageDoorControlSpot}
            />
          </>
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

      <div className="pointer-events-none absolute left-4 top-4 z-[90] w-[clamp(220px,26vw,340px)] border border-[hsl(var(--hell-steel))] bg-[hsl(var(--hell-black))]/85 p-2.5 font-pixel text-[10px] text-[hsl(var(--hell-muted))] shadow-[0_0_18px_hsl(var(--hell-black))]">
        <div className="mb-2 flex items-center justify-between">
          <span>HP</span>
          <span>{hp} / 100</span>
        </div>
        <div className="grid h-5 grid-cols-10 gap-1 border border-[hsl(var(--hell-steel))] p-0.5">
          {Array.from({ length: 10 }, (_, segment) => (
            <i
              key={segment}
              className={segment < Math.ceil(hp / 10) ? "bg-[hsl(var(--hell-warning))]" : "bg-[hsl(var(--hell-panel))]"}
            />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-10 text-center">
        <div className="font-pixel text-[10px] tracking-[0.3em] text-white/80">{label}</div>
        <div className="font-pixel text-[9px] text-[hsl(var(--hell-muted))]">{hint}</div>
      </div>

      {terminalOpen && <Terminal paused={paused} session={terminalSession} onSessionChange={setTerminalSession} onClose={() => { mayhemSfx.terminalClose(); setTerminalOpen(false); }} onResetGrid={() => setGridDown(false)} />}
      {generatorOpen && <GeneratorPanel upgrades={upgrades} lookRef={generatorLookRef} night={night} paused={paused || generatorClosing} closing={generatorClosing} progress={generatorProgress} onProgress={setGeneratorProgress} onClose={closeGenerator} onComplete={() => {
        setGeneratorOnline(true);
        setGeneratorOpen(false);
        setMayhemNight(getMayhemNight() + 1);
        onNightComplete();
      }} />}
      {cameraOpen && <GridMap onClose={() => setCameraOpen(false)} characters={grid.characters} moveCount={grid.moveCount} heat={gridUseMs / GRID_MAX_VIEW_MS} />}
      {view === "office" && nightReady && !paused && !generatorOnline && !cameraOpen && cameraEntry === "idle" && !terminalOpen && (
        <Button
          ref={flipTabRef}
          variant="ghost"
          className="gen-hover-tab"
          aria-label={generatorOpen ? "Lower generator" : "Raise generator"}
          aria-expanded={generatorOpen}
          onMouseEnter={() => {
            if (generatorClosingRef.current) return;
            if (generatorOpenRef.current) closeGenerator();
            else { mayhemSfx.terminalOpen(); setGeneratorOpen(true); }
          }}
          onClick={(event) => {
            // Mouse entry already toggles the panel; retain keyboard/touch access.
            if (event.detail !== 0 && window.matchMedia("(hover: hover)").matches) return;
            if (generatorClosingRef.current) return;
            if (generatorOpenRef.current) closeGenerator();
            else { mayhemSfx.terminalOpen(); setGeneratorOpen(true); }
          }}
        >
          {generatorOpen ? <ChevronsDown /> : <ChevronsUp />}
        </Button>
      )}
      {threat && threat.phase === "active" && (
        <div className="pointer-events-none absolute right-4 top-4 z-[91] font-pixel text-[10px] tracking-[0.3em] text-[hsl(var(--hell-warning))] mayhem-tip-blink">
          {threat.id === "gifted" ? "SHE'S IN THE HALL — GET TO THE OFFICE" : "SOMETHING IS IN THE HALL"}
        </div>
      )}
      {dead === "blackout" && <div className="absolute inset-0 z-[130] bg-black"><div aria-hidden="true" className="hell-static absolute inset-0 opacity-50" /></div>}
      {dead && deathDone && (
        <div className="absolute inset-0 z-[140] flex flex-col items-center justify-center gap-6 bg-black/80">
          <Button variant="outline" className="font-pixel" onClick={() => onRetry?.()}>TRY AGAIN</Button>
        </div>
      )}
      {nightReady && !paused && !terminalOpen && !generatorOpen && !cameraOpen && !dead && cameraEntry === "idle" && (
        <div
          ref={cursorRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-[110] h-7 w-7 rounded-full border border-[hsl(var(--hell-muted))]/60 opacity-0 shadow-[0_0_10px_hsl(var(--hell-black)/0.8)] transition-opacity duration-150"
        >
          <i className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--hell-muted))]/80" />
        </div>
      )}
    </div>
  );
}
