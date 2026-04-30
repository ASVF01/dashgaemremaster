import { useState, useCallback, useEffect, useRef } from "react";
import GameCanvas, { type HudState } from "@/game/GameCanvas";
import Hud from "@/game/Hud";
import TouchControls from "@/game/TouchControls";
import FpsOverlay from "@/game/FpsOverlay";

import MainMenu from "@/game/MainMenu";
import { LEVELS, type LevelId } from "@/game/level";
import { useKeybinds, keyLabel, type ActionId } from "@/game/keybinds";
import { playMenuBgm, playMenuBgmFadeIn, playBgmFor, setBgmMuted, isBgmMuted, initBgmMutedFromStorage, stopBgm, preloadBgmFor, isSameTrackAs, setBgmVolume, bgmLevelEnd, playStarmanBgm } from "@/game/bgm";
import cutsceneJustRunBro from "@/assets/video/mcdonalds_sprite_2.mp4";
import cutsceneBossDeath from "@/assets/video/boss_death_cutscene.mp4";
import introCardImg from "@/assets/intro_card.png";
import introBeginUrl from "@/assets/audio/intro_begin.ogg";
import { sfx, unlockAudio, setSfxVolume, silenceAllSfx, setMuted as setSfxMuted } from "@/game/sfx";
import { getSettings } from "@/game/settings";


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
    hp: 3, mach: 0, speed: 0, score: 0, combo: 0, progress: 0, timeMs: 0, parryReady: true, dashCooldown: 0, dashCooldownMax: 2.5,
  });
  const [resetKey, setResetKey] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [invboiIntroOpen, setInvboiIntroOpen] = useState(false);
  // Marathon: index into MARATHON_SEQUENCE, or null if not running.
  const [marathonStep, setMarathonStep] = useState<number | null>(null);
  const [binds] = useKeybinds();
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
        // Stay on "playing" so the GameCanvas remounts state cleanly while
        // the starman BGM keeps playing uninterrupted.
        return;
      }
      // All sub-levels cleared → finish the marathon.
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

  const startLevel = (id: LevelId) => {
    setLevelId(id);
    setResetKey((k) => k + 1);
    setInvboiIntroOpen(false);
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
    setInvboiIntroOpen(false);
    setScreen("loading");
    preloadBgmFor(levelId).then(() => {
      setTimeout(() => {
        setScreen((s) => (s === "loading" ? "playing" : s));
      }, 250);
    });
  };
  const backToMenu = () => { setInvboiIntroOpen(false); setScreen("menu"); };
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
      {/* page header */}
      <header className="px-6 pt-4 pb-2 flex items-center justify-between max-w-[1500px] mx-auto">
        <div className="flex items-center gap-3">
          <h1 className="font-marker text-3xl md:text-5xl text-ink leading-none">
            DASH GAEM <span className="text-[hsl(var(--accent))] inline-block -rotate-2">R</span>
          </h1>
          {hasJrbBadge && (
            <button
              type="button"
              title="badge: just ran bro :3"
              onClick={() => {
                unlockAudio();
                sfx.meow();
                setBadgeFace((f) => (f === ":3" ? "X3" : ":3"));
              }}
              className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-sm md:text-base px-2 py-1 rotate-3 inline-block animate-jitter select-none hover:rotate-6 active:scale-95 transition-transform cursor-pointer"
            >
              {badgeFace}
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
      <section className="relative max-w-[1500px] mx-auto px-3">
        <div className="relative">
          <GameCanvas
            onHud={handleHud}
            onFinish={handleFinish}
            onDeath={handleDeath}
            onInvboiPickup={handleInvboiPickup}
            paused={screen !== "playing" || invboiIntroOpen}
            keepAudio={screen === "dead" || screen === "win" || invboiIntroOpen}
            resetKey={resetKey}
            levelId={levelId}
          />
          {screen === "playing" && !invboiIntroOpen && <Hud hud={hud} />}
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

          {screen === "menu" && <MainMenu onPlay={startLevel} />}

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
                  {currentLevel?.name} cleared
                </div>
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
        </div>

        {/* touch controls live BELOW the game stage so they never cover the HUD */}
        <TouchControls visible={screen === "playing"} />

        {/* mobile controls hint */}
        <p className="md:hidden text-center font-scribble text-lg mt-2 text-ink/70">
          (best on desktop with a keyboard!)
        </p>
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
