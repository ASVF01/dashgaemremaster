import { useEffect, useRef, useState } from "react";
import { LEVELS, type LevelId } from "@/game/level";
import {
  ACTIONS, DEFAULT_BINDS, type ActionId, type Keybinds,
  keyLabel, useKeybinds,
} from "@/game/keybinds";
import { useSettings, type Settings } from "@/game/settings";
import { sfx, setSfxVolume, unlockAudio } from "@/game/sfx";
import { setBgmVolume } from "@/game/bgm";
import BgmPlayer from "@/game/BgmPlayer";
import { SPRITE_GALLERY } from "@/game/sprites";

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

// ---------------- PLAY TAB ----------------
function PlayTab({ onPlay }: { onPlay: (id: LevelId) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {LEVELS.filter((l) => !l.hidden).map((lvl) => (
        <button
          key={lvl.id}
          onClick={() => onPlay(lvl.id)}
          onMouseEnter={() => sfx.menuHover()}
          className="scribble-border bg-paper p-4 text-left hover:-rotate-1 hover:bg-[hsl(var(--accent))/0.15] transition-transform group"
        >
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-marker text-3xl text-ink">{lvl.name}</span>
            <span className="font-bungee text-base text-ink/60">PAR {lvl.par}s</span>
          </div>
          <div className="font-scribble text-xl text-ink/80">{lvl.subtitle}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-scribble text-base text-ink/60">difficulty</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className={[
                  "inline-block w-3 h-3 scribble-border",
                  i < lvl.difficulty ? "bg-[hsl(var(--accent))]" : "bg-paper",
                ].join(" ")}
              />
            ))}
          </div>
          <div className="mt-3 font-marker text-xl text-[hsl(var(--accent))] opacity-0 group-hover:opacity-100 transition-opacity">
            ▶ GO!!
          </div>
        </button>
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
          onClick={() => setBinds(DEFAULT_BINDS)}
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
                    onClick={() => setCapture(isCapturing ? null : { action: a.id, slot })}
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
          onClick={() => resetSettings()}
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
          onClick={() => onChange(!value)}
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
