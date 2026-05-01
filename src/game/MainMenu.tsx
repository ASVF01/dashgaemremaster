import { useEffect, useRef, useState } from "react";
import { LEVELS, type LevelId, type LevelMeta } from "@/game/level";
import {
  ACTIONS, DEFAULT_BINDS, type ActionId, type Keybinds,
  keyLabel, useKeybinds,
} from "@/game/keybinds";
import { useSettings, type Settings } from "@/game/settings";
import { sfx, setSfxVolume, unlockAudio } from "@/game/sfx";
import { setBgmVolume } from "@/game/bgm";
import BgmPlayer from "@/game/BgmPlayer";
import { SPRITE_GALLERY } from "@/game/sprites";
import { useLevelStats, formatMs } from "@/game/levelStats";
import { ChevronLeft, ChevronRight } from "lucide-react";
import roaringKnightImg from "@/assets/roaring_knight.png";

export type MenuTab = "play" | "tutorial" | "keybinds" | "settings" | "extras" | "credits";

interface Props {
  onPlay: (id: LevelId) => void;
}

export default function MainMenu({ onPlay }: Props) {
  const [tab, setTab] = useState<MenuTab>("play");

  const handlePlay = (id: LevelId) => {
    unlockAudio();
    sfx.menuConfirm();
    onPlay(id);
  };

  const switchTab = (next: MenuTab) => {
    if (next === tab) return;
    unlockAudio();
    sfx.menuTab();
    setTab(next);
  };

  return (
    <div className="absolute inset-0 flex items-stretch justify-center bg-paper/95 backdrop-blur-[2px] overflow-auto">
      <div className="w-full max-w-5xl mx-auto px-6 py-8 flex flex-col">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="font-marker text-6xl md:text-7xl text-ink leading-[0.9] -rotate-1 inline-block">
            DASH GAEM
            <br />
            <span className="text-[hsl(var(--accent))] inline-block rotate-2">REMASTERED</span>
          </div>
          <p className="font-scribble text-2xl text-ink/80 mt-3">
            a chaotic stick-figure speed platformer
          </p>
        </div>

        {/* Tabs */}
        <nav className="flex flex-wrap gap-2 justify-center mb-6">
          <TabBtn active={tab === "play"}     onClick={() => switchTab("play")}>PLAY</TabBtn>
          <TabBtn active={tab === "tutorial"} onClick={() => switchTab("tutorial")}>HOW TO PLAY</TabBtn>
          <TabBtn active={tab === "keybinds"} onClick={() => switchTab("keybinds")}>KEYBINDS</TabBtn>
          <TabBtn active={tab === "settings"} onClick={() => switchTab("settings")}>SETTINGS</TabBtn>
          <TabBtn active={tab === "extras"}   onClick={() => switchTab("extras")}>EXTRAS</TabBtn>
          <TabBtn active={tab === "credits"}  onClick={() => switchTab("credits")}>CREDITS</TabBtn>
        </nav>

        {/* Body */}
        <div className="flex-1">
          {tab === "play"     && <PlayTab onPlay={handlePlay} />}
          {tab === "tutorial" && <TutorialTab onStartTutorial={() => handlePlay("tutorial")} />}
          {tab === "keybinds" && <KeybindsTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "extras"   && <ExtrasTab onPlay={handlePlay} />}
          {tab === "credits"  && <CreditsTab />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => { if (!active) sfx.menuHover(); }}
      className={[
        "scribble-border font-marker text-2xl px-5 py-2 transition-transform hover:-rotate-2",
        active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-[hsl(var(--accent))/0.2]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ---------------- PLAY TAB (horizontal carousel) ----------------

// Per-level extended descriptions + thumbnail theme. Subtitles on LEVELS
// are kept short for the in-game HUD; here we get a little more room.
type LevelTheme = {
  description: string;
  // HSL color (no hsl() wrapper) for the thumbnail accent.
  accent: string;
  // Big glyph drawn on the thumbnail.
  glyph: string;
};

const LEVEL_THEME: Record<LevelId, LevelTheme> = {
  "tutorial":           { description: "Learn to scribble. Run, jump, slide, parry — the whole vocabulary.", accent: "190 90% 55%", glyph: "✎" },
  "scribble-1":         { description: "A short warm-up alley. Get used to the speed and find the rhythm.", accent: "32 95% 55%", glyph: "➤" },
  "scribble-2":         { description: "Shooters everywhere. Time your parries or eat ink.", accent: "0 85% 60%", glyph: "✦" },
  "scribble-3":         { description: "Foot off the brake. Pure overdrive — chain mach tiers all the way.", accent: "280 80% 60%", glyph: "⚡" },
  "chase":              { description: "An ink wall is on your heels. Don't stop. Parry it back if it gets close.", accent: "350 85% 55%", glyph: "≫" },
  "speed-test":         { description: "The hallway never ends. Or does it? Hold dash. Find out.", accent: "60 90% 55%", glyph: "∞" },
  "just-run-bro":       { description: "No obstacles. No enemies. Just vibes and a horizon. Hold dash.", accent: "200 80% 60%", glyph: "♥" },
  "meet-invboi":        { description: "Say hi to a new friend. Grab the star and become unstoppable.", accent: "50 95% 60%", glyph: "★" },
  "roaring-knight":     { description: "Boss fight. Dodge his sweeps, parry the openings, dash to strike.", accent: "260 70% 50%", glyph: "♛" },
  "aftermath-1":        { description: "After the knight, the ink keeps bleeding. Push through the ash.", accent: "20 50% 45%", glyph: "▲" },
  "aftermath-2":        { description: "Shooters in the gaps. Mind the rips. Keep your line clean.", accent: "10 60% 50%", glyph: "▣" },
  "aftermath-3":        { description: "Final draft. Everything you've learned, all in one breath.", accent: "0 70% 45%", glyph: "✗" },
  "celestial-marathon": { description: "Every level. One breath. Invboi forever. The ultimate run.", accent: "300 80% 60%", glyph: "✦" },
};

function PlayTab({ onPlay }: { onPlay: (id: LevelId) => void }) {
  const visible = LEVELS.filter((l) => !l.hidden);
  const stats = useLevelStats();
  const [index, setIndex] = useState(0);
  // -1 = sliding to previous, +1 = sliding to next, 0 = idle.
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const animatingRef = useRef(false);

  const TRANSITION_MS = 380;

  const go = (delta: -1 | 1) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    sfx.menuHover();
    setDir(delta);
    window.setTimeout(() => {
      setIndex((i) => (i + delta + visible.length) % visible.length);
      setDir(0);
      // brief pause before next click can fire so the entry animation is visible
      window.setTimeout(() => { animatingRef.current = false; }, 60);
    }, TRANSITION_MS);
  };

  const jumpTo = (target: number) => {
    if (animatingRef.current || target === index) return;
    const diff = target - index;
    go(diff > 0 ? 1 : -1);
    // For non-adjacent jumps, snap intermediate after the slide.
    if (Math.abs(diff) > 1) {
      window.setTimeout(() => setIndex(target), TRANSITION_MS);
    }
  };

  // Keyboard arrows + Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft")  { e.preventDefault(); go(-1); }
      if (e.code === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.code === "Enter")      { e.preventDefault(); onPlay(visible[index].id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, visible.length]);

  const featured = visible[index];
  const left = visible[(index - 1 + visible.length) % visible.length];
  const right = visible[(index + 1) % visible.length];
  // The "incoming" peek that will replace `left`/`right` after the spin —
  // it orbits in from off-screen on the opposite side.
  const farLeft = visible[(index - 2 + visible.length) % visible.length];
  const farRight = visible[(index + 2) % visible.length];

  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  // Featured card stays put — no flip on the level block itself.
  // The side peek cards orbit around it: when going next (+1), the right
  // peek swings INTO the center spot (then snaps), and a new peek swings
  // in from far-right. Symmetric for previous.
  //
  // Each peek defines: an "idle" transform (resting position) and an
  // "exit"/"enter" transform driven by `dir`.
  const peekBase = "translateY(-50%)";

  // LEFT peek
  const leftIdle = `${peekBase} rotate(-3deg)`;
  const leftTransform =
    dir === -1 ? `${peekBase} translateX(280px) rotate(0deg) scale(1.15)` : // swings to center
    dir === 1  ? `${peekBase} translateX(-260px) rotate(-25deg) scale(0.7)` : // swings off-screen left
                 leftIdle;
  const leftOpacity = dir === 1 ? 0 : 0.55;

  // RIGHT peek
  const rightIdle = `${peekBase} rotate(3deg)`;
  const rightTransform =
    dir === 1  ? `${peekBase} translateX(-280px) rotate(0deg) scale(1.15)` : // swings to center
    dir === -1 ? `${peekBase} translateX(260px) rotate(25deg) scale(0.7)` : // swings off-screen right
                 rightIdle;
  const rightOpacity = dir === -1 ? 0 : 0.55;

  // INCOMING peeks — only visible during the transition, sweeping in from
  // the far side as the current peek rotates toward center.
  const farLeftTransform =
    dir === -1 ? `${peekBase} translateX(0) rotate(-3deg) scale(1)` :
                 `${peekBase} translateX(-360px) rotate(-25deg) scale(0.6)`;
  const farRightTransform =
    dir === 1  ? `${peekBase} translateX(0) rotate(3deg) scale(1)` :
                 `${peekBase} translateX(360px) rotate(25deg) scale(0.6)`;

  return (
    <div className="relative">
      {/* Carousel stage */}
      <div
        className="relative h-[360px] flex items-center justify-center select-none overflow-hidden"
        style={{ perspective: "1200px" }}
      >
        {/* Prev arrow */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous level"
          className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-30 scribble-border bg-paper p-2 hover:-rotate-3 transition-transform"
        >
          <ChevronLeft className="w-6 h-6 text-ink" />
        </button>

        {/* Far-left incoming peek (visible only when going to previous) */}
        <div
          className="hidden md:block absolute left-16 top-1/2 w-44 pointer-events-none z-[5]"
          style={{
            transform: farLeftTransform,
            opacity: dir === -1 ? 0.55 : 0,
            transition: `transform ${TRANSITION_MS}ms ${easing}, opacity ${TRANSITION_MS}ms ${easing}`,
          }}
        >
          <MiniCard lvl={farLeft} />
        </div>

        {/* Left peek card */}
        <div
          onClick={() => go(-1)}
          className="hidden md:block absolute left-16 top-1/2 w-44 cursor-pointer z-10"
          style={{
            transform: leftTransform,
            opacity: leftOpacity,
            transition: `transform ${TRANSITION_MS}ms ${easing}, opacity ${TRANSITION_MS}ms ${easing}`,
          }}
        >
          <MiniCard lvl={left} />
        </div>

        {/* Featured (stays put) */}
        <div className="relative z-20 w-full max-w-xl mx-auto px-2">
          <FeaturedCard
            lvl={featured}
            stat={stats[featured.id]}
            onPlay={() => onPlay(featured.id)}
          />
        </div>

        {/* Right peek card */}
        <div
          onClick={() => go(1)}
          className="hidden md:block absolute right-16 top-1/2 w-44 cursor-pointer z-10"
          style={{
            transform: rightTransform,
            opacity: rightOpacity,
            transition: `transform ${TRANSITION_MS}ms ${easing}, opacity ${TRANSITION_MS}ms ${easing}`,
          }}
        >
          <MiniCard lvl={right} />
        </div>

        {/* Far-right incoming peek (visible only when going to next) */}
        <div
          className="hidden md:block absolute right-16 top-1/2 w-44 pointer-events-none z-[5]"
          style={{
            transform: farRightTransform,
            opacity: dir === 1 ? 0.55 : 0,
            transition: `transform ${TRANSITION_MS}ms ${easing}, opacity ${TRANSITION_MS}ms ${easing}`,
          }}
        >
          <MiniCard lvl={farRight} />
        </div>

        {/* Next arrow */}
        <button
          onClick={() => go(1)}
          aria-label="Next level"
          className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 z-30 scribble-border bg-paper p-2 hover:rotate-3 transition-transform"
        >
          <ChevronRight className="w-6 h-6 text-ink" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4 flex-wrap">
        {visible.map((l, i) => (
          <button
            key={l.id}
            onClick={() => jumpTo(i)}
            aria-label={`Go to ${l.name}`}
            className={[
              "w-3 h-3 scribble-border transition-transform hover:scale-125",
              i === index ? "bg-ink" : "bg-paper",
            ].join(" ")}
          />
        ))}
      </div>
      <div className="text-center font-scribble text-base text-ink/60 mt-2">
        ← → arrows to browse • ENTER to play
      </div>
    </div>
  );
}

function Thumbnail({ lvl, large = false }: { lvl: LevelMeta; large?: boolean }) {
  const theme = LEVEL_THEME[lvl.id];
  const isMarathon = lvl.id === "celestial-marathon";
  const isKnight = lvl.id === "roaring-knight";
  return (
    <div
      className={[
        "relative w-full overflow-hidden scribble-border",
        large ? "aspect-[16/7]" : "aspect-[16/9]",
        isMarathon ? "marathon-rainbow" : "",
      ].join(" ")}
      style={
        isMarathon
          ? undefined
          : isKnight
          ? { background: "#000" }
          : { background: `linear-gradient(135deg, hsl(${theme.accent} / 0.25), hsl(${theme.accent} / 0.05))` }
      }
    >
      {isMarathon && <MarathonStars />}
      <div className="absolute inset-0 flex items-center justify-center">
        {isKnight ? (
          <div className="relative h-[78%] aspect-square flex items-center justify-center">
            {/* afterimage (behind) */}
            <img
              src={roaringKnightImg}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-contain animate-knight-afterimage pointer-events-none [image-rendering:pixelated]"
              style={{ filter: "drop-shadow(0 0 12px hsl(260 70% 60% / 0.7))" }}
            />
            {/* main floating knight */}
            <img
              src={roaringKnightImg}
              alt={lvl.name}
              className="relative w-full h-full object-contain animate-knight-float [image-rendering:pixelated]"
              style={{ filter: "drop-shadow(0 0 8px hsl(260 80% 55% / 0.5))" }}
            />
          </div>
        ) : (
          <span
            className={[
              "font-marker leading-none select-none",
              large ? "text-[140px]" : "text-[80px]",
              isMarathon ? "rainbow-text animate-jitter" : "",
            ].join(" ")}
            style={isMarathon ? undefined : { color: `hsl(${theme.accent})`, opacity: 0.85 }}
          >
            {theme.glyph}
          </span>
        )}
      </div>
      {/* corner par chip */}
      <div className="absolute top-2 right-2 scribble-border bg-paper px-2 py-0.5 font-bungee text-xs text-ink">
        PAR {lvl.par >= 9999 ? "∞" : `${lvl.par}s`}
      </div>
    </div>
  );
}

function FeaturedCard({
  lvl, stat, onPlay,
}: {
  lvl: LevelMeta;
  stat: { bestTimeMs: number | null; bestScore: number; plays: number } | undefined;
  onPlay: () => void;
}) {
  const theme = LEVEL_THEME[lvl.id];
  const isMarathon = lvl.id === "celestial-marathon";
  return (
    <div className="scribble-border bg-paper p-4 sm:p-5 animate-scale-in">
      <Thumbnail lvl={lvl} large />

      <div className="mt-3 flex items-baseline justify-between gap-3 flex-wrap">
        <div
          className={[
            "font-marker text-4xl sm:text-5xl leading-none -rotate-1",
            isMarathon ? "rainbow-text animate-jitter" : "text-ink",
          ].join(" ")}
        >
          {lvl.name}
        </div>
        <Difficulty value={lvl.difficulty} />
      </div>

      <div className="font-scribble text-xl text-ink/80 mt-1">{lvl.subtitle}</div>
      <p className="font-scribble text-lg text-ink/70 mt-2 leading-snug">
        {theme.description}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="BEST TIME" value={formatMs(stat?.bestTimeMs)} />
        <Stat label="BEST SCORE" value={stat?.bestScore ? String(stat.bestScore) : "—"} />
        <Stat label="PLAYS" value={String(stat?.plays ?? 0)} />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onPlay}
          onMouseEnter={() => sfx.menuHover()}
          className={[
            "scribble-border font-marker text-3xl px-6 py-2 hover:-rotate-2 transition-transform",
            isMarathon
              ? "bg-ink text-paper"
              : "bg-[hsl(var(--accent))] text-accent-foreground",
          ].join(" ")}
        >
          ▶ PLAY
        </button>
      </div>
    </div>
  );
}

function MiniCard({ lvl }: { lvl: LevelMeta }) {
  return (
    <div className="scribble-border bg-paper p-2">
      <Thumbnail lvl={lvl} />
      <div className="font-marker text-xl text-ink mt-1 truncate">{lvl.name}</div>
      <div className="font-scribble text-sm text-ink/60 truncate">{lvl.subtitle}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="scribble-border bg-paper px-2 py-1.5 text-center">
      <div className="font-scribble text-xs text-ink/60 leading-none">{label}</div>
      <div className="font-bungee text-base text-ink mt-1 truncate">{value}</div>
    </div>
  );
}

function Difficulty({ value }: { value: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-scribble text-base text-ink/60">difficulty</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={[
            "inline-block w-3 h-3 scribble-border",
            i < value ? "bg-[hsl(var(--accent))]" : "bg-paper",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// Sprinkles 8 sparkly stars at random spots on the CELESTIAL MARATHON
// thumbnail. Positions/scales/delays randomize once per mount so each menu
// open is a slightly different constellation.
function MarathonStars() {
  const stars = useRef(
    Array.from({ length: 9 }).map(() => ({
      top: `${Math.random() * 80 + 5}%`,
      left: `${Math.random() * 90 + 3}%`,
      size: 10 + Math.random() * 14,
      delay: Math.random() * 1.6,
      dur: 1.2 + Math.random() * 1.4,
      rot: Math.random() * 360,
    })),
  ).current;
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute marathon-star-twinkle"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
            transform: `rotate(${s.rot}deg)`,
          }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}


// ---------------- TUTORIAL TAB ----------------
function TutorialTab({ onStartTutorial }: { onStartTutorial: () => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Card title="THE BASICS">
        <ul className="font-scribble text-xl text-ink/85 space-y-1.5">
          <li>● <b>RUN</b> with ← / → (or A / D)</li>
          <li>● <b>JUMP</b> with SPACE — hold for higher jumps</li>
          <li>● <b>SLIDE</b> with ↓ / S — duck under low ceilings + boost</li>
          <li>● <b>STOMP</b> enemies by landing on their heads</li>
          <li>● <b>PARRY</b> with J — deflects shots and counters enemies</li>
        </ul>
      </Card>
      <Card title="GO FAST">
        <ul className="font-scribble text-xl text-ink/85 space-y-1.5">
          <li>● Don't stop running — momentum builds <b>MACH</b> tiers</li>
          <li>● Hit <span className="font-marker text-[hsl(var(--mach-3))]">MACH 3</span> for screen-glitch chaos</li>
          <li>● Slide into enemies at speed to obliterate them</li>
          <li>● Chain stomps + parries for <b>combo bonuses</b></li>
          <li>● Risky high routes = more pickups = more score</li>
        </ul>
      </Card>
      <Card title="PARRY WINDOW">
        <p className="font-scribble text-xl text-ink/85 leading-snug">
          Tap <b>J</b> right before a hit. A flash of <span className="text-[hsl(var(--electric))] font-marker">YELLOW</span>{" "}
          means you nailed it — projectiles reflect, enemies explode, and you get a fat combo bonus.
          Miss it and you eat damage. Get good.
        </p>
      </Card>
      <Card title="DYING">
        <p className="font-scribble text-xl text-ink/85 leading-snug">
          You will die a lot. It's funny. Try a different route, parry sooner, or just{" "}
          <span className="font-marker text-[hsl(var(--accent))]">go faster</span>.
        </p>
      </Card>
      <div className="md:col-span-2 flex justify-center mt-2">
        <button
          onClick={onStartTutorial}
          className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-3xl px-8 py-3 hover:-rotate-2 transition-transform"
        >
          PLAY TUTORIAL LEVEL →
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="scribble-border bg-paper p-4">
      <div className="font-marker text-2xl text-ink mb-2 -rotate-1 inline-block">{title}</div>
      {children}
    </div>
  );
}

// ---------------- KEYBINDS TAB ----------------
function KeybindsTab() {
  const [binds, setBinds] = useKeybinds();
  const [capture, setCapture] = useState<{ action: ActionId; slot: number } | null>(null);
  const captureRef = useRef(capture);
  captureRef.current = capture;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cap = captureRef.current;
      if (!cap) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") { setCapture(null); return; }
      // remove this code from any other action first (no duplicates)
      const next: Keybinds = { ...binds };
      (Object.keys(next) as ActionId[]).forEach((a) => {
        next[a] = next[a].filter((c) => c !== e.code);
      });
      const slots = [...(next[cap.action] ?? [])];
      slots[cap.slot] = e.code;
      next[cap.action] = slots.filter(Boolean);
      setBinds(next);
      setCapture(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [binds, setBinds]);

  return (
    <div className="scribble-border bg-paper p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-marker text-3xl text-ink -rotate-1">REBIND KEYS</div>
        <button
          onClick={() => { sfx.menuBack(); setBinds(DEFAULT_BINDS); }}
          onMouseEnter={() => sfx.menuHover()}
          className="scribble-border bg-paper px-3 py-1 font-marker text-lg text-ink hover:-rotate-2 transition-transform"
        >
          RESET DEFAULTS
        </button>
      </div>

      <p className="font-scribble text-lg text-ink/70 mb-4">
        Click a slot then press any key. Click again to clear capture (ESC cancels). Each action supports up to 3 keys.
      </p>

      <div className="space-y-2">
        {ACTIONS.map((a) => (
          <div key={a.id} className="grid grid-cols-12 items-center gap-2 py-2 border-b-2 border-dashed border-ink/20">
            <div className="col-span-12 sm:col-span-5">
              <div className="font-marker text-2xl text-ink leading-tight">{a.label}</div>
              <div className="font-scribble text-base text-ink/60">{a.desc}</div>
            </div>
            <div className="col-span-12 sm:col-span-7 flex flex-wrap gap-2">
              {[0, 1, 2].map((slot) => {
                const code = binds[a.id][slot];
                const isCapturing = capture?.action === a.id && capture?.slot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => { sfx.menuClick(); setCapture(isCapturing ? null : { action: a.id, slot }); }}
                    className={[
                      "scribble-border font-marker text-lg px-3 py-1.5 min-w-[80px] transition-transform hover:-rotate-2",
                      isCapturing
                        ? "bg-[hsl(var(--electric))] text-ink animate-pulse"
                        : code
                          ? "bg-paper text-ink"
                          : "bg-paper text-ink/40",
                    ].join(" ")}
                  >
                    {isCapturing ? "PRESS…" : code ? keyLabel(code) : "+ ADD"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- SETTINGS TAB ----------------
function SettingsTab() {
  const [settings, setSettings, resetSettings] = useSettings();

  // Apply audio volumes live as the user drags.
  useEffect(() => { setSfxVolume(settings.sfxVolume); }, [settings.sfxVolume]);
  useEffect(() => { setBgmVolume(settings.bgmVolume * 0.5); }, [settings.bgmVolume]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ [key]: value } as Partial<Settings>);
  };

  return (
    <div className="scribble-border bg-paper p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="font-marker text-3xl text-ink -rotate-1">SETTINGS</div>
        <button
          onClick={() => { sfx.menuBack(); resetSettings(); }}
          onMouseEnter={() => sfx.menuHover()}
          className="scribble-border bg-paper px-3 py-1 font-marker text-lg text-ink hover:-rotate-2 transition-transform"
        >
          RESET DEFAULTS
        </button>
      </div>

      <div className="space-y-3">
        <ToggleRow
          label="No jump while sliding"
          desc="Stops jump-spam during a slide. Disable for old-school slide-hop."
          value={settings.noJumpWhileSliding}
          onChange={(v) => update("noJumpWhileSliding", v)}
        />
        <ToggleRow
          label="Show FPS"
          desc="Display a tiny frames-per-second counter in the top-right."
          value={settings.showFps}
          onChange={(v) => update("showFps", v)}
        />
        <ToggleRow
          label="Reduce screen shake"
          desc="Quarters the camera shake — kinder on motion-sensitive eyes."
          value={settings.reduceShake}
          onChange={(v) => update("reduceShake", v)}
        />
        <ToggleRow
          label="Reduced FX"
          desc="Tones down particle bursts and glitch flashes (helps on slow devices)."
          value={settings.reducedFx}
          onChange={(v) => update("reducedFx", v)}
        />
        <ToggleRow
          label="Low-HP heartbeat"
          desc="Faint heartbeat sound when you're down to 1 HP. Turn off if it's annoying."
          value={settings.lowHpHeartbeat}
          onChange={(v) => update("lowHpHeartbeat", v)}
        />
        <SliderRow
          label="SFX volume"
          value={settings.sfxVolume}
          onChange={(v) => update("sfxVolume", v)}
        />
        <SliderRow
          label="Music volume"
          value={settings.bgmVolume}
          onChange={(v) => update("bgmVolume", v)}
        />
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-12 items-center gap-3 py-2 border-b-2 border-dashed border-ink/20">
      <div className="col-span-12 sm:col-span-8">
        <div className="font-marker text-2xl text-ink leading-tight">{label}</div>
        <div className="font-scribble text-base text-ink/60">{desc}</div>
      </div>
      <div className="col-span-12 sm:col-span-4 flex sm:justify-end">
        <button
          onClick={() => { sfx.menuClick(); onChange(!value); }}
          className={[
            "scribble-border font-marker text-lg px-4 py-1.5 transition-transform hover:-rotate-2",
            value ? "bg-ink text-paper" : "bg-paper text-ink",
          ].join(" ")}
        >
          {value ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-12 items-center gap-3 py-2 border-b-2 border-dashed border-ink/20">
      <div className="col-span-12 sm:col-span-4">
        <div className="font-marker text-2xl text-ink leading-tight">{label}</div>
      </div>
      <div className="col-span-9 sm:col-span-7 flex items-center">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-[hsl(var(--accent))]"
        />
      </div>
      <div className="col-span-3 sm:col-span-1 text-right font-marker text-lg text-ink">
        {Math.round(value * 100)}
      </div>
    </div>
  );
}

// ---------------- EXTRAS ----------------
const SECRETS: { name: string; how: string; reward: string }[] = [
  {
    name: "??? SPEED TEST ???",
    how: "Type 'testpls' anywhere on the page.",
    reward: "Launches a hidden, never-ending speed-test hallway.",
  },
  {
    name: ":3 BADGE",
    how: "Beat 'just run bro' and watch the cutscene through.",
    reward: "Cute badge in the header — click it for a meow & face flip.",
  },
];

const SFX_LIST: { id: string; label: string; play: () => void }[] = [
  { id: "jump",       label: "JUMP",        play: () => sfx.jump() },
  { id: "land",       label: "LAND (psh)",  play: () => sfx.land() },
  { id: "step",       label: "STEP",        play: () => sfx.step() },
  { id: "run",        label: "RUN",         play: () => sfx.run() },
  { id: "slide",      label: "SLIDE",       play: () => sfx.slide() },
  { id: "slideEnd",   label: "SLIDE END",   play: () => sfx.slideEnd() },
  { id: "skid",       label: "SKID",        play: () => sfx.skid() },
  { id: "dash",       label: "DASH",        play: () => sfx.dash() },
  { id: "superDash",  label: "SUPER DASH",  play: () => sfx.superDash() },
  { id: "mach",       label: "MACH UP",     play: () => sfx.mach() },
  { id: "parryStart", label: "PARRY START", play: () => sfx.parryStart() },
  { id: "parryHit",   label: "PARRY HIT",   play: () => sfx.parryHit() },
  { id: "hit",        label: "PLAYER HIT",  play: () => sfx.hit() },
  { id: "fatalHit",   label: "FATAL HIT",   play: () => sfx.fatalHit() },
  { id: "enemyKill",  label: "ENEMY KILL",  play: () => sfx.enemyKill() },
  { id: "shoot",      label: "SHOOT",       play: () => sfx.shoot() },
  { id: "pickup",     label: "PICKUP",      play: () => sfx.pickup() },
  { id: "win",        label: "WIN",         play: () => sfx.win() },
  { id: "die",        label: "DIE",         play: () => sfx.die() },
  { id: "meow",       label: "MEOW",        play: () => sfx.meow() },
  { id: "thunder",    label: "THUNDER",     play: () => sfx.thunder() },
  { id: "heartbeat",  label: "HEARTBEAT",   play: () => sfx.heartbeat() },
  { id: "slashShing", label: "SLASH SHING", play: () => sfx.slashShing() },
  { id: "bossHurt",   label: "BOSS HURT",   play: () => sfx.bossHurt() },
  { id: "bossDefeat", label: "BOSS DEFEAT", play: () => sfx.bossDefeat() },
];

const SFX_LOOPS: { id: string; label: string; start: () => void; stop: () => void }[] = [
  { id: "shine",     label: "SHINE (starman)", start: () => sfx.shineStart(), stop: () => sfx.shineStop() },
  { id: "laser",     label: "LASER BEAM",      start: () => sfx.laserStart(), stop: () => sfx.laserStop() },
  { id: "rain",      label: "RAIN",            start: () => sfx.rainStart(),  stop: () => sfx.rainStop()  },
  { id: "slideLoop", label: "SLIDE LOOP",      start: () => sfx.slideStart(), stop: () => sfx.slideStop() },
];

function ExtrasTab({ onPlay }: { onPlay: (id: LevelId) => void }) {
  const [active, setActive] = useState<Record<string, boolean>>({});

  // Stop any running loops on unmount so they don't bleed into gameplay.
  useEffect(() => {
    return () => { SFX_LOOPS.forEach((l) => l.stop()); };
  }, []);

  const toggleLoop = (id: string, start: () => void, stop: () => void) => {
    unlockAudio();
    setActive((a) => {
      const on = !a[id];
      if (on) start(); else stop();
      return { ...a, [id]: on };
    });
  };

  const speedTest = LEVELS.find((l) => l.id === "speed-test");

  return (
    <div className="space-y-5">
      {/* SECRETS */}
      <div className="scribble-border bg-paper p-5">
        <div className="font-marker text-3xl text-ink -rotate-1 mb-3">SECRETS</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {SECRETS.map((s) => (
            <div key={s.name} className="scribble-border bg-paper p-3">
              <div className="font-marker text-2xl text-ink mb-1">{s.name}</div>
              <div className="font-scribble text-lg text-ink/85"><b>How:</b> {s.how}</div>
              <div className="font-scribble text-lg text-ink/70"><b>Reward:</b> {s.reward}</div>
            </div>
          ))}
        </div>
        {speedTest && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => onPlay("speed-test")}
              className="scribble-border bg-[hsl(var(--accent))] text-accent-foreground font-marker text-2xl px-5 py-2 hover:-rotate-2 transition-transform"
            >
              ▶ LAUNCH ??? SPEED TEST ???
            </button>
          </div>
        )}
      </div>

      {/* BGM PLAYER */}
      <BgmPlayer />

      {/* SFX GALLERY */}
      <div className="scribble-border bg-paper p-5">
        <div className="font-marker text-3xl text-ink -rotate-1 mb-3">SFX GALLERY</div>
        <p className="font-scribble text-base text-ink/70 mb-3">
          Click any sound to preview it. Loops toggle on/off.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {SFX_LIST.map((s) => (
            <button
              key={s.id}
              onClick={() => { unlockAudio(); s.play(); }}
              className="scribble-border bg-paper px-3 py-1.5 font-marker text-lg text-ink hover:-rotate-2 transition-transform"
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="font-marker text-xl text-ink/70 mb-2">LOOPING SOUNDS</div>
        <div className="flex flex-wrap gap-2">
          {SFX_LOOPS.map((l) => {
            const on = !!active[l.id];
            return (
              <button
                key={l.id}
                onClick={() => toggleLoop(l.id, l.start, l.stop)}
                className={[
                  "scribble-border font-marker text-lg px-3 py-1.5 transition-transform hover:-rotate-2",
                  on ? "bg-ink text-paper" : "bg-paper text-ink",
                ].join(" ")}
              >
                {on ? "■ " : "▶ "}{l.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SPRITE GALLERY */}
      <div className="scribble-border bg-paper p-5">
        <div className="font-marker text-3xl text-ink -rotate-1 mb-3">SPRITE GALLERY</div>
        <p className="font-scribble text-base text-ink/70 mb-3">
          Every player sprite, in all its scribbly glory.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {SPRITE_GALLERY.map((s) => (
            <div
              key={s.id}
              className="scribble-border bg-paper p-2 flex flex-col items-center hover:-rotate-2 transition-transform"
            >
              <div className="w-full aspect-square flex items-center justify-center bg-[hsl(var(--paper))]">
                <img
                  src={s.url}
                  alt={s.label}
                  className="max-w-full max-h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                  draggable={false}
                />
              </div>
              <div className="font-marker text-xs md:text-sm text-ink mt-1 text-center leading-tight">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- CREDITS ----------------
function CreditsTab() {
  return (
    <div className="scribble-border bg-paper p-6 max-w-2xl mx-auto text-center">
      <div className="font-marker text-3xl text-ink -rotate-1 mb-3">CREDITS</div>
      <p className="font-scribble text-xl text-ink/85 mb-2">
        Inspired by <b>Pizza Tower</b>. Doodled together with too much caffeine.
      </p>
      <p className="font-scribble text-lg text-ink/70">
        Built on a tiny custom canvas engine. No frameworks for the gameplay — just vibes.
      </p>
    </div>
  );
}
