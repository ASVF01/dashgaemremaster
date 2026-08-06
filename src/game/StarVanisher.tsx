import { useEffect, useRef, useState } from "react";
import { sfx, unlockAudio } from "@/game/sfx";
import beamAsset from "@/assets/audio/beam.mp3.asset.json";
import exploseAsset from "@/assets/audio/explose1.mp3.asset.json";

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


// STAR VANISHER...!! — one-click point grinding mini game.
// The player must vanish exactly the requested percentage of the star:
// a green "vanish field" pulses in size, one click fires the beam and
// whatever slice of the star the field covered is what gets destroyed.

const W = 960;
const H = 540;
const HS_KEY = "dashgaem_starvanisher_hs_v1";

type Judgement = "PERFECT" | "OKAY" | "MISS";
type Phase = "aim" | "fire" | "result" | "over";

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  kind: "smoke" | "spark" | "line";
  angle?: number;
};

type Star = {
  cx: number; cy: number; r: number;
  seed: number;
  wobble: number;      // shape complexity
  craters: { a: number; d: number; r: number }[];
};

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
};

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

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
    wobble: Math.min(0.16, 0.02 + combo * 0.006),
    craters,
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
  return {
    perfect: 3.2 * (1 - tighten),
    okay: 8.5 * (1 - tighten),
  };
}

function starPath(ctx: CanvasRenderingContext2D, s: Star, time: number) {
  const segs = 46;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const w = 1 + Math.sin(a * 5 + s.seed) * s.wobble + Math.sin(a * 9 - time * 1.4 + s.seed) * s.wobble * 0.6;
    const x = s.cx + Math.cos(a) * s.r * w;
    const y = s.cy + Math.sin(a) * s.r * w;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export default function StarVanisher() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<State | null>(null);
  const [running, setRunning] = useState(false);
  const [hud, setHud] = useState({ score: 0, combo: 0, best: 0, over: false, lastScore: 0, newBest: false });
  const hsRef = useRef(0);

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
    st.fieldSpeed = 0.62 + Math.min(1.5, st.combo * 0.075);
    st.lockedPct = 0;
    st.judgement = null;
    st.beam = 0;
    st.destroyFrac = 0;
    st.star = makeStar(st.combo);
  };

  const start = () => {
    unlockAudio();
    sfx.menuConfirm();
    const st: State = {
      phase: "aim", t: 0, target: 50, fieldT: 0, fieldDir: 1, fieldSpeed: 0.7,
      lockedPct: 0, judgement: null, combo: 0, score: 0, shake: 0, flash: 0,
      hitstop: 0, beam: 0, star: null, destroyFrac: 0, particles: [], floatNums: [],
      comboPop: 0,
    };
    newRound(st);
    stateRef.current = st;
    setHud((h) => ({ ...h, score: 0, combo: 0, over: false, newBest: false }));
    setRunning(true);
  };

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

    st.lockedPct = pct;
    st.judgement = j;
    st.phase = "fire";
    st.t = 0;
    st.beam = 0.32;
    st.hitstop = 0.12;
    st.flash = 1;
    st.shake = 14 + Math.min(26, st.combo * 1.6);

    const intensity = Math.min(2, 0.8 + st.combo * 0.08);
    playBeam();
    window.setTimeout(playExplosion, 90);


    // explosion particles
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

    if (j !== "MISS") {
      st.floatNums.push({
        x: s.cx, y: s.cy - s.r - 20, text: `${pct.toFixed(1)}%`,
        life: 1.1, color: "#ffb03a", size: 74,
      });
    }

    if (j === "MISS") {
      sfx.fatalHit();
      st.phase = "over";
      const newBest = st.score > hsRef.current;
      if (newBest) {
        hsRef.current = st.score;
        try { localStorage.setItem(HS_KEY, String(st.score)); } catch { /* noop */ }
      }
      setHud({ score: st.score, combo: st.combo, best: hsRef.current, over: true, lastScore: st.score, newBest, lastPct: pct });
    } else {
      const acc = Math.max(0, 1 - diff / win.okay);
      const gained = Math.round((j === "PERFECT" ? 1200 : 500) * (1 + acc) * (1 + st.combo * 0.22));
      st.score += gained;
      st.combo += 1;
      st.comboPop = 1;
      sfx.enemyKill();
      st.floatNums.push({
        x: s.cx, y: s.cy + 40, text: `+${gained}`,
        life: 0.9, color: "#7dffb0", size: 34,
      });
      setHud((h) => ({ ...h, score: st.score, combo: st.combo }));
    }
  };

  const fieldCenter = (s: Star) => ({ x: s.cx - s.r * 0.55, y: s.cy });
  const fieldRadius = (st: State, s: Star) => {
    const eased = 0.5 - Math.cos(st.fieldT * Math.PI) / 2;
    return s.r * (0.35 + eased * 1.35);
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
      if (st.phase === "aim") {
        st.fieldT += st.fieldDir * st.fieldSpeed * dt;
        if (st.fieldT > 1) { st.fieldT = 1; st.fieldDir = -1; }
        if (st.fieldT < 0) { st.fieldT = 0; st.fieldDir = 1; }
      } else if (st.phase === "fire") {
        st.destroyFrac = Math.min(1, st.destroyFrac + dt * 5);
        if (st.t > 0.55) { st.phase = "result"; st.t = 0; }
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

        // beam
        if (st.beam > 0) {
          const k = st.beam / 0.32;
          const bh = (28 + st.combo * 3) * (0.5 + k);
          ctx.globalAlpha = 0.35 + k * 0.65;
          const bg = ctx.createLinearGradient(0, 0, s.cx, 0);
          bg.addColorStop(0, "#ffffff");
          bg.addColorStop(1, "#ff4d86");
          ctx.fillStyle = bg;
          ctx.fillRect(40, s.cy - bh / 2, s.cx - 40, bh);
          ctx.fillStyle = "#ffffff";
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

      // judgement text
      if (st.judgement && (st.phase === "fire" || st.phase === "result" || st.phase === "over")) {
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#2a0011]/85">
            <div className="font-bungee text-4xl text-[#ff2d5e]">RUN OVER</div>
            <div className="font-bungee text-2xl text-[#ffffff]">SCORE {hud.lastScore}</div>
            <div className="font-marker text-sm text-[#ffd0de]">COMBO REACHED x{hud.combo}</div>
            {hud.newBest && (
              <div className="font-bungee text-xl text-[#ffe23a] animate-jitter">NEW HIGH SCORE!!</div>
            )}
            <button
              type="button"
              onClick={start}
              className="scribble-border bg-paper px-6 py-3 font-bungee text-ink hover:scale-105 transition-transform mt-2"
            >
              GO AGAIN
            </button>
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
