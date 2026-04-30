import { useEffect, useRef, useState } from "react";
import {
  GRAVITY, MOVE_ACCEL, MAX_SPEED, FRICTION, JUMP_VEL,
  SLIDE_BOOST, SLIDE_FRICTION, PARRY_WINDOW, PARRY_COOLDOWN, PARRY_BOOST,
  DASH_IMPULSE, DASH_BONUS, DASH_DURATION, DASH_COOLDOWN,
  PLAYER_W, PLAYER_H, SLIDE_H,
  MACH_THRESHOLDS, MACH_COLORS, MACH_LABELS,
  type Particle, type Projectile, type Enemy,
} from "@/game/constants";
import { buildLevel, type Level, type LevelId } from "@/game/level";
import { sketchLine, sketchRect, sketchCircle, jaggedBolt, INK } from "@/game/draw";
import { isPressed, matchesAction, getLiveBinds } from "@/game/keybinds";
import { sfx, unlockAudio } from "@/game/sfx";

import { playBgmFor, stopBgm, pauseBgm, resumeBgm, bgmLevelEnd, playStarmanBgm, getStarmanElapsed, playSomSomBgm, getSomSomElapsed } from "@/game/bgm";
import weSfxUrl from "@/assets/audio/impact_aura_charge.ogg";
import { getSettings } from "@/game/settings";
import { getSprite, type SpriteState } from "@/game/sprites";
import spookUrl from "@/assets/sprites/spook.png";
import spookHurtUrl from "@/assets/sprites/spook_hurt.png";
import roaringKnightUrl from "@/assets/roaring_knight.png";
import roaringKnightVulnUrl from "@/assets/roaring_knight_vulnerable.png";
import bossBgUrl from "@/assets/boss_bg.gif";
import bossBgSheetUrl from "@/assets/boss_bg_sheet.webp";

type Keys = Record<string, boolean>;

const RAINBOW_BUCKETS = 18;
const tintCache = new Map<string, HTMLCanvasElement>();
const darkTintCache = new Map<string, HTMLCanvasElement>();
const starCache = new Map<string, HTMLCanvasElement>();

// "Man of spook" — chaser sprite + its hurt variant. Eagerly loaded so the
// first frame after spawn already has a sprite ready. A red-tinted silhouette
// is cached on first use for the trail ghosts.
const spookImg = new Image(); spookImg.src = spookUrl;
const spookHurtImg = new Image(); spookHurtImg.src = spookHurtUrl;
let spookRedTint: HTMLCanvasElement | null = null;
function getSpookRedTint(): HTMLCanvasElement | null {
  if (!spookImg.complete || !spookImg.naturalWidth) return null;
  if (spookRedTint) return spookRedTint;
  const off = document.createElement("canvas");
  off.width = spookImg.naturalWidth;
  off.height = spookImg.naturalHeight;
  const octx = off.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(spookImg, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = "#f5234c";
  octx.fillRect(0, 0, off.width, off.height);
  spookRedTint = off;
  return off;
}

// Roaring Knight boss sprite. Drawn in screen-space (top-right, hovers).
const knightImg = new Image(); knightImg.src = roaringKnightUrl;
const knightVulnImg = new Image(); knightVulnImg.src = roaringKnightVulnUrl;
const bossBgImg = new Image(); bossBgImg.src = bossBgUrl;
// Animated boss bg: 31 frames, 6 cols × 6 rows, each 320×180.
const bossBgSheet = new Image(); bossBgSheet.src = bossBgSheetUrl;
const BOSS_BG_FRAMES = 31;
const BOSS_BG_COLS = 6;
const BOSS_BG_FW = 320;
const BOSS_BG_FH = 180;
const BOSS_BG_FPS = 18;
const KNIGHT_DRAW_H = 180; // rendered height in screen pixels (sprite is square-ish)

function makeBoss() {
  return {
    hp: 5,
    maxHp: 5,
    screenX: 0, screenY: 0,
    hoverPhase: 0,
    attackTimer: 2.0,         // grace period before first slash
    attacksRemaining: 3,      // slashes per burst
    worn: 0,                  // vulnerable window
    wornWorldX: 0,            // pinned world X while staggered (un-sticks from camera)
    wornAnchored: false,
    hitFlash: 0,
    shakeT: 0,
    afterTimer: 0,
    // afterimages drift right in screen-space and ignore world camera
    afterimages: [] as { sx: number; sy: number; vx: number; life: number; maxLife: number; flipped: boolean }[],
    // warnings: spinning red lines that re-aim toward player while spinning,
    // then lock in their final angle and fire a white slash.
    warnings: [] as { t: number; dur: number; fired: boolean; angle: number; len: number }[],
    // slashes: re-aimed every frame from boss origin toward player while alive
    slashes: [] as { angle: number; len: number; t: number; dur: number; hit: boolean }[],
    defeated: false,
    defeatT: 0,
  };
}

// Darker cyan used by SOM SOM (invboi-in-just-run-bro). Single hue, lower lightness.
const DARK_CYAN = "#0fb5cf";
const DARK_CYAN_SOFT = "#1199b0";

function hueBucket(hue: number) {
  return ((Math.round(hue / (360 / RAINBOW_BUCKETS)) % RAINBOW_BUCKETS) + RAINBOW_BUCKETS) % RAINBOW_BUCKETS;
}

function bucketHue(bucket: number) {
  return Math.round((bucket / RAINBOW_BUCKETS) * 360);
}

function getTintedSprite(sprite: HTMLImageElement, hue: number): HTMLCanvasElement {
  const bucket = hueBucket(hue);
  const key = `${sprite.currentSrc || sprite.src}|${bucket}`;
  const cached = tintCache.get(key);
  if (cached) return cached;
  const off = document.createElement("canvas");
  off.width = sprite.width;
  off.height = sprite.height;
  const octx = off.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(sprite, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = `hsl(${bucketHue(bucket)}, 95%, 60%)`;
  octx.fillRect(0, 0, off.width, off.height);
  octx.globalCompositeOperation = "source-over";
  if (tintCache.size > 96) tintCache.clear();
  tintCache.set(key, off);
  return off;
}

// Darker variant used for SOM SOM cyan. Lower lightness, slightly less saturated.
function getDarkCyanTintedSprite(sprite: HTMLImageElement): HTMLCanvasElement {
  const key = sprite.currentSrc || sprite.src;
  const cached = darkTintCache.get(key);
  if (cached) return cached;
  const off = document.createElement("canvas");
  off.width = sprite.width;
  off.height = sprite.height;
  const octx = off.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(sprite, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = "hsl(190, 85%, 42%)";
  octx.fillRect(0, 0, off.width, off.height);
  octx.globalCompositeOperation = "source-over";
  if (darkTintCache.size > 64) darkTintCache.clear();
  darkTintCache.set(key, off);
  return off;
}

function getRainStar(size: number, hue: number): HTMLCanvasElement {
  const sizeBucket = Math.max(4, Math.min(9, Math.round(size)));
  const bucket = hueBucket(hue);
  const key = `${sizeBucket}|${bucket}`;
  const cached = starCache.get(key);
  if (cached) return cached;
  const pad = 3;
  const outer = sizeBucket;
  const inner = outer * 0.45;
  const off = document.createElement("canvas");
  off.width = off.height = (outer + pad) * 2;
  const octx = off.getContext("2d")!;
  octx.translate(off.width / 2, off.height / 2);
  octx.fillStyle = `hsl(${bucketHue(bucket)}, 95%, 60%)`;
  octx.strokeStyle = "rgba(255,255,255,0.72)";
  octx.lineWidth = 1;
  octx.beginPath();
  octx.moveTo(0, -outer);
  octx.lineTo(inner * 0.5878, -inner * 0.809);
  octx.lineTo(outer * 0.9511, -outer * 0.309);
  octx.lineTo(inner * 0.9511, inner * 0.309);
  octx.lineTo(outer * 0.5878, outer * 0.809);
  octx.lineTo(0, inner);
  octx.lineTo(-outer * 0.5878, outer * 0.809);
  octx.lineTo(-inner * 0.9511, inner * 0.309);
  octx.lineTo(-outer * 0.9511, -outer * 0.309);
  octx.lineTo(-inner * 0.5878, -inner * 0.809);
  octx.closePath();
  octx.fill();
  octx.stroke();
  starCache.set(key, off);
  return off;
}

interface Player {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number;
  facing: 1 | -1;
  onGround: boolean;
  sliding: boolean;
  diving: boolean;
  dashTime: number; // remaining seconds of active dash
  dashCooldown: number;
  dashVx: number;   // locked velocity during current dash
  dashVy: number;
  parrying: number; // remaining seconds of parry active window
  parryCooldown: number;
  invuln: number;
  hp: number;
  hitFlash: number;
  hurtTimer: number; // seconds remaining of post-hit "hurt" pose + red afterimages
  hurtAfterTimer: number; // throttle for spawning red afterimages
  squash: number; // 0..1 transient (landing — wide & short)
  stretch: number; // 0..1 transient (falling/dive — tall & thin)
  hStretch: number; // 0..1 transient (dash — wide & slightly short)
  smearTimer: number;
  dashAirJumpUsed: boolean; // one bonus mid-air jump available while dashing
  jumpWasHeld: boolean;     // for rising-edge jump detection
  alive: boolean;
  superDashing: boolean;
  superDashTime: number; // seconds the hold has been active
  starman: boolean; // "invboi" cheat — rainbow + star sparkles + custom BGM
  somSom: boolean; // invboi while in just-run-bro — cyan variant
  starTimer: number; // timer for emitting star particles
  beamTime: number; // remaining seconds the beam pose is held
  beamCooldown: number; // small fire-rate cap on beams (legacy, kept for compat)
  beamGrounded: boolean; // whether the beam was fired from ground (pose select)
  laserActive: boolean; // held-laser attack (invboi vs boss only)
  laserFloatBudget: number; // seconds of float remaining (max 10)
  laserDir: 1 | -1; // direction the laser is pointed
  laserDamageTick: number; // accumulator for periodic boss damage
  laserWasHeld: boolean; // edge-detect for re-arming float per press
}

interface Afterimage {
  x: number; y: number; w: number; h: number;
  facing: 1 | -1;
  sliding: boolean;
  diving: boolean;
  state: SpriteState;
  frame: number;        // animation frame index captured at spawn (mach-scaled)
  life: number; maxLife: number;
  color: string;
  rainbowHue?: number;
  tintColor?: string; // solid tint applied over sprite (e.g., red hurt trail)
  alphaBoost?: number; // optional alpha multiplier (defaults to 1)
}

interface GameRefs {
  level: Level;
  player: Player;
  projectiles: Projectile[];
  particles: Particle[];
  afterimages: Afterimage[];
  afterTimer: number;
  chaserTrail: { x: number; y: number; w: number; h: number; life: number; maxLife: number }[];
  chaserTrailTimer: number;
  cameraX: number;
  shake: number;
  freezeFrames: number;
  time: number;
  combo: number;
  comboTimer: number;
  score: number;
  bestMach: number;
  glitch: number;
  superDashBurst: { x: number; y: number; t: number; facing: 1 | -1 } | null;
  superDashFxTimer: number;
  superDashLineTimer: number;
  startedAt: number;
  finished: boolean;
  finishTime: number;
  walkTimer: number;
  skidDustTimer: number;
  skidSfxTimer: number;
  isSkidding: boolean;
  rainStars: { x: number; y: number; vy: number; size: number; phase: number; hue: number }[];
  // SOM SOM lightning: spawned occasionally over the OLED-black backdrop.
  lightningCooldown: number;
  lightningBolts: { x: number; t: number; life: number; segs: { x: number; y: number }[]; flash: number }[];
  // SOM SOM "32.65" event: white fade, fast cloud, optimized rain.
  somSomStorm: boolean;
  somSomStormFlash: number; // seconds since flash trigger
  somSomCloudX: number | null;
  somSomRain: Float32Array | null; // packed [x, y, speed, len] * N
  heartbeatTimer: number;
  // Roaring Knight boss state (only present in the boss level).
  boss: Boss | null;
  // Player beams (invboi vs boss only).
  beams: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; hit: boolean }[];
}

// Boss is rendered in screen-space (top-right). World-space slashes attack the player.
interface Boss {
  hp: number;
  maxHp: number;
  // Screen-space anchor (camera-locked). Drawn at this position.
  screenX: number;
  screenY: number;
  hoverPhase: number;
  // attack cycle
  attackTimer: number; // counts down to next attack burst
  attacksRemaining: number; // attacks left in current burst before "worn out"
  worn: number; // seconds remaining of "worn out" / vulnerable window
  wornWorldX: number; // pinned world X while staggered (un-sticks from camera)
  wornAnchored: boolean;
  hitFlash: number; // 0..1 white flash overlay on the sprite
  shakeT: number; // residual shake time (own little wiggle on hit)
  // afterimages (screen-space, ignore camera) — drift right via vx
  afterTimer: number;
  afterimages: { sx: number; sy: number; vx: number; life: number; maxLife: number; flipped: boolean }[];
  // warnings: spinning red lines that re-aim while spinning, then fire a slash
  warnings: { t: number; dur: number; fired: boolean; angle: number; len: number }[];
  // slashes: re-aimed every frame from boss origin toward player
  slashes: { angle: number; len: number; t: number; dur: number; hit: boolean }[];
  defeated: boolean;
  defeatT: number;
}

interface Props {
  onHud: (hud: HudState) => void;
  onFinish: (timeMs: number, score: number) => void;
  onDeath: () => void;
  paused: boolean;
  /** When true, do not pause the BGM even if the game is paused (e.g. win/death overlays). */
  keepAudio?: boolean;
  resetKey: number;
  levelId?: LevelId;
}

export interface HudState {
  hp: number;
  mach: number;
  speed: number;
  score: number;
  combo: number;
  progress: number;
  timeMs: number;
  parryReady: boolean;
  dashCooldown: number;
  dashCooldownMax: number;
  starman?: boolean;
  somSom?: boolean;
}

export default function GameCanvas({ onHud, onFinish, onDeath, paused, keepAudio = false, resetKey, levelId = "scribble-1" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refs = useRef<GameRefs | null>(null);
  const keysRef = useRef<Keys>({});
  const levelIdRef = useRef<LevelId>(levelId);
  levelIdRef.current = levelId;
  const [size, setSize] = useState({ w: 1200, h: 600 });

  // resize
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth - 24, 1400);
      const h = Math.min(window.innerHeight - 180, 720);
      setSize({ w, h: Math.max(420, h) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // init / reset
  useEffect(() => {
    const level = buildLevel(levelId);
    refs.current = {
      level,
      player: {
        x: level.spawn.x, y: level.spawn.y,
        vx: 0, vy: 0,
        w: PLAYER_W, h: PLAYER_H,
        facing: 1,
        onGround: false,
        sliding: false,
        diving: false,
        dashTime: 0,
        dashCooldown: 0,
        dashVx: 0, dashVy: 0,
        parrying: 0,
        parryCooldown: 0,
        invuln: 0,
        hp: 3,
        hitFlash: 0,
        hurtTimer: 0,
        hurtAfterTimer: 0,
        squash: 0, stretch: 0, hStretch: 0, smearTimer: 0,
        dashAirJumpUsed: false,
        jumpWasHeld: false,
        alive: true,
        superDashing: false,
        superDashTime: 0,
        starman: false,
        somSom: false,
        starTimer: 0,
        beamTime: 0,
        beamCooldown: 0,
        beamGrounded: true,
        laserActive: false,
        laserFloatBudget: 10,
        laserDir: 1,
        laserDamageTick: 0,
        laserWasHeld: false,
      },
      projectiles: [],
      particles: [],
      afterimages: [],
      afterTimer: 0,
      chaserTrail: [],
      chaserTrailTimer: 0,
      cameraX: 0,
      shake: 0,
      freezeFrames: 0,
      time: 0,
      combo: 0,
      comboTimer: 0,
      score: 0,
      bestMach: 0,
      glitch: 0,
      superDashBurst: null,
      superDashFxTimer: 0,
      superDashLineTimer: 0,
      startedAt: performance.now(),
      finished: false,
      finishTime: 0,
      walkTimer: 0,
      skidDustTimer: 0,
      skidSfxTimer: 0,
      isSkidding: false,
      rainStars: [],
      lightningCooldown: 0,
      lightningBolts: [],
      somSomStorm: false,
      somSomStormFlash: -1,
      somSomCloudX: null,
      somSomRain: null,
      heartbeatTimer: 0,
      boss: levelId === "roaring-knight" ? makeBoss() : null,
      beams: [],
    };
    // Any reset/level change cancels the starman shimmer too.
    sfx.shineStop(); sfx.rainStop(); sfx.slideStop(); sfx.laserStop();
  }, [resetKey, levelId]);

  // BGM: stop on unmount only. The parent (Index) decides which track to
  // play based on the current screen (menu vs playing) so we don't race
  // with the menu music here. Restart on retry is also driven by the
  // parent via screen/levelId/resetKey transitions.
  useEffect(() => {
    return () => { stopBgm(); sfx.shineStop(); sfx.rainStop(); sfx.slideStop(); sfx.laserStop(); };
  }, []);

  // BGM: pause/resume with the game's pause state — but keep playing when
  // an overlay (win/death) wants the music to continue in the background.
  useEffect(() => {
    if (paused && !keepAudio) pauseBgm(); else resumeBgm();
  }, [paused, keepAudio]);

  // keys
  useEffect(() => {
    let cheatBuf = "";
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      // cheat code: type "invboi" to enter starman mode
      if (e.key && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        cheatBuf = (cheatBuf + e.key.toLowerCase()).slice(-12);
        if (cheatBuf.endsWith("invboi") && refs.current) {
          const r = refs.current;
          if (r.player.alive && !r.finished) {
            r.player.starman = true;
            r.player.starTimer = 0;
            const inJrb = levelIdRef.current === "just-run-bro";
            r.player.somSom = inJrb;
            // generous i-frames so they actually feel invincible
            r.player.invuln = Math.max(r.player.invuln, 9999);
            unlockAudio();
            if (inJrb) playSomSomBgm();
            else playStarmanBgm();
            sfx.shineStart();
            burst(r, r.player.x + r.player.w / 2, r.player.y + r.player.h / 2, inJrb ? "#22e2ff" : "#ffd11a", 24, 380);
          }
          cheatBuf = "";
        }
      }
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      // parry — bound action
      if (matchesAction(e.code, "parry") && refs.current) {
        unlockAudio();
        const r = refs.current;
        if (r.player.parryCooldown <= 0 && r.player.parrying <= 0) {
          r.player.parrying = PARRY_WINDOW;
          // Boss fights: shorter cooldown so the player can keep up with the
          // knight's quick attacks, but still long enough that you can't just
          // mash the button — must be a deliberate retry after the active
          // window closes.
          const cd = r.boss ? PARRY_WINDOW + 0.18 : PARRY_COOLDOWN + PARRY_WINDOW;
          r.player.parryCooldown = cd;
          // i-frames for the entire parry active window so you can't get hit while parrying
          if (r.player.invuln < PARRY_WINDOW) r.player.invuln = PARRY_WINDOW;
          sfx.parryStart();
        }
      }
      // dash — bound action. Direction comes from currently held movement
      // keys (8-way). If nothing is held, dash horizontally in facing dir.
      // Pressing dash + jump together performs a "dash jump".
      if (matchesAction(e.code, "dash") && refs.current) {
        unlockAudio();
        const r = refs.current;
        const p = r.player;
        // INVBOI vs BOSS: replace dash with a HELD LASER attack.
        if (p.starman && r.boss && !r.boss.defeated && p.alive) {
          if (!p.laserActive && !e.repeat) {
            p.laserActive = true;
            p.laserDir = p.facing;
            p.laserDamageTick = 0;
            p.beamTime = 0.2; // pose hint
            p.beamGrounded = p.onGround;
            unlockAudio();
            sfx.laserStart();
            r.shake = Math.max(r.shake, 0.25);
          }
          return;
        }
        // SUPER DASH (just-run-bro only): hold dash for increasing speed.
        // No cooldown, no normal dash sfx — just a single whoosh on press.
        if (levelIdRef.current === "just-run-bro") {
          if (!p.superDashing && p.alive && !e.repeat) {
            p.superDashing = true;
            p.superDashTime = 0;
            p.hStretch = 1;
            sfx.superDash();
            // dedicated super-dash burst VFX (~0.18s)
            r.superDashBurst = {
              x: p.x + p.w / 2,
              y: p.y + p.h / 2,
              t: 0,
              facing: p.facing,
            };
            r.shake = Math.max(r.shake, 0.7);
            r.freezeFrames = Math.max(r.freezeFrames, 3);
            r.glitch = Math.max(r.glitch, 0.4);
          }
          return;
        }
        if (p.dashCooldown <= 0 && p.dashTime <= 0 && p.alive) {
          const k = keysRef.current;
          const b = getLiveBinds();
          let dx = 0, dy = 0;
          if (isPressed(k, "left",  b)) dx -= 1;
          if (isPressed(k, "right", b)) dx += 1;
          const jumpAlso = isPressed(k, "jump", b);
          const downHeld = isPressed(k, "slide", b);
          if (jumpAlso) dy -= 1;
          if (downHeld) dy += 1;
          igniteDash(r, p, dx, dy, jumpAlso);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      // release super dash
      if (matchesAction(e.code, "dash") && refs.current) {
        const p = refs.current.player;
        if (p.superDashing) {
          p.superDashing = false;
          p.superDashTime = 0;
        }
        if (p.laserActive) {
          p.laserActive = false;
          sfx.laserStop();
        }
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastPausedRender = 0;

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const r = refs.current;
      const c = canvasRef.current;
      if (!r || !c) return;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (!paused && !r.finished && r.player.alive) {
        update(r, dt, keysRef.current);
      }
      if (paused && t - lastPausedRender < 250) return;
      if (paused) lastPausedRender = t;
      render(c, r, size.w, size.h);

      // HUD
      if (t - lastHud >= 100 || r.finished || !r.player.alive) {
        lastHud = t;
        const speed = Math.abs(r.player.vx);
        const mach = machTier(speed);
        onHud({
          hp: r.player.hp,
          mach,
          speed,
          score: r.score,
          combo: r.combo,
          progress: Math.min(1, r.player.x / r.level.width),
          timeMs: r.finished ? r.finishTime : performance.now() - r.startedAt,
          parryReady: r.player.starman ? true : r.player.parryCooldown <= 0,
          dashCooldown: r.player.starman ? 0 : Math.max(0, r.player.dashCooldown),
          dashCooldownMax: DASH_COOLDOWN,
          starman: r.player.starman,
          somSom: r.player.somSom,
        });
      }

      if (!r.player.alive && !r.finished) {
        r.finished = true;
        r.finishTime = performance.now() - r.startedAt;
        sfx.die();
        // Don't touch BGM on death — let the level's music keep playing
        // through the death overlay and into the retry.
        onDeath();
      }
      if (r.finished && r.player.alive && r.finishTime === 0) {
        // shouldn't happen; finish handled in update
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, paused, onHud, onDeath, onFinish]);

  return (
    <div className="relative mx-auto" style={{ width: size.w, height: size.h }}>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="block scribble-border bg-paper"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );

  // ----- helpers in closure -----
  function machTier(speed: number) {
    let tier = 0;
    for (let i = MACH_THRESHOLDS.length - 1; i >= 0; i--) {
      if (speed >= MACH_THRESHOLDS[i]) { tier = i; break; }
    }
    return tier;
  }

  function spawnParticle(r: GameRefs, p: Partial<Particle> & { x: number; y: number }) {
    r.particles.push({
      x: p.x, y: p.y,
      vx: p.vx ?? 0, vy: p.vy ?? 0,
      life: p.life ?? 0.4, maxLife: p.life ?? 0.4,
      color: p.color ?? "#141414",
      size: p.size ?? 3,
      kind: p.kind ?? "spark",
      angle: p.angle ?? 0,
    });
  }

  function burst(r: GameRefs, x: number, y: number, color: string, n = 14, speed = 280) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawnParticle(r, {
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        color, size: 2 + Math.random() * 3,
        life: 0.35 + Math.random() * 0.3,
        kind: Math.random() < 0.4 ? "shard" : "spark",
        angle: Math.random() * Math.PI,
      });
    }
  }

  // Chunky kick-up of dust + grit on slide-start.
  function spawnSlideDustBurst(r: GameRefs, p: Player) {
    const reduced = getSettings().reducedFx;
    const baseY = p.y + p.h;
    const cx = p.x + p.w / 2;
    const back = -p.facing; // dust shoots backward relative to movement
    const n = reduced ? 6 : 14;
    // big back-smear
    spawnParticle(r, {
      x: cx, y: baseY,
      vx: back * 240, vy: -90,
      color: INK, life: 0.42, size: 5, kind: "smear",
    });
    for (let i = 0; i < n; i++) {
      const fwdJitter = (Math.random() - 0.5) * p.w;
      const speed = 90 + Math.random() * 220;
      const upward = 80 + Math.random() * 180;
      const grayShade = 60 + Math.floor(Math.random() * 90);
      const col = `rgb(${grayShade},${grayShade},${grayShade})`;
      spawnParticle(r, {
        x: cx + fwdJitter,
        y: baseY - Math.random() * 4,
        vx: back * speed + (Math.random() - 0.5) * 60,
        vy: -upward,
        color: col,
        size: 1.5 + Math.random() * 2.5,
        life: 0.35 + Math.random() * 0.4,
        kind: Math.random() < 0.5 ? "spark" : "shard",
        angle: Math.random() * Math.PI,
      });
    }
    // a couple of pebbles arcing out
    if (!reduced) {
      for (let i = 0; i < 4; i++) {
        spawnParticle(r, {
          x: cx, y: baseY - 2,
          vx: back * (260 + Math.random() * 200),
          vy: -(180 + Math.random() * 140),
          color: "#3a3a3a",
          size: 2 + Math.random() * 1.5,
          life: 0.5 + Math.random() * 0.3,
          kind: "shard",
          angle: Math.random() * Math.PI,
        });
      }
    }
  }

  // Continuous grinding-dust trail while sliding. Throttled by smearTimer.
  function spawnSlideDustTrail(r: GameRefs, p: Player, dt: number, intensity: number) {
    const reduced = getSettings().reducedFx;
    // pace: faster at higher intensity (every 30-90ms)
    const interval = reduced ? 0.12 : (0.09 - 0.06 * intensity);
    p.smearTimer -= dt;
    if (p.smearTimer > 0) return;
    p.smearTimer = Math.max(0.02, interval);
    const baseY = p.y + p.h;
    const cx = p.x + p.w / 2;
    const back = -p.facing;
    const puffs = reduced ? 1 : (1 + Math.floor(intensity * 2));
    for (let i = 0; i < puffs; i++) {
      const offsetX = (Math.random() - 0.5) * (p.w * 0.7);
      const grayShade = 80 + Math.floor(Math.random() * 100);
      const col = `rgb(${grayShade},${grayShade},${grayShade})`;
      spawnParticle(r, {
        x: cx + offsetX,
        y: baseY - Math.random() * 2,
        vx: back * (40 + Math.random() * 80 + intensity * 80),
        vy: -(40 + Math.random() * 70 + intensity * 40),
        color: col,
        size: 1.5 + Math.random() * 2 + intensity,
        life: 0.28 + Math.random() * 0.25,
        kind: Math.random() < 0.35 ? "shard" : "spark",
        angle: Math.random() * Math.PI,
      });
    }
    // occasional spark/grit shard at higher speeds
    if (!reduced && intensity > 0.5 && Math.random() < 0.35) {
      spawnParticle(r, {
        x: cx + (Math.random() - 0.5) * p.w * 0.5,
        y: baseY - 1,
        vx: back * (200 + Math.random() * 180),
        vy: -(120 + Math.random() * 100),
        color: "#fff34a",
        size: 1 + Math.random() * 1.5,
        life: 0.18 + Math.random() * 0.12,
        kind: "spark",
        angle: Math.random() * Math.PI,
      });
    }
  }

  // Soft puff of dust when the player stands up out of a slide.
  function spawnSlideEndPuff(r: GameRefs, p: Player) {
    const reduced = getSettings().reducedFx;
    const baseY = p.y + p.h;
    const cx = p.x + p.w / 2;
    const back = -p.facing;
    const n = reduced ? 5 : 11;
    // small back-smear
    spawnParticle(r, {
      x: cx, y: baseY,
      vx: back * 110, vy: -60,
      color: INK, life: 0.32, size: 4, kind: "smear",
    });
    for (let i = 0; i < n; i++) {
      const offsetX = (Math.random() - 0.5) * (p.w * 0.9);
      const grayShade = 110 + Math.floor(Math.random() * 90);
      const col = `rgb(${grayShade},${grayShade},${grayShade})`;
      spawnParticle(r, {
        x: cx + offsetX,
        y: baseY - Math.random() * 3,
        vx: back * (40 + Math.random() * 90) + (Math.random() - 0.5) * 50,
        vy: -(70 + Math.random() * 130),
        color: col,
        size: 1.5 + Math.random() * 2,
        life: 0.32 + Math.random() * 0.28,
        kind: Math.random() < 0.4 ? "shard" : "spark",
        angle: Math.random() * Math.PI,
      });
    }
    // tiny upward ring to sell the "pop up to standing" feel
    if (!reduced) {
      spawnParticle(r, {
        x: cx, y: baseY - 4,
        vx: 0, vy: -20,
        color: INK, life: 0.28, size: 5, kind: "ring",
      });
    }
  }

  function igniteDash(r: GameRefs, p: Player, dx: number, dy: number, jumpAlso: boolean) {
    if (dx === 0 && dy === 0) dx = p.facing;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    const along = p.vx * nx + p.vy * ny;
    const newAlong = Math.max(along, 0) + DASH_IMPULSE + DASH_BONUS;
    p.vx += (newAlong - along) * nx;
    p.vy += (newAlong - along) * ny;
    if (jumpAlso && p.onGround) {
      p.vy = Math.min(p.vy, -JUMP_VEL);
      p.onGround = false;
      p.squash = 1;
      sfx.jump();
    }
    sfx.dash();
    p.dashTime = DASH_DURATION;
    p.dashCooldown = DASH_COOLDOWN;
    p.dashVx = nx; p.dashVy = ny;
    p.dashAirJumpUsed = false;
    p.facing = dx >= 0 ? 1 : -1;
    p.hStretch = 1;
    if (p.invuln < DASH_DURATION) p.invuln = DASH_DURATION;
    burst(r, p.x + p.w / 2, p.y + p.h / 2, "#22e2ff", 14, 320);

    const cxp = p.x + p.w / 2;
    const cyp = p.y + p.h / 2;
    for (let i = 0; i < 10; i++) {
      const back = 10 + i * 6;
      const jitter = (Math.random() - 0.5) * 14;
      spawnParticle(r, {
        x: cxp - nx * back + (-ny) * jitter,
        y: cyp - ny * back + (nx) * jitter,
        vx: -nx * (220 + Math.random() * 160),
        vy: -ny * (220 + Math.random() * 160),
        color: "#22e2ff",
        size: 3 + Math.random() * 2,
        life: 0.18 + Math.random() * 0.12,
        kind: "smear",
        angle: Math.atan2(ny, nx),
      });
    }
    const ghostFrame = Math.floor(r.time * 14);
    for (let i = 1; i <= 4; i++) {
      const back = i * 14;
      r.afterimages.push({
        x: p.x - nx * back,
        y: p.y - ny * back,
        w: p.w, h: p.h,
        facing: p.facing,
        sliding: false,
        diving: false,
        state: "dash",
        frame: ghostFrame,
        life: 0.22 - i * 0.02,
        maxLife: 0.22,
        color: "#22e2ff",
      });
    }
    sfx.parryStart();
    sfx.mach();
  }

  function fireBeam(r: GameRefs, p: Player) {
    const speed = 1600;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h * 0.4;
    const vx = p.facing * speed;
    r.beams.push({
      x: cx + p.facing * 18,
      y: cy,
      vx,
      vy: 0,
      life: 0,
      maxLife: 0.6,
      hit: false,
    });
    p.beamTime = 0.18;
    p.beamGrounded = p.onGround;
    p.beamCooldown = 0.22;
    burst(r, cx + p.facing * 22, cy, "#ffe34a", 6, 220);
    sfx.dash();
    r.shake = Math.max(r.shake, 0.18);
  }

  function update(r: GameRefs, dt: number, keys: Keys) {
    r.time += dt;
    const p = r.player;
    const onGround = p.onGround;

    // starman cheat: keep i-frames topped up. Stars are drawn around the
    // player in render() (blinking in place) instead of spawning particles.
    if (p.starman) {
      p.invuln = Math.max(p.invuln, 1);
      // free dash + parry: zero out their cooldowns every frame
      p.dashCooldown = 0;
      p.parryCooldown = 0;
    }

    // input (bound).
    const b = getLiveBinds();
    const left = isPressed(keys, "left", b);
    const right = isPressed(keys, "right", b);
    const jumpHeld = isPressed(keys, "jump", b);
    const slideHeld = isPressed(keys, "slide", b);

    // horizontal accel
    let dir = 0;
    if (left) dir -= 1;
    if (right) dir += 1;
    if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

    const speedMul = p.starman ? 1.5 : 1;
    if (dir !== 0) {
      p.vx += dir * MOVE_ACCEL * speedMul * dt;
    } else {
      // friction (more if not sliding)
      const fr = p.sliding ? SLIDE_FRICTION : FRICTION;
      const sign = Math.sign(p.vx);
      const mag = Math.max(0, Math.abs(p.vx) - fr * dt);
      p.vx = sign * mag;
    }

    // slide (ground) / dive (air) — both on the slide button
    if (slideHeld && onGround && !p.sliding && Math.abs(p.vx) > 120) {
      p.sliding = true;
      p.h = SLIDE_H;
      p.y += PLAYER_H - SLIDE_H;
      // boost in facing dir
      p.vx += p.facing * SLIDE_BOOST;
      // chunky dust kick-up burst on slide-start
      spawnSlideDustBurst(r, p);
      sfx.slide();
      sfx.slideStart();
    }
    // dive — pressed while airborne
    if (slideHeld && !onGround && !p.diving) {
      p.diving = true;
      p.vx += p.facing * 260;
      p.vy = Math.max(p.vy + 200, 520);
      p.stretch = 1;
      spawnParticle(r, { x: p.x + p.w / 2, y: p.y, vx: -p.facing * 120, vy: -60, color: INK, life: 0.35, size: 3, kind: "smear" });
      sfx.slide();
    }
    if (!slideHeld && p.sliding) {
      // try to stand
      const above = !collidesAt(r, p.x, p.y - (PLAYER_H - SLIDE_H), p.w, PLAYER_H);
      if (above) {
        p.y -= PLAYER_H - SLIDE_H;
        p.h = PLAYER_H;
        p.sliding = false;
        spawnSlideEndPuff(r, p);
        sfx.slideEnd();
      }
    }
    // Drive the looping slide sfx + grinding-dust trail based on state/speed.
    if (p.sliding && p.alive) {
      const intensity = Math.max(0, Math.min(1, (Math.abs(p.vx) - 120) / 700));
      sfx.slideIntensity(intensity);
      spawnSlideDustTrail(r, p, dt, intensity);
    } else {
      sfx.slideStop();
    }

    // jump (also cancels dive when grounded — handled by jump flow naturally)
    const jumpJustPressed = jumpHeld && !p.jumpWasHeld;
    const settings = getSettings();
    const jumpBlockedBySlide = settings.noJumpWhileSliding && p.sliding;
    if (jumpHeld && onGround && !jumpBlockedBySlide) {
      p.vy = -JUMP_VEL;
      p.onGround = false;
      p.squash = 1;
      p.diving = false;
      spawnParticle(r, { x: p.x + p.w / 2, y: p.y + p.h, color: INK, vy: -40, life: 0.3, size: 4, kind: "ring" });
      sfx.jump();
    } else if (jumpJustPressed && !onGround && p.dashTime > 0 && !p.dashAirJumpUsed) {
      // mid-air dash-jump: lets the player leap while a dash is active
      p.vy = -JUMP_VEL;
      p.dashAirJumpUsed = true;
      p.diving = false;
      p.squash = 1;
      spawnParticle(r, { x: p.x + p.w / 2, y: p.y + p.h, color: "#22e2ff", vy: -40, life: 0.3, size: 4, kind: "ring" });
      sfx.jump();
    }
    // refill once we touch the ground
    if (onGround) p.dashAirJumpUsed = false;
    p.jumpWasHeld = jumpHeld;
    // variable jump
    if (!jumpHeld && p.vy < -300) p.vy = -300;

    // speed cap (dash impulse can briefly exceed it; we let momentum carry).
    // Super-dash hold (just-run-bro) bypasses the cap entirely.
    if (!p.superDashing) {
      const speedCap = (MAX_SPEED + (p.sliding ? 120 : 0) + (p.dashTime > 0 ? 600 : 0)) * speedMul;
      if (Math.abs(p.vx) > speedCap) p.vx = Math.sign(p.vx) * speedCap;
    }

    // gravity — always on; dash no longer freezes vertical motion
    p.vy += GRAVITY * dt;
    if (p.vy > 1400) p.vy = 1400;

    // dash visual / i-frame window timer (velocity is no longer locked)
    if (p.dashTime > 0) p.dashTime -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.beamTime > 0) p.beamTime -= dt;
    if (p.beamCooldown > 0) p.beamCooldown -= dt;

    // SUPER DASH (just-run-bro): hold dash to ramp up speed in facing dir.
    if (p.superDashing && p.alive) {
      const prevSdt = p.superDashTime;
      p.superDashTime += dt;
      // When the SUPER DAZH animation kicks in (>=5s), play the WE sting once.
      if (prevSdt < 5 && p.superDashTime >= 5) {
        try {
          const a = new Audio(weSfxUrl);
          a.volume = 0.7;
          a.play().catch(() => {});
        } catch { /* noop */ }
      }
      // Nerfed: gentler accel and a hard top-speed ceiling so it caps out.
      const t = Math.min(p.superDashTime, 12);
      const accel = 500 + t * 160; // ~500 -> ~2420 px/s^2 over 12s
      p.vx += p.facing * accel * dt;
      // hard cap on super dash top speed
      const SUPER_DASH_CAP = 5300;
      if (Math.abs(p.vx) > SUPER_DASH_CAP) p.vx = Math.sign(p.vx) * SUPER_DASH_CAP;
      // gentle continuous horizontal stretch while ramping
      if (p.hStretch < 0.5) p.hStretch = 0.5;
      if (p.invuln < 0.05) p.invuln = 0.05;

      // SUPER DAZH animation FX (only after the ramp threshold)
      if (p.superDashTime >= 5) {
        // vertical cyan speed lines streaking upward past the player
        r.superDashLineTimer -= dt;
        if (r.superDashLineTimer <= 0) {
          r.superDashLineTimer = 0.012;
          const lines = 2;
          for (let i = 0; i < lines; i++) {
            const lx = p.x + p.w / 2 + (Math.random() - 0.5) * (p.w * 2.2);
            const ly = p.y + p.h + 6 + Math.random() * 18;
            const len = 22 + Math.random() * 30;
            const lineCol = p.somSom
              ? (Math.random() < 0.25 ? "#9be8f5" : DARK_CYAN)
              : (Math.random() < 0.25 ? "#ffffff" : "#22e2ff");
            spawnParticle(r, {
              x: lx, y: ly,
              vx: 0,
              vy: -(520 + Math.random() * 380),
              color: lineCol,
              size: len / 2,
              life: 0.22 + Math.random() * 0.12,
              kind: "smear",
            });
          }
        }
      } else {
        r.superDashLineTimer = 0;
      }
      r.superDashFxTimer = 0;
    } else {
      r.superDashFxTimer = 0;
      r.superDashLineTimer = 0;
    }

    // parry timers
    if (p.parrying > 0) p.parrying -= dt;
    if (p.parryCooldown > 0) p.parryCooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    // critical-hp heartbeat: faint, fast lub-dub when hp is 1
    if (p.alive && p.hp === 1 && getSettings().lowHpHeartbeat) {
      r.heartbeatTimer -= dt;
      if (r.heartbeatTimer <= 0) {
        sfx.heartbeat();
        r.heartbeatTimer = 0.55; // a bit fast, ~110 bpm
      }
    } else {
      r.heartbeatTimer = 0;
    }
    // hurt window: leave red afterimages behind for ~0.5s after a hit
    if (p.hurtTimer > 0) {
      p.hurtTimer -= dt;
      p.hurtAfterTimer -= dt;
      if (p.hurtAfterTimer <= 0) {
        p.hurtAfterTimer = 0.04;
        const life = 0.01;
        r.afterimages.push({
          x: p.x, y: p.y, w: p.w, h: p.h,
          facing: p.facing,
          sliding: false,
          diving: false,
          state: "hurt",
          frame: 0,
          life, maxLife: life,
          color: "#f5234c",
          tintColor: "#f5234c",
          alphaBoost: 1.1,
        });
        if (r.afterimages.length > 40) r.afterimages.splice(0, r.afterimages.length - 40);
      }
    }
    if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 4);
    // While airborne and falling, stretch the sprite vertically based on
    // downward speed. Drives the squash&stretch render below; gives a juicy
    // "diving raindrop" silhouette before landing. Other systems (jump,
    // ramp boosts) still spike `stretch` to 1 and we just take the max so
    // those moments aren't dampened by this passive driver.
    if (!p.onGround && p.vy > 60) {
      const fallStretch = Math.min(1, (p.vy - 60) / 700);
      if (fallStretch > p.stretch) p.stretch = fallStretch;
      else p.stretch = Math.max(0, p.stretch - dt * 4);
    } else if (p.stretch > 0) {
      p.stretch = Math.max(0, p.stretch - dt * 4);
    }
    if (p.hStretch > 0) p.hStretch = Math.max(0, p.hStretch - dt * 4);
    if (p.smearTimer > 0) p.smearTimer -= dt;
    if (r.superDashBurst) {
      r.superDashBurst.t += dt;
      if (r.superDashBurst.t >= 0.18) r.superDashBurst = null;
    }

    // move + collide axis-separated
    moveAxis(r, "x", p.vx * dt);
    moveAxis(r, "y", p.vy * dt);

    // out of world death
    if (p.y > r.level.height + 200) {
      p.alive = false;
    }

    // mach particles
    const speed = Math.abs(p.vx);
    const mach = machTier(speed);
    if (mach > r.bestMach) { r.bestMach = mach; if (mach >= 1) sfx.mach(); }

    // afterimages — spawn when fast, diving, or dashing
    r.afterTimer -= dt;
    if ((mach >= 1 || p.diving || p.dashTime > 0) && r.afterTimer <= 0) {
      const superDazh = p.superDashing && p.superDashTime >= 5;
      r.afterTimer = p.starman ? 0.04 : superDazh ? 0.025 : (p.dashTime > 0 ? 0.012 : Math.max(0.018, 0.05 - mach * 0.008));
      const life = p.starman ? 0.28 : (p.dashTime > 0 ? 0.22 : 0.18);
      const rainbowHue = p.starman
        ? (p.somSom ? 190 : Math.floor(r.time * 90) % 360)
        : superDazh ? 190 : undefined;
      const aiState: SpriteState =
        p.dashTime > 0 ? "dash" :
        p.diving ? "dive" :
        p.sliding ? "slide" :
        !p.onGround ? (p.vy > 0 ? "fall" : "jump") :
        (p.superDashing && p.superDashTime >= 5) ? "superDash" :
        Math.abs(p.vx) > 60 ? (mach >= 2 ? "runFast" : "run") :
        "idle";
      // capture the same mach-scaled animation frame the player render uses,
      // so the afterimage trail stays in lock-step with the live sprite.
      const aiFps = aiState === "superDash" ? 8 : 12 + mach * 3;
      const aiFrame = Math.floor(r.time * aiFps);
      r.afterimages.push({
        x: p.x, y: p.y, w: p.w, h: p.h,
        facing: p.facing,
        sliding: p.sliding,
        diving: p.diving,
        state: aiState,
        frame: aiFrame,
        life, maxLife: life,
        color: p.starman
          ? "rainbow"
          : superDazh ? "#22e2ff"
          : p.dashTime > 0 ? "#22e2ff" : p.diving ? "#ffd11a" : MACH_COLORS[Math.max(1, mach)],
        rainbowHue,
      });
      const maxAfterimages = p.starman ? 12 : 32;
      if (r.afterimages.length > maxAfterimages) r.afterimages.splice(0, r.afterimages.length - maxAfterimages);
    }
    for (const ai of r.afterimages) ai.life -= dt;
    r.afterimages = r.afterimages.filter((a) => a.life > 0);
    for (const ct of r.chaserTrail) ct.life -= dt;
    r.chaserTrail = r.chaserTrail.filter((c) => c.life > 0);

    // Thin speed lines while running on the ground (any speed above a small threshold).
    if (p.onGround && !p.sliding && Math.abs(p.vx) > 140 && Math.random() < 0.55) {
      const len = 14 + Math.random() * 18 + Math.min(40, Math.abs(p.vx) * 0.04);
      spawnParticle(r, {
        x: p.x + p.w / 2 - p.facing * (p.w * 0.4 + Math.random() * 30),
        y: p.y + 4 + Math.random() * (p.h - 8),
        vx: -p.facing * (Math.abs(p.vx) * 0.5 + 80),
        vy: 0,
        color: "#ffffff",
        size: len / 2,
        life: 0.18 + Math.random() * 0.12,
        kind: "smear",
      });
    }

    // ----- Skid dust + walking SFX -----
    const speedAbs = Math.abs(p.vx);
    const moveSign = Math.sign(p.vx);
    const inputOpposing = dir !== 0 && moveSign !== 0 && dir !== moveSign;
    const decelerating = (dir === 0 || inputOpposing) && speedAbs > 80;
    const isSkidding = p.onGround && !p.sliding && decelerating;
    r.isSkidding = p.onGround && !p.sliding && inputOpposing && speedAbs > 120;

    if (isSkidding) {
      // dust particle puffs from the trailing foot
      r.skidDustTimer -= dt;
      if (r.skidDustTimer <= 0) {
        r.skidDustTimer = 0.025;
        const intensity = Math.min(1, speedAbs / 500) * (inputOpposing ? 1.4 : 1);
        const puffs = 1 + Math.floor(intensity * 2);
        for (let i = 0; i < puffs; i++) {
          const px = p.x + p.w / 2 - moveSign * (p.w * 0.45 + Math.random() * 6);
          const py = p.y + p.h - 2 - Math.random() * 4;
          spawnParticle(r, {
            x: px, y: py,
            vx: -moveSign * (40 + Math.random() * 80) + (Math.random() - 0.5) * 30,
            vy: -30 - Math.random() * 60,
            color: "#bdbdbd",
            size: 3 + Math.random() * 3,
            life: 0.3 + Math.random() * 0.25,
            kind: "ring",
          });
        }
      }
      // skid sfx (throttled)
      r.skidSfxTimer -= dt;
      if (r.skidSfxTimer <= 0 && speedAbs > 180) {
        r.skidSfxTimer = 0.18;
        sfx.skid();
      }
    } else {
      r.skidDustTimer = 0;
      r.skidSfxTimer = 0;
    }

    // Footsteps — on ground, moving with input, not sliding/skidding.
    // Walks at low speed, runs (faster cadence + punchier sfx) at mach >= 1.
    const isMoving = p.onGround && !p.sliding && dir !== 0 && !inputOpposing && speedAbs > 60;
    if (isMoving) {
      const running = mach >= 1;
      const stepInterval = running
        ? Math.max(0.09, 0.22 - speedAbs * 0.00018)
        : Math.max(0.18, 0.5 - speedAbs * 0.0006);
      r.walkTimer -= dt;
      if (r.walkTimer <= 0) {
        r.walkTimer = stepInterval;
        if (running) sfx.run(); else sfx.step();
        spawnParticle(r, {
          x: p.x + p.w / 2 - moveSign * (p.w * 0.3),
          y: p.y + p.h - 1,
          vx: -moveSign * (10 + Math.random() * (running ? 60 : 30)),
          vy: -20 - Math.random() * (running ? 45 : 25),
          color: running ? "#bdbdbd" : "#cfcfcf",
          size: (running ? 3 : 2) + Math.random() * 2,
          life: 0.25 + Math.random() * 0.15,
          kind: "ring",
        });
      }
    } else if (!p.onGround) {
      r.walkTimer = 0;
    }

    // (mach color trail removed — speed lines + afterimage handle the feedback)

    // combo decay
    if (r.comboTimer > 0) {
      r.comboTimer -= dt;
      if (r.comboTimer <= 0) r.combo = 0;
    }
    if (r.shake > 0) r.shake = Math.max(0, r.shake - dt * 3);
    if (r.glitch > 0) r.glitch = Math.max(0, r.glitch - dt * 4);
    

    // enemies update
    for (const e of r.level.enemies) {
      if (!e.alive) continue;
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash -= dt;
      if (e.kind === "grunt") {
        e.x += e.vx * dt;
        // simple ledge / wall turn
        const ahead = collidesAt(r, e.x + (e.vx > 0 ? e.w : -2), e.y, 2, e.h);
        const groundAhead = collidesAt(r, e.x + (e.vx > 0 ? e.w + 2 : -4), e.y + e.h + 2, 2, 4);
        if (ahead || !groundAhead) e.vx = -e.vx;
      } else if (e.kind === "shooter") {
        e.shootTimer = (e.shootTimer ?? 1.2) - dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.4 + Math.random() * 0.6;
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const sp = 380;
          r.projectiles.push({
            x: e.x + e.w / 2, y: e.y + e.h / 2,
            vx: (dx / len) * sp, vy: (dy / len) * sp - 30,
            r: 7, alive: true, danger: true,
          });
          sfx.shoot();
        }
      } else if (e.kind === "chaser") {
        // Pursue forward at base speed; if the player gets too far ahead,
        // catch up faster. Stay glued to the floor.
        const stunned = (e.stunTimer ?? 0) > 0;
        if (stunned) {
          e.stunTimer = (e.stunTimer ?? 0) - dt;
          // ride out knockback velocity then settle
          e.x += e.vx * dt;
          e.vx *= 1 - Math.min(1, dt * 2.5);
        } else {
          const base = e.baseSpeed ?? 360;
          const gap = (p.x) - (e.x + e.w);
          // if player pulls ahead, accelerate up to +60% to catch up
          const catchup = Math.max(1, Math.min(1.6, gap / 600));
          e.vx = base * catchup;
          e.x += e.vx * dt;
        }
        e.y = (r.level.height - 80) - e.h; // pin to ground

        // red trail ghosts behind the chaser (0.3s lifetime)
        r.chaserTrailTimer -= dt;
        if (r.chaserTrailTimer <= 0) {
          r.chaserTrailTimer = 0.035;
          r.chaserTrail.push({
            x: e.x, y: e.y, w: e.w, h: e.h,
            life: 0.3, maxLife: 0.3,
          });
          if (r.chaserTrail.length > 24) r.chaserTrail.splice(0, r.chaserTrail.length - 24);
        }
      }

      // enemy vs player
      if (rectOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        // INVBOI (starman) — touching anything obliterates it, chaser
        // included. Big rainbow burst + combo bump for style.
        if (p.starman) {
          e.alive = false;
          r.combo += 1;
          r.comboTimer = 2.5;
          r.score += 250 * Math.max(1, r.combo);
          // rainbow-ish burst — pick a random hue per call so it varies.
          const hue = Math.floor(Math.random() * 360);
          burst(r, e.x + e.w / 2, e.y + e.h / 2, `hsl(${hue} 95% 60%)`, 22, 360);
          r.shake = Math.max(r.shake, 0.5);
          sfx.enemyKill();
          continue;
        }
        if (e.kind === "chaser") {
          // Chaser is unkillable — only parry pushes it back.
          if (p.parrying > 0) {
            // shove it backwards a long way + stun
            e.vx = -1400;
            e.stunTimer = 0.9;
            parrySuccess(r, e.x + e.w / 2, e.y + e.h / 2);
            e.hitFlash = 0.2;
          } else if (p.invuln <= 0) {
            damage(r, e.x + e.w / 2, e.y + e.h / 2);
          }
        } else if (p.vy > 80 && p.y + p.h - 20 < e.y) {
          // stomp
          e.alive = false;
          p.vy = -520;
          r.combo += 1;
          r.comboTimer = 2.5;
          r.score += 100 * Math.max(1, r.combo);
          burst(r, e.x + e.w / 2, e.y + e.h / 2, "#f5234c", 14);
          r.shake = 0.4;
          sfx.enemyKill();
        } else if (p.parrying > 0) {
          parrySuccess(r, e.x + e.w / 2, e.y + e.h / 2);
          e.alive = false;
        } else if (p.sliding && Math.abs(p.vx) > 350) {
          e.alive = false;
          burst(r, e.x + e.w / 2, e.y + e.h / 2, "#ff7a1a", 18);
          r.combo += 1;
          r.comboTimer = 2.5;
          r.score += 150 * Math.max(1, r.combo);
          r.shake = 0.5;
          sfx.enemyKill();
        } else if (p.invuln <= 0) {
          damage(r, e.x + e.w / 2, e.y + e.h / 2);
        }
      }
    }

    // boss
    if (r.boss) updateBoss(r, dt, size.w);

    // HELD LASER (invboi vs boss only)
    {
      const pl = r.player;
      // Auto-cancel if boss gone/defeated, player dead, or out of float budget mid-air.
      if (pl.laserActive && (!r.boss || r.boss.defeated || !pl.alive)) {
        pl.laserActive = false;
        sfx.laserStop();
      }
      if (pl.laserActive) {
        // Track facing changes from movement input.
        if (pl.vx > 30) pl.laserDir = 1;
        else if (pl.vx < -30) pl.laserDir = -1;
        else pl.laserDir = pl.facing;

        // Float: drain budget, near-zero gravity, allow hovering up via jump.
        if (pl.laserFloatBudget > 0) {
          pl.laserFloatBudget = Math.max(0, pl.laserFloatBudget - dt);
          // Cancel most of gravity that was added this frame and apply gentle hover.
          pl.vy -= GRAVITY * dt; // negate gravity
          pl.vy += 80 * dt;      // very soft drift
          // Vertical control: jump = up, slide = down
          const bnd = getLiveBinds();
          const jumpHeldNow = isPressed(keysRef.current, "jump", bnd);
          const downHeldNow = isPressed(keysRef.current, "slide", bnd);
          if (jumpHeldNow) pl.vy = Math.max(pl.vy - 1600 * dt, -380);
          if (downHeldNow) pl.vy = Math.min(pl.vy + 1600 * dt, 380);
          // Soft vertical clamp so floating feels stable
          if (pl.vy > 380) pl.vy = 380;
          if (pl.vy < -380) pl.vy = -380;
        } else {
          // Out of float — laser stays on but gravity returns; if you land, fine.
        }

        // Beam damage tick to boss (raycast horizontally from player center).
        if (r.boss && !r.boss.defeated) {
          pl.laserDamageTick -= dt;
          if (pl.laserDamageTick <= 0) {
            const boss = r.boss;
            const { drawW, drawH } = bossScreenAnchor(r, boss, size.w);
            const bx = r.cameraX + boss.screenX - drawW * 0.35;
            const by = boss.screenY - drawH * 0.4;
            const bw = drawW * 0.7;
            const bh = drawH * 0.8;
            const ly = pl.y + pl.h * 0.4;
            const lx0 = pl.x + pl.w / 2;
            const dir = pl.laserDir;
            // horizontal ray check: ly within boss vertical span and boss is in firing direction
            const hits = ly >= by && ly <= by + bh &&
              ((dir > 0 && bx + bw >= lx0) || (dir < 0 && bx <= lx0));
            if (hits) {
              boss.hp -= 1;
              boss.hitFlash = 1;
              boss.shakeT = 0.3;
              boss.worn = 0;
              boss.attacksRemaining = 3;
              boss.attackTimer = 1.4;
              r.shake = Math.max(r.shake, 0.45);
              r.freezeFrames = Math.max(r.freezeFrames, 3);
              r.score += 250;
              const hx = dir > 0 ? bx : bx + bw;
              burst(r, hx, ly, "#fff34a", 18, 320);
              sfx.bossHurt();
              if (boss.hp <= 0) {
                boss.defeated = true;
                boss.defeatT = 0;
                r.shake = Math.max(r.shake, 1.0);
                burst(r, bx + bw / 2, by + bh / 2, "#ffffff", 60, 520);
                sfx.bossDefeat();
                pl.laserActive = false;
                sfx.laserStop();
              }
            }
            pl.laserDamageTick = 0.18;
          }
        }
        // Keep pose hint alive
        pl.beamTime = Math.max(pl.beamTime, 0.1);
        pl.beamGrounded = pl.onGround;
      } else {
        // Regen float budget while not firing (slowly when airborne, fast when grounded).
        const regen = pl.onGround ? 6 : 1.5;
        pl.laserFloatBudget = Math.min(10, pl.laserFloatBudget + regen * dt);
      }
    }

    // projectiles
    for (const pr of r.projectiles) {
      if (!pr.alive) continue;
      if (!pr.danger) {
        // homing toward nearest enemy
        let best: Enemy | null = null;
        let bestD = Infinity;
        for (const e of r.level.enemies) {
          if (!e.alive) continue;
          const dx = (e.x + e.w / 2) - pr.x;
          const dy = (e.y + e.h / 2) - pr.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const dx = (best.x + best.w / 2) - pr.x;
          const dy = (best.y + best.h / 2) - pr.y;
          const len = Math.hypot(dx, dy) || 1;
          const homeSpeed = 620;
          // smoothly steer
          pr.vx += ((dx / len) * homeSpeed - pr.vx) * Math.min(1, dt * 8);
          pr.vy += ((dy / len) * homeSpeed - pr.vy) * Math.min(1, dt * 8);
        } else {
          // no gravity drift for homing shots
          pr.vy *= 1 - Math.min(1, dt * 2);
        }
      } else {
        pr.vy += GRAVITY * 0.25 * dt;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.x < r.cameraX - 400 || pr.x > r.cameraX + size.w + 400 || pr.y > r.level.height) pr.alive = false;
      // hit player
      if (pr.danger && rectOverlap(p.x, p.y, p.w, p.h, pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) {
        if (p.parrying > 0) {
          // reflect — will home next frame
          pr.vx *= -1; pr.vy = -260; pr.danger = false; pr.r = 9;
          parrySuccess(r, pr.x, pr.y);
        } else if (p.invuln <= 0) {
          pr.alive = false;
          damage(r, pr.x, pr.y);
        }
      }
      // reflected projectile kills enemies
      if (!pr.danger) {
        for (const e of r.level.enemies) {
          if (!e.alive) continue;
          if (rectOverlap(e.x, e.y, e.w, e.h, pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) {
            e.alive = false;
            pr.alive = false;
            burst(r, e.x + e.w / 2, e.y + e.h / 2, "#b14cff", 14);
            r.combo += 1;
            r.comboTimer = 2.5;
            r.score += 200 * Math.max(1, r.combo);
            r.shake = 0.4;
            sfx.enemyKill();
            break;
          }
        }
      }
    }
    r.projectiles = r.projectiles.filter((x) => x.alive);

    // hazards
    for (const h of r.level.hazards) {
      if (rectOverlap(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        // starman cheat: completely ignore hazards (no damage, no knockback)
        if (p.starman) continue;
        if (p.parrying > 0) {
          // PARRY ANYTHING — bounce off the hazard
          const cx = h.x + h.w / 2;
          const cy = h.y + h.h / 2;
          const dx = (p.x + p.w / 2) - cx;
          const dy = (p.y + p.h / 2) - cy;
          const len = Math.hypot(dx, dy) || 1;
          p.vx = (dx / len) * (PARRY_BOOST + 200) + p.facing * 120;
          p.vy = -480;
          parrySuccess(r, cx, cy);
        } else if (p.invuln <= 0) {
          // Knock player up and back AWAY from hazard so they don't fall
          // into the pit the spike is guarding.
          const cx = h.x + h.w / 2;
          const awayX = (p.x + p.w / 2) < cx ? -1 : 1;
          damage(r, p.x + p.w / 2, p.y + p.h);
          p.vx = awayX * 360;
          p.vy = -560;
          // lift the player above the spike so they don't immediately re-overlap
          p.y = h.y - p.h - 2;
        }
      }
    }

    // pickups
    for (const pk of r.level.pickups) {
      if (pk.collected) continue;
      if (rectOverlap(p.x, p.y, p.w, p.h, pk.x - 10, pk.y - 10, 20, 20)) {
        pk.collected = true;
        r.score += 25;
        burst(r, pk.x, pk.y, "#ffd11a", 8, 180);
        sfx.pickup();
      }
    }

    // particles
    for (const pa of r.particles) {
      pa.life -= dt;
      pa.vy += 600 * dt * (pa.kind === "smear" ? 0 : 1);
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.angle !== undefined) pa.angle += dt * 8;
    }
    r.particles = r.particles.filter((x) => x.life > 0);

    // goal
    const g = r.level.goal;
    if (rectOverlap(p.x, p.y, p.w, p.h, g.x, g.y, g.w, g.h)) {
      r.finished = true;
      r.finishTime = performance.now() - r.startedAt;
      r.score += Math.max(0, 5000 - Math.floor(r.finishTime / 10));
      r.shake = Math.max(r.shake, 0.7);
      // trigger white flash overlay
      const host = canvasRef.current?.parentElement;
      if (host) {
        const flash = document.createElement("div");
        flash.className = "absolute inset-0 pointer-events-none bg-white";
        flash.style.animation = "winFlash 0.3s ease-out forwards";
        host.appendChild(flash);
        setTimeout(() => flash.remove(), 350);
      }
      // For "just-run-bro" we hand off straight to the cutscene MP4 — skip
      // the win sfx/fanfare so the video starts immediately and clean.
      if (levelId !== "just-run-bro") {
        sfx.win();
        bgmLevelEnd();
      } else {
        stopBgm();
      }
      onFinish(r.finishTime, r.score);
    }

    // Camera follow. In "just-run-bro" we keep the player centered so
    // extreme super-dash velocity doesn't push them off-screen. Other
    // levels use the original offset-follow with lookahead.
    if (levelIdRef.current === "just-run-bro") {
      const speedNow = Math.abs(p.vx);
      const playerCenterX = p.x + p.w / 2;
      // Shift the player slightly left of center so they appear a bit
      // to the right within the camera view.
      const shift = 80;
      const centerCam = playerCenterX - size.w * 0.5 + shift;
      const lockCentered = p.superDashing;
      const targetCam = lockCentered ? centerCam : centerCam + p.facing * 40 + p.vx * 0.06;
      const lerp = lockCentered ? 1 : Math.min(1, dt * (6 + speedNow * 0.02));
      r.cameraX += (targetCam - r.cameraX) * lerp;
      if (r.cameraX < 0) r.cameraX = 0;
      if (r.cameraX > r.level.width - size.w) r.cameraX = r.level.width - size.w;
      // Keep player close to the (shifted) middle — tighter margin.
      const maxOffset = 60;
      const desiredScreenX = size.w * 0.5 - shift;
      const playerScreenX = playerCenterX - r.cameraX;
      if (playerScreenX < desiredScreenX - maxOffset) r.cameraX = playerCenterX - (desiredScreenX - maxOffset);
      if (playerScreenX > desiredScreenX + maxOffset) r.cameraX = playerCenterX - (desiredScreenX + maxOffset);
    } else {
      const targetCam = p.x - size.w * 0.35 + p.facing * 80 + p.vx * 0.12;
      r.cameraX += (targetCam - r.cameraX) * Math.min(1, dt * 6);
      if (r.cameraX < 0) r.cameraX = 0;
      if (r.cameraX > r.level.width - size.w) r.cameraX = r.level.width - size.w;
    }
  }

  function damage(r: GameRefs, x: number, y: number) {
    const p = r.player;
    p.hp -= 1;
    p.invuln = 1.0;
    p.hitFlash = 0.5;
    p.hurtTimer = 0.5;
    p.hurtAfterTimer = 0;
    // knockback: shove away from the hit point, with a small upward pop
    const dir = (p.x + p.w / 2) < x ? -1 : 1;
    const kbX = 360;
    p.vx = dir * kbX;
    p.vy = -420;
    // cancel slide/dash so the knockback actually reads
    p.sliding = false;
    p.diving = false;
    p.dashTime = 0;
    r.combo = 0;
    r.shake = 0.6;
    r.glitch = 0.5;
    burst(r, x, y, "#f5234c", 18, 240);
    sfx.hit();
    if (p.hp <= 0) {
      // third/final hit — layer the impactful 3s stinger on top of the normal hit
      sfx.fatalHit();
      p.alive = false;
    }
  }

  function parrySuccess(r: GameRefs, x: number, y: number) {
    // Anti-spam: while the 2.5s parry i-frames are still ticking, ignore
    // further successful-parry triggers entirely (no sound, no boost, no fx).
    // We piggyback on `invuln` since a successful parry sets it to 2.5s.
    if (r.player.invuln > 2.0) return;
    r.combo += 2;
    r.comboTimer = 3;
    r.score += 250 * Math.max(1, r.combo);
    r.shake = 0.7;
    r.glitch = 0.7;
    r.freezeFrames = 4;
    // 2.5s i-frames per successful parry. Also park the parry on cooldown
    // for the same duration so the active window can't re-fire mid-iframes.
    r.player.invuln = Math.max(r.player.invuln, 2.5);
    r.player.parrying = 0;
    r.player.parryCooldown = r.boss ? 0.25 : 2.5;
    sfx.parryHit();
    // boost in facing dir
    r.player.vx += r.player.facing * PARRY_BOOST;
    r.player.vy = -220;
    burst(r, x, y, "#fff34a", 22, 380);
    burst(r, x, y, "#22e2ff", 14, 320);
  }

  function moveAxis(r: GameRefs, axis: "x" | "y", delta: number) {
    const p = r.player;
    if (axis === "x") {
      p.x += delta;
      // collide
      for (const pl of r.level.platforms) {
        if (rectOverlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) {
          if (delta > 0) p.x = pl.x - p.w;
          else if (delta < 0) p.x = pl.x + pl.w;
          p.vx = 0;
        }
      }
      // world bounds
      if (p.x < 0) { p.x = 0; p.vx = 0; }
      if (p.x + p.w > r.level.width) { p.x = r.level.width - p.w; p.vx = 0; }
    } else {
      p.y += delta;
      let landed = false;
      for (const pl of r.level.platforms) {
        if (rectOverlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) {
          if (delta > 0) {
            p.y = pl.y - p.h;
            if (!p.onGround && p.vy > 200) { p.squash = 1; sfx.land(); }
            // dive impact — convert to slide, shake, sparks
            if (p.diving) {
              p.diving = false;
              r.shake = Math.max(r.shake, 0.55);
              burst(r, p.x + p.w / 2, pl.y, "#ffd11a", 12, 280);
              if (!p.sliding) {
                p.sliding = true;
                p.h = SLIDE_H;
                p.y = pl.y - p.h;
                p.vx += p.facing * SLIDE_BOOST;
                // dive→slide also needs the looping slide sfx + dust kick-up
                spawnSlideDustBurst(r, p);
                sfx.slide();
                sfx.slideStart();
              }
              sfx.land();
            }
            p.vy = 0;
            landed = true;
          } else if (delta < 0) {
            p.y = pl.y + pl.h;
            p.vy = 0;
          }
        }
      }
      p.onGround = landed;
    }
  }

  function collidesAt(r: GameRefs, x: number, y: number, w: number, h: number) {
    for (const pl of r.level.platforms) {
      if (rectOverlap(x, y, w, h, pl.x, pl.y, pl.w, pl.h)) return true;
    }
    return false;
  }

  function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ----- render -----
  function render(c: HTMLCanvasElement, r: GameRefs, w: number, h: number) {
    const ctx = c.getContext("2d")!;
    ctx.save();
    // starman cinematic kicks in at 3.20s into the cheat track
    const isSomSom = r.player.somSom;
    const starElapsed = r.player.starman
      ? (isSomSom ? (getSomSomElapsed() ?? 0) : (getStarmanElapsed() ?? 0))
      : 0;
    const starmanFx = r.player.starman && !isSomSom && starElapsed >= 3.20;

    // SOM SOM cinematic (just-run-bro invboi):
    //  0..5s   normal paper background
    //  5..6s   white-out screen
    //  6s+     cyan impact flash → OLED-black background + small camera shake
    const somSomActive = r.player.starman && isSomSom;
    const whiteOut = somSomActive && starElapsed >= 5 && starElapsed < 6
      ? Math.min(1, (starElapsed - 5) / 0.25)
      : 0;
    const postImpact = somSomActive && starElapsed >= 6;
    // 0.45s cyan impact flash right after t=6
    const impactFlash = postImpact ? Math.max(0, 1 - (starElapsed - 6) / 0.45) : 0;

    // smooth fade-in of the black backdrop
    const bgT = starmanFx ? Math.min(1, (starElapsed - 3.20) / 0.6) : 0;
    const isBossLevel = levelIdRef.current === "roaring-knight";
    // paper bg (or black during starman fx, or OLED black post-impact for som som,
    // or the boss-level cyan-flame backdrop)
    if (isBossLevel) {
      // Solid black under the bg image.
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      // Animated cyan-flame: cycle frames from the sprite sheet.
      const sheetReady = bossBgSheet.complete && bossBgSheet.naturalWidth;
      const fallback = bossBgImg.complete && bossBgImg.naturalWidth;
      if (sheetReady || fallback) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const srcW = sheetReady ? BOSS_BG_FW : bossBgImg.naturalWidth;
        const srcH = sheetReady ? BOSS_BG_FH : bossBgImg.naturalHeight;
        // cover-fit
        const ir = srcW / srcH;
        const sr = w / h;
        let dw = w, dh = h;
        if (ir > sr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.globalAlpha = 0.95;
        if (sheetReady) {
          const frame = Math.floor(r.time * BOSS_BG_FPS) % BOSS_BG_FRAMES;
          const col = frame % BOSS_BG_COLS;
          const row = Math.floor(frame / BOSS_BG_COLS);
          ctx.drawImage(
            bossBgSheet,
            col * BOSS_BG_FW, row * BOSS_BG_FH, BOSS_BG_FW, BOSS_BG_FH,
            dx, dy, dw, dh
          );
        } else {
          ctx.drawImage(bossBgImg, dx, dy, dw, dh);
        }
        ctx.restore();
      }
    } else {
      if (postImpact) {
        ctx.fillStyle = "#000";
      } else if (bgT >= 1) {
        ctx.fillStyle = "#000";
      } else if (bgT > 0) {
        ctx.fillStyle = "#f0ead6";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = `rgba(0,0,0,${bgT})`;
      } else {
        ctx.fillStyle = "#f0ead6";
      }
      ctx.fillRect(0, 0, w, h);
    }

    // SOM SOM: small persistent shake after the impact (light, ongoing)
    if (postImpact) {
      r.shake = Math.max(r.shake, 0.12);
    }
    // SOM SOM: punchy shake kick on the impact frame itself
    if (somSomActive && starElapsed >= 6 && starElapsed < 6.05 && r.shake < 0.5) {
      r.shake = 0.5;
    }

    // SOM SOM: lightning bolts over the OLED-black background.
    // Random chance every cycle: 10s, 5s, or 1s wait between strikes.
    if (postImpact) {
      r.lightningCooldown -= 0.0166;
      if (r.lightningCooldown <= 0) {
        const roll = Math.random();
        // Storm makes lightning much more frequent: ~0.3s / 1s / 2.5s
        // Calm post-impact (no storm yet): 1s / 5s / 10s
        const wait = r.somSomStorm
          ? (roll < 0.5 ? 0.3 : roll < 0.85 ? 1 : 2.5)
          : (roll < 0.34 ? 1 : roll < 0.67 ? 5 : 10);
        r.lightningCooldown = wait;
        const bx = 40 + Math.random() * (w - 80);
        const segs: { x: number; y: number }[] = [];
        let cy = -8;
        let cx = bx;
        while (cy < h * (0.55 + Math.random() * 0.4)) {
          segs.push({ x: cx, y: cy });
          cy += 18 + Math.random() * 28;
          cx += (Math.random() - 0.5) * 36;
        }
        segs.push({ x: cx, y: cy });
        r.lightningBolts.push({ x: bx, t: 0, life: 0.45, segs, flash: 1 });
        sfx.thunder();
      }
      for (let i = r.lightningBolts.length - 1; i >= 0; i--) {
        const b = r.lightningBolts[i];
        b.t += 0.0166;
        b.flash = Math.max(0, 1 - b.t / b.life);
        if (b.t >= b.life) r.lightningBolts.splice(i, 1);
      }
      if (r.lightningBolts.length) {
        ctx.save();
        for (const b of r.lightningBolts) {
          const a = b.flash;
          if (a > 0.6) {
            ctx.fillStyle = `rgba(15,181,207,${(a - 0.6) * 0.35})`;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.strokeStyle = `rgba(155,232,245,${0.55 * a})`;
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(b.segs[0].x, b.segs[0].y);
          for (let s = 1; s < b.segs.length; s++) ctx.lineTo(b.segs[s].x, b.segs[s].y);
          ctx.stroke();
          ctx.strokeStyle = `rgba(15,181,207,${0.95 * a})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(b.segs[0].x, b.segs[0].y);
          for (let s = 1; s < b.segs.length; s++) ctx.lineTo(b.segs[s].x, b.segs[s].y);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (r.lightningBolts.length || r.lightningCooldown !== 0) {
      r.lightningBolts.length = 0;
      r.lightningCooldown = 0;
    }

    // SOM SOM "32.50" event: white fade-out flash + fast grey cloud + optimized rain.
    const STORM_T = 32.50;
    if (somSomActive && starElapsed >= STORM_T && !r.somSomStorm) {
      r.somSomStorm = true;
      r.somSomStormFlash = 0;
      r.somSomCloudX = -260;
      const N = 220;
      const buf = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) {
        buf[i * 4 + 0] = Math.random() * w;
        buf[i * 4 + 1] = Math.random() * h - h;
        buf[i * 4 + 2] = 900 + Math.random() * 600;
        buf[i * 4 + 3] = 10 + Math.random() * 10;
      }
      r.somSomRain = buf;
      sfx.rainStart();
    } else if (!somSomActive && r.somSomStorm) {
      r.somSomStorm = false;
      r.somSomStormFlash = -1;
      r.somSomCloudX = null;
      r.somSomRain = null;
      sfx.rainStop();
    }

    if (r.somSomStorm) {
      const dtR = 0.0166;
      if (r.somSomStormFlash >= 0) {
        r.somSomStormFlash += dtR;
        const f = r.somSomStormFlash;
        let alpha = 0;
        if (f < 0.12) alpha = f / 0.12;
        else if (f < 0.9) alpha = 1 - (f - 0.12) / 0.78;
        if (alpha > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        } else {
          r.somSomStormFlash = -1;
        }
      }

      if (r.somSomCloudX !== null) {
        r.somSomCloudX += 1400 * dtR;
        const cx = r.somSomCloudX;
        const bandH = Math.max(110, h * 0.22); // chunky band across the top
        ctx.save();
        // base cloud band covering the entire top of the screen
        const grad = ctx.createLinearGradient(0, 0, 0, bandH);
        grad.addColorStop(0, "rgba(90,98,110,0.95)");
        grad.addColorStop(0.7, "rgba(120,128,138,0.85)");
        grad.addColorStop(1, "rgba(120,128,138,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, bandH);

        // big rolling puffs riding the band — tiled across the full width
        // with a fixed stride and modulo-wrapped offset for a seamless loop.
        ctx.fillStyle = "rgba(80,88,100,0.9)";
        const puffY = bandH * 0.78;
        const STRIDE = 280; // < puff visual width so clusters overlap (no gaps)
        const offset = ((cx % STRIDE) + STRIDE) % STRIDE;
        const tiles = Math.ceil(w / STRIDE) + 2;
        for (let i = -1; i < tiles; i++) {
          const px = i * STRIDE + offset;
          ctx.beginPath();
          ctx.ellipse(px,        puffY,        160, 52, 0, 0, Math.PI * 2);
          ctx.ellipse(px + 110,  puffY - 26,  110, 44, 0, 0, Math.PI * 2);
          ctx.ellipse(px - 90,   puffY - 14,   95, 38, 0, 0, Math.PI * 2);
          ctx.ellipse(px + 60,   puffY + 22,  130, 40, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // motion smear streaks across the whole band
        ctx.fillStyle = "rgba(60,68,80,0.35)";
        for (let i = 0; i < 6; i++) {
          const sy = (i / 6) * bandH + (offset * 0.05) % (bandH / 6);
          ctx.fillRect(0, sy, w, 2);
        }
        ctx.restore();
      }

      const rain = r.somSomRain;
      if (rain) {
        const len = rain.length / 4;
        ctx.save();
        ctx.strokeStyle = "rgba(170,200,220,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const o = i * 4;
          rain[o + 1] += rain[o + 2] * dtR;
          if (rain[o + 1] > h) {
            rain[o + 1] = -10;
            rain[o + 0] = Math.random() * w;
          }
          const x = rain[o];
          const y = rain[o + 1];
          const l = rain[o + 3];
          ctx.moveTo(x, y);
          ctx.lineTo(x - 2, y + l);
        }
        ctx.stroke();
        ctx.restore();
      }
  }


    // starman: rainbow stars rain down (BACKGROUND layer, behind level assets)
    // (suppressed for SOM SOM variant — no rain, no rainbow)
    const maxRainStars = Math.min(64, Math.max(28, Math.floor((w * h) / 17000)));
    if (starmanFx && r.rainStars.length < maxRainStars) {
      const spawnRate = 0.2 + bgT * 0.55;
      if (Math.random() < spawnRate) {
        r.rainStars.push({
          x: Math.random() * w,
          y: -10 - Math.random() * 40,
          vy: 32 + Math.random() * 34,
          size: 4 + Math.random() * 4,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random() * 360,
        });
      }
    }
    if (r.rainStars.length) {
      const dtFrame = 1 / 60;
      const t = r.time;
      const stars = r.rainStars;
      let write = 0;
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y += s.vy * dtFrame;
        if (!starmanFx || s.y >= h + 28) continue;
        s.x += Math.sin(s.phase + t * 1.1) * 0.35;
        const img = getRainStar(s.size, s.hue + t * 80);
        const half = img.width / 2;
        ctx.drawImage(img, s.x - half, s.y - half);
        stars[write++] = s;
      }
      stars.length = write;
    }

    // shake (scaled by user setting)
    const shakeMul = getSettings().reduceShake ? 0.25 : 1;
    const shakeX = (Math.random() - 0.5) * r.shake * 16 * shakeMul;
    const shakeY = (Math.random() - 0.5) * r.shake * 16 * shakeMul;
    ctx.translate(shakeX, shakeY);

    // glitch background flashes
    if (r.glitch > 0) {
      ctx.fillStyle = `rgba(34,226,255,${0.18 * r.glitch})`;
      ctx.fillRect(0, Math.random() * h, w, 8);
      ctx.fillStyle = `rgba(245,35,76,${0.18 * r.glitch})`;
      ctx.fillRect(0, Math.random() * h, w, 6);
    }

    const camX = Math.floor(r.cameraX);
    ctx.translate(-camX, 0);

    // distant scribbled clouds / scenery
    drawScenery(ctx, camX, w, r.level.height);

    // platforms
    const bossPlatforms = levelIdRef.current === "roaring-knight";
    for (const pl of r.level.platforms) {
      if (pl.x + pl.w < camX - 40 || pl.x > camX + w + 40) continue;
      const isGround = pl.kind === "ground";
      const visX = Math.max(pl.x, camX - 40);
      const visR = Math.min(pl.x + pl.w, camX + w + 40);
      const visW = visR - visX;
      const fill = bossPlatforms ? "#000000" : (isGround ? "#e5dfc2" : "#f7f1dc");
      const stroke = bossPlatforms ? "#ffffff" : INK;
      sketchRect(ctx, visX, pl.y, visW, pl.h, fill, stroke, isGround ? 3 : 2.6, isGround ? 1.6 : 1.2);
      // hatching — only over the visible slice
      ctx.save();
      ctx.strokeStyle = bossPlatforms ? "rgba(255,255,255,0.45)" : "rgba(20,20,20,0.35)";
      ctx.lineWidth = 1;
      const hStart = Math.max(pl.x + 6, visX);
      const hEnd = Math.min(pl.x + pl.w - 4, visR);
      for (let hx = hStart; hx < hEnd; hx += 14) {
        ctx.beginPath();
        ctx.moveTo(hx, pl.y + 4);
        ctx.lineTo(hx - 6, pl.y + pl.h - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // tutorial signs (if any)
    if (r.level.signs) {
      ctx.save();
      for (const s of r.level.signs) {
        if (s.x < camX - 200 || s.x > camX + w + 200) continue;
        // post
        sketchLine(ctx, s.x, s.y + 60, s.x, s.y + 110, 3, INK, 1.4);
        // board
        const bw = Math.max(140, ctx.measureText(s.text).width + 40);
        sketchRect(ctx, s.x - bw / 2, s.y, bw, 50, "#fff8d6", INK, 2.6, 1.2);
        ctx.fillStyle = INK;
        ctx.font = "bold 16px 'Permanent Marker', cursive";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.text, s.x, s.y + 25);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
    }

    // hazards (spikes - scribbled triangles)
    for (const hz of r.level.hazards) {
      if (hz.x + hz.w < camX - 40 || hz.x > camX + w + 40) continue;
      const teeth = Math.max(3, Math.floor(hz.w / 14));
      ctx.save();
      ctx.fillStyle = "#f5234c";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < teeth; i++) {
        const tx = hz.x + (i * hz.w) / teeth;
        const tw = hz.w / teeth;
        ctx.beginPath();
        ctx.moveTo(tx, hz.y + hz.h);
        ctx.lineTo(tx + tw / 2 + (Math.random() - 0.5) * 2, hz.y - 2);
        ctx.lineTo(tx + tw, hz.y + hz.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // pickups
    for (const pk of r.level.pickups) {
      if (pk.collected) continue;
      if (pk.x < camX - 30 || pk.x > camX + w + 30) continue;
      const bob = Math.sin(r.time * 6 + pk.x) * 3;
      sketchCircle(ctx, pk.x, pk.y + bob, 7, "#ffd11a", INK, 2, 0.8);
      // star sparkle
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pk.x - 3, pk.y + bob);
      ctx.lineTo(pk.x + 3, pk.y + bob);
      ctx.moveTo(pk.x, pk.y + bob - 3);
      ctx.lineTo(pk.x, pk.y + bob + 3);
      ctx.stroke();
      ctx.restore();
    }

    // chaser red trail (drawn behind enemies) — sized to match the spook sprite
    if (r.chaserTrail.length) {
      const tint = getSpookRedTint();
      const ratio = (spookImg.complete && spookImg.naturalWidth > 0)
        ? spookImg.naturalWidth / spookImg.naturalHeight
        : 1;
      for (const ct of r.chaserTrail) {
        if (ct.x + ct.w < camX - 40 || ct.x > camX + w + 40) continue;
        const t = ct.life / ct.maxLife; // 1 → 0
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.55 * t;
        if (tint) {
          // match drawEnemy's chaser sizing exactly so the ghost overlays the sprite
          const drawH = ct.h * 1.25;
          const drawW = drawH * ratio;
          const dx = ct.x + ct.w / 2 - drawW / 2;
          const dy = ct.y + ct.h - drawH;
          ctx.drawImage(tint, dx, dy, drawW, drawH);
        } else {
          ctx.fillStyle = "#f5234c";
          ctx.fillRect(ct.x, ct.y, ct.w, ct.h);
        }
        ctx.restore();
      }
    }

    // enemies
    for (const e of r.level.enemies) {
      if (!e.alive) continue;
      if (e.x + e.w < camX - 40 || e.x > camX + w + 40) continue;
      drawEnemy(ctx, e.x, e.y, e.w, e.h, e.kind, e.vx, r.time, e.hitFlash ?? 0);
    }

    // projectiles
    for (const pr of r.projectiles) {
      if (!pr.alive) continue;
      const col = pr.danger ? "#f5234c" : "#22e2ff";
      sketchCircle(ctx, pr.x, pr.y, pr.r, col, INK, 2, 0.8);
      // tail
      jaggedBolt(ctx, pr.x, pr.y, pr.x - pr.vx * 0.04, pr.y - pr.vy * 0.04, col, 2, 4, 4);
    }

    // HELD LASER (invboi vs boss): big static beam from player to screen edge
    if (r.player.laserActive && r.boss && !r.boss.defeated) {
      const pl = r.player;
      const dir = pl.laserDir;
      const x0 = pl.x + pl.w / 2 + dir * 8;
      const y0 = pl.y + pl.h * 0.4;
      // End point: across the screen in firing direction (in world coords).
      const x1 = dir > 0 ? r.cameraX + size.w + 200 : r.cameraX - 200;
      // subtle thickness pulse but mostly static
      const pulse = 1 + Math.sin(r.time * 30) * 0.04;
      ctx.save();
      ctx.lineCap = "butt";
      // huge outer halo
      ctx.strokeStyle = "rgba(255, 200, 60, 0.22)";
      ctx.lineWidth = 70 * pulse;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      // outer glow
      ctx.strokeStyle = "rgba(255, 220, 80, 0.55)";
      ctx.lineWidth = 42 * pulse;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      // mid yellow body
      ctx.strokeStyle = "rgba(255, 240, 120, 0.9)";
      ctx.lineWidth = 22 * pulse;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      // bright white core
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 8 * pulse;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      // muzzle burst at player
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.beginPath(); ctx.arc(x0, y0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255, 220, 80, 0.55)";
      ctx.beginPath(); ctx.arc(x0, y0, 28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // boss world-space FX (warnings + slashes)
    if (r.boss) drawBossWorldFx(ctx, r, r.boss);
    drawGoal(ctx, r.level.goal.x, r.level.goal.y, r.level.goal.w, r.level.goal.h, r.time);

    // afterimages — draw before player so player sits on top
    for (const ai of r.afterimages) {
      const t = ai.life / ai.maxLife; // 1 → 0
      drawAfterimage(ctx, ai, t);
    }

    // player
    drawPlayer(ctx, r);
    if (r.player.starman && !r.player.somSom) drawStarmanStars(ctx, r);


    // super dash burst VFX
    if (r.superDashBurst) {
      const b = r.superDashBurst;
      const dur = 0.18;
      const k = Math.min(1, b.t / dur);    // 0 → 1
      const inv = 1 - k;
      ctx.save();
      // bright flash core (fades fast)
      const CYAN = "#22e2ff";
      const CYAN_LIGHT = "#b9f6ff";
      const flashA = Math.max(0, 1 - k * 2.2);
      if (flashA > 0) {
        ctx.globalAlpha = flashA * 0.9;
        ctx.fillStyle = CYAN_LIGHT;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 18 + k * 30, 0, Math.PI * 2);
        ctx.fill();
      }
      // shockwave rings
      ctx.globalAlpha = inv;
      sketchCircle(ctx, b.x, b.y, 10 + k * 70, null, CYAN, 3, 1.2);
      ctx.globalAlpha = inv * 0.7;
      sketchCircle(ctx, b.x, b.y, 4 + k * 44, null, CYAN, 2, 1);
      // radial speed lines
      ctx.globalAlpha = inv;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2.5;
      const spokes = 14;
      for (let i = 0; i < spokes; i++) {
        const ang = (i / spokes) * Math.PI * 2 + b.t * 6;
        const r0 = 14 + k * 30;
        const r1 = r0 + 18 + inv * 22;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(ang) * r0, b.y + Math.sin(ang) * r0);
        ctx.lineTo(b.x + Math.cos(ang) * r1, b.y + Math.sin(ang) * r1);
        ctx.stroke();
      }
      // forward streak in facing dir
      ctx.globalAlpha = inv * 0.85;
      ctx.lineWidth = 4;
      const sx = b.x + b.facing * (10 + k * 20);
      const ex = b.x + b.facing * (50 + k * 90);
      jaggedBolt(ctx, sx, b.y, ex, b.y, CYAN, 3, 4, 6);
      jaggedBolt(ctx, sx, b.y - 6, ex - b.facing * 10, b.y - 6, CYAN, 2, 3, 5);
      jaggedBolt(ctx, sx, b.y + 6, ex - b.facing * 10, b.y + 6, CYAN, 2, 3, 5);
      ctx.restore();
    }

    // particles
    const rainbowParticles = r.player.starman && !r.player.somSom;
    const cyanParticles = r.player.starman && r.player.somSom;
    for (let pi = 0; pi < r.particles.length; pi++) {
      const pa = r.particles[pi];
      const a = Math.max(0, pa.life / pa.maxLife);
      const drawColor = rainbowParticles
        ? `hsl(${(r.time * 360 + pi * 37) % 360}, 100%, 60%)`
        : cyanParticles
        ? (pi % 4 === 0 ? "#9be8f5" : DARK_CYAN)
        : pa.color;
      ctx.save();
      ctx.globalAlpha = a;
      if (pa.kind === "ring") {
        sketchCircle(ctx, pa.x, pa.y, (1 - a) * 24 + 4, null, drawColor, 2, 1);
      } else if (pa.kind === "smear") {
        ctx.fillStyle = drawColor;
        ctx.fillRect(pa.x - pa.size, pa.y - 2, pa.size * 2, 4);
      } else if (pa.kind === "shard") {
        ctx.fillStyle = drawColor;
        ctx.translate(pa.x, pa.y);
        ctx.rotate(pa.angle ?? 0);
        ctx.fillRect(-pa.size, -1, pa.size * 2, 2);
      } else if (pa.kind === "star") {
        // 5-point star
        ctx.fillStyle = drawColor;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.translate(pa.x, pa.y);
        ctx.rotate(pa.angle ?? 0);
        const sp = 5;
        const outer = pa.size + 2;
        const inner = outer * 0.45;
        ctx.beginPath();
        for (let i = 0; i < sp * 2; i++) {
          const rr = i % 2 === 0 ? outer : inner;
          const ang = (i / (sp * 2)) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(ang) * rr;
          const y = Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(pa.x, pa.y, pa.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // parry flash overlay
    if (r.player.parrying > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4 * (r.player.parrying / PARRY_WINDOW);
      ctx.fillStyle = "#fff34a";
      ctx.beginPath();
      ctx.arc(r.player.x + r.player.w / 2, r.player.y + r.player.h / 2, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // boss screen-space layer (sprite + afterimages + hp pip) — draws on top of world.
    if (r.boss) drawBossScreen(ctx, r, r.boss, w);

    // (rainbow star rain is rendered earlier as a background layer)

    // SOM SOM cinematic overlays: white-out (5..6s) then cyan impact flash (6..6.45s)
    if (whiteOut > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${whiteOut})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (impactFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(15,181,207,${0.85 * impactFlash})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // INVBOI (non-SOM-SOM): white fade-in over 0.3s starting at 3.20s.
    if (r.player.starman && !isSomSom && starElapsed >= 3.20 && starElapsed < 3.50) {
      const f = (starElapsed - 3.20) / 0.3; // 0 → 1
      // ramp up to full white, then fade out (triangle envelope)
      const alpha = f < 0.5 ? f * 2 : (1 - f) * 2;
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // vignette / mach overlay
    const vmach = machTier(Math.abs(r.player.vx));
    if (vmach >= 2) {
      ctx.save();
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${0.15 + vmach * 0.06})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

  }

  // ----- BOSS: Roaring Knight -----
  // Anchor returns world-space draw size and updates `boss.screenX/Y` (screen-space).
  // Normally camera-locked (top-right). When staggered (`worn > 0`), the boss
  // un-sticks: we pin a world X at stagger time and convert it back to screen X
  // so the camera can scroll past him.
  function bossScreenAnchor(r: GameRefs, boss: Boss, screenW: number) {
    const margin = 40;
    const drawW = KNIGHT_DRAW_H * (knightImg.naturalWidth && knightImg.naturalHeight
      ? knightImg.naturalWidth / knightImg.naturalHeight : 1);
    const cameraBaseX = screenW - margin - drawW / 2;
    // Keep the knight inside the arena vicinity (between ceiling block ~y=84
    // and ground top ~y=640). Hover up high; when staggered, drop into the
    // middle of the arena but still above the lower platform so the player
    // can dash-strike him from below or beside.
    const baseY = 240;
    const hover = Math.sin(boss.hoverPhase) * 14;

    const wantLow = boss.worn > 0 && !boss.defeated;
    if (wantLow) {
      // Pin world X at the moment of stagger so he no longer follows the camera.
      if (!boss.wornAnchored) {
        boss.wornWorldX = r.cameraX + (boss.screenX || cameraBaseX);
        boss.wornAnchored = true;
      }
    } else {
      boss.wornAnchored = false;
    }

    const targetScreenX = wantLow ? boss.wornWorldX - r.cameraX : cameraBaseX;
    // Floating up-and-down (extra bob while staggered low). Vulnerable Y sits
    // around 470 — well above the ground (top y=640) so the dash hitbox lines
    // up with the player's reach.
    const wornTargetY = 470 + Math.sin(boss.hoverPhase * 1.4) * 16;
    const baseTargetY = baseY + hover;
    const targetY = wantLow ? wornTargetY : baseTargetY;

    if (boss.screenY === 0) boss.screenY = targetY;
    if (boss.screenX === 0) boss.screenX = targetScreenX;
    boss.screenY += (targetY - boss.screenY) * 0.12;
    boss.screenX = wantLow ? boss.screenX + (targetScreenX - boss.screenX) * 0.18 : targetScreenX;
    return { drawW, drawH: KNIGHT_DRAW_H };
  }

  function spawnBossWarning(_r: GameRefs, boss: Boss) {
    // Player-centered telegraph at a RANDOM angle. The line is detached from
    // the knight and follows the player at this fixed angle for its lifetime.
    const angle = Math.random() * Math.PI * 2;
    boss.warnings.push({
      t: 0, dur: 0.5, fired: false,
      angle,
      len: 1800,
    });
  }

  function updateBoss(r: GameRefs, dt: number, screenW: number) {
    const boss = r.boss!;
    boss.hoverPhase += dt * 2.2;
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt * 4);
    if (boss.shakeT > 0) boss.shakeT = Math.max(0, boss.shakeT - dt);
    bossScreenAnchor(r, boss, screenW);

    // Shake-in-fear when invboi (starman) is active — knight visibly trembles.
    if (r.player.starman && !boss.defeated) {
      boss.shakeT = Math.max(boss.shakeT, 0.18);
    }

    // afterimages — screen-space, drift right, ignore world camera.
    boss.afterTimer -= dt;
    if (boss.afterTimer <= 0 && !boss.defeated) {
      boss.afterTimer = 0.03;
      boss.afterimages.push({
        sx: boss.screenX, sy: boss.screenY,
        vx: 90, // px/sec drift to the right (screen-space)
        life: 0.2, maxLife: 0.2, flipped: false,
      });
      if (boss.afterimages.length > 12) boss.afterimages.splice(0, boss.afterimages.length - 12);
    }
    for (const ai of boss.afterimages) {
      ai.life -= dt;
      ai.sx += ai.vx * dt;
    }
    boss.afterimages = boss.afterimages.filter((a) => a.life > 0);

    if (boss.defeated) {
      boss.defeatT += dt;
      if (boss.defeatT > 1.6 && !r.finished) {
        r.finished = true;
        r.finishTime = performance.now() - r.startedAt;
        r.score += 5000;
        sfx.win();
        bgmLevelEnd();
        onFinish(r.finishTime, r.score);
      }
      return;
    }

    // Attack scheduling
    if (boss.worn > 0) {
      boss.worn -= dt;
      if (boss.worn <= 0) {
        boss.attacksRemaining = 3;
        boss.attackTimer = 1.0;
      }
    } else {
      boss.attackTimer -= dt;
      if (boss.attackTimer <= 0 && boss.attacksRemaining > 0) {
        spawnBossWarning(r, boss);
        boss.attacksRemaining -= 1;
        boss.attackTimer = 0.85;
        if (boss.attacksRemaining <= 0) {
          boss.worn = 2.6;
        }
      }
    }

    // Warnings + slashes are now PLAYER-CENTERED at a random angle picked at
    // spawn time. They translate with the player but the angle stays locked,
    // so the line "sticks" on the player from a fixed random direction.
    const p = r.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;
    for (const wn of boss.warnings) {
      wn.t += dt;
      // angle stays as picked at spawn (random) — no re-aiming, no spinning
      if (!wn.fired && wn.t >= wn.dur) {
        wn.fired = true;
        boss.slashes.push({ angle: wn.angle, len: wn.len, t: 0, dur: 0.2, hit: false });
        sfx.slashShing();
      }
    }
    boss.warnings = boss.warnings.filter((w) => !w.fired);

    // Slashes — centered on the player, stretch len/2 each direction.
    for (const sl of boss.slashes) {
      sl.t += dt;
      if (!sl.hit) {
        const half = sl.len / 2;
        const cx = Math.cos(sl.angle), cy = Math.sin(sl.angle);
        const x1 = pcx - cx * half, y1 = pcy - cy * half;
        const x2 = pcx + cx * half, y2 = pcy + cy * half;
        if (segRectOverlap(x1, y1, x2, y2, p.x, p.y, p.w, p.h)) {
          if (p.parrying > 0) {
            sl.hit = true;
            parrySuccess(r, pcx, pcy);
          } else if (p.alive) {
            // BOSS RULE: no i-frames in this fight — player must parry to block.
            // Exception: invboi (starman) keeps its i-frames so the cheat still
            // makes you invincible.
            if (p.starman && p.invuln > 0) {
              sl.hit = true;
            } else {
              sl.hit = true;
              damage(r, pcx, pcy);
            }
          }
        }
      }
    }
    boss.slashes = boss.slashes.filter((s) => s.t < s.dur);

    // Player dash hit on boss — only when worn-out (vulnerable)
    if (boss.worn > 0 && r.player.dashTime > 0 && r.player.alive) {
      const { drawW, drawH } = bossScreenAnchor(r, boss, screenW);
      const bx = r.cameraX + boss.screenX - drawW * 0.35;
      const by = boss.screenY - drawH * 0.4;
      const bw = drawW * 0.7;
      const bh = drawH * 0.8;
      if (rectOverlap(p.x, p.y, p.w, p.h, bx, by, bw, bh)) {
        boss.hp -= 1;
        boss.hitFlash = 1;
        boss.shakeT = 0.35;
        boss.worn = 0;
        boss.attacksRemaining = 3;
        boss.attackTimer = 1.6;
        r.shake = Math.max(r.shake, 0.5);
        r.freezeFrames = Math.max(r.freezeFrames, 4);
        r.score += 500;
        burst(r, bx + bw / 2, by + bh / 2, "#fff34a", 22, 360);
        sfx.bossHurt();
        p.vx = -p.facing * 380;
        p.vy = -260;
        p.invuln = Math.max(p.invuln, 0.4);
        if (boss.hp <= 0) {
          boss.defeated = true;
          boss.defeatT = 0;
          r.shake = Math.max(r.shake, 1.0);
          burst(r, bx + bw / 2, by + bh / 2, "#ffffff", 60, 520);
          sfx.bossDefeat();
        }
      }
    }
  }

  function segRectOverlap(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) {
    // Sample the segment; cheap and accurate enough for thin slashes.
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return true;
    }
    return false;
  }

  function drawBossWorldFx(ctx: CanvasRenderingContext2D, r: GameRefs, _boss: Boss) {
    const boss = _boss;
    // Lines are PLAYER-CENTERED — origin = player center, extend len/2 each side
    // along the locked random angle. Detached from the knight entirely.
    const p = r.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;

    // Red telegraph — starts THICK then thins out over its 0.5s life.
    for (const wn of boss.warnings) {
      const k = Math.min(1, wn.t / wn.dur);
      const thickness = Math.max(1.2, 6 * (1 - k * 0.85));
      const alpha = 0.55 + 0.4 * (1 - k);
      const half = wn.len / 2;
      const cx = Math.cos(wn.angle), cy = Math.sin(wn.angle);
      const x1 = pcx - cx * half, y1 = pcy - cy * half;
      const x2 = pcx + cx * half, y2 = pcy + cy * half;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ff1f3a";
      ctx.lineWidth = thickness;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
    // White slash — black outline + white core, thins over 0.2s with brief glow.
    for (const sl of boss.slashes) {
      const k = Math.min(1, sl.t / sl.dur);
      const thickness = Math.max(0.4, 5 * (1 - k));
      const alpha = 1 - k * 0.5;
      const half = sl.len / 2;
      const cx = Math.cos(sl.angle), cy = Math.sin(sl.angle);
      const x1 = pcx - cx * half, y1 = pcy - cy * half;
      const x2 = pcx + cx * half, y2 = pcy + cy * half;
      ctx.save();
      ctx.lineCap = "butt";
      // glow at the snap
      const glow = Math.max(0, 1 - k * 3);
      if (glow > 0) {
        ctx.globalAlpha = 0.45 * glow;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = thickness + 5 * glow;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 14 * glow;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // BLACK outline first (thicker), then white core on top
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = thickness + 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBossSpriteAt(ctx: CanvasRenderingContext2D, sx: number, sy: number, drawW: number, drawH: number, alpha: number, white: boolean, vulnerable = false) {
    const img = vulnerable && knightVulnImg.complete && knightVulnImg.naturalWidth ? knightVulnImg : knightImg;
    if (!img.complete || !img.naturalWidth) return;
    // Recompute drawW to keep aspect ratio of whichever sprite we're using.
    const ar = img.naturalWidth / img.naturalHeight;
    const dw = drawH * ar;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx - dw / 2, sy - drawH / 2, dw, drawH);
    if (white) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(sx - dw / 2, sy - drawH / 2, dw, drawH);
    }
    ctx.restore();
  }

  function drawBossScreen(ctx: CanvasRenderingContext2D, r: GameRefs, boss: Boss, screenW: number) {
    const { drawW, drawH } = bossScreenAnchor(r, boss, screenW);
    const vuln = boss.worn > 0 && !boss.defeated;
    // afterimages (screen-space, ignore world camera)
    for (const ai of boss.afterimages) {
      const t = ai.life / ai.maxLife; // 1 → 0
      drawBossSpriteAt(ctx, ai.sx, ai.sy, drawW, drawH, 0.35 * t, false, vuln);
    }
    // little wiggle on hit
    let wx = 0, wy = 0;
    if (boss.shakeT > 0) {
      const k = boss.shakeT;
      wx = (Math.random() - 0.5) * 10 * k;
      wy = (Math.random() - 0.5) * 10 * k;
    }
    const sx = boss.screenX + wx;
    const sy = boss.screenY + wy;
    if (boss.defeated) {
      // fade out + tilt as he falls
      const k = Math.min(1, boss.defeatT / 1.6);
      ctx.save();
      ctx.translate(sx, sy + k * 80);
      ctx.rotate(k * 0.6);
      ctx.globalAlpha = 1 - k;
      drawBossSpriteAt(ctx, 0, 0, drawW, drawH, 1, false, false);
      ctx.restore();
    } else {
      drawBossSpriteAt(ctx, sx, sy, drawW, drawH, 1, boss.hitFlash > 0.05, vuln);
    }
    // HP pips
    const pipY = sy + drawH / 2 + 14;
    const pipW = 18, pipGap = 6;
    const totalW = boss.maxHp * pipW + (boss.maxHp - 1) * pipGap;
    let px = sx - totalW / 2;
    for (let i = 0; i < boss.maxHp; i++) {
      ctx.save();
      ctx.fillStyle = i < boss.hp ? "#f5234c" : "rgba(0,0,0,0.2)";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.fillRect(px, pipY, pipW, 8);
      ctx.strokeRect(px, pipY, pipW, 8);
      ctx.restore();
      px += pipW + pipGap;
    }
    // "VULNERABLE!" hint when worn-out
    if (boss.worn > 0) {
      ctx.save();
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = "#fff34a";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      const txt = "DASH!";
      ctx.strokeText(txt, sx, pipY + 28);
      ctx.fillText(txt, sx, pipY + 28);
      ctx.restore();
    }
  }

  function drawScenery(ctx: CanvasRenderingContext2D, camX: number, w: number, levelH: number) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 14; i++) {
      const baseX = ((i * 480) - (camX * 0.3) % 480 + camX * 0.3);
      const x = baseX;
      const y = 80 + (i % 3) * 50;
      sketchCircle(ctx, x + camX * 0, y, 28 + (i % 4) * 6, null, "rgba(20,20,20,0.4)", 1.4, 1.2);
      sketchCircle(ctx, x + 30, y + 6, 22, null, "rgba(20,20,20,0.4)", 1.4, 1.2);
    }
    // distant mountains
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const baseY = levelH - 90;
    ctx.moveTo(camX - 40, baseY);
    let x = camX - 40;
    while (x < camX + w + 40) {
      const peak = baseY - 100 - Math.sin(x * 0.01) * 60;
      ctx.lineTo(x + 80, peak);
      ctx.lineTo(x + 160, baseY - 30);
      x += 160;
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawAfterimage(ctx: CanvasRenderingContext2D, ai: Afterimage, t: number) {
    // t: 1 (fresh) → 0 (faded)
    const sprite = getSprite(ai.state, ai.frame);
    ctx.save();
    ctx.globalAlpha = 0.55 * t;

    if (sprite) {
      // Match drawPlayer's sizing exactly so the trail fits the PNG.
      const ratio = sprite.width / sprite.height;
      const wide = ratio > 1.1;
      let drawW: number, drawH: number;
      if (ai.state === "slide") {
        drawW = ai.w * 2.2;
        drawH = drawW / ratio;
      } else if (wide) {
        drawH = ai.w * 1.6 / ratio;
        drawW = ai.w * 1.6;
      } else {
        drawH = ai.h;
        drawW = drawH * ratio;
      }
      const dx = ai.x + ai.w / 2 - drawW / 2;
      const dy = ai.y + ai.h - drawH;

      // Flip horizontally for facing without changing the sprite's angle.
      if (ai.facing === -1) {
        ctx.translate(dx + drawW / 2, dy + drawH / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(dx + drawW / 2), -(dy + drawH / 2));
      }

      ctx.imageSmoothingEnabled = false;
      // Cached rainbow tint for starman afterimages; avoids repainting an
      // offscreen sprite for every ghost every frame.
      if (ai.tintColor) {
        // Solid-color tint (e.g., red hurt trail). Draw sprite alpha mask
        // then fill with the tint inside the alpha.
        const off = document.createElement("canvas");
        off.width = sprite.width;
        off.height = sprite.height;
        const octx = off.getContext("2d")!;
        octx.imageSmoothingEnabled = false;
        octx.drawImage(sprite, 0, 0);
        octx.globalCompositeOperation = "source-in";
        octx.fillStyle = ai.tintColor;
        octx.fillRect(0, 0, off.width, off.height);
        ctx.globalAlpha = 0.75 * t * (ai.alphaBoost ?? 1);
        ctx.drawImage(off, dx, dy, drawW, drawH);
      } else if (ai.rainbowHue !== undefined) {
        const isSomSomAi = ai.color === "rainbow" && ai.rainbowHue === 190;
        const off = isSomSomAi ? getDarkCyanTintedSprite(sprite) : getTintedSprite(sprite, ai.rainbowHue);
        // invboi (starman) trail: bumped from 0.62 → 0.85 so the rainbow
        // ghosts read clearly against bright backgrounds.
        ctx.globalAlpha = 0.85 * t;
        ctx.drawImage(off, dx, dy, drawW, drawH);
      } else {
        // Default speedboi mach trail: bumped from 0.5 → 0.8 so each ghost
        // is clearly visible instead of nearly transparent.
        ctx.globalAlpha = 0.8 * t;
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
      }
      ctx.restore();
      return;
    }

    // Fallback (no sprite loaded): old stick-figure silhouette.
    ctx.fillStyle = ai.color;
    ctx.strokeStyle = ai.color;
    ctx.lineWidth = 2;
    const cx = ai.x + ai.w / 2;
    const cy = ai.y + ai.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(ai.facing, 1);
    ctx.translate(-ai.w / 2, -ai.h / 2);
    if (ai.sliding) {
      ctx.beginPath();
      ctx.ellipse(ai.w / 2, ai.h / 2, ai.w * 0.7, ai.h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const headR = 12;
      const headX = ai.w / 2;
      const headY = headR + 2;
      ctx.beginPath();
      ctx.arc(headX, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(headX - 6, headY + headR - 4, 12, ai.h - headY - headR - 6, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  // Star sparkles for the "invboi" cheat — six stars orbiting the player,
  // each blinking on/off (and twinkling in size) on its own offset cycle.
  function drawStarmanStars(ctx: CanvasRenderingContext2D, r: GameRefs) {
    const p = r.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const radius = Math.max(p.w, p.h) * 0.85;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const phase = i / count;
      // slow orbit so the stars feel attached but float a little
      const ang = r.time * 0.9 + phase * Math.PI * 2;
      const sx = cx + Math.cos(ang) * radius;
      const sy = cy + Math.sin(ang) * radius * 0.7;
      // each star blinks on/off ~3 times per second on its own offset
      const blink = (Math.sin(r.time * 9 + phase * 7) + 1) * 0.5; // 0..1
      if (blink < 0.25) continue; // off
      const a = (blink - 0.25) / 0.75; // 0..1
      const size = 4 + a * 3;
      ctx.save();
      ctx.globalAlpha = 0.55 + a * 0.45;
      ctx.translate(sx, sy);
      ctx.rotate(r.time * 2 + phase * 5);
      const hue = (r.time * 360 + phase * 360) % 360;
      ctx.fillStyle = `hsl(${hue}, 95%, 60%)`;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      const sp = 5;
      const outer = size + 2;
      const inner = outer * 0.45;
      ctx.beginPath();
      for (let k = 0; k < sp * 2; k++) {
        const rr = k % 2 === 0 ? outer : inner;
        const an = (k / (sp * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(an) * rr;
        const y = Math.sin(an) * rr;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, r: GameRefs) {
    const p = r.player;
    const speed = Math.abs(p.vx);
    const mach = machTier(speed);

    ctx.save();
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.translate(cx, cy);
    // squash (landing) → wide + short. stretch (falling) → tall + thin.
    // hStretch (dash / super dash) → wide + slightly short, motion-streak feel.
    const sx = 1 + p.squash * 0.3 - p.stretch * 0.18 + p.hStretch * 0.35;
    const sy = 1 - p.squash * 0.2 + p.stretch * 0.28 - p.hStretch * 0.12;
    // (running tilt removed — sprite stays upright)
    ctx.scale(sx * p.facing, sy);
    ctx.translate(-p.w / 2, -p.h / 2);

    // hit flash
    const flash = p.hitFlash > 0 && Math.floor(r.time * 30) % 2 === 0;
    // suppress invuln blink while starman is active so the rainbow stays solid
    const blink = !p.starman && p.invuln > 0 && Math.floor(r.time * 20) % 2 === 0;
    if (blink && p.hitFlash <= 0) {
      ctx.globalAlpha = 0.4;
    }

    const inkCol = flash ? "#f5234c" : INK;
    // tint hue: rainbow during starman, fixed cyan during SUPER DAZH
    const superDazhActive = p.superDashing && p.superDashTime >= 5;
    const rainbowHue = p.starman
      ? (p.somSom ? 190 : Math.floor(r.time * 90) % 360)
      : superDazhActive ? 190 : null;

    // ---- sprite override (use uploaded PNG if available for current state) ----
    const speedNow = Math.abs(p.vx);
    const machNow = machTier(speedNow);
    const state: SpriteState =
      p.hurtTimer > 0 ? "hurt" :
      p.beamTime > 0 ? (p.beamGrounded && p.onGround ? "beam" : "beamJump") :
      p.dashTime > 0 ? "dash" :
      p.diving ? "dive" :
      p.sliding ? "slide" :
      !p.onGround ? (p.vy > 0 ? "fall" : "jump") :
      r.isSkidding ? "skid" :
      (p.superDashing && p.superDashTime >= 5) ? "superDash" :
      speedNow > 60 ? (machNow >= 2 ? "runFast" : "run") :
      "idle";
    // Animation frame: cycles faster the faster you go (mach 2..4).
    // ~14 fps at mach 2, ~22 fps at mach 4.
    const fps = state === "superDash" ? 8 : 12 + machNow * 3;
    const frame = Math.floor(r.time * fps);
    const sprite = getSprite(state, frame);
    if (sprite) {
      // Fit the sprite to the player AABB. For wide sprites (slide/dive) we
      // size by width so the pose stays readable; for tall sprites we size
      // by height. Either way the sprite is anchored to the bottom of the box.
      const ratio = sprite.width / sprite.height;
      const wide = ratio > 1.1;
      // Slide pose lives inside a square PNG, so force a wider render.
      const slideScale = 2.2;
      let drawW: number, drawH: number;
      if (state === "slide") {
        drawW = p.w * slideScale;
        drawH = drawW / ratio;
      } else if (wide) {
        drawH = p.w * 1.6 / ratio;
        drawW = p.w * 1.6;
      } else {
        drawH = p.h;
        drawW = drawH * ratio;
      }
      const dx = p.w / 2 - drawW / 2;
      const dy = p.h - drawH;
      if (flash) {
        // Tint the player red on hit. Build the red silhouette in an
        // offscreen canvas (clipped to the PNG alpha) and overlay it on the
        // sprite, so the tint never paints a square red box behind/around
        // the player.
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
        const off = document.createElement("canvas");
        off.width = sprite.width;
        off.height = sprite.height;
        const octx = off.getContext("2d")!;
        octx.imageSmoothingEnabled = false;
        octx.drawImage(sprite, 0, 0);
        octx.globalCompositeOperation = "source-in";
        octx.fillStyle = "#f5234c";
        octx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(off, dx, dy, drawW, drawH);
        ctx.restore();
      } else if (rainbowHue !== null) {
        // starman: cached rainbow-tinted sprite clipped to the PNG alpha.
        const isSomSomTint = p.somSom && rainbowHue === 190;
        const off = isSomSomTint ? getDarkCyanTintedSprite(sprite) : getTintedSprite(sprite, rainbowHue);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
        ctx.globalAlpha = isSomSomTint ? 0.85 : 0.65;
        ctx.drawImage(off, dx, dy, drawW, drawH);
        ctx.restore();
      } else {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
      }
      ctx.restore();
      return;
    }
    // ---- end sprite override ----

    if (p.sliding) {
      // slide pose
      // body oval
      sketchCircle(ctx, p.w / 2, p.h / 2, 14, "#fff8d6", inkCol, 2.4, 1);
      // head forward
      sketchCircle(ctx, p.w + 6, p.h / 2 - 6, 12, "#fff8d6", inkCol, 2.4, 1);
      drawFace(ctx, p.w + 6, p.h / 2 - 6, 12, inkCol, "wild");
      // trailing arm
      sketchLine(ctx, p.w / 2, p.h / 2, -8, p.h / 2 + 4, 2.6, inkCol, 1.4);
      // legs back
      sketchLine(ctx, p.w / 2 + 4, p.h / 2 + 4, -2, p.h - 2, 2.6, inkCol, 1.4);
      sketchLine(ctx, p.w / 2 + 4, p.h / 2 + 6, -6, p.h - 4, 2.6, inkCol, 1.4);
    } else {
      // head
      const headR = 14;
      const headX = p.w / 2;
      const headY = headR + 2;
      sketchCircle(ctx, headX, headY, headR, "#fff8d6", inkCol, 2.6, 1.2);
      drawFace(ctx, headX, headY, headR, inkCol, mach >= 3 ? "feral" : mach >= 1 ? "intense" : "calm");

      // body
      const bodyTop = headY + headR - 2;
      const bodyBot = p.h - 18;
      sketchLine(ctx, headX, bodyTop, headX + Math.sin(r.time * 14) * 1.5, bodyBot, 3, inkCol, 1.2);

      // arms — flailing when running
      const armPhase = r.time * (8 + mach * 4);
      const armAmp = p.onGround ? 12 + mach * 4 : 8;
      sketchLine(ctx, headX, bodyTop + 4,
        headX - 14, bodyTop + 14 + Math.sin(armPhase) * armAmp, 2.6, inkCol, 1.4);
      sketchLine(ctx, headX, bodyTop + 4,
        headX + 14, bodyTop + 14 + Math.sin(armPhase + Math.PI) * armAmp, 2.6, inkCol, 1.4);

      // legs
      const legPhase = r.time * (10 + mach * 5);
      if (p.onGround) {
        const lx1 = headX - 8 + Math.sin(legPhase) * 8;
        const lx2 = headX + 8 + Math.sin(legPhase + Math.PI) * 8;
        sketchLine(ctx, headX - 4, bodyBot, lx1, p.h, 2.8, inkCol, 1.4);
        sketchLine(ctx, headX + 4, bodyBot, lx2, p.h, 2.8, inkCol, 1.4);
      } else {
        // tucked / extended
        sketchLine(ctx, headX - 4, bodyBot, headX - 8, p.h - 2, 2.8, inkCol, 1.4);
        sketchLine(ctx, headX + 4, bodyBot, headX + 10, p.h - 6, 2.8, inkCol, 1.4);
      }

      // smear frame at high mach
      if (mach >= 3) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = MACH_COLORS[mach];
        ctx.fillRect(-p.w * 0.6, headY - 2, p.w * 0.6, p.h - headY + 6);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, mood: "calm" | "intense" | "feral" | "wild") {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2;
    // eyes
    if (mood === "calm") {
      ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
      // mouth small
      sketchLine(ctx, cx - 3, cy + 5, cx + 3, cy + 5, 1.6, col, 0.6);
    } else if (mood === "intense") {
      sketchLine(ctx, cx - 7, cy - 4, cx - 1, cy - 1, 2.2, col, 0.6);
      sketchLine(ctx, cx + 1, cy - 1, cx + 7, cy - 4, 2.2, col, 0.6);
      ctx.beginPath(); ctx.arc(cx - 4, cy - 1, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 1, 1.6, 0, Math.PI * 2); ctx.fill();
      sketchLine(ctx, cx - 4, cy + 6, cx + 4, cy + 6, 2, col, 0.6);
    } else {
      // feral / wild
      sketchLine(ctx, cx - 8, cy - 5, cx - 1, cy - 2, 2.4, col, 0.8);
      sketchLine(ctx, cx + 1, cy - 2, cx + 8, cy - 5, 2.4, col, 0.8);
      ctx.beginPath(); ctx.arc(cx - 4, cy, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy, 2.4, 0, Math.PI * 2); ctx.fill();
      // big teeth grin
      ctx.save();
      ctx.fillStyle = "#fff8d6";
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx + 8, cy + 4);
      ctx.lineTo(cx + 6, cy + 10);
      ctx.lineTo(cx - 6, cy + 10);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // jagged teeth
      for (let i = -6; i <= 6; i += 3) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy + 4);
        ctx.lineTo(cx + i + 1.5, cy + 8);
        ctx.lineTo(cx + i + 3, cy + 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: "grunt" | "shooter" | "chaser", vx: number, time: number, hitFlash = 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    const wobbleA = Math.sin(time * 8) * 0.08;
    ctx.rotate(wobbleA);
    ctx.translate(-w / 2, -h / 2);

    if (kind === "grunt") {
      // angry blob with legs
      sketchCircle(ctx, w / 2, h / 2, 16, "#f5234c", INK, 2.6, 1.4);
      // eyes
      ctx.fillStyle = "#fff8d6";
      ctx.beginPath(); ctx.arc(w / 2 - 5, h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 + 5, h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(w / 2 - 5 + Math.sign(vx), h / 2 - 4, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 + 5 + Math.sign(vx), h / 2 - 4, 1.8, 0, Math.PI * 2); ctx.fill();
      // angry brows
      sketchLine(ctx, w / 2 - 9, h / 2 - 9, w / 2 - 2, h / 2 - 6, 2, INK, 0.6);
      sketchLine(ctx, w / 2 + 2, h / 2 - 6, w / 2 + 9, h / 2 - 9, 2, INK, 0.6);
      // jagged mouth
      ctx.beginPath();
      ctx.moveTo(w / 2 - 6, h / 2 + 4);
      ctx.lineTo(w / 2 - 3, h / 2 + 7);
      ctx.lineTo(w / 2, h / 2 + 4);
      ctx.lineTo(w / 2 + 3, h / 2 + 7);
      ctx.lineTo(w / 2 + 6, h / 2 + 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      // legs
      const lp = Math.sin(time * 14) * 4;
      sketchLine(ctx, w / 2 - 6, h - 4, w / 2 - 8, h + 2 + lp, 2.4, INK, 1);
      sketchLine(ctx, w / 2 + 6, h - 4, w / 2 + 8, h + 2 - lp, 2.4, INK, 1);
    } else if (kind === "shooter") {
      // shooter: tall, one big eye, glowing
      sketchRect(ctx, 4, 4, w - 8, h - 8, "#b14cff", INK, 2.6, 1.4);
      sketchCircle(ctx, w / 2, h / 2 - 4, 8, "#fff8d6", INK, 2, 1);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(w / 2 + Math.sin(time * 6) * 2, h / 2 - 4, 3.2, 0, Math.PI * 2); ctx.fill();
      // antenna
      sketchLine(ctx, w / 2, 4, w / 2 + Math.sin(time * 4) * 4, -10, 2, INK, 0.8);
      sketchCircle(ctx, w / 2 + Math.sin(time * 4) * 4, -12, 3, "#22e2ff", INK, 1.8, 0.8);
    } else {
      // CHASER: "Man of spook" sprite, swap to OW variant on hit.
      const useHurt = hitFlash > 0;
      const img = useHurt ? spookHurtImg : spookImg;
      const ready = img.complete && img.naturalWidth > 0;
      // little nervous shake — jitters more when hurt
      const shakeAmp = useHurt ? 3 : 1.5;
      const sx = (Math.sin(time * 47.3) + Math.sin(time * 31.7)) * 0.5 * shakeAmp;
      const sy = (Math.cos(time * 53.1) + Math.sin(time * 39.9)) * 0.5 * shakeAmp;
      if (ready) {
        // size sprite to fill the chaser AABB while preserving aspect.
        const ratio = img.naturalWidth / img.naturalHeight;
        // Make him a bit larger than the hitbox so he reads as a looming threat.
        const drawH = h * 1.25;
        const drawW = drawH * ratio;
        const dx = w / 2 - drawW / 2 + sx;
        const dy = h - drawH + sy;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      } else {
        // sprite not loaded yet — draw a quick red silhouette so he's visible.
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(sx, sy, w, h);
      }
    }
    ctx.restore();
  }

  function drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number) {
    // big swirling FINISH flag
    ctx.save();
    sketchLine(ctx, x + w / 2, y - 20, x + w / 2, y + h, 3, INK, 1.6);
    // flag wobble
    const off = Math.sin(time * 4) * 6;
    ctx.fillStyle = "#fff34a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 18);
    ctx.lineTo(x + w / 2 + 60, y - 8 + off);
    ctx.lineTo(x + w / 2, y + 12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = "bold 14px 'Permanent Marker', cursive";
    ctx.fillText("GO!", x + w / 2 + 14, y);
    ctx.restore();
  }
}
