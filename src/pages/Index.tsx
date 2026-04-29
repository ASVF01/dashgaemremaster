import { useState, useCallback, useEffect, useRef } from "react";
import GameCanvas, { type HudState } from "@/game/GameCanvas";
import Hud from "@/game/Hud";
import MainMenu from "@/game/MainMenu";
import { LEVELS, type LevelId } from "@/game/level";
import { useKeybinds, keyLabel, type ActionId } from "@/game/keybinds";
import { playMenuBgm, playBgmFor, setBgmMuted, isBgmMuted, initBgmMutedFromStorage, stopBgm, preloadBgmFor } from "@/game/bgm";
import cutsceneJustRunBro from "@/assets/video/mcdonalds_sprite_2.mp4";
import { sfx, unlockAudio } from "@/game/sfx";

type Screen = "menu" | "playing" | "dead" | "win" | "cutscene";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("menu");
  const [levelId, setLevelId] = useState<LevelId>("tutorial");
  const [hud, setHud] = useState<HudState>({
    hp: 3, mach: 0, speed: 0, score: 0, combo: 0, progress: 0, timeMs: 0, parryReady: true, dashCooldown: 0, dashCooldownMax: 2.5,
  });
  const [resetKey, setResetKey] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [binds] = useKeybinds();
  const [muted, setMuted] = useState(false);
  const [hasJrbBadge, setHasJrbBadge] = useState(false);
  const [badgeFace, setBadgeFace] = useState<":3" | "X3">(":3");

  // Load persisted mute pref once.
  useEffect(() => {
    initBgmMutedFromStorage();
    setMuted(isBgmMuted());
    try { setHasJrbBadge(localStorage.getItem("badge_jrb") === "1"); } catch { /* noop */ }
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setBgmMuted(next);
  };

  const handleHud = useCallback((h: HudState) => setHud(h), []);
  const handleFinish = useCallback((t: number, s: number) => {
    setFinalTime(t); setFinalScore(s);
    setScreen((prev) => prev); // no-op for type
    // play cutscene after just-run-bro, else go straight to win
    setScreen(levelId === "just-run-bro" ? "cutscene" : "win");
  }, [levelId]);
  const handleDeath = useCallback(() => setScreen("dead"), []);

  // One owner for BGM: every screen/level transition cancels any pending
  // track first so loading delays can never stack songs on top of each other.
  useEffect(() => {
    if (screen === "menu") playMenuBgm();
    else if (screen === "playing") playBgmFor(levelId, true);
    else if (screen === "cutscene") stopBgm(0.35);
    else if (screen === "dead" || screen === "win") return;
    else stopBgm(0.35);
  }, [screen, levelId]);

  const startLevel = (id: LevelId) => {
    // Warm the next track's buffer BEFORE the screen transition fires the
    // BGM effect, so the crossfade has a decoded buffer ready instantly.
    preloadBgmFor(id);
    setLevelId(id);
    setResetKey((k) => k + 1);
    setScreen("playing");
  };
  const retry = () => {
    setResetKey((k) => k + 1);
    setScreen("playing");
  };
  const backToMenu = () => setScreen("menu");

  // Award the "just run bro" badge and head back to the main menu.
  const finishCutscene = useCallback(() => {
    setHasJrbBadge(true);
    try { localStorage.setItem("badge_jrb", "1"); } catch { /* noop */ }
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
            paused={screen !== "playing"}
            keepAudio={screen === "dead" || screen === "win"}
            resetKey={resetKey}
            levelId={levelId}
          />
          {screen === "playing" && <Hud hud={hud} />}

          {screen === "menu" && <MainMenu onPlay={startLevel} />}

          {screen === "cutscene" && (
            <CutscenePlayer src={cutsceneJustRunBro} onDone={finishCutscene} />
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

        {/* mobile controls hint */}
        <p className="md:hidden text-center font-scribble text-lg mt-2 text-ink/70">
          (best on desktop with a keyboard!)
        </p>
      </section>
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

function CutscenePlayer({ src, onDone }: { src: string; onDone: () => void }) {
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
      <button
        onClick={onDone}
        className="absolute bottom-6 right-6 scribble-border bg-paper text-ink font-marker text-xl px-5 py-2 hover:-rotate-2 transition-transform"
      >
        SKIP ▶
      </button>
    </div>
  );
}

export default Index;
