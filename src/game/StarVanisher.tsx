import { useEffect, useRef, useState } from "react";
import { sfx, unlockAudio } from "@/game/sfx";
import { activeBeamSkin, addTokens, getShop, hasAbility, subscribeShop, tokensForScore } from "@/game/shop";
import beamAsset from "@/assets/audio/beam.mp3.asset.json";
import exploseAsset from "@/assets/audio/explose1.mp3.asset.json";
import explose2Asset from "@/assets/audio/explose2.mp3.asset.json";
import countupAsset from "@/assets/audio/countup.mp3.asset.json";
import runBgmAsset from "@/assets/audio/StarVanisher_duh.ogg.asset.json";
import svTitleBg from "@/assets/sv_title_bg.jpg.asset.json";
import dangerAsset from "@/assets/audio/danger_target.ogg.asset.json";
import { isCheatOn } from "@/game/cheats";

import { isBgmMuted, subscribeBgmMuted, pauseBgm, resumeBgm } from "@/game/bgm";

// simple one-shot sample player (overlapping playback via cloned nodes)
function makeSample(url: string, volume: number) {
  let base: HTMLAudioElement | null = null;
  return () => {
    try {
      if (!base) {
        base = new Audio(url);
        base.preload = "auto";
        base.volume = volume;
      }
      const node = base.cloneNode(true) as HTMLAudioElement;
      node.volume = volume;
      node.currentTime = 0;
      void node.play().catch(() => { /* noop */ });
    } catch { /* noop */ }
  };
}

const playBeam = makeSample(beamAsset.url, 0.75);
const playExplosion = makeSample(exploseAsset.url, 0.85);
const playExplosion2 = makeSample(explose2Asset.url, 0.9);
const playCountUp = makeSample(countupAsset.url, 0.55);


// STAR VANISHER...!! — one-click point grinding mini game.
// The player must vanish exactly the requested percentage of the star:
// a green "vanish field" pulses in size, one click fires the beam and
// whatever slice of the star the field covered is what gets destroyed.

const W = 960;
const H = 540;
const HS_KEY = "dashgaem_starvanisher_hs_v1";
const TUT_KEY = "dashgaem_starvanisher_tut_v1";

const TUT_SLIDES: { title: string; body: string }[] = [
  {
    title: "THE ASK",
    body: "Bottom-left tells you how much of the star must be vanished. Hit that % as closely as you can.",
  },
  {
    title: "THE VANISH FIELD",
    body: "The green field pulses bigger and smaller over the star. Whatever it covers is what gets destroyed.",
  },
  {
    title: "ONE CLICK",
    body: "Click / tap once to fire the beam. JUST and OKAY keep the run alive and build your combo — a MISS ends it.",
  },
];


type Judgement = "JUST" | "OKAY" | "MISS";
type Phase = "aim" | "fire" | "count" | "result" | "over" | "boss";

type BossPath = "circle" | "square" | "infinity" | "triangle";
type BossSpot = { a: number; d: number; cd: number };
type Boss = {
  hp: number; maxHp: number;
  path: BossPath;
  t: number; speed: number;
  x: number; y: number; r: number;
  spots: BossSpot[];
  spin: number;
  timeLeft: number;
  hitFlash: number;
  dying: number;
};

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  kind: "smoke" | "spark" | "line";
  angle?: number;
};

type ColorSet = { light: string; mid: string; dark: string; edge: string };

type Star = {
  cx: number; cy: number; r: number;
  seed: number;
  wobble: number;      // shape complexity
  craters: { a: number; d: number; r: number }[];
  colors: ColorSet;
  spin: number;        // current rotation (radians)
  spinSpeed: number;   // slow spin
};

type Streak = { x: number; y: number; len: number; sp: number; w: number; c: string };


type State = {
  phase: Phase;
  t: number;              // phase timer
  target: number;         // target destruction %
  fieldT: number;         // 0..1 pulse position
  fieldDir: 1 | -1;
  fieldSpeed: number;
  lockedPct: number;      // destroyed %
  judgement: Judgement | null;
  combo: number;
  score: number;
  shake: number;
  flash: number;
  hitstop: number;
  beam: number;           // beam life
  star: Star | null;
  destroyFrac: number;    // 0..1 visual erase amount
  particles: Particle[];
  floatNums: { x: number; y: number; text: string; life: number; color: string; size: number }[];
  comboPop: number;
  // percentage count-up
  countVal: number;       // currently shown %
  countStep: number;      // index of ticks done
  countTimer: number;     // time until next tick
  countDone: boolean;
  countPop: number;
  boomed: boolean;        // explosion already triggered for this shot
  pendingMiss: boolean;   // run ends once the count-up finishes
  reviveLeft: number;     // SECOND WIND charges left this run
  sightLeft: number;      // TRUE SIGHT targets left this run
  starsDone: number;      // stars completed this run
  bg: ColorSet;           // background palette, reshuffled every 5 stars
  streaks: Streak[];      // speed lines flying right -> left
  demo: boolean;          // tutorial demonstration: the game plays itself
  demoTryTimer: number;   // seconds after count-up done before "Try it yourself!" flashes
  boss: Boss | null;      // DANGER TARGET, appears every 40 targets
  bossIntro: number;      // intro card timer
  bossOnly: boolean;      // DANGER TARGET mode: endless bosses, each tougher
  bossWave: number;       // how many DANGER TARGETs have shown up this run
  aimX: number; aimY: number;   // mouse aim during the boss fight
  beamX: number; beamY: number; // where the last boss beam landed
};



function rand(a: number, b: number) { return a + Math.random() * (b - a); }

// a fully random colour identity — includes greys, near-black and near-white
function randColorSet(): ColorSet {
  const grey = Math.random() < 0.28;
  const h = rand(0, 360);
  const sat = grey ? 0 : rand(45, 100);
  const L = rand(26, 74);
  const hsl = (l: number) => `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${Math.max(3, Math.min(97, l)).toFixed(0)}%)`;
  return { light: hsl(L + 28), mid: hsl(L), dark: hsl(L - 26), edge: hsl(L + 40) };
}

function makeStar(combo: number): Star {
  const r = rand(105, 150) - Math.min(25, combo * 1.2);
  const craters = Array.from({ length: Math.floor(rand(4, 9)) }, () => ({
    a: rand(0, Math.PI * 2), d: rand(0.15, 0.75), r: rand(0.07, 0.2),
  }));
  return {
    cx: W - rand(210, 260),
    cy: H / 2 + rand(-30, 30),
    r,
    seed: Math.random() * 1000,
    wobble: 0,
    craters,
    colors: randColorSet(),
    spin: rand(0, Math.PI * 2),
    spinSpeed: rand(0.18, 0.34) * (Math.random() < 0.5 ? -1 : 1),
  };
}


// area of the lens where the vanish field overlaps the star, as a % of star area
function overlapPct(sx: number, sy: number, sr: number, fx: number, fy: number, fr: number) {
  const d = Math.hypot(sx - fx, sy - fy);
  if (d >= sr + fr) return 0;
  if (d <= Math.abs(sr - fr)) {
    const small = Math.min(sr, fr);
    return (small * small) / (sr * sr) * 100;
  }
  const r1 = sr, r2 = fr;
  const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const area = r1 * r1 * (a1 - Math.sin(2 * a1) / 2) + r2 * r2 * (a2 - Math.sin(2 * a2) / 2);
  return Math.min(100, (area / (Math.PI * r1 * r1)) * 100);
}

function windows(combo: number) {
  const tighten = Math.min(0.62, combo * 0.045);
  const forgive = hasAbility("wide") ? 1.25 : 1;
  return {
    perfect: 3.2 * (1 - tighten) * forgive,
    okay: 8.5 * (1 - tighten) * forgive,
  };
}

// horizontal speed lines that fly in from the right edge at random heights
function makeStreaks(bg: ColorSet): Streak[] {
  return Array.from({ length: 30 }, () => ({
    x: rand(0, W + 400),
    y: rand(6, H - 6),
    len: rand(80, 320),
    sp: rand(220, 760),
    w: rand(2, 6),
    c: Math.random() < 0.5 ? bg.light : bg.edge,
  }));
}

function starPath(ctx: CanvasRenderingContext2D, s: Star, _time?: number) {
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
  ctx.closePath();
}

// ---------------- DANGER TARGET ----------------
export const SPOT_R = 20;
const BOSS_MAX_HP = 108;
const BOSS_TIME = 42;
const BOSS_PATHS: BossPath[] = ["circle", "square", "infinity", "triangle"];

function makeBoss(): Boss {
  const path = BOSS_PATHS[Math.floor(Math.random() * BOSS_PATHS.length)];
  const spots: BossSpot[] = Array.from({ length: 5 }, (_, i) => ({
    a: (i / 5) * Math.PI * 2 + rand(-0.2, 0.2),
    d: rand(0.72, 0.98),
    cd: 0,
  }));
  const p = bossPathPos(path, 0);
  return {
    hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, path, t: 0,
    speed: 0.16 + Math.random() * 0.07,
    x: p.x, y: p.y, r: 74, spots, spin: 0,
    timeLeft: BOSS_TIME, hitFlash: 0, dying: 0,
  };
}

function bossPathPos(path: BossPath, t: number) {
  const cx = W * 0.58, cy = H * 0.5, rx = 230, ry = 130;
  const u = ((t % 1) + 1) % 1;
  if (path === "circle") {
    const a = u * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  }
  if (path === "infinity") {
    const a = u * Math.PI * 2;
    return { x: cx + Math.sin(a) * rx, y: cy + Math.sin(a * 2) * ry * 0.72 };
  }
  const pts: number[][] = path === "square"
    ? [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    : [[0, -1], [1, 1], [-1, 1]];
  const n = pts.length;
  const seg = u * n;
  const i = Math.floor(seg) % n;
  const f = seg - Math.floor(seg);
  const p0 = pts[i], p1 = pts[(i + 1) % n];
  return {
    x: cx + (p0[0] + (p1[0] - p0[0]) * f) * rx,
    y: cy + (p0[1] + (p1[1] - p0[1]) * f) * ry,
  };
}

function spotPos(b: Boss, sp: BossSpot) {
  const a = sp.a + b.spin;
  return { x: b.x + Math.cos(a) * b.r * sp.d, y: b.y + Math.sin(a) * b.r * sp.d };
}

// boss theme (module-level so it survives re-renders)
let bossAudio: HTMLAudioElement | null = null;
function playBossBgm() {
  try {
    if (!bossAudio) {
      bossAudio = new Audio(dangerAsset.url);
      bossAudio.loop = true;
    }
    bossAudio.volume = 0.5;
    bossAudio.currentTime = 0;
    void bossAudio.play().catch(() => { /* blocked */ });
  } catch { /* noop */ }
}
function stopBossBgm() {
  try { bossAudio?.pause(); if (bossAudio) bossAudio.currentTime = 0; } catch { /* noop */ }
}

function drawBoss(ctx: CanvasRenderingContext2D, st: State, time: number) {
  const b = st.boss;
  if (!b) return;
  const dead = b.dying > 0;

  // beam from the left edge to wherever the player clicked
  if (st.beam > 0) {
    const sk = activeBeamSkin();
    const k = st.beam / 0.28;
    const bh = 22 * (0.5 + k);
    ctx.save();
    ctx.translate(40, st.beamY);
    ctx.globalAlpha = 0.35 + k * 0.65;
    const len = Math.max(0, st.beamX - 40);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, sk.core);
    grad.addColorStop(1, sk.edge);
    ctx.fillStyle = grad;
    ctx.fillRect(0, -bh / 2, len, bh);
    ctx.fillStyle = sk.core;
    ctx.fillRect(0, -bh / 6, len, bh / 3);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  if (!dead) {
    // body
    ctx.save();
    const pulse = 1 + Math.sin(time * 7) * 0.03 + b.hitFlash * 0.08;
    ctx.translate(b.x, b.y);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.35, b.r * 0.1, 0, 0, b.r * 1.2);
    g.addColorStop(0, b.hitFlash > 0.3 ? "#ffffff" : "#ff6a6a");
    g.addColorStop(0.55, "#c11030");
    g.addColorStop(1, "#3a0009");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ff2d5e";
    ctx.stroke();
    // spikes
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + b.spin * 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * b.r, Math.sin(a) * b.r);
      ctx.lineTo(Math.cos(a + 0.12) * (b.r + 20), Math.sin(a + 0.12) * (b.r + 20));
      ctx.lineTo(Math.cos(a + 0.26) * b.r, Math.sin(a + 0.26) * b.r);
      ctx.closePath();
      ctx.fillStyle = "#7a0016";
      ctx.fill();
    }
    ctx.restore();

    // weak spots
    for (const sp of b.spots) {
      const pos = spotPos(b, sp);
      const ready = sp.cd <= 0;
      const r = SPOT_R * (ready ? 1 + Math.sin(time * 9 + sp.a * 3) * 0.12 : 0.6);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = ready ? "#ffe23a" : "rgba(70,20,30,0.75)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ready ? "#fff8d0" : "rgba(255,255,255,0.25)";
      ctx.stroke();
      if (ready) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 8 + Math.sin(time * 9) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,226,58,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // HP bar + timer
  const bw = 520, bh2 = 20, bx = (W - bw) / 2, by = H - 96;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(bx - 4, by - 4, bw + 8, bh2 + 8);
  ctx.fillStyle = "#ff2d5e";
  ctx.fillRect(bx, by, bw * (b.hp / b.maxHp), bh2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh2);
  ctx.textAlign = "center";
  ctx.font = "italic 800 22px Oxanium, system-ui, sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(25,0,10,0.85)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText("DANGER TARGET", W / 2, by - 12);
  ctx.fillText("DANGER TARGET", W / 2, by - 12);
  ctx.font = "italic 800 18px Oxanium, system-ui, sans-serif";
  ctx.fillStyle = b.timeLeft < 10 ? "#ff2d5e" : "#ffe23a";
  ctx.strokeText(`${Math.max(0, b.timeLeft).toFixed(1)}s`, W / 2, by + bh2 + 22);
  ctx.fillText(`${Math.max(0, b.timeLeft).toFixed(1)}s`, W / 2, by + bh2 + 22);
  ctx.restore();

  // mouse crosshair
  if (!dead && st.bossIntro <= 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(st.aimX, st.aimY, 16, 0, Math.PI * 2);
    ctx.moveTo(st.aimX - 26, st.aimY); ctx.lineTo(st.aimX - 6, st.aimY);
    ctx.moveTo(st.aimX + 6, st.aimY); ctx.lineTo(st.aimX + 26, st.aimY);
    ctx.moveTo(st.aimX, st.aimY - 26); ctx.lineTo(st.aimX, st.aimY - 6);
    ctx.moveTo(st.aimX, st.aimY + 6); ctx.lineTo(st.aimX, st.aimY + 26);
    ctx.stroke();
    ctx.restore();
  }

  // intro card
  if (st.bossIntro > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, st.bossIntro);
    ctx.textAlign = "center";
    ctx.font = "italic 800 76px Oxanium, system-ui, sans-serif";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = Math.floor(time * 8) % 2 === 0 ? "#ff2d5e" : "#ffffff";
    ctx.strokeText("DANGER TARGET!!", W / 2, H * 0.4);
    ctx.fillText("DANGER TARGET!!", W / 2, H * 0.4);
    ctx.font = "italic 800 26px Oxanium, system-ui, sans-serif";
    ctx.fillStyle = "#ffe23a";
    ctx.strokeText("AIM WITH THE MOUSE — SHOOT THE WEAK SPOTS", W / 2, H * 0.4 + 44);
    ctx.fillText("AIM WITH THE MOUSE — SHOOT THE WEAK SPOTS", W / 2, H * 0.4 + 44);
    ctx.restore();
  }
}




export default function StarVanisher() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<State | null>(null);
  const [running, setRunning] = useState(false);
  const [hud, setHud] = useState({ score: 0, combo: 0, best: 0, over: false, lastScore: 0, newBest: false, lastPct: 0, earned: 0 });
  const [, forceShop] = useState(0);
  useEffect(() => subscribeShop(() => forceShop((n) => n + 1)), []);
  const [failStage, setFailStage] = useState(0); // 0 none, 1 miss, 2 white+FAIL, 3 retry
  const [showFailPct, setShowFailPct] = useState(false);
  const hsRef = useRef(0);

  // first-time tutorial: slides -> self-playing demo -> "Try it yourself!"
  const [tutSlide, setTutSlide] = useState<number | null>(null); // null = no slides showing
  const [tutDemo, setTutDemo] = useState(false);
  const [showTryIt, setShowTryIt] = useState(false);
  const tutTimers = useRef<number[]>([]);
  const clearTutTimers = () => { tutTimers.current.forEach(window.clearTimeout); tutTimers.current = []; };
  useEffect(() => clearTutTimers, []);


  // run BGM (loops for the whole run, stops on game over / unmount)
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const ensureBgm = () => {
    if (!bgmRef.current) {
      const a = new Audio(runBgmAsset.url);
      a.loop = true;
      a.volume = 0.3375;
      bgmRef.current = a;
    }


    return bgmRef.current;
  };
  useEffect(() => {
    const a = ensureBgm();
    if (isBgmMuted()) {
      a.pause();
      return;
    }
    if (running && !hud.over) {
      // restart the run track at the beginning of each run / retry
      a.volume = 0.3375;
      a.currentTime = 0;
      pauseBgm(); // silence menu/game music while the run track plays
      void a.play().catch(() => { /* blocked */ });
    } else if (running && hud.over) {
      // keep the track going on the fail screen but very quiet
      a.volume = 0.10;
    } else {
      a.pause();
      a.currentTime = 0;
      resumeBgm();
    }
  }, [running, hud.over]);
  useEffect(() => subscribeBgmMuted((m) => {
    const inBoss = stateRef.current?.phase === "boss";
    if (m) stopBossBgm();
    const a = bgmRef.current;
    if (!a) return;
    if (m) { a.pause(); }
    else if (inBoss) { pauseBgm(); playBossBgm(); }
    else if (running && !hud.over) { pauseBgm(); a.volume = 0.3375; a.currentTime = 0; void a.play().catch(() => { /* noop */ }); }
    else if (running && hud.over) { a.volume = 0.10; void a.play().catch(() => { /* noop */ }); }
  }), [running, hud.over]);
  useEffect(() => () => { bgmRef.current?.pause(); stopBossBgm(); resumeBgm(); }, []);


  useEffect(() => {
    const raw = Number(localStorage.getItem(HS_KEY) ?? 0);
    hsRef.current = Number.isFinite(raw) ? raw : 0;
    setHud((h) => ({ ...h, best: hsRef.current }));
  }, []);

  const newRound = (st: State) => {
    st.phase = "aim";
    st.t = 0;
    st.target = Math.round(rand(28, 96));
    st.fieldT = 0;
    st.fieldDir = 1;
    st.fieldSpeed = (0.62 + Math.min(1.5, st.combo * 0.075))
      * (hasAbility("steady") ? 0.8 : 1)
      * (hasAbility("greed") ? 1.15 : 1);
    st.lockedPct = 0;
    st.judgement = null;
    st.beam = 0;
    st.destroyFrac = 0;
    st.countVal = 0;
    st.countStep = 0;
    st.countTimer = 0;
    st.countDone = false;
    st.countPop = 0;
    st.boomed = false;
    st.pendingMiss = false;
    st.starsDone += 1;
    // every 5 stars completed the whole background shifts to a new random colour
    if (st.starsDone > 0 && st.starsDone % 5 === 0) {
      st.bg = randColorSet();
      st.streaks = makeStreaks(st.bg);
    }
    // every 40 targets beaten, a DANGER TARGET shows up instead of a star
    if (!st.demo && st.starsDone > 0 && st.starsDone % 40 === 0) {
      startBoss(st);
      return;
    }
    st.star = makeStar(st.combo);
  };

  const start = (demo = false, bossOnly = false) => {
    unlockAudio();
    sfx.menuConfirm();
    clearTutTimers();
    stopBossBgm();
    setShowTryIt(false);
    setTutSlide(null);
    setTutDemo(demo);
    const bg0 = randColorSet();
    const st: State = {
      phase: "aim", t: 0, target: 50, fieldT: 0, fieldDir: 1, fieldSpeed: 0.7,
      lockedPct: 0, judgement: null, combo: 0, score: 0, shake: 0, flash: 0,
      hitstop: 0, beam: 0, star: null, destroyFrac: 0, particles: [], floatNums: [],
      comboPop: 0, countVal: 0, countStep: 0, countTimer: 0, countDone: false, countPop: 0,
      boomed: false, pendingMiss: false, reviveLeft: hasAbility("revive") ? 1 : 0,
      sightLeft: hasAbility("sight") ? 10 : 0,
      starsDone: -1, bg: bg0, streaks: makeStreaks(bg0), demo,
      demoTryTimer: 0,
      boss: null, bossIntro: 0, aimX: W * 0.5, aimY: H * 0.5, beamX: W * 0.5, beamY: H * 0.5,
    };

    newRound(st);
    if (demo) st.target = 55; // a clean, easy-to-read ask for the demonstration
    stateRef.current = st;
    setHud((h) => ({ ...h, score: 0, combo: 0, over: false, newBest: false, earned: 0 }));
    setFailStage(0);
    setShowFailPct(false);
    setRunning(true);
    if (bossOnly) startBoss(st);
  };


  // pressing play for the very first time runs the tutorial instead
  const handlePlay = () => {
    let seen = false;
    try { seen = localStorage.getItem(TUT_KEY) === "1"; } catch { /* noop */ }
    if (seen) { start(false); return; }
    unlockAudio();
    sfx.menuConfirm();
    setTutSlide(0);
  };

  const markTutorialDone = () => {
    try { localStorage.setItem(TUT_KEY, "1"); } catch { /* noop */ }
  };


  // fail sequence timeline
  useEffect(() => {
    if (!hud.over) { setFailStage(0); setShowFailPct(false); return; }
    setFailStage(1);
    const pct = window.setTimeout(() => setShowFailPct(true), 120);
    const t1 = window.setTimeout(() => setFailStage(2), 1500);
    const t2 = window.setTimeout(() => setFailStage(3), 1500 + 1200);
    return () => { window.clearTimeout(pct); window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [hud.over]);


  const fire = (auto = false) => {
    const st = stateRef.current;
    if (!st || st.phase !== "aim" || !st.star) return;
    if (st.demo && !auto) return; // hands off during the demonstration

    unlockAudio();
    const s = st.star;
    const fr = fieldRadius(st, s);
    const fc = fieldCenter(s);
    const rawPct = overlapPct(s.cx, s.cy, s.r, fc.x, fc.y, fr);
    const cheatJust = isCheatOn("perfectAim");
    const pct = cheatJust ? st.target : rawPct;
    const win = windows(st.combo);
    const diff = Math.abs(pct - st.target);
    const j: Judgement = cheatJust
      ? "JUST"
      : diff <= win.perfect ? "JUST" : diff <= win.okay ? "OKAY" : "MISS";

    if (st.sightLeft > 0) st.sightLeft -= 1;
    st.lockedPct = pct;
    st.judgement = j;
    st.phase = "fire";
    st.t = 0;
    st.beam = 0.32;
    st.boomed = false;
    st.countVal = 0;
    st.countStep = 0;
    st.countTimer = 0;
    st.countDone = false;
    st.countPop = 0;

    playBeam();



    if (j === "MISS") {
      // hold the run open: the MISS reveal happens after the count-up
      st.pendingMiss = true;
    } else {
      const acc = Math.max(0, 1 - diff / win.okay);
      const greed = hasAbility("greed") ? 1.3 : 1;
      const gained = Math.round((j === "JUST" ? 1200 : 500) * (1 + acc) * (1 + st.combo * 0.22) * greed);
      st.score += gained;
      st.combo += 1;
      st.comboPop = 1;
      st.floatNums.push({
        x: s.cx, y: s.cy + 40, text: `+${gained}`,
        life: 0.9, color: "#7dffb0", size: 34,
      });
      setHud((h) => ({ ...h, score: st.score, combo: st.combo }));
    }
  };

  const finishMiss = (st: State) => {
    // SECOND WIND: eat the miss, keep the run alive
    if (st.reviveLeft > 0) {
      st.reviveLeft -= 1;
      st.combo = 0;
      st.floatNums.push({
        x: W * 0.4, y: H * 0.3, text: "SECOND WIND!", life: 1.4, color: "#8bff3a", size: 40,
      });
      sfx.parryHit();
      setHud((h) => ({ ...h, combo: 0 }));
      newRound(st);
      return;
    }
    sfx.fatalHit();
    st.phase = "over";
    st.t = 0;
    const newBest = st.score > hsRef.current;
    if (newBest) {
      hsRef.current = st.score;
      try { localStorage.setItem(HS_KEY, String(st.score)); } catch { /* noop */ }
    }
    const earned = tokensForScore(st.score);
    if (earned > 0) addTokens(earned);
    setHud({ score: st.score, combo: st.combo, best: hsRef.current, over: true, lastScore: st.score, newBest, lastPct: st.lockedPct, earned });
  };

  const fieldCenter = (s: Star) => ({ x: s.cx - s.r * 0.55, y: s.cy });
  const fieldRadius = (st: State, s: Star) => {
    const eased = 0.5 - Math.cos(st.fieldT * Math.PI) / 2;
    return s.r * (0.35 + eased * 1.35);
  };

  // the explosion beat, fired 0.4s after the beam
  const explode = (st: State) => {
    const s = st.star;
    if (!s) return;
    st.boomed = true;
    if (st.demo) {
      // demo's "Try it yourself!" flash is handled after the count-up finishes
      return;
    }

    st.hitstop = 0.12;
    st.flash = 1;
    st.shake = 14 + Math.min(26, st.combo * 1.6);
    playExplosion();

    const intensity = Math.min(2, 0.8 + st.combo * 0.08);
    const n = 46 + Math.min(90, st.combo * 6);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 460) * (0.7 + intensity * 0.4);
      st.particles.push({
        x: s.cx + Math.cos(a) * s.r * rand(0, 0.7),
        y: s.cy + Math.sin(a) * s.r * rand(0, 0.7),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: rand(0.5, 1.2), maxLife: 1.2,
        size: rand(10, 46), color: i % 4 === 0 ? "#ffe9f2" : i % 3 === 0 ? "#ff5c8a" : "#ff9ec2",
        kind: i % 5 === 0 ? "spark" : "smoke",
      });
    }
    for (let i = 0; i < 14; i++) {
      st.particles.push({
        x: s.cx, y: s.cy, vx: rand(-700, -180), vy: rand(-160, 160),
        life: rand(0.18, 0.4), maxLife: 0.4, size: rand(40, 190),
        color: "#ffd1e2", kind: "line", angle: rand(-0.25, 0.25),
      });
    }
  };

  // ---------------- DANGER TARGET (boss battle) ----------------
  const startBoss = (st: State) => {
    st.star = null;
    st.phase = "boss";
    st.t = 0;
    st.judgement = null;
    st.beam = 0;
    st.boomed = false;
    st.destroyFrac = 0;
    st.boss = makeBoss();
    st.bossIntro = 1.6;
    st.flash = 1;
    st.shake = 20;
    st.aimX = W * 0.5;
    st.aimY = H * 0.5;
    playExplosion2();
    // the boss theme takes over the run track
    if (!isBgmMuted()) {
      bgmRef.current?.pause();
      playBossBgm();
    }
  };

  const endBoss = (st: State) => {
    st.boss = null;
    stopBossBgm();
    if (!isBgmMuted() && !hud.over) {
      const a = bgmRef.current;
      if (a) { a.volume = 0.3375; void a.play().catch(() => { /* noop */ }); }
    }
  };

  const updateBoss = (st: State, dt: number) => {
    const b = st.boss;
    if (!b) return;

    if (st.bossIntro > 0) { st.bossIntro -= dt; return; }

    if (b.dying > 0) {
      b.dying -= dt;
      // keep blowing chunks off the corpse
      if (Math.random() < 0.5) {
        const a = rand(0, Math.PI * 2);
        st.particles.push({
          x: b.x + Math.cos(a) * b.r * 0.6, y: b.y + Math.sin(a) * b.r * 0.6,
          vx: Math.cos(a) * rand(80, 420), vy: Math.sin(a) * rand(80, 420) - 40,
          life: rand(0.4, 1.0), maxLife: 1.0, size: rand(12, 44),
          color: Math.random() < 0.5 ? "#ffe9a8" : "#ff5c3a", kind: "smoke",
        });
      }
      if (b.dying <= 0) {
        endBoss(st);
        newRound(st);
      }
      return;
    }

    // path movement
    b.t += dt * b.speed;
    const p = bossPathPos(b.path, b.t);
    b.x = p.x; b.y = p.y;
    b.spin += dt * 0.9;
    b.hitFlash = Math.max(0, b.hitFlash - dt * 4);
    for (const sp of b.spots) if (sp.cd > 0) sp.cd -= dt;

    // countdown — let it expire and the run is over
    b.timeLeft -= dt;
    if (b.timeLeft <= 0) {
      st.judgement = "MISS";
      st.lockedPct = 0;
      endBoss(st);
      finishMiss(st);
    }
  };

  const bossFire = (ax: number, ay: number) => {
    const st = stateRef.current;
    const b = st?.boss;
    if (!st || !b || st.phase !== "boss" || st.bossIntro > 0 || b.dying > 0) return;
    unlockAudio();
    st.beam = 0.28;
    st.beamX = ax;
    st.beamY = ay;
    playBeam();

    // weak spot hit test
    let hit: BossSpot | null = null;
    let best = 9999;
    for (const sp of b.spots) {
      if (sp.cd > 0) continue;
      const pos = spotPos(b, sp);
      const d = Math.hypot(pos.x - ax, pos.y - ay);
      if (d <= SPOT_R + 10 && d < best) { best = d; hit = sp; }
    }

    if (hit) {
      const pos = spotPos(b, hit);
      hit.cd = 1.1;
      b.hp = Math.max(0, b.hp - 12);
      b.hitFlash = 1;
      st.shake = 12;
      st.hitstop = 0.06;
      playExplosion2();
      st.combo += 1;
      st.comboPop = 1;
      const gained = Math.round(900 * (1 + st.combo * 0.12));
      st.score += gained;
      st.floatNums.push({ x: pos.x, y: pos.y - 10, text: `+${gained}`, life: 0.8, color: "#ffe23a", size: 30 });
      for (let i = 0; i < 22; i++) {
        const a = rand(0, Math.PI * 2);
        st.particles.push({
          x: pos.x, y: pos.y, vx: Math.cos(a) * rand(60, 340), vy: Math.sin(a) * rand(60, 340),
          life: rand(0.25, 0.7), maxLife: 0.7, size: rand(6, 22),
          color: i % 3 === 0 ? "#fff3b0" : "#ff3a5e", kind: i % 4 === 0 ? "spark" : "smoke",
        });
      }
      setHud((h) => ({ ...h, score: st.score, combo: st.combo }));

      if (b.hp <= 0) {
        // DANGER TARGET DOWN
        b.dying = 2.2;
        st.flash = 1;
        st.shake = 30;
        st.hitstop = 0.16;
        playExplosion();
        st.score += 100000;
        st.floatNums.push({ x: b.x, y: b.y - 40, text: "DANGER TARGET DOWN", life: 2.0, color: "#ff3a5e", size: 40 });
        st.floatNums.push({ x: b.x, y: b.y + 20, text: "+100000", life: 2.0, color: "#ffe23a", size: 52 });
        for (let i = 0; i < 90; i++) {
          const a = rand(0, Math.PI * 2);
          st.particles.push({
            x: b.x + Math.cos(a) * rand(0, b.r), y: b.y + Math.sin(a) * rand(0, b.r),
            vx: Math.cos(a) * rand(80, 620), vy: Math.sin(a) * rand(80, 620),
            life: rand(0.4, 1.2), maxLife: 1.2, size: rand(10, 52),
            color: i % 4 === 0 ? "#ffffff" : i % 3 === 0 ? "#ffb03a" : "#ff2d5e",
            kind: i % 5 === 0 ? "spark" : "smoke",
          });
        }
        setHud((h) => ({ ...h, score: st.score, combo: st.combo }));
      }
    } else {
      st.shake = 5;
      st.floatNums.push({ x: ax, y: ay, text: "miss", life: 0.5, color: "#ffffff", size: 22 });
    }
  };


  // main loop
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let time = 0;

    const loop = (now: number) => {
      const st = stateRef.current;
      if (!st) return;
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;

      if (st.hitstop > 0) { st.hitstop -= dt; dt *= 0.12; }

      // ---- update ----
      st.t += dt;
      if (!st.boomed && st.judgement && st.t >= 0.4 && (st.phase === "fire" || st.phase === "over")) {
        explode(st);
      }
      if (st.boomed) st.destroyFrac = Math.min(1, st.destroyFrac + dt * 5);

      if (st.phase === "aim") {
        st.fieldT += st.fieldDir * st.fieldSpeed * dt;
        if (st.fieldT > 1) { st.fieldT = 1; st.fieldDir = -1; }
        if (st.fieldT < 0) { st.fieldT = 0; st.fieldDir = 1; }
        // demonstration: the game plays itself, firing right on the target
        if (st.demo && st.star && st.t > 1.1) {
          const s = st.star;
          const fc = fieldCenter(s);
          const pct = overlapPct(s.cx, s.cy, s.r, fc.x, fc.y, fieldRadius(st, s));
          if (Math.abs(pct - st.target) <= 1.4) fire(true);
        }

      } else if (st.phase === "boss") {
        updateBoss(st, dt);
      } else if (st.phase === "fire") {
        if (st.t > 0.95) { st.phase = "count"; st.t = 0; st.countTimer = 0.18; }
      } else if (st.phase === "count") {
        st.countPop = Math.max(0, st.countPop - dt * 4);
        const total = Math.floor(st.lockedPct) + 1;
        if (!st.countDone) {
          st.countTimer -= dt;
          if (st.countTimer <= 0) {
            st.countStep += 1;
          if (st.countStep >= total) {
            st.countVal = st.lockedPct;
            st.countDone = true;
            st.countPop = 1;
            st.t = 0;
            st.shake = 13;
            playExplosion2();
            if (st.demo) st.demoTryTimer = 0.6;
          } else {
              st.countVal = st.countStep;
              st.countPop = 0.55;
              playCountUp();
              const prog = st.countStep / total;
              st.countTimer = 0.024 + 0.17 * Math.pow(prog, 2.6);
            }
          }
      } else if (st.t > 0.94) {
        if (st.demo) {
          // demo holds here until the tutorial hands over
          if (st.demoTryTimer > 0) {
            st.demoTryTimer -= dt;
            if (st.demoTryTimer <= 0) {
              setShowTryIt(true);
              clearTutTimers();
              tutTimers.current.push(window.setTimeout(() => {
                setShowTryIt(false);
                markTutorialDone();
                start(false);
              }, 1500));
            }
          }
        }
        else if (st.pendingMiss) finishMiss(st);
        else newRound(st);
      }

      } else if (st.phase === "result") {
        const gap = Math.max(0.22, 0.5 - st.combo * 0.02);
        if (st.t > gap) newRound(st);
      }


      st.beam = Math.max(0, st.beam - dt);
      st.flash = Math.max(0, st.flash - dt * 3.2);
      st.shake = Math.max(0, st.shake - dt * 55);
      st.comboPop = Math.max(0, st.comboPop - dt * 3);

      for (const p of st.particles) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.94; p.vy *= 0.94;
        if (p.kind === "smoke") p.vy -= 30 * dt;
      }
      st.particles = st.particles.filter((p) => p.life > 0);
      for (const f of st.floatNums) { f.life -= dt; f.y -= 26 * dt; }
      st.floatNums = st.floatNums.filter((f) => f.life > 0);

      // slow star spin + horizontal streaks flying leftwards
      if (st.star) st.star.spin += st.star.spinSpeed * dt;
      for (const sk of st.streaks) {
        sk.x -= sk.sp * dt;
        if (sk.x + sk.len < -20) {
          sk.x = W + rand(20, 380);
          sk.y = rand(6, H - 6);
          sk.len = rand(80, 320);
          sk.sp = rand(220, 760);
          sk.w = rand(2, 6);
          sk.c = Math.random() < 0.5 ? st.bg.light : st.bg.edge;
        }
      }

      // ---- draw ----
      ctx.save();
      const sh = st.shake;
      ctx.translate(rand(-sh, sh) * 0.5, rand(-sh, sh) * 0.5);

      // background: randomised colour void
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, st.bg.dark);
      g.addColorStop(0.5, st.bg.mid);
      g.addColorStop(1, st.bg.dark);
      ctx.fillStyle = g;
      ctx.fillRect(-40, -40, W + 80, H + 80);

      ctx.globalAlpha = 0.26;
      for (const sk of st.streaks) {
        ctx.fillStyle = sk.c;
        ctx.fillRect(sk.x, sk.y, sk.len, sk.w);
      }
      ctx.globalAlpha = 1;

      if (st.boss) drawBoss(ctx, st, time);

      const s = st.star;
      if (s) {
        // star body
        ctx.save();
        const alive = 1 - (st.phase === "aim" ? 0 : st.destroyFrac * (st.lockedPct / 100));
        starPath(ctx, s);
        ctx.clip();
        const sg = ctx.createRadialGradient(s.cx - s.r * 0.3, s.cy - s.r * 0.35, s.r * 0.1, s.cx, s.cy, s.r * 1.2);
        sg.addColorStop(0, s.colors.light);
        sg.addColorStop(0.6, s.colors.mid);
        sg.addColorStop(1, s.colors.dark);
        ctx.fillStyle = sg;
        ctx.fillRect(s.cx - s.r * 1.4, s.cy - s.r * 1.4, s.r * 2.8, s.r * 2.8);
        // craters (rotate with the star so the spin reads)
        for (const c of s.craters) {
          const a = c.a + s.spin;
          ctx.beginPath();
          ctx.arc(s.cx + Math.cos(a) * s.r * c.d, s.cy + Math.sin(a) * s.r * c.d, s.r * c.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0,0,0,0.4)";
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        // vanished slice punched out
        if (st.phase !== "aim") {
          const fc = fieldCenter(s);
          const fr = fieldRadius(st, s) * st.destroyFrac;
          ctx.beginPath();
          ctx.arc(fc.x, fc.y, fr, 0, Math.PI * 2);
          ctx.fillStyle = "#120008";
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = alive > 0 ? 1 : 0.4;
        starPath(ctx, s);
        ctx.strokeStyle = s.colors.edge;

        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // vanish field preview
        if (st.phase === "aim") {
          const fc = fieldCenter(s);
          const fr = fieldRadius(st, s);
          ctx.beginPath();
          ctx.arc(fc.x, fc.y, fr, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(150,255,80,0.32)";
          ctx.fill();
          ctx.strokeStyle = "rgba(215,255,140,0.95)";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "rgba(240,255,210,0.95)";
          ctx.font = "italic 800 26px Oxanium, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("TARGET", fc.x, fc.y + 9);
        }

        // beam — colours come from the equipped shop skin
        if (st.beam > 0) {
          const sk = activeBeamSkin();
          const k = st.beam / 0.32;
          const bh = (28 + st.combo * 3) * (0.5 + k);
          ctx.globalAlpha = 0.35 + k * 0.65;
          const bg = ctx.createLinearGradient(0, 0, s.cx, 0);
          bg.addColorStop(0, sk.core);
          bg.addColorStop(1, sk.edge);
          ctx.fillStyle = bg;
          ctx.fillRect(40, s.cy - bh / 2, s.cx - 40, bh);
          ctx.fillStyle = sk.core;
          ctx.fillRect(40, s.cy - bh / 6, s.cx - 40, bh / 3);
          ctx.globalAlpha = 1;
        }
      }

      // particles
      for (const p of st.particles) {
        const k = p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = p.color;
        if (p.kind === "line") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle ?? 0);
          ctx.fillRect(0, -3, p.size, 6);
          ctx.restore();
        } else if (p.kind === "spark") {
          ctx.fillRect(p.x, p.y, 5, 5);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.1 - k * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // floating numbers
      ctx.textAlign = "center";
      for (const f of st.floatNums) {
        ctx.globalAlpha = Math.min(1, f.life * 1.6);
        ctx.fillStyle = f.color;
        ctx.font = `italic 800 ${f.size}px Oxanium, system-ui, sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(30,0,12,0.75)";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      // counting percentage
      if (st.phase === "count" && s) {
        const pop = 1 + st.countPop * (st.countDone ? 0.55 : 0.18);
        ctx.save();
        ctx.translate(s.cx, s.cy - s.r - 24);
        ctx.scale(pop, pop);
        ctx.textAlign = "center";
        ctx.font = "italic 800 74px Oxanium, system-ui, sans-serif";
        ctx.lineWidth = 9;
        ctx.strokeStyle = "rgba(30,0,12,0.8)";
        ctx.fillStyle = st.countDone ? "#ffe23a" : "#ffb03a";
        const txt = st.countDone ? `${st.countVal.toFixed(1)}%` : `${Math.floor(st.countVal)}%`;
        ctx.strokeText(txt, 0, 0);
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      }

      // judgement text
      if (st.judgement && ((st.phase === "count" && st.countDone) || st.phase === "result")) {
        const j = st.judgement;
        const pop = Math.min(1, st.t * 6);
        ctx.save();
        ctx.translate(W * 0.34, H * 0.32);
        ctx.scale(1 + (1 - pop) * 0.4, 1 + (1 - pop) * 0.4);
        ctx.rotate(-0.05);
        ctx.font = "italic 800 78px Oxanium, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 9;
        ctx.strokeStyle = "rgba(25,0,10,0.85)";
        ctx.fillStyle = j === "JUST" ? "#a855f7" : j === "OKAY" ? "#8ef0ff" : "#ff2d5e";
        ctx.strokeText(j, 0, 0);
        ctx.fillText(j, 0, 0);
        if (j === "MISS" && Math.floor(time * 8) % 2 === 0) {
          ctx.font = "italic 800 42px Oxanium, system-ui, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.strokeText(`${st.lockedPct.toFixed(1)}%`, 0, 56);
          ctx.fillText(`${st.lockedPct.toFixed(1)}%`, 0, 56);
        }
        ctx.restore();
      }

      // TRUE SIGHT: live destruction % readout while aiming
      if (st.phase === "aim" && st.star && st.sightLeft > 0) {
        const s0 = st.star;
        const live = overlapPct(s0.cx, s0.cy, s0.r, fieldCenter(s0).x, fieldCenter(s0).y, fieldRadius(st, s0));
        ctx.save();
        ctx.textAlign = "center";
        ctx.font = "italic 800 40px Oxanium, system-ui, sans-serif";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(25,0,10,0.85)";
        ctx.fillStyle = Math.abs(live - st.target) <= windows(st.combo).perfect ? "#a855f7" : "#8ef0ff";
        ctx.strokeText(`${live.toFixed(1)}%`, s0.cx, s0.cy - s0.r - 34);
        ctx.fillText(`${live.toFixed(1)}%`, s0.cx, s0.cy - s0.r - 34);
        ctx.font = "italic 800 20px Oxanium, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.strokeText(`TRUE SIGHT ${st.sightLeft} LEFT`, s0.cx, s0.cy - s0.r - 8);
        ctx.fillText(`TRUE SIGHT ${st.sightLeft} LEFT`, s0.cx, s0.cy - s0.r - 8);
        ctx.restore();
      }

      // left HUD: target call-out (hidden while the DANGER TARGET is up)
      ctx.save();
      ctx.textAlign = "left";
      if (st.phase !== "boss") {
        ctx.font = "italic 800 54px Oxanium, system-ui, sans-serif";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(25,0,10,0.85)";
        ctx.fillStyle = "#ffe23a";
        ctx.strokeText(`${st.target}%`, 34, H - 60);
        ctx.fillText(`${st.target}%`, 34, H - 60);
        ctx.font = "italic 800 34px Oxanium, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.strokeText("Vanish!!", 34 + ctx.measureText(`${st.target}% `).width * 0.55, H - 60);
        ctx.fillText("Vanish!!", 34 + ctx.measureText(`${st.target}% `).width * 0.55, H - 60);
      }
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(25,0,10,0.85)";

      // combo + score
      const cp = 1 + st.comboPop * 0.5;
      ctx.font = `italic 800 ${Math.round(30 * cp)}px Oxanium, system-ui, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(`x${st.combo}`, 34, 52);
      ctx.fillText(`x${st.combo}`, 34, 52);
      ctx.font = "italic 800 24px Oxanium, system-ui, sans-serif";
      ctx.fillStyle = "#ffd0de";
      ctx.strokeText(`${st.score}`, 34, 84);
      ctx.fillText(`${st.score}`, 34, 84);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffe23a";
      ctx.strokeText(`BEST ${hsRef.current}`, W - 30, 52);
      ctx.fillText(`BEST ${hsRef.current}`, W - 30, 52);
      if (st.phase === "aim") {
        ctx.textAlign = "center";
        ctx.font = "italic 800 20px Oxanium, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("CLICK / TAP TO FIRE", W / 2, H - 22);
      }
      ctx.restore();

      // screen flash
      if (st.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, st.flash)})`;
        ctx.fillRect(-40, -40, W + 80, H + 80);
      }
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return (
    <div className="sv-font flex flex-col items-center gap-3">
      <div className="text-center">
        
        <p className="font-marker text-xs text-ink/70 mt-1">
          One click. Vanish exactly as much of the star as they ask. Miss and the run is over.
        </p>
        <p className="font-marker text-xs text-ink/60 mt-1">
          Balance <span className="font-bungee text-ink">{getShop().tokens} T</span> · beam{" "}
          <span className="font-bungee text-ink">{activeBeamSkin().name}</span>
          {getShop().abilities.length > 0 && <> · {getShop().abilities.length} ability equipped</>}
        </p>
      </div>

      <div
        className="relative w-full max-w-3xl scribble-border overflow-hidden bg-[#2a0011] select-none"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full block touch-none cursor-crosshair"
          onPointerMove={(e) => {
            const st = stateRef.current;
            if (!st) return;
            const r = e.currentTarget.getBoundingClientRect();
            st.aimX = ((e.clientX - r.left) / r.width) * W;
            st.aimY = ((e.clientY - r.top) / r.height) * H;
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            const st = stateRef.current;
            const r = e.currentTarget.getBoundingClientRect();
            const ax = ((e.clientX - r.left) / r.width) * W;
            const ay = ((e.clientY - r.top) / r.height) * H;
            if (st) { st.aimX = ax; st.aimY = ay; }
            if (st && st.phase === "boss") bossFire(ax, ay);
            else fire();
          }}
        />

        {/* jagged cinematic borders — scroll left, thin so the play area stays readable */}
        <style>{`@keyframes svBorderScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-0 w-full overflow-hidden" style={{ height: "6%" }}>
            <svg
              className="absolute top-0 left-0 h-full"
              style={{ width: "200%", animation: "svBorderScroll 4s linear infinite" }}
              viewBox="0 0 200 10"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="0,0 100,0 100,7.2 78,8.6 62,6.2 44,9.4 26,7.8 12,9.9 0,8.1" fill="#000" />
              <polygon points="100,0 200,0 200,7.2 178,8.6 162,6.2 144,9.4 126,7.8 112,9.9 100,8.1" fill="#000" />
            </svg>
          </div>
          <div className="absolute bottom-0 left-0 w-full overflow-hidden" style={{ height: "6%", transform: "scaleY(-1)" }}>
            <svg
              className="absolute top-0 left-0 h-full"
              style={{ width: "200%", animation: "svBorderScroll 4s linear infinite" }}
              viewBox="0 0 200 10"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="0,0 100,0 100,7.2 78,8.6 62,6.2 44,9.4 26,7.8 12,9.9 0,8.1" fill="#000" />
              <polygon points="100,0 200,0 200,7.2 178,8.6 162,6.2 144,9.4 126,7.8 112,9.9 100,8.1" fill="#000" />
            </svg>
          </div>
        </div>



        {!running && tutSlide === null && (
          <div
            className="absolute inset-0 z-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${svTitleBg.url})` }}
          >
            {/* best score — top left */}
            <div className="absolute left-4 top-4 -rotate-2">
              <div
                className="border-2 border-black bg-black px-4 py-2"
                style={{ boxShadow: "4px 4px 0 rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.12)" }}
              >
                <div className="font-marker text-[10px] leading-none tracking-[0.3em] text-white/60">BEST</div>
                <div className="font-bungee text-2xl leading-none text-black" style={{ WebkitTextStroke: "1.5px #fff" }}>
                  {hud.best}
                </div>
              </div>
            </div>

            {/* stylized logo */}
            <div className="absolute left-1/2 top-[16%] -translate-x-1/2 select-none">
              <div
                className="font-bungee whitespace-nowrap italic text-[clamp(28px,7vw,68px)] leading-none tracking-tight"
                style={{
                  transform: "skewX(-12deg)",
                  background: "linear-gradient(180deg,#ffffff 0%,#e8f4ff 38%,#7fb7ff 52%,#ffffff 66%,#cfe6ff 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  filter:
                    "drop-shadow(0 0 2px #000) drop-shadow(3px 3px 0 #0a1b3d) drop-shadow(-2px -2px 0 #0a1b3d) drop-shadow(0 0 18px rgba(90,170,255,0.75))",
                }}
              >
                Star Vanisher...!!
              </div>
            </div>

            {/* danger target mode — bottom left */}
            <button
              type="button"
              onClick={() => { unlockAudio(); sfx.menuConfirm(); start(false, true); }}
              className="absolute bottom-4 left-4 -rotate-2 border-2 border-black bg-[#ff1f43] px-5 py-3 font-bungee text-lg tracking-wide text-white transition-transform hover:scale-110 hover:rotate-1"
              style={{ boxShadow: "6px 6px 0 #000, 0 0 24px rgba(255,31,67,0.7)" }}
            >
              DANGER TARGET MODE
            </button>

            {/* start — bottom right */}
            <button
              type="button"
              onClick={() => handlePlay()}
              className="absolute bottom-4 right-4 rotate-2 border-2 border-black bg-[#2b7bff] px-8 py-3 font-bungee text-2xl tracking-wide text-white transition-transform hover:scale-110 hover:-rotate-1"
              style={{ boxShadow: "6px 6px 0 #000, 0 0 24px rgba(43,123,255,0.65)" }}
            >
              START
            </button>
          </div>
        )}


        {/* first-time tutorial slides */}
        {tutSlide !== null && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#2a0011]/95 px-8 text-center">
            <div className="font-marker text-xs tracking-widest text-[#ffd0de]/70">
              HOW TO PLAY · {tutSlide + 1}/{TUT_SLIDES.length}
            </div>
            <div className="font-bungee text-2xl text-[#ffe23a] animate-fade-in">{TUT_SLIDES[tutSlide].title}</div>
            <p className="font-marker max-w-xl text-sm text-white/90 animate-fade-in">{TUT_SLIDES[tutSlide].body}</p>
            <button
              type="button"
              onClick={() => {
                sfx.menuConfirm();
                if (tutSlide < TUT_SLIDES.length - 1) setTutSlide(tutSlide + 1);
                else start(true);
              }}
              className="scribble-border bg-paper px-6 py-2 font-bungee text-ink hover:scale-105 transition-transform"
            >
              {tutSlide < TUT_SLIDES.length - 1 ? "NEXT" : "WATCH A DEMO"}
            </button>
            <button
              type="button"
              onClick={() => { markTutorialDone(); start(false); }}
              className="font-marker text-xs text-white/50 underline"
            >
              skip tutorial
            </button>
          </div>
        )}

        {/* demonstration banner + "Try it yourself!" flash */}
        {running && tutDemo && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute top-[9%] left-1/2 -translate-x-1/2 font-bungee text-sm text-[#ffe23a] drop-shadow">
              DEMONSTRATION — watch closely
            </div>
            {showTryIt && (
              <>
                <style>{`@keyframes svTryFlash { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }`}</style>
                <div
                  className="absolute inset-0 flex items-center justify-center font-bungee text-4xl md:text-5xl text-white"
                  style={{ animation: "svTryFlash 0.35s steps(1,end) infinite", textShadow: "0 0 18px rgba(255,60,120,0.9)" }}
                >
                  Try it yourself!
                </div>
              </>
            )}
          </div>
        )}


        {running && hud.over && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* faded black backdrop */}
            <div
              className="absolute inset-0 bg-black transition-opacity duration-500"
              style={{ opacity: failStage >= 1 && failStage < 2 ? 0.7 : 0 }}
            />
            {/* white screen */}
            <div
              className="absolute inset-0 bg-white transition-opacity duration-200"
              style={{ opacity: failStage >= 2 ? 1 : 0 }}
            />

            {failStage < 2 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <div
                  className="font-bungee text-4xl text-white transition-transform duration-700 ease-out"
                  style={{ transform: showFailPct ? "translateY(0)" : "translateY(200%)" }}
                >
                  {hud.lastPct.toFixed(1)}%
                </div>
              </div>
            )}


            {failStage >= 1 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-6 transition-opacity duration-200"
                style={{ opacity: failStage >= 2 ? 1 : 0 }}
              >
                <div
                  className="font-bungee text-7xl text-black transition-transform duration-500 ease-out"
                  style={{ transform: failStage >= 2 ? "translateY(0)" : "translateY(-300%)" }}
                >
                  FAIL
                </div>
                <div
                  className="font-bungee text-xl text-black/70 transition-opacity duration-500"
                  style={{ opacity: failStage >= 3 ? 1 : 0 }}
                >
                  + {hud.earned} T
                </div>
                <button
                  type="button"
                  onClick={() => start(false)}
                  className="pointer-events-auto scribble-border bg-paper px-6 py-3 font-bungee text-ink transition-all duration-500 ease-out hover:scale-105"
                  style={{
                    transform: failStage >= 3 ? "translateY(0)" : "translateY(300%)",
                    opacity: failStage >= 3 ? 1 : 0,
                  }}
                >
                  Retry?
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="font-marker text-[11px] text-ink/60 text-center max-w-xl">
        Points here will feed the shop later. Higher combos tighten the windows, shrink the stars and
        crank the explosions.
      </div>
    </div>
  );
}
