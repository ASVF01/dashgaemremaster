import { useState, useCallback } from "react";
import GameCanvas, { type HudState } from "@/game/GameCanvas";
import Hud from "@/game/Hud";

type Screen = "title" | "playing" | "dead" | "win";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("title");
  const [hud, setHud] = useState<HudState>({
    hp: 3, mach: 0, speed: 0, score: 0, combo: 0, progress: 0, timeMs: 0, parryReady: true,
  });
  const [resetKey, setResetKey] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  const handleHud = useCallback((h: HudState) => setHud(h), []);
  const handleFinish = useCallback((t: number, s: number) => {
    setFinalTime(t); setFinalScore(s); setScreen("win");
  }, []);
  const handleDeath = useCallback(() => setScreen("dead"), []);

  const start = () => { setResetKey((k) => k + 1); setScreen("playing"); };

  return (
    <main className="min-h-screen w-full bg-paper text-ink overflow-hidden relative">
      {/* page header */}
      <header className="px-6 pt-4 pb-2 flex items-center justify-between max-w-[1500px] mx-auto">
        <h1 className="font-marker text-3xl md:text-5xl text-ink leading-none">
          SCRIBBLE <span className="text-[hsl(var(--accent))] inline-block -rotate-2">RUSH!!</span>
        </h1>
        <div className="hidden md:flex items-center gap-4 font-scribble text-xl">
          <Key label="A/D ←→" desc="run" />
          <Key label="SPACE" desc="jump" />
          <Key label="S / ↓" desc="slide" />
          <Key label="J" desc="PARRY" />
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
            resetKey={resetKey}
          />
          {screen === "playing" && <Hud hud={hud} />}

          {screen === "title" && (
            <Overlay>
              <div className="text-center max-w-2xl mx-auto px-6">
                <div className="font-marker text-6xl md:text-7xl text-ink leading-[0.9] mb-3 -rotate-1">
                  SCRIBBLE
                  <br />
                  <span className="text-[hsl(var(--accent))] inline-block rotate-2">RUSH!!</span>
                </div>
                <p className="font-scribble text-2xl md:text-3xl text-ink mb-6">
                  a chaotic stick-figure speed platformer about going{" "}
                  <span className="font-marker text-[hsl(var(--mach-3))]">absurdly fast</span> and{" "}
                  <span className="font-marker text-[hsl(var(--electric))]">parrying everything</span>.
                </p>
                <ul className="font-scribble text-xl text-ink/80 mb-8 space-y-1">
                  <li>● slide under low ceilings to keep your momentum</li>
                  <li>● chain stomps + parries for HUGE combo bonuses</li>
                  <li>● hit MACH 3 and the world starts to glitch</li>
                  <li>● die a lot. it's funny.</li>
                </ul>
                <button onClick={start} className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-3xl px-8 py-3 hover:-rotate-2 transition-transform">
                  GO FAST →
                </button>
              </div>
            </Overlay>
          )}

          {screen === "dead" && (
            <Overlay>
              <div className="text-center px-6">
                <div className="font-marker text-7xl text-[hsl(var(--accent))] mb-2 animate-wobble inline-block">OOPS!!</div>
                <p className="font-scribble text-3xl text-ink mb-2">you died. embarrassing.</p>
                <p className="font-scribble text-xl text-ink/70 mb-6">score: {hud.score} • combo lost forever</p>
                <button onClick={start} className="scribble-border bg-ink text-paper font-marker text-2xl px-8 py-3 hover:rotate-1 transition-transform">
                  TRY AGAIN
                </button>
              </div>
            </Overlay>
          )}

          {screen === "win" && (
            <Overlay>
              <div className="text-center px-6">
                <div className="font-marker text-6xl md:text-7xl text-ink mb-2 -rotate-2 inline-block">YOU DID IT</div>
                <div className="font-marker text-3xl text-[hsl(var(--mach-3))] mb-6 animate-jitter inline-block">somehow??</div>
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
                <button onClick={start} className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-2xl px-8 py-3 hover:-rotate-2 transition-transform">
                  RUN IT BACK
                </button>
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

function Key({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="scribble-border bg-paper px-2 py-0.5 font-marker text-base text-ink">{label}</span>
      <span className="text-ink/70">{desc}</span>
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

export default Index;
