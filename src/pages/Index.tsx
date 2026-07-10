import { useState, useCallback, useEffect, useRef } from "react";
import GameCanvas, { type HudState } from "@/game/GameCanvas";
import Hud from "@/game/Hud";
import TouchControls from "@/game/TouchControls";
import FpsOverlay from "@/game/FpsOverlay";

import MainMenu from "@/game/MainMenu";
import { LEVELS, type LevelId } from "@/game/level";
import { useKeybinds, keyLabel, type ActionId } from "@/game/keybinds";
import { playMenuBgm, playMenuBgmFadeIn, playBgmFor, setBgmMuted, isBgmMuted, initBgmMutedFromStorage, stopBgm, preloadBgmFor, isSameTrackAs, setBgmVolume, bgmLevelEnd, playMarathonBgm, resetBgmLevelEndFx } from "@/game/bgm";
import cutsceneJustRunBro from "@/assets/video/mcdonalds_sprite_2.mp4";
import cutsceneBossDeath from "@/assets/video/boss_death_cutscene.mp4";
import introCardImg from "@/assets/intro_card.png";
import introBeginUrl from "@/assets/audio/intro_begin.ogg";
import { sfx, unlockAudio, setSfxVolume, silenceAllSfx, setMuted as setSfxMuted } from "@/game/sfx";
import { selectCharacter, unlockCharacter, useCharacter } from "@/game/character";
import { getSettings } from "@/game/settings";
import { recordLevelResult } from "@/game/levelStats";


type Screen = "menu" | "loading" | "playing" | "dead" | "win" | "cutscene" | "death-cutscene";

// Levels whose music should hard-restart on entry. Everything else shares
// the "champion play" track and lets it keep looping across transitions.
const RESTART_BGM_ON_ENTRY: ReadonlyArray<LevelId> = ["tutorial", "chase", "just-run-bro", "roaring-knight"];

// CELESTIAL MARATHON: every gameplay level chained back-to-back. Player
// stays as invboi the whole time and the starman BGM keeps playing across
// transitions (no rain re-cinematic).
const MARATHON_SEQUENCE: ReadonlyArray<LevelId> = [
  "tutorial",
  "scribble-1",
  "scribble-2",
  "scribble-3",
  "chase",
  "just-run-bro",
  "roaring-knight",
  "aftermath-1",
  "aftermath-2",
  "aftermath-3",
];

const Index = () => {
  const [screen, setScreen] = useState<Screen>("menu");
  const [levelId, setLevelId] = useState<LevelId>("tutorial");
  const [hud, setHud] = useState<HudState>({
    hp: 3, mach: 0, speed: 0, score: 0, combo: 0, progress: 0, timeMs: 0, parryReady: true, parryCooldown: 0, dashCooldown: 0, dashCooldownMax: 2.5, playerScreenX: 0, playerScreenY: 0,
  });
  const [resetKey, setResetKey] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [invboiIntroOpen, setInvboiIntroOpen] = useState(false);
  // CHASE: on-screen tutorial popup, shown each time the player enters the
  // chase level (standalone OR as a marathon sub-level). Tracked per-entry
  // so it shows again on retry / after backing out and replaying.
  const [chaseIntroOpen, setChaseIntroOpen] = useState(false);
  const chaseIntroSeenKeyRef = useRef<string | null>(null);
  // Marathon: index into MARATHON_SEQUENCE, or null if not running.
  const [marathonStep, setMarathonStep] = useState<number | null>(null);
  // Marathon speedrun timer (ms). Accumulates real-time across all sub-levels.
  const [marathonMs, setMarathonMs] = useState(0);
  const marathonStartRef = useRef<number | null>(null);
  const [marathonFinalMs, setMarathonFinalMs] = useState<number | null>(null);
  const [binds] = useKeybinds();
  const charState = useCharacter();
  const isAltSelected = charState.selected === "x3mode";
  const [muted, setMuted] = useState(false);
  const [hasJrbBadge, setHasJrbBadge] = useState(false);
  const [badgeFace, setBadgeFace] = useState<":3" | "X3">(":3");
  const [dark, setDark] = useState(true);

  // Intro card shown once on app start: fade in → hold 9s → fade out.
  // Phases: "in" (opacity 0→1), "hold" (opacity 1), "out" (1→0), "done".
  // Click anywhere to skip: jumps straight to "out" so the card fades out
  // and the menu music swells in immediately.
  const [introPhase, setIntroPhase] = useState<"in" | "hold" | "out" | "done">("in");
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const introSkippedRef = useRef(false);
  const FADE = 800; // ms
  useEffect(() => {
    const HOLD = 9000; // ms fully visible
    // Make absolutely sure no BGM is playing while the intro is on screen.
    stopBgm();
    // Play the intro sting alongside the card fade-in.
    const introAudio = new Audio(introBeginUrl);
    introAudio.preload = "auto";
    introAudio.volume = 0.9;
    introAudioRef.current = introAudio;
    introAudio.play().catch(() => { /* autoplay blocked — will play after a gesture */ });
    const t1 = window.setTimeout(() => setIntroPhase("hold"), 30); // trigger fade-in next frame
    const t2 = window.setTimeout(() => {
      if (introSkippedRef.current) return;
      setIntroPhase("out");
      // Music swells in as the card fades out.
      playMenuBgmFadeIn(FADE);
    }, 30 + FADE + HOLD);
    const t3 = window.setTimeout(() => setIntroPhase("done"), 30 + FADE + HOLD + FADE);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      try { introAudio.pause(); } catch { /* noop */ }
    };
  }, []);

  const skipIntro = useCallback(() => {
    if (introSkippedRef.current) return;
    if (introPhase === "done" || introPhase === "out") return;
    introSkippedRef.current = true;
    try { introAudioRef.current?.pause(); } catch { /* noop */ }
    setIntroPhase("out");
    playMenuBgmFadeIn(FADE);
    window.setTimeout(() => setIntroPhase("done"), FADE);
  }, [introPhase]);

  // Load persisted prefs once.
  useEffect(() => {
    initBgmMutedFromStorage();
    setMuted(isBgmMuted());
    try { setHasJrbBadge(localStorage.getItem("badge_jrb") === "1"); } catch { /* noop */ }
    try {
      const f = localStorage.getItem("badge_face");
      if (f === "X3" || f === ":3") setBadgeFace(f);
    } catch { /* noop */ }
    try {
      // Default to dark unless explicitly turned off.
      const stored = localStorage.getItem("dark_mode");
      const d = stored == null ? true : stored === "1";
      setDark(d);
      document.documentElement.classList.toggle("dark", d);
    } catch { /* noop */ }
    // Apply persisted volume settings on app start.
    const s = getSettings();
    setSfxVolume(s.sfxVolume);
    setBgmVolume(s.bgmVolume * 0.5);
  }, []);

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try { localStorage.setItem("dark_mode", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setBgmMuted(next);
  };

  const handleHud = useCallback((h: HudState) => setHud(h), []);
  const handleFinish = useCallback((t: number, s: number) => {
    setFinalTime(t); setFinalScore(s);
    // Persist personal-best for non-marathon completions only. Marathon is
    // tracked separately as a whole-run timer and we don't want partial
    // sub-level times polluting per-level bests.
    if (marathonStep == null) {
      recordLevelResult(levelId, t, s);
    }
    // MARATHON: advance to the next sub-level instead of going to win, unless
    // we just cleared the last one. Skip the just-run-bro cutscene too —
    // marathon doesn't break the flow for it.
    if (marathonStep != null) {
      const nextStep = marathonStep + 1;
      if (nextStep < MARATHON_SEQUENCE.length) {
        const nextId = MARATHON_SEQUENCE[nextStep];
        setMarathonStep(nextStep);
        setLevelId(nextId);
        setResetKey((k) => k + 1);
        // GameCanvas calls bgmLevelEnd() on every level finish, which ducks
        // the volume and engages the lowpass. In marathon we keep the same
        // track playing across sub-levels, so undo that FX immediately.
        resetBgmLevelEndFx();
        // Stay on "playing" so the GameCanvas remounts state cleanly while
        // the starman BGM keeps playing uninterrupted.
        return;
      }
      // All sub-levels cleared → finish the marathon. Freeze the timer.
      const finalMs = marathonStartRef.current != null ? performance.now() - marathonStartRef.current : marathonMs;
      setMarathonFinalMs(finalMs);
      setMarathonMs(finalMs);
      marathonStartRef.current = null;
      setMarathonStep(null);
      setScreen("win");
      return;
    }
    // play cutscene after just-run-bro, else go straight to win
    setScreen(levelId === "just-run-bro" ? "cutscene" : "win");
  }, [levelId, marathonStep]);
  const handleDeath = useCallback(() => {
    // Marathon: invboi can't die, but the boss death-cutscene path still
    // runs if somehow triggered. Bail back to menu cleanly.
    if (marathonStep != null) {
      setMarathonStep(null);
      setScreen("dead");
      return;
    }
    if (levelId === "roaring-knight") {
      // boss death → unskippable cutscene, then kick to menu
      stopBgm(0.2);
      silenceAllSfx();
      setScreen("death-cutscene");
    } else {
      setScreen("dead");
    }
  }, [levelId, marathonStep]);

  // One owner for BGM. The "loading" screen handles the actual track switch
  // before "playing" begins, so we leave that case alone here.
  // `cameFromDeathRef` is set when the player dies, then consumed when we
  // re-enter "playing" so we know to leave the BGM alone on a death-retry.
  const cameFromDeathRef = useRef(false);
  useEffect(() => {
    // MARATHON: Index owns the starman BGM and keeps it playing across
    // every sub-level. Skip ALL per-level BGM management while it's active
    // so the rain cinematic / lowpass / track-switch never re-fires.
    // (We still allow menu music to take over once the user backs out.)
    if (marathonStep != null && (screen === "playing" || screen === "loading" || screen === "dead")) {
      return;
    }
    // Hold off menu BGM while the intro card is on screen — the intro's
    // fade-out triggers playMenuBgmFadeIn so the music swells in with it.
    if (screen === "menu" && introPhase !== "done" && introPhase !== "out") return;
    if (screen === "menu") playMenuBgm();
    else if (screen === "loading") {
      // Duck + lowpass any currently-playing music while LOADING shows.
      // The transition to "playing" calls playBgmFor → resetLevelEndFx,
      // so volume/lowpass auto-restore once the level starts.
      bgmLevelEnd();
      // Track switch itself is handled by startLevel's preload+play below.
      return;
    }
    else if (screen === "playing") {
      const fromDeath = cameFromDeathRef.current;
      cameFromDeathRef.current = false;
      // Never reset BGM on a death-retry: if the same track is already
      // playing, leave it alone entirely.
      if (fromDeath && isSameTrackAs(levelId)) return;
      // Only restart BGM for levels that have a unique track. For shared-
      // track levels, if the same track is already playing, leave it alone.
      const restart = !fromDeath && (RESTART_BGM_ON_ENTRY.includes(levelId) || !isSameTrackAs(levelId));
      playBgmFor(levelId, restart);
    }
    else if (screen === "cutscene") stopBgm(0.35);
    else if (screen === "death-cutscene") stopBgm(0.1);
    else if (screen === "dead") { cameFromDeathRef.current = true; return; }
    else if (screen === "win") return;
    else stopBgm(0.35);
  }, [screen, levelId, introPhase, marathonStep]);

  // Silence sfx ONLY during the intro card. Menu has its own click sfx.
  useEffect(() => {
    const introUp = introPhase !== "done";
    setSfxMuted(introUp);
    return () => { setSfxMuted(false); };
  }, [introPhase]);

  // CELESTIAL MARATHON speedrun timer: tick the display every frame while
  // the run is active. The actual elapsed time is always derived from
  // marathonStartRef so a missed frame can't drift the clock.
  useEffect(() => {
    if (marathonStep == null) return;
    let raf = 0;
    const tick = () => {
      const start = marathonStartRef.current;
      if (start != null) setMarathonMs(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [marathonStep]);

  // Open the chase tutorial popup whenever we enter the chase level on the
  // playing screen (once per resetKey so retries re-show it).
  useEffect(() => {
    if (screen === "playing" && levelId === "chase") {
      const key = `${resetKey}`;
      if (chaseIntroSeenKeyRef.current !== key) {
        chaseIntroSeenKeyRef.current = key;
        setChaseIntroOpen(true);
      }
    }
  }, [screen, levelId, resetKey]);

  // On the win screen, pressing Enter advances to the next level (if any).
  useEffect(() => {
    if (screen !== "win") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      if (nextLevel) {
        e.preventDefault();
        startLevel(nextLevel.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, levelId]);

  const startLevel = (id: LevelId) => {
    // CELESTIAL MARATHON: hijack into the chained sequence. Start the
    // starman BGM exactly once on entry; subsequent sub-level transitions
    // leave it playing.
    if (id === "celestial-marathon") {
      const firstId = MARATHON_SEQUENCE[0];
      setMarathonStep(0);
      setLevelId(firstId);
      setResetKey((k) => k + 1);
      setInvboiIntroOpen(false); setChaseIntroOpen(false);
      setScreen("loading");
      // Reset + start the speedrun timer when the first level appears.
      setMarathonMs(0);
      setMarathonFinalMs(null);
      marathonStartRef.current = null;
      // Kick the starman track now so it's already playing when the level
      // appears. Skip the BGM "loading duck" since we want it at full vol.
      preloadBgmFor(firstId).then(() => {
        playMarathonBgm();
        setTimeout(() => {
          setScreen((s) => (s === "loading" ? "playing" : s));
          marathonStartRef.current = performance.now();
        }, 250);
      });
      return;
    }
    setMarathonStep(null);
    marathonStartRef.current = null;
    setMarathonFinalMs(null);
    setLevelId(id);
    setResetKey((k) => k + 1);
    setInvboiIntroOpen(false); setChaseIntroOpen(false);
    setScreen("loading");
    // Decode the track buffer first (or skip if already cached). When ready,
    // hand off to the playing screen — the BGM effect there will play it.
    preloadBgmFor(id).then(() => {
      // small grace so the "LOADING…" actually shows briefly even on cache hits
      setTimeout(() => {
        setScreen((s) => (s === "loading" ? "playing" : s));
      }, 250);
    });
  };
  const retry = () => {
    setResetKey((k) => k + 1);
    setInvboiIntroOpen(false); setChaseIntroOpen(false);
    // Marathon retry from death: restart from the first sub-level.
    if (marathonStep != null) {
      const firstId = MARATHON_SEQUENCE[0];
      setMarathonStep(0);
      setLevelId(firstId);
      setScreen("loading");
      setMarathonMs(0);
      setMarathonFinalMs(null);
      marathonStartRef.current = null;
      preloadBgmFor(firstId).then(() => {
        playMarathonBgm();
        setTimeout(() => {
          setScreen((s) => (s === "loading" ? "playing" : s));
          marathonStartRef.current = performance.now();
        }, 250);
      });
      return;
    }
    setScreen("loading");
    preloadBgmFor(levelId).then(() => {
      setTimeout(() => {
        setScreen((s) => (s === "loading" ? "playing" : s));
      }, 250);
    });
  };
  const backToMenu = () => {
    setInvboiIntroOpen(false); setChaseIntroOpen(false);
    setMarathonStep(null);
    marathonStartRef.current = null;
    setMarathonFinalMs(null);
    setMarathonMs(0);
    setScreen("menu");
  };
  const handleInvboiPickup = useCallback(() => setInvboiIntroOpen(true), []);

  // Award the "just run bro" badge and head back to the main menu.
  const finishCutscene = useCallback(() => {
    setHasJrbBadge(true);
    try { localStorage.setItem("badge_jrb", "1"); } catch { /* noop */ }
    setScreen("menu");
  }, []);

  // Boss death cutscene → restore sfx and head back to the main menu.
  const finishDeathCutscene = useCallback(() => {
    setSfxMuted(false);
    setScreen("menu");
  }, []);

  const currentLevel = LEVELS.find((l) => l.id === levelId);
  // next non-hidden level after the current one (used for "NEXT LEVEL" button)
  const visibleLevels = LEVELS.filter((l) => !l.hidden);
  const currentIdx = visibleLevels.findIndex((l) => l.id === levelId);
  const nextLevel = currentIdx >= 0 ? visibleLevels[currentIdx + 1] : undefined;

  // secret code: type "testpls" anywhere to launch the speed test level
  useEffect(() => {
    let buf = "";
    const target = "testpls";
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-target.length);
      if (buf === target) {
        buf = "";
        startLevel("speed-test");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <main className="min-h-screen w-full bg-paper text-ink overflow-hidden relative">
      {/* small-screen portrait lock: ask the player to rotate */}
      <div className="fixed inset-0 z-[200] bg-paper text-ink hidden portrait-lock items-center justify-center px-6 text-center">
        <div>
          <div className="font-marker text-5xl text-[hsl(var(--accent))] mb-3 animate-wobble inline-block">
            ROTATE!!
          </div>
          <p className="font-scribble text-2xl text-ink mb-2">
            this game is built for landscape.
          </p>
          <p className="font-scribble text-lg text-ink/70">
            turn your device sideways to play →
          </p>
          <div className="font-marker text-6xl mt-6 inline-block animate-jitter-soft">📱↻</div>
        </div>
      </div>

      {/* page header */}
      <header className="px-3 sm:px-6 pt-2 sm:pt-4 pb-1 sm:pb-2 flex items-center justify-between gap-2 max-w-[1500px] mx-auto">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="font-marker text-xl sm:text-3xl md:text-5xl text-ink leading-none truncate">
            DASH GAEM <span className="text-[hsl(var(--accent))] inline-block -rotate-2">R</span>
          </h1>
          {hasJrbBadge && (
            <button
              type="button"
              title="badge: just ran bro :3"
              onClick={() => {
                unlockAudio();
                sfx.meow();
                setBadgeFace((f) => {
                  const next: ":3" | "X3" = f === ":3" ? "X3" : ":3";
                  try { localStorage.setItem("badge_face", next); } catch { /* noop */ }
                  if (next === "X3") unlockCharacter("x3mode");
                  return next;
                });
              }}
              className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-xs sm:text-sm md:text-base px-1.5 sm:px-2 py-0.5 sm:py-1 rotate-3 inline-block animate-jitter select-none hover:rotate-6 active:scale-95 transition-transform cursor-pointer"
            >
              {badgeFace}
            </button>
          )}
        </div>
        {/* compact controls visible on small screens */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute music" : "Mute music"}
            className="scribble-border bg-paper px-2 py-1 font-marker text-xs text-ink"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {screen === "playing" && (
            <button
              onClick={backToMenu}
              className="scribble-border bg-paper px-2 py-1 font-marker text-xs text-ink"
            >
              ←
            </button>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3 font-scribble text-xl">
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute music" : "Mute music"}
            title={muted ? "Unmute music" : "Mute music"}
            className="scribble-border bg-paper px-3 py-1 font-marker text-base text-ink hover:-rotate-2 transition-transform"
          >
            {muted ? "🔇 MUSIC OFF" : "🔊 MUSIC ON"}
          </button>
          <button
            onClick={toggleDark}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode (save your eyes)"}
            className="scribble-border bg-paper px-3 py-1 font-marker text-base text-ink hover:rotate-2 transition-transform"
          >
            {dark ? "☀️ LIGHT" : "🌙 DARK"}
          </button>
          {screen === "playing" && (
            <button
              onClick={backToMenu}
              className="scribble-border bg-paper px-3 py-1 font-marker text-base text-ink hover:-rotate-2 transition-transform"
            >
              ← MENU
            </button>
          )}
          <KeyChip action="left"  label="run"   binds={binds} />
          <KeyChip action="jump"  label="jump"  binds={binds} />
          <KeyChip action="slide" label="slide" binds={binds} />
          <KeyChip action="parry" label="PARRY" binds={binds} />
        </div>
      </header>

      {/* game stage */}
      <section className="relative max-w-[1500px] mx-auto px-1 sm:px-3">
        <div className="relative">
          <GameCanvas
            onHud={handleHud}
            onFinish={handleFinish}
            onDeath={handleDeath}
            onInvboiPickup={handleInvboiPickup}
            paused={screen !== "playing" || invboiIntroOpen || chaseIntroOpen}
            keepAudio={screen === "dead" || screen === "win" || invboiIntroOpen || chaseIntroOpen || marathonStep != null}
            startAsInvboi={marathonStep != null}
            resetKey={resetKey}
            levelId={levelId}
          />
          {screen === "playing" && !invboiIntroOpen && !chaseIntroOpen && <Hud hud={hud} />}
          {screen === "playing" && levelId === "tutorial" && marathonStep == null && !invboiIntroOpen && !chaseIntroOpen && (
            <TutorialPrompt progress={hud.progress} alt={isAltSelected} />
          )}
          {screen === "playing" && marathonStep != null && !invboiIntroOpen && !chaseIntroOpen && (
            <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="scribble-border bg-paper px-4 py-1.5 -rotate-1 flex items-center gap-3">
                <span className="font-marker text-sm tracking-widest text-[hsl(var(--accent))]">
                  ✦ MARATHON ✦
                </span>
                <span className="font-bungee text-2xl text-ink tabular-nums leading-none">
                  {fmtMarathon(marathonMs)}
                </span>
                <span className="font-marker text-xs text-ink/60">
                  {Math.min(marathonStep + 1, MARATHON_SEQUENCE.length)}/{MARATHON_SEQUENCE.length}
                </span>
              </div>
            </div>
          )}
          <FpsOverlay />

          {screen === "playing" && invboiIntroOpen && (
            <Overlay>
              <div className="text-center px-6 max-w-2xl">
                <div className="font-marker text-5xl md:text-6xl text-[hsl(var(--accent))] mb-3 -rotate-2 inline-block animate-jitter">
                  MEET INVBOI!
                </div>
                <p className="font-scribble text-2xl md:text-3xl text-ink mb-4">
                  you grabbed the star — now you're <b>invboi</b>!!
                </p>
                <ul className="font-scribble text-lg md:text-xl text-ink/90 mb-6 space-y-2 text-left inline-block">
                  <li>✦ <b>invincible</b> — nothing can hurt you</li>
                  <li>✦ <b>obliterate</b> enemies just by touching them</li>
                  <li>✦ <b>spammable dash</b> — chain it to fly across the level</li>
                  <li>✦ <b>parry</b> has zero cooldown — go nuts</li>
                  <li>✦ <b>rainbow trail</b> + sparkly stars (you look amazing)</li>
                </ul>
                <button
                  onClick={() => setInvboiIntroOpen(false)}
                  className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-3xl px-8 py-4 hover:rotate-2 transition-transform animate-jitter"
                >
                  LET'S GOOO →
                </button>
              </div>
            </Overlay>
          )}

          {screen === "playing" && chaseIntroOpen && (
            <Overlay>
              <div className="text-center px-6 max-w-2xl">
                <div className="font-marker text-5xl md:text-6xl text-[hsl(var(--accent))] mb-3 -rotate-2 inline-block animate-jitter">
                  THE CHASE!
                </div>
                <p className="font-scribble text-2xl md:text-3xl text-ink mb-4">
                  something's hunting you down the hallway. <b>don't stop running.</b>
                </p>
                <ul className="font-scribble text-lg md:text-xl text-ink/90 mb-6 space-y-2 text-left inline-block">
                  <li>✦ <b>RUN</b> right with → / D — never slow down</li>
                  <li>✦ <b>SLIDE</b> with ↓ / S to fit under low ceilings (keeps your speed!)</li>
                  <li>✦ <b>JUMP</b> or <b>DASH</b> over spikes — never tank a hit, you'll lose ground</li>
                  <li>✦ <b>SUPER DASH</b> (hold SHIFT at high speed) to pull WAY ahead</li>
                  <li>✦ if it gets close, <b>PARRY</b> with J — knocks it back & stuns it briefly</li>
                  <li>✦ touching the chaser hurts. parry beats tanking. <b>always.</b></li>
                </ul>
                <button
                  onClick={() => setChaseIntroOpen(false)}
                  className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-3xl px-8 py-4 hover:rotate-2 transition-transform animate-jitter"
                >
                  RUN!! →
                </button>
              </div>
            </Overlay>
          )}


          {screen === "menu" && introPhase === "done" && (
            <Overlay>
              <MainMenu
                onPlay={startLevel}
                altTutorialPrompt={hasJrbBadge && badgeFace === "X3"}
                onPlayAsAlternate={() => {
                  selectCharacter("x3mode");
                  startLevel("tutorial");
                }}
              />
            </Overlay>
          )}

          {screen === "loading" && (
            <Overlay>
              <LoadingScreen levelName={currentLevel?.name ?? "level"} />
            </Overlay>
          )}

          {screen === "cutscene" && (
            <CutscenePlayer src={cutsceneJustRunBro} onDone={finishCutscene} />
          )}

          {screen === "death-cutscene" && (
            <CutscenePlayer src={cutsceneBossDeath} onDone={finishDeathCutscene} unskippable />
          )}

          {screen === "dead" && (
            <Overlay>
              <div className="text-center px-6">
                <div className="font-marker text-7xl text-[hsl(var(--accent))] mb-2 animate-wobble inline-block">OOPS!!</div>
                <p className="font-scribble text-3xl text-ink mb-2">you died. embarrassing.</p>
                <p className="font-scribble text-xl text-ink/70 mb-6">
                  level: <b>{currentLevel?.name}</b> • score: {hud.score}
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={retry} className="scribble-border bg-ink text-paper font-marker text-2xl px-6 py-3 hover:rotate-1 transition-transform">
                    TRY AGAIN
                  </button>
                  <button onClick={backToMenu} className="scribble-border bg-paper text-ink font-marker text-2xl px-6 py-3 hover:-rotate-1 transition-transform">
                    MAIN MENU
                  </button>
                </div>
              </div>
            </Overlay>
          )}

          {screen === "win" && (
            <Overlay>
              <div className="text-center px-6">
                <div className="font-marker text-6xl md:text-7xl text-ink mb-2 -rotate-2 inline-block">YOU DID IT</div>
                <div className="font-marker text-3xl text-[hsl(var(--mach-3))] mb-4 animate-jitter inline-block">
                  {marathonFinalMs != null ? "CELESTIAL MARATHON cleared" : `${currentLevel?.name} cleared`}
                </div>
                {marathonFinalMs != null ? (
                  <div className="mb-6 max-w-md mx-auto">
                    <div className="scribble-border bg-paper p-4 -rotate-1 inline-block">
                      <div className="font-marker text-lg text-[hsl(var(--accent))] tracking-widest">SPEEDRUN TIME</div>
                      <div className="font-bungee text-5xl text-ink tabular-nums">{fmtMarathon(marathonFinalMs)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
                    <div className="scribble-border bg-paper p-3">
                      <div className="font-scribble text-lg text-ink/70">TIME</div>
                      <div className="font-bungee text-3xl text-ink">{(finalTime / 1000).toFixed(2)}s</div>
                    </div>
                    <div className="scribble-border bg-paper p-3">
                      <div className="font-scribble text-lg text-ink/70">SCORE</div>
                      <div className="font-bungee text-3xl text-[hsl(var(--accent))]">{finalScore}</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={retry} className="scribble-border bg-paper text-ink font-marker text-2xl px-6 py-3 hover:-rotate-2 transition-transform">
                    RUN IT BACK
                  </button>
                  {nextLevel ? (
                    <button
                      onClick={() => startLevel(nextLevel.id)}
                      className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-2xl px-6 py-3 hover:rotate-2 transition-transform animate-jitter"
                    >
                      NEXT LEVEL →
                    </button>
                  ) : (
                    <div className="scribble-border bg-paper px-4 py-3 font-marker text-xl text-ink/70 self-center">
                      BOSS COMING SOON…
                    </div>
                  )}
                  <button onClick={backToMenu} className="scribble-border bg-paper text-ink font-marker text-2xl px-6 py-3 hover:rotate-1 transition-transform">
                    MAIN MENU
                  </button>
                </div>
              </div>
            </Overlay>
          )}
          {/* touch controls overlay the canvas corners on touch devices —
              they don't push the canvas down or hide the HUD. */}
          <TouchControls visible={screen === "playing"} />
        </div>
      </section>

      {/* One-time intro card on app start. Fades in, holds 9s, fades out. */}
      {introPhase !== "done" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-[800ms] ease-out cursor-pointer"
          style={{ opacity: introPhase === "in" ? 0 : introPhase === "out" ? 0 : 1 }}
          onClick={skipIntro}
          role="button"
          aria-label="Skip intro"
        >
          <img
            src={introCardImg}
            alt=""
            className="max-w-[92vw] max-h-[88vh] object-contain select-none pointer-events-none"
            draggable={false}
          />
        </div>
      )}
    </main>
  );
};

function KeyChip({ action, label, binds }: { action: ActionId; label: string; binds: Record<ActionId, string[]> }) {
  const code = binds[action]?.[0];
  if (!code) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="scribble-border bg-paper px-2 py-0.5 font-marker text-base text-ink">
        {keyLabel(code)}
      </span>
      <span className="text-ink/70">{label}</span>
    </div>
  );
}

// Format marathon ms as m:ss.cs (e.g. 4:23.71). Used by the in-run timer
// chip and the marathon victory screen.
function fmtMarathon(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${min}:${sec.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

// On-screen tutorial prompts. Driven by hud.progress (0..1) so each
// section of the tutorial level shows its own framed step. Lives at the
// top of the canvas so it doesn't cover the action.
const TUTORIAL_STEPS: { from: number; title: string; body: string; key?: string }[] = [
  { from: 0.00, title: "STEP 1 — RUN",        body: "press ← → (or A / D) to move. keep heading right →", key: "→ / D" },
  { from: 0.12, title: "STEP 2 — JUMP",       body: "press SPACE to JUMP. hold longer = jump higher. climb the stairs!", key: "SPACE" },
  { from: 0.22, title: "STEP 3 — SLIDE",      body: "hold ↓ / S to SLIDE under low ceilings. keeps your speed.", key: "↓ / S" },
  { from: 0.34, title: "STEP 4 — STOMP",      body: "jump on enemies' heads to STOMP them. don't touch their sides!", key: "SPACE → land" },
  { from: 0.46, title: "STEP 5 — PARRY",      body: "press J as a bullet hits you to PARRY it back at the shooter.", key: "J" },
  { from: 0.58, title: "STEP 6 — DIVE",       body: "while in the air, hold ↓ to DIVE down fast and cross gaps.", key: "↓ in air" },
  { from: 0.68, title: "STEP 7 — SUPER DASH", body: "build speed, then HOLD K. the longer you hold, the faster you fly.", key: "hold K" },
  { from: 0.82, title: "STEP 8 — COMBO IT",   body: "mix everything: run, slide, parry, dash. trust your scribble.", key: "all of it" },
  { from: 0.92, title: "FINAL — REACH THE FLAG", body: "you got this bro. go go go →", key: "→" },
];

function TutorialPrompt({ progress }: { progress: number }) {
  const step = TUTORIAL_STEPS.slice().reverse().find((s) => progress >= s.from) ?? TUTORIAL_STEPS[0];
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[min(92%,640px)]">
      <div className="scribble-border bg-paper/95 px-5 py-3 -rotate-1 text-center">
        <div className="font-marker text-xl md:text-2xl text-[hsl(var(--accent))] tracking-wide">
          {step.title}
        </div>
        <div className="font-scribble text-base md:text-lg text-ink mt-1">
          {step.body}
        </div>
        {step.key && (
          <div className="mt-2 inline-flex items-center gap-2">
            <span className="font-marker text-xs text-ink/60">KEY</span>
            <span className="scribble-border bg-paper px-2 py-0.5 font-marker text-sm text-ink">
              {step.key}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-paper/85 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

function LoadingScreen({ levelName }: { levelName: string }) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 280);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center px-6">
      <div className="font-marker text-6xl md:text-7xl text-ink mb-3 animate-jitter inline-block">
        LOADING{dots}
      </div>
      <div className="font-scribble text-2xl md:text-3xl text-[hsl(var(--accent))] mb-2">
        {levelName}
      </div>
      <div className="font-scribble text-base md:text-lg text-ink/60">
        cueing the music…
      </div>
    </div>
  );
}

function CutscenePlayer({ src, onDone, unskippable = false }: { src: string; onDone: () => void; unskippable?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [dots, setDots] = useState("");

  // animate the loading dots
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 350);
    return () => clearInterval(id);
  }, [loading]);

  // Try hard to play. Browsers block autoplay-with-sound until a gesture, so
  // if the first play() rejects we retry muted (and surface a tap-to-play).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    const tryPlay = async () => {
      try {
        await v.play();
      } catch {
        if (cancelled) return;
        // fall back to muted autoplay so it at least starts
        v.muted = true;
        try { await v.play(); } catch { /* user will click skip */ }
      }
    };
    tryPlay();
    return () => { cancelled = true; };
  }, [src]);

  return (
    <div className="fixed inset-0 z-50 bg-ink flex items-center justify-center">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        controls={false}
        preload="auto"
        onLoadedData={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onEnded={onDone}
        onClick={() => { const v = videoRef.current; if (v && v.paused) v.play().catch(() => {}); }}
        className="w-screen h-screen object-cover"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink text-paper pointer-events-none">
          <div className="text-center">
            <div className="font-marker text-5xl md:text-7xl mb-2 animate-jitter">LOADING{dots}</div>
            <div className="font-scribble text-xl md:text-2xl opacity-80">cooking the cutscene…</div>
          </div>
        </div>
      )}
      {!unskippable && (
        <button
          onClick={onDone}
          className="absolute bottom-6 right-6 scribble-border bg-paper text-ink font-marker text-xl px-5 py-2 hover:-rotate-2 transition-transform"
        >
          SKIP ▶
        </button>
      )}
    </div>
  );
}

export default Index;
