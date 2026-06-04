import { forwardRef, useEffect, useRef, useState } from "react";
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
import roaringKnightImg from "@/assets/roaring_knight_titlecard.png";
import celestialMarathonEmblem from "@/assets/celestial-marathon-emblem.png";

export type MenuTab = "play" | "tutorial" | "keybinds" | "settings" | "extras" | "updates" | "credits" | "youtube" | "bestiary";

interface Props {
  onPlay: (id: LevelId) => void;
}

export default function MainMenu({ onPlay }: Props) {
  const [tab, setTab] = useState<MenuTab>("play");
  const [charSelectOpen, setCharSelectOpen] = useState(false);

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

  const openCharSelect = () => {
    unlockAudio();
    sfx.menuTab();
    setCharSelectOpen(true);
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
          <TabBtn active={tab === "updates"}  onClick={() => switchTab("updates")}>UPDATES</TabBtn>
          <TabBtn active={tab === "credits"}  onClick={() => switchTab("credits")}>CREDITS</TabBtn>
          <TabBtn active={tab === "youtube"} onClick={() => switchTab("youtube")}>YOUTUBE</TabBtn>
          <TabBtn active={tab === "bestiary"} onClick={() => switchTab("bestiary")}>BESTIARY</TabBtn>
          <TabBtn active={false} onClick={openCharSelect}>CHARACTER SELECT</TabBtn>
        </nav>

        {/* Body */}
        <div className="flex-1">
          {tab === "play"     && <PlayTab onPlay={handlePlay} />}
          {tab === "tutorial" && <TutorialTab onStartTutorial={() => handlePlay("tutorial")} />}
          {tab === "keybinds" && <KeybindsTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "extras"   && <ExtrasTab onPlay={handlePlay} />}
          {tab === "updates"  && <UpdatesTab />}
          {tab === "credits"  && <CreditsTab />}
          {tab === "youtube"  && <YouTubeTab />}
          {tab === "bestiary" && <BestiaryTab />}
        </div>
      </div>

      {charSelectOpen && <CharacterSelectScreen onClose={() => setCharSelectOpen(false)} />}
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
  const animatingRef = useRef(false);

  const TRANSITION_MS = 600;
  // Spacing between adjacent card centers (px). Featured sits at 0.
  const SLOT = 360;

  const go = (delta: number) => {
    if (animatingRef.current) return;
    if (delta === 0) return;
    animatingRef.current = true;
    sfx.menuHover();
    setIndex((i) => (i + delta + visible.length) % visible.length);
    window.setTimeout(() => { animatingRef.current = false; }, TRANSITION_MS);
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

  const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
  const featured = visible[index];

  // Compute the signed shortest offset from `index` to card `i`, treating the
  // list as a ring. e.g. with 5 cards, from index 0 to card 4 the offset is -1,
  // not +4 — this keeps the "moving in the direction the player chose" feel.
  const offsetFor = (i: number) => {
    const n = visible.length;
    let d = i - index;
    if (d >  n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  return (
    <div className="relative">
      {/* Carousel stage — ONE sliding strip; all cards translate together. */}
      <div
        className="relative min-h-[440px] flex items-center justify-center select-none overflow-hidden"
      >
        {/* Prev arrow */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous level"
          className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-30 scribble-border bg-paper p-2 hover:-rotate-3 transition-transform"
        >
          <ChevronLeft className="w-6 h-6 text-ink" />
        </button>

        {/* All level cards laid out around the centered featured slot. */}
        {visible.map((l, i) => {
          const off = offsetFor(i);
          const isCenter = off === 0;
          const abs = Math.abs(off);
          // Cards more than 2 slots away stay hidden but still translate so
          // they appear/disappear naturally as the strip slides.
          const visibleCard = abs <= 2;

          // Center is bigger; sides shrink with distance.
          const scale = isCenter ? 1 : abs === 1 ? 0.55 : 0.4;
          const opacity = !visibleCard ? 0 : isCenter ? 1 : abs === 1 ? 0.55 : 0;
          const tilt = isCenter ? 0 : off < 0 ? -3 : 3;
          const z = 20 - abs;

          return (
            <div
              key={l.id}
              onClick={() => { if (!isCenter) go(off); }}
              className={[
                "absolute top-1/2",
                isCenter ? "" : "cursor-pointer hover:opacity-80",
              ].join(" ")}
              style={{
                left: "50%",
                width: isCenter ? "min(28rem, 90%)" : "11rem",
                transform: `translate(-50%, -50%) translateX(${off * SLOT}px) scale(${scale}) rotate(${tilt}deg)`,
                opacity,
                zIndex: z,
                pointerEvents: visibleCard ? "auto" : "none",
                transition: `transform ${TRANSITION_MS}ms ${easing}, opacity ${TRANSITION_MS}ms ${easing}`,
              }}
            >
              {isCenter ? (
                <FeaturedCard
                  lvl={l}
                  stat={stats[l.id]}
                  onPlay={() => onPlay(l.id)}
                />
              ) : (
                <MiniCard lvl={l} />
              )}
            </div>
          );
        })}

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
            onClick={() => go(offsetFor(i))}
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
          <KnightVisual />
        ) : isMarathon ? (
          <img
            src={celestialMarathonEmblem}
            alt="Celestial Marathon emblem"
            className={[
              "object-contain select-none pointer-events-none animate-jitter-soft drop-shadow-[0_0_12px_rgba(0,0,0,0.45)]",
              large ? "h-[120%]" : "h-[112%]",
            ].join(" ")}
            draggable={false}
          />
        ) : (
          <span
            className={[
              "font-marker leading-none select-none",
              large ? "text-[140px]" : "text-[80px]",
            ].join(" ")}
            style={{ color: `hsl(${theme.accent})`, opacity: 0.85 }}
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
    <div className="scribble-border bg-paper p-3 animate-scale-in">
      <Thumbnail lvl={lvl} large />

      <div className="mt-2 flex items-baseline justify-between gap-2 flex-wrap">
        <div
          className={[
            "font-marker text-2xl sm:text-3xl leading-none -rotate-1",
            isMarathon ? "rainbow-text animate-jitter" : "text-ink",
          ].join(" ")}
        >
          {lvl.name}
        </div>
        <Difficulty value={lvl.difficulty} />
      </div>

      <div className="font-scribble text-base text-ink/80 mt-0.5">{lvl.subtitle}</div>
      <p className="font-scribble text-sm text-ink/70 mt-1 leading-snug line-clamp-2">
        {theme.description}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Stat label="BEST TIME" value={formatMs(stat?.bestTimeMs)} />
        <Stat label="BEST SCORE" value={stat?.bestScore ? String(stat.bestScore) : "—"} />
        <Stat label="PLAYS" value={String(stat?.plays ?? 0)} />
      </div>

      <div className="mt-2 flex justify-end">
        <button
          onClick={onPlay}
          onMouseEnter={() => sfx.menuHover()}
          className={[
            "scribble-border font-marker text-xl px-4 py-1 hover:-rotate-2 transition-transform",
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

const MiniCard = forwardRef<HTMLDivElement, { lvl: LevelMeta }>(function MiniCard({ lvl }, ref) {
  return (
    <div ref={ref} className="scribble-border bg-paper p-2">
      <Thumbnail lvl={lvl} />
      <div className="font-marker text-xl text-ink mt-1 truncate">{lvl.name}</div>
      <div className="font-scribble text-sm text-ink/60 truncate">{lvl.subtitle}</div>
    </div>
  );
});

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

// Knight thumbnail visual: floating knight with afterimage ghosts that
// snapshot the knight's CURRENT position (so they look like they peeled
// off him, not just spawned dead-center).
function KnightVisual() {
  const knightRef = useRef<HTMLImageElement | null>(null);
  const [ghosts, setGhosts] = useState<Array<{ id: number; y: number }>>([]);

  useEffect(() => {
    let nextId = 0;
    const interval = window.setInterval(() => {
      const el = knightRef.current;
      if (!el) return;
      // Read the live translateY from the running float animation.
      let y = 0;
      const t = getComputedStyle(el).transform;
      if (t && t !== "none") {
        // matrix(a,b,c,d,tx,ty)  or  matrix3d(...)
        const m = t.match(/matrix.*\((.+)\)/);
        if (m) {
          const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
          y = parts.length === 6 ? parts[5] : parts[13];
        }
      }
      const id = nextId++;
      setGhosts((g) => [...g, { id, y }]);
      // ghost lifetime = 0.5s; clean up shortly after
      window.setTimeout(() => {
        setGhosts((g) => g.filter((x) => x.id !== id));
      }, 600);
    }, 800);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[78%] aspect-square flex items-center justify-center">
      {/* afterimage ghosts — snapshot of the knight at spawn time */}
      {ghosts.map((g) => (
        <img
          key={g.id}
          src={roaringKnightImg}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-contain pointer-events-none [image-rendering:pixelated] animate-knight-ghost"
          style={{
            ["--ghost-y" as never]: `${g.y}px`,
            filter: "drop-shadow(0 0 12px hsl(260 70% 60% / 0.7))",
          }}
        />
      ))}
      {/* main floating knight */}
      <img
        ref={knightRef}
        src={roaringKnightImg}
        alt="Roaring Knight"
        className="relative w-full h-full object-contain animate-knight-float [image-rendering:pixelated]"
        style={{ filter: "drop-shadow(0 0 8px hsl(260 80% 55% / 0.5))" }}
      />
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

const Card = forwardRef<HTMLDivElement, { title: string; children: React.ReactNode }>(function Card({ title, children }, ref) {
  return (
    <div ref={ref} className="scribble-border bg-paper p-4">
      <div className="font-marker text-2xl text-ink mb-2 -rotate-1 inline-block">{title}</div>
      {children}
    </div>
  );
});

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

// ---------------- UPDATES TAB ----------------

type UpdateEntry = {
  version: string;
  date: string;
  title: string;
  changes: string[];
};

const UPDATES: UpdateEntry[] = [
  {
    version: "v1.3",
    date: "2026-05-19",
    title: "Mobile-Friendly Camera",
    changes: [
      "Added a follow camera that keeps the player centered on iPhone/iPad in landscape.",
      "Game canvas now scales properly for smaller screens so the whole level is visible.",
      "Camera shifted slightly so you can see more of what's ahead.",
    ],
  },
  {
    version: "v1.2",
    date: "2026-05-19",
    title: "HUD Cleanup",
    changes: [
      "Moved parry & dash cooldowns above the player as floating numbers.",
      "Level progress now sits under the level timer.",
      "Removed the speed meter — it was just in the way.",
    ],
  },
  {
    version: "v1.1",
    date: "2026-05-18",
    title: "Celestial Marathon",
    changes: [
      "Every level chained back-to-back as one continuous run.",
      "Speedrun timer ticks across all sub-levels.",
      "Invboi stays with you the whole run, starman BGM never stops.",
    ],
  },
  {
    version: "v1.0",
    date: "2026-05-15",
    title: "DASH GAEM REMASTERED",
    changes: [
      "Full remaster with new sprites, levels, and BGM.",
      "Added Roaring Knight boss fight.",
      "Just Run Bro cutscene + badge reward.",
    ],
  },
];

function UpdatesTab() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-4">
        <div className="font-marker text-4xl text-ink -rotate-1 inline-block">UPDATE LOG</div>
        <p className="font-scribble text-lg text-ink/70 mt-1">
          what's new, what's fixed, what's broken on purpose
        </p>
      </div>
      <div className="space-y-4">
        {UPDATES.map((u, i) => (
          <div
            key={u.version}
            className="scribble-border bg-paper p-4"
            style={{ transform: `rotate(${i % 2 === 0 ? -0.4 : 0.4}deg)` }}
          >
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-baseline gap-3">
                <span className="font-bungee text-xl text-[hsl(var(--accent))]">{u.version}</span>
                <span className="font-marker text-2xl text-ink">{u.title}</span>
              </div>
              <span className="font-scribble text-sm text-ink/60">{u.date}</span>
            </div>
            <ul className="font-scribble text-lg text-ink/85 space-y-1 list-disc list-inside">
              {u.changes.map((c, j) => (
                <li key={j}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
        </div>
      </div>
    );
  }

// ---------------- YOUTUBE TAB ----------------
const YT_PLAYLISTS: { videoId: string; listId: string; title: string }[] = [
  { videoId: "iLWcdug6oqY", listId: "PLbnpeZR6mTMqh7rXBNyaiph005odpazgi", title: "Playlist 1" },
  { videoId: "MMOziflvcZo", listId: "PLbnpeZR6mTMrXyq0WMWecp8oFSY3DR-3h", title: "Playlist 2" },
  { videoId: "DMBYQEHxxA0", listId: "PLbnpeZR6mTMoTxvpVdx4heygZazsujA-N", title: "Playlist 3" },
];

export function YouTubeTab() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("https://www.youtube.com/favicon.ico", { mode: "no-cors", cache: "no-store" })
      .then(() => { /* reachable */ })
      .catch(() => { if (!cancelled) setBlocked(true); });
    return () => { cancelled = true; };
  }, []);

  // Debug shortcut: hold "1" and press Backspace to force-block all playlists.
  useEffect(() => {
    const keys = new Set<string>();
    const down = (e: KeyboardEvent) => {
      keys.add(e.key);
      if (keys.has("1") && e.key === "Backspace") {
        e.preventDefault();
        setBlocked(true);
      }
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);


  return (
    <div className="flex flex-col items-center min-h-[300px] py-4 sm:py-6 px-2 sm:px-4 overflow-y-auto max-h-[85vh] w-full">
      <a
        href="https://www.youtube.com/@StarryEVO"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { unlockAudio(); sfx.menuConfirm(); }}
        className="animate-yt-glow font-marker text-2xl sm:text-4xl md:text-6xl text-center hover:scale-105 transition-transform"
      >
        SUB TO THE YT!
      </a>
      <p className="font-scribble text-base sm:text-xl text-ink/70 mt-3 sm:mt-4 text-center">
        @StarryEVO — new devlogs, speedruns, and chaos
      </p>

      <p className="font-marker text-lg sm:text-2xl md:text-3xl text-ink mt-6 sm:mt-10 mb-3 sm:mb-4 text-center">
        check out the appitizers first..
      </p>

      {blocked ? (
        <div className="scribble-border bg-paper rounded w-full max-w-3xl py-10 px-6 text-center">
          <p className="animate-yt-glow font-marker text-2xl sm:text-4xl md:text-5xl">
            CURSE YOU GOGUARDIAN!!!! &gt;:(
          </p>
          <p className="font-scribble text-base sm:text-lg text-ink/70 mt-4">
            the playlists are blocked on this network.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 w-full max-w-6xl">
          {YT_PLAYLISTS.map((p, i) => (
            <PlaylistCard key={p.listId} p={p} i={i} onBlocked={() => setBlocked(true)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaylistCard({
  p,
  i,
  onBlocked,
}: {
  p: { videoId: string; listId: string; title: string };
  i: number;
  onBlocked: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!loaded) onBlocked();
    }, 6000);
    return () => window.clearTimeout(t);
  }, [loaded, onBlocked]);

  return (
    <div className="scribble-border bg-paper rounded overflow-hidden flex flex-col min-w-0">
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${p.videoId}?list=${p.listId}`}
          title={p.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          onError={() => onBlocked()}
        />
      </div>
      <a
        href={`https://www.youtube.com/playlist?list=${p.listId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-marker text-center text-sm sm:text-base text-ink py-2 px-2 hover:bg-ink hover:text-paper transition-colors"
      >
        ▶ open playlist {i + 1}
      </a>
    </div>
  );
}

// ---------------- BESTIARY TAB ----------------
import ragingCrittersImg from "@/assets/bestiary/raging-critters.png";
import bestiaryBgm from "@/assets/audio/bgm_champion_map.mp3";
import gachaBgm from "@/assets/audio/bgm_gacha.mp3";
import thePlayerArt from "@/assets/characters/the_player.png";
import { setBgmMuted as setGameBgmMuted, isBgmMuted as isGameBgmMuted } from "@/game/bgm";

// Shared mute state across all tab BGMs — one toggle controls whichever is playing.
let _tabBgmMuted = false;
const _tabBgmListeners = new Set<(m: boolean) => void>();
function setTabBgmMutedShared(m: boolean) {
  _tabBgmMuted = m;
  _tabBgmListeners.forEach((fn) => fn(m));
}
function useSharedTabMute(): [boolean, (m: boolean | ((p: boolean) => boolean)) => void] {
  const [muted, setMuted] = useState(_tabBgmMuted);
  useEffect(() => {
    const fn = (m: boolean) => setMuted(m);
    _tabBgmListeners.add(fn);
    return () => { _tabBgmListeners.delete(fn); };
  }, []);
  const update = (m: boolean | ((p: boolean) => boolean)) => {
    setTabBgmMutedShared(typeof m === "function" ? (m as (p: boolean) => boolean)(_tabBgmMuted) : m);
  };
  return [muted, update];
}

// Shared fade-in/out tab BGM with a shared mute toggle.
function useTabBgm(src: string, targetVolume = 0.6, fadeInMs = 1200, fadeOutMs = 500) {
  const [muted, setMuted] = useSharedTabMute();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const mutedGameRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => {
    const a = new Audio(src);
    a.loop = true;
    a.volume = 0;
    audioRef.current = a;
    if (!isGameBgmMuted()) {
      setGameBgmMuted(true);
      mutedGameRef.current = true;
    }
    a.play().catch(() => { /* needs gesture */ });

    let raf = 0;
    const start = performance.now();
    const tickIn = (t: number) => {
      const k = Math.min(1, (t - start) / fadeInMs);
      a.volume = mutedRef.current ? 0 : targetVolume * k;
      if (k < 1) raf = requestAnimationFrame(tickIn);
    };
    raf = requestAnimationFrame(tickIn);

    return () => {
      cancelAnimationFrame(raf);
      const startOut = performance.now();
      const startVol = a.volume;
      const tickOut = (t: number) => {
        const k = Math.min(1, (t - startOut) / fadeOutMs);
        a.volume = Math.max(0, Math.min(1, startVol * (1 - k)));
        if (k < 1) requestAnimationFrame(tickOut);
        else { a.pause(); a.src = ""; }
      };
      requestAnimationFrame(tickOut);
      if (mutedGameRef.current) {
        setGameBgmMuted(false);
        mutedGameRef.current = false;
      }
    };
  }, [src, targetVolume, fadeInMs, fadeOutMs]);

  // Live mute toggle (after fade-in completes, keep volume in sync)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (muted) a.volume = 0;
    else if (a.volume === 0) a.volume = targetVolume;
  }, [muted, targetVolume]);

  return { muted, setMuted };
}

function MuteBtn({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="scribble-border bg-paper px-3 py-1 font-marker text-base sm:text-lg text-ink hover:-rotate-2 transition-transform"
      aria-label={muted ? "Unmute tab music" : "Mute tab music"}
    >
      {muted ? "🔇 MUTED" : "🔊 MUSIC ON"}
    </button>
  );
}

type BestiaryEntry = {
  id: string;
  name: string;
  image: string;
  description: string;
  tags?: string[];
  lore?: string;
  combat?: string[];
};

const BESTIARY: BestiaryEntry[] = [
  {
    id: "raging-critters",
    name: "Raging Critters",
    image: ragingCrittersImg,
    description:
      "Tiny red circle goons with anger issues. They travel in packs and charge anything that moves. Quick to spawn, quicker to lose their temper.",
    tags: ["common", "melee", "swarm"],
    lore:
      "Nobody's sure where the critters come from — one moment the field is empty, the next there's a dozen of them rolling at you in a furious little stampede. Locals say they're the leftover tantrums of bigger monsters, given just enough body to roll.",
    combat: [
      "Dash through gaps in the swarm — never stand still.",
      "They commit to a charge; sidestep at the last second.",
      "Pick off stragglers before the pack regroups.",
    ],
  },
];

function BestiaryTab() {
  const [selected, setSelected] = useState<BestiaryEntry | null>(null);
  const { muted, setMuted } = useTabBgm(bestiaryBgm);

  // Close panel on Escape
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <div className="flex flex-col items-center min-h-[300px] py-4 sm:py-6 px-2 sm:px-4 overflow-y-auto max-h-[85vh] w-full animate-fade-in">
      <div className="w-full max-w-6xl flex items-center justify-between mb-2 gap-2">
        <span className="font-scribble text-sm text-ink/50">♪ field guide ambience</span>
        <MuteBtn muted={muted} onToggle={() => setMuted((m) => !m)} />
      </div>
      <p className="font-marker text-2xl sm:text-4xl md:text-5xl text-ink mb-2 text-center">
        BESTIARY
      </p>
      <p className="font-scribble text-base sm:text-lg text-ink/70 mb-6 text-center">
        a field guide to everything that wants you dead. click an entry for details.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full max-w-6xl">
        {BESTIARY.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setSelected(e)}
            className="scribble-border bg-paper rounded overflow-hidden flex flex-col min-w-0 text-left hover:-rotate-1 hover:scale-[1.01] transition-transform cursor-pointer"
          >
            <div className="relative w-full bg-paper" style={{ paddingTop: "75%" }}>
              <img
                src={e.image}
                alt={e.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="p-3 sm:p-4 flex flex-col gap-2">
              <h3 className="font-marker text-lg sm:text-xl text-ink">{e.name}</h3>
              {e.tags && (
                <div className="flex flex-wrap gap-1">
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      className="font-scribble text-xs px-2 py-0.5 border border-ink/40 rounded text-ink/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <p className="font-scribble text-sm sm:text-base text-ink/80 leading-snug">
                {e.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="scribble-border bg-paper rounded max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-ink/20">
              <div>
                <h2 className="font-marker text-3xl sm:text-5xl text-ink leading-none">
                  {selected.name}
                </h2>
                {selected.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selected.tags.map((t) => (
                      <span
                        key={t}
                        className="font-scribble text-xs px-2 py-0.5 border border-ink/40 rounded text-ink/70"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="scribble-border bg-paper px-3 py-1 font-marker text-xl text-ink hover:rotate-3 transition-transform"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="relative w-full bg-paper scribble-border" style={{ paddingTop: "75%" }}>
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="flex flex-col gap-4 min-w-0">
                <div>
                  <h3 className="font-marker text-xl text-ink mb-1 -rotate-1">LORE</h3>
                  <p className="font-scribble text-base text-ink/80 leading-snug">
                    {selected.lore ?? selected.description}
                  </p>
                </div>
                {selected.combat && selected.combat.length > 0 && (
                  <div>
                    <h3 className="font-marker text-xl text-ink mb-1 rotate-1">COMBAT NOTES</h3>
                    <ul className="font-scribble text-base text-ink/80 leading-snug list-disc pl-5 space-y-1">
                      {selected.combat.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- WIP CHARACTER SELECTION TAB ----------------
type WipCharacter = {
  id: string;
  name: string;
  blurb: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  /** Small art shown on the grid card. */
  art?: string;
  /** Larger preview art shown in the left INFO panel. Falls back to a placeholder until provided. */
  preview?: string;
};

const WIP_CHARACTERS: WipCharacter[] = [
  { id: "stick",   name: "The Player", blurb: "The OG. Runs. Jumps. Vibes.",              rarity: "common",    art: thePlayerArt },
  { id: "dasher",  name: "Blue Blur",       blurb: "Dashes faster. Thinks slower.",            rarity: "rare" },
  { id: "shadow",  name: "Shark Gal",      blurb: "A rumor in pencil form. Hard to pin down.", rarity: "epic" },
  { id: "x3mode",  name: "X3 MODE",             blurb: "Locked behind a story we haven't written.", rarity: "legendary" },
];

const RARITY_STYLES: Record<WipCharacter["rarity"], string> = {
  common:    "border-ink/40 text-ink/70",
  rare:      "border-blue-500/60 text-blue-700",
  epic:      "border-purple-500/60 text-purple-700",
  legendary: "border-[hsl(var(--accent))] text-[hsl(var(--accent))]",
};

// Per-character outline tint for the grid cards (matches reference colors).
const CARD_TINT: Record<string, string> = {
  stick:  "#1a1a1a",
  dasher: "#2b6cff",
  shadow: "#1a1a1a",
  x3mode: "#e11d2a",
};

function CharacterSelectScreen({ onClose }: { onClose: () => void }) {
  const { muted, setMuted } = useTabBgm(gachaBgm);
  const [picked, setPicked] = useState<string>("stick");
  const selected = WIP_CHARACTERS.find((c) => c.id === picked) ?? WIP_CHARACTERS[0];

  // Swipe-in / swipe-out transition.
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const handleClose = () => {
    if (closing) return;
    sfx.menuTab();
    setClosing(true);
    setShown(false);
    window.setTimeout(onClose, 420);
  };

  // ESC to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { e.preventDefault(); handleClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  // Page nav (only one page for now — arrows are decorative/disabled).
  const PAGE = 1;
  const MAX_PAGE = 1;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        background: "#c9c9c9",
        transform: shown ? "translateX(0)" : "translateX(100%)",
        opacity: shown ? 1 : 0,
        transition: "transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease-out",
      }}
    >
      <div className="w-full h-full overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col items-center">
        {/* Top bar: GET OUT + title + mute */}
        <div className="w-full max-w-6xl flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center font-marker text-xs sm:text-sm text-paper px-3 py-1.5 hover:-rotate-2 transition-transform"
            style={{
              background: "#e11d2a",
              clipPath: "polygon(10% 0, 100% 0, 100% 100%, 10% 100%, 0 50%)",
              paddingLeft: "1.5rem",
            }}
            title="back to menu"
          >
            GET OUT.
          </button>
          <span className="font-marker text-2xl sm:text-4xl text-ink -rotate-1 hidden sm:inline-block">
            CHARACTER SELECT
          </span>
          <div className="flex items-center gap-2">
            <span className="font-scribble text-xs sm:text-sm text-ink/60 hidden sm:inline">♪ gacha lobby theme</span>
            <MuteBtn muted={muted} onToggle={() => setMuted((m) => !m)} />
          </div>
        </div>

        {/* Two-panel layout to mirror the reference sketch */}
        <div className="w-full max-w-6xl flex-1 grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-4 sm:gap-6">
          {/* LEFT — info / preview panel */}
          <div
            className="relative scribble-border rounded-md p-4 sm:p-6 min-h-[460px] flex items-center justify-center overflow-hidden"
            style={{ background: "#bdbdbd" }}
          >
            {/* Big character preview (separate sprite slot) */}
            <div className="flex items-center justify-center w-full h-full pt-6">
              {selected.preview ? (
                <img
                  src={selected.preview}
                  alt={`${selected.name} preview`}
                  className="max-h-[420px] w-auto object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                />
              ) : (
                <div className="flex flex-col items-center text-ink/40 select-none">
                  <div className="font-marker text-[10rem] leading-none">?</div>
                  <div className="font-scribble text-sm mt-2">preview sprite coming soon</div>
                </div>
              )}
            </div>

            {/* INFO tag bottom-left */}
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-[75%] -rotate-2">
              <div className="bg-ink text-paper font-marker text-2xl sm:text-3xl tracking-widest px-4 py-2 inline-block">
                INFO
              </div>
              <div className="mt-1 bg-paper/90 scribble-border px-3 py-2 font-scribble text-sm sm:text-base text-ink leading-snug">
                <div className="font-marker text-base sm:text-lg leading-none mb-1">{selected.name}</div>
                <span
                  className={[
                    "font-scribble text-[10px] px-1.5 py-0.5 border rounded uppercase tracking-wide mr-2",
                    RARITY_STYLES[selected.rarity],
                  ].join(" ")}
                >
                  {selected.rarity}
                </span>
                {selected.blurb}
              </div>
            </div>
          </div>

          {/* RIGHT — grid panel */}
          <div
            className="relative scribble-border rounded-md p-4 sm:p-5 min-h-[460px] -rotate-1"
            style={{ background: "#8a8a8a" }}
          >
            <div className="font-marker text-2xl sm:text-3xl text-ink mb-2 text-center tracking-wider">
              PG . {PAGE}
            </div>

            <div className="flex gap-3 sm:gap-4 items-stretch">
              {/* Up/Down arrows column */}
              <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 py-2">
                <button
                  type="button"
                  disabled={PAGE <= 1}
                  className="font-marker text-3xl sm:text-4xl text-ink disabled:opacity-30 hover:-translate-y-0.5 transition-transform"
                  aria-label="previous page"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={PAGE >= MAX_PAGE}
                  className="font-marker text-3xl sm:text-4xl text-ink disabled:opacity-30 hover:translate-y-0.5 transition-transform"
                  aria-label="next page"
                >
                  ↓
                </button>
              </div>

              {/* 2x2 character cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1">
                {WIP_CHARACTERS.map((c) => {
                  const active = picked === c.id;
                  const tint = CARD_TINT[c.id] ?? "#1a1a1a";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPicked(c.id)}
                      className={[
                        "relative bg-paper rounded-sm flex items-center justify-center overflow-hidden transition-transform hover:scale-[1.03]",
                        active ? "ring-4 ring-[hsl(var(--accent))] scale-[1.02]" : "",
                      ].join(" ")}
                      style={{
                        aspectRatio: "3 / 4",
                        border: `3px solid ${tint}`,
                        boxShadow: "2px 2px 0 rgba(0,0,0,0.35)",
                      }}
                      title={c.name}
                    >
                      {c.art ? (
                        <img src={c.art} alt={c.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="font-marker text-5xl" style={{ color: tint }}>?</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pencil decoration */}
            <div className="absolute bottom-2 right-3 font-marker text-xl sm:text-2xl text-ink/70 rotate-12 select-none">
              ✏
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
