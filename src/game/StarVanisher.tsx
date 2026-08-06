import { useEffect, useRef, useState } from "react";
import { sfx, unlockAudio } from "@/game/sfx";
import { activeBeamSkin, addTokens, getShop, hasAbility, subscribeShop, tokensForScore } from "@/game/shop";
import beamAsset from "@/assets/audio/beam.mp3.asset.json";
import exploseAsset from "@/assets/audio/explose1.mp3.asset.json";
import explose2Asset from "@/assets/audio/explose2.mp3.asset.json";
import countupAsset from "@/assets/audio/countup.mp3.asset.json";
import runBgmAsset from "@/assets/audio/StarVanisher_duh.ogg.asset.json";
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

type Judgement = "PERFECT" | "OKAY" | "MISS";
type Phase = "aim" | "fire" | "count" | "result" | "over";

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

function starPath(ctx: CanvasRenderingContext2D, s: Star, _time?: number) {
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
  ctx.closePath();
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
    const a = bgmRef.current;
    if (!a) return;
    if (m) { a.pause(); }
    else if (running && !hud.over) { pauseBgm(); a.volume = 0.3375; a.currentTime = 0; void a.play().catch(() => { /* noop */ }); }
    else if (running && hud.over) { a.volume = 0.10; void a.play().catch(() => { /* noop */ }); }
  }), [running, hud.over]);
  useEffect(() => () => { bgmRef.current?.pause(); resumeBgm(); }, []);


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
    st.star = makeStar(st.combo);
  };

  const start = () => {
    unlockAudio();
    sfx.menuConfirm();
    const bg0 = randColorSet();
    const st: State = {
      phase: "aim", t: 0, target: 50, fieldT: 0, fieldDir: 1, fieldSpeed: 0.7,
      lockedPct: 0, judgement: null, combo: 0, score: 0, shake: 0, flash: 0,
      hitstop: 0, beam: 0, star: null, destroyFrac: 0, particles: [], floatNums: [],
      comboPop: 0, countVal: 0, countStep: 0, countTimer: 0, countDone: false, countPop: 0,
      boomed: false, pendingMiss: false, reviveLeft: hasAbility("revive") ? 1 : 0,
      sightLeft: hasAbility("sight") ? 10 : 0,
      starsDone: -1, bg: bg0, streaks: makeStreaks(bg0),
    };

    newRound(st);
    stateRef.current = st;
    setHud((h) => ({ ...h, score: 0, combo: 0, over: false, newBest: false, earned: 0 }));
    setFailStage(0);
    setShowFailPct(false);
    setRunning(true);

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


  const fire = () => {
    const st = stateRef.current;
    if (!st || st.phase !== "aim" || !st.star) return;
    unlockAudio();
    const s = st.star;
    const fr = fieldRadius(st, s);
    const fc = fieldCenter(s);
    const pct = overlapPct(s.cx, s.cy, s.r, fc.x, fc.y, fr);
    const win = windows(st.combo);
    const diff = Math.abs(pct - st.target);
    const j: Judgement = diff <= win.perfect ? "PERFECT" : diff <= win.okay ? "OKAY" : "MISS";

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
      const gained = Math.round((j === "PERFECT" ? 1200 : 500) * (1 + acc) * (1 + st.combo * 0.22) * greed);
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
            } else {
              st.countVal = st.countStep;
              st.countPop = 0.55;
              playCountUp();
              const prog = st.countStep / total;
              st.countTimer = 0.024 + 0.17 * Math.pow(prog, 2.6);
            }
          }
        } else if (st.t > 0.94) {
          if (st.pendingMiss) finishMiss(st);
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

      // ---- draw ----
      ctx.save();
      const sh = st.shake;
      ctx.translate(rand(-sh, sh) * 0.5, rand(-sh, sh) * 0.5);

      // background: speed-streak void
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#3b0018");
      g.addColorStop(0.5, "#7a0026");
      g.addColorStop(1, "#2a0011");
      ctx.fillStyle = g;
      ctx.fillRect(-40, -40, W + 80, H + 80);

      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 26; i++) {
        const y = ((i * 61 + time * (120 + i * 9)) % (H + 60)) - 30;
        ctx.fillStyle = i % 2 ? "#ff87ad" : "#ffd0de";
        ctx.fillRect(0, y, W, 2 + (i % 3));
      }
      ctx.globalAlpha = 1;

      const s = st.star;
      if (s) {
        // star body
        ctx.save();
        const alive = 1 - (st.phase === "aim" ? 0 : st.destroyFrac * (st.lockedPct / 100));
        starPath(ctx, s, time);
        ctx.clip();
        const sg = ctx.createRadialGradient(s.cx - s.r * 0.3, s.cy - s.r * 0.35, s.r * 0.1, s.cx, s.cy, s.r * 1.2);
        sg.addColorStop(0, "#ff8fb4");
        sg.addColorStop(0.6, "#e8114f");
        sg.addColorStop(1, "#5c0020");
        ctx.fillStyle = sg;
        ctx.fillRect(s.cx - s.r * 1.4, s.cy - s.r * 1.4, s.r * 2.8, s.r * 2.8);
        // craters
        for (const c of s.craters) {
          ctx.beginPath();
          ctx.arc(s.cx + Math.cos(c.a) * s.r * c.d, s.cy + Math.sin(c.a) * s.r * c.d, s.r * c.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(80,0,25,0.55)";
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
        starPath(ctx, s, time);
        ctx.strokeStyle = "#ffd3e2";
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
          ctx.font = "bold 26px Bungee, system-ui, sans-serif";
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
        ctx.font = `bold ${f.size}px Bungee, system-ui, sans-serif`;
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
        ctx.font = "bold 74px Bungee, system-ui, sans-serif";
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
        ctx.font = "bold 78px Bungee, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 9;
        ctx.strokeStyle = "rgba(25,0,10,0.85)";
        ctx.fillStyle = j === "PERFECT" ? "#ffe23a" : j === "OKAY" ? "#8ef0ff" : "#ff2d5e";
        ctx.strokeText(j, 0, 0);
        ctx.fillText(j, 0, 0);
        if (j === "MISS" && Math.floor(time * 8) % 2 === 0) {
          ctx.font = "bold 42px Bungee, system-ui, sans-serif";
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
        ctx.font = "bold 40px Bungee, system-ui, sans-serif";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(25,0,10,0.85)";
        ctx.fillStyle = Math.abs(live - st.target) <= windows(st.combo).perfect ? "#ffe23a" : "#8ef0ff";
        ctx.strokeText(`${live.toFixed(1)}%`, s0.cx, s0.cy - s0.r - 34);
        ctx.fillText(`${live.toFixed(1)}%`, s0.cx, s0.cy - s0.r - 34);
        ctx.font = "bold 20px Bungee, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.strokeText(`TRUE SIGHT ${st.sightLeft} LEFT`, s0.cx, s0.cy - s0.r - 8);
        ctx.fillText(`TRUE SIGHT ${st.sightLeft} LEFT`, s0.cx, s0.cy - s0.r - 8);
        ctx.restore();
      }

      // left HUD: target call-out
      ctx.save();
      ctx.textAlign = "left";
      ctx.font = "bold 54px Bungee, system-ui, sans-serif";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(25,0,10,0.85)";
      ctx.fillStyle = "#ffe23a";
      ctx.strokeText(`${st.target}%`, 34, H - 60);
      ctx.fillText(`${st.target}%`, 34, H - 60);
      ctx.font = "bold 34px Bungee, system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText("Vanish!!", 34 + ctx.measureText(`${st.target}% `).width * 0.55, H - 60);
      ctx.fillText("Vanish!!", 34 + ctx.measureText(`${st.target}% `).width * 0.55, H - 60);

      // combo + score
      const cp = 1 + st.comboPop * 0.5;
      ctx.font = `bold ${Math.round(30 * cp)}px Bungee, system-ui, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(`x${st.combo}`, 34, 52);
      ctx.fillText(`x${st.combo}`, 34, 52);
      ctx.font = "bold 24px Bungee, system-ui, sans-serif";
      ctx.fillStyle = "#ffd0de";
      ctx.strokeText(`${st.score}`, 34, 84);
      ctx.fillText(`${st.score}`, 34, 84);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffe23a";
      ctx.strokeText(`BEST ${hsRef.current}`, W - 30, 52);
      ctx.fillText(`BEST ${hsRef.current}`, W - 30, 52);
      if (st.phase === "aim") {
        ctx.textAlign = "center";
        ctx.font = "bold 20px Bungee, system-ui, sans-serif";
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
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        <div className="font-marker text-3xl md:text-4xl text-ink -rotate-1">Star Vanisher...!!</div>
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
          onPointerDown={(e) => { e.preventDefault(); fire(); }}
        />

        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#2a0011]/85">
            <div className="font-bungee text-3xl text-[#ffe23a]">STAR VANISHER...!!</div>
            <div className="font-marker text-sm text-[#ffd0de]">BEST {hud.best}</div>
            <button
              type="button"
              onClick={start}
              className="scribble-border bg-paper px-6 py-3 font-bungee text-ink hover:scale-105 transition-transform"
            >
              START GRINDING
            </button>
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
                  onClick={start}
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
