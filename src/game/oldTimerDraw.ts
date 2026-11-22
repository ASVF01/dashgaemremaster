// Old Timer — the original prototype stick figure, rebuilt with jointed,
// bouncy OvO-style limbs. Same parchment head, wobbly ink and moods.
import { sketchCircle, sketchLine, INK } from "./draw";
import { jawOpen, chompPhase } from "./oldTimerRules";

export type OldTimerPose = {
  w: number; h: number;
  time: number;
  speed: number; // |vx|
  vy: number;
  onGround: boolean;
  sliding: boolean;
  diving: boolean;
  dashing: boolean;
  hurt: boolean;
  mach: number;
  chompElapsed: number; // seconds since chomp started, -1 if none
  ink: string;
};

const PAPER_HEAD = "#fff8d6";

// Two-segment limb from (x,y): first segment angle a1, second a2 (radians, 0 = down).
function limb(ctx: CanvasRenderingContext2D, x: number, y: number, l1: number, l2: number, a1: number, a2: number, col: string, w = 2.8) {
  const kx = x + Math.sin(a1) * l1;
  const ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a2) * l2;
  const ey = ky + Math.cos(a2) * l2;
  sketchLine(ctx, x, y, kx, ky, w, col, 1.1);
  sketchLine(ctx, kx, ky, ex, ey, w, col, 1.1);
}

function face(ctx: CanvasRenderingContext2D, cx: number, cy: number, col: string, mood: "calm" | "intense" | "feral" | "hurt", jaw: number) {
  ctx.save();
  ctx.fillStyle = col;
  if (mood === "hurt") {
    sketchLine(ctx, cx - 6, cy - 5, cx - 2, cy - 1, 2, col, 0.4);
    sketchLine(ctx, cx - 6, cy - 1, cx - 2, cy - 5, 2, col, 0.4);
    sketchLine(ctx, cx + 3, cy - 5, cx + 7, cy - 1, 2, col, 0.4);
    sketchLine(ctx, cx + 3, cy - 1, cx + 7, cy - 5, 2, col, 0.4);
    sketchCircle(ctx, cx + 1, cy + 6, 2.5, null, col, 1.6, 0.4);
    ctx.restore();
    return;
  }
  // Iconic unibrow V.
  const browDrop = mood === "calm" ? 0 : mood === "intense" ? 2 : 3.5;
  sketchLine(ctx, cx - 8, cy - 6 - browDrop * 0.3, cx + 1, cy - 3 + browDrop * 0.4, 2.2, col, 0.5);
  sketchLine(ctx, cx + 1, cy - 3 + browDrop * 0.4, cx + 9, cy - 6 - browDrop * 0.3, 2.2, col, 0.5);
  const er = mood === "feral" ? 2.3 : 1.6;
  ctx.beginPath(); ctx.arc(cx - 3, cy - 0.5, er, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5, cy - 0.5, er, 0, Math.PI * 2); ctx.fill();
  if (mood !== "feral" && jaw <= 0) {
    sketchLine(ctx, cx - 2, cy + 6, cx + 5, cy + 6, 1.8, col, 0.4);
  } else {
    // Jagged-teeth grin; jaw separates during the chomp.
    const open = 2 + jaw * 12;
    const top = cy + 3;
    const bot = top + open;
    const half = 8 + jaw * 6;
    ctx.fillStyle = PAPER_HEAD;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + 1 - half, top);
    ctx.lineTo(cx + 1 + half, top);
    ctx.lineTo(cx + 1 + half * 0.75, bot + 3);
    ctx.lineTo(cx + 1 - half * 0.75, bot + 3);
    ctx.closePath();
    if (jaw > 0.2) { ctx.fillStyle = col; }
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAPER_HEAD;
    const step = (half * 2) / 5;
    for (let i = 0; i < 5; i++) {
      const x0 = cx + 1 - half + i * step;
      ctx.beginPath();
      ctx.moveTo(x0, top); ctx.lineTo(x0 + step / 2, top + 4 + jaw * 2); ctx.lineTo(x0 + step, top);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (jaw > 0.2) {
        ctx.beginPath();
        ctx.moveTo(x0, bot + 3); ctx.lineTo(x0 + step / 2, bot - 1 - jaw * 2); ctx.lineTo(x0 + step, bot + 3);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Draw in local player space (0..w, 0..h), already flipped for facing. */
export function drawOldTimer(ctx: CanvasRenderingContext2D, s: OldTimerPose) {
  const { w, h, time, speed, ink } = s;
  const chomp = chompPhase(s.chompElapsed);
  const jaw = s.chompElapsed >= 0 ? jawOpen(s.chompElapsed) : 0;
  const mood = s.hurt ? "hurt" : chomp !== "none" || s.mach >= 3 ? "feral" : speed > 60 || !s.onGround ? "intense" : "calm";
  const headR = 14;

  if (s.sliding || s.diving) {
    // Low, flat aerodynamic skid / torpedo.
    const hy = h - 14;
    const hx = w + 4;
    sketchLine(ctx, hx - headR, hy + 2, -6, hy + 4, 3, ink, 1.2);
    if (s.diving) {
      limb(ctx, hx - headR - 2, hy, 9, 9, Math.PI * 0.55, Math.PI * 0.6, ink, 2.6);
    } else {
      limb(ctx, hx - headR - 4, hy + 2, 9, 8, -Math.PI * 0.3, -Math.PI * 0.6, ink, 2.6);
    }
    limb(ctx, -4, hy + 4, 10, 9, -Math.PI * 0.45, -Math.PI * 0.55, ink);
    limb(ctx, -2, hy + 4, 10, 9, -Math.PI * 0.6, -Math.PI * 0.4, ink);
    sketchCircle(ctx, hx, hy - 4, headR, PAPER_HEAD, ink, 2.6, 1.2);
    face(ctx, hx, hy - 4, ink, s.diving ? "intense" : "feral", 0);
    return;
  }

  const running = s.onGround && speed > 60;
  const runRate = 9 + s.mach * 2.5;
  const ph = time * runRate;
  // Forward lean grows with speed (OvO tilt) and the chomp lunge.
  let lean = s.onGround ? Math.min(0.42, speed / 1400) : 0.12;
  if (chomp === "windup") lean = -0.25;
  if (chomp === "lunge") lean = 0.6;
  const bob = running ? Math.abs(Math.sin(ph)) * -3 : s.onGround ? Math.sin(time * 2.5) * 0.8 : 0;

  const hipX = w / 2;
  const hipY = h - 22 + bob;
  const torso = 20;
  const neckX = hipX + Math.sin(lean) * torso;
  const neckY = hipY - Math.cos(lean) * torso;
  const headX = neckX + Math.sin(lean) * (headR - 2);
  const headY = neckY - Math.cos(lean) * (headR - 2);

  // Legs.
  if (running) {
    const a = Math.sin(ph) * 0.9;
    const b = Math.sin(ph + Math.PI) * 0.9;
    limb(ctx, hipX, hipY, 11, 11, a, a - Math.max(0, Math.cos(ph)) * 1.2, ink);
    limb(ctx, hipX, hipY, 11, 11, b, b - Math.max(0, Math.cos(ph + Math.PI)) * 1.2, ink);
  } else if (!s.onGround) {
    if (s.vy < 0) { // rising: knees tucked
      limb(ctx, hipX, hipY, 10, 10, 1.3, -0.2, ink);
      limb(ctx, hipX, hipY, 10, 10, 0.7, -0.5, ink);
    } else { // falling: legs trail
      limb(ctx, hipX, hipY, 11, 11, 0.35, 0.1, ink);
      limb(ctx, hipX, hipY, 11, 11, -0.35, -0.6, ink);
    }
  } else if (chomp === "lunge") {
    limb(ctx, hipX, hipY, 11, 11, 0.6, 0.2, ink);
    limb(ctx, hipX, hipY, 11, 11, -0.8, -0.4, ink);
  } else {
    limb(ctx, hipX, hipY, 11, 11, 0.22, 0.12, ink);
    limb(ctx, hipX, hipY, 11, 11, -0.22, -0.12, ink);
  }

  // Spine.
  sketchLine(ctx, hipX, hipY, neckX, neckY, 3, ink, 1.1);

  // Arms from the shoulder (a bit below the neck).
  const shX = hipX + Math.sin(lean) * (torso - 4);
  const shY = hipY - Math.cos(lean) * (torso - 4);
  if (chomp !== "none") {
    // Arms flung back for the bite.
    limb(ctx, shX, shY, 9, 9, -1.9, -1.4, ink, 2.6);
    limb(ctx, shX, shY, 9, 9, -2.2, -1.8, ink, 2.6);
  } else if (s.dashing) {
    limb(ctx, shX, shY, 9, 9, -1.6, -1.5, ink, 2.6);
    limb(ctx, shX, shY, 9, 9, -1.3, -1.2, ink, 2.6);
  } else if (running) {
    const a = Math.sin(ph + Math.PI) * 1.1;
    const b = Math.sin(ph) * 1.1;
    limb(ctx, shX, shY, 9, 8, a, a + 1.3, ink, 2.6);
    limb(ctx, shX, shY, 9, 8, b, b + 1.3, ink, 2.6);
  } else if (!s.onGround) {
    const flap = s.vy > 0 ? Math.sin(time * 26) * 0.4 : 0;
    limb(ctx, shX, shY, 11, 10, 1.9 + flap, 2.5 + flap, ink, 2.6);
    limb(ctx, shX, shY, 11, 10, -1.9 - flap, -2.5 - flap, ink, 2.6);
  } else {
    const sway = Math.sin(time * 2.5) * 0.06;
    limb(ctx, shX, shY, 9, 9, 0.55 + sway, 0.3, ink, 2.6);
    limb(ctx, shX, shY, 9, 9, -0.55 - sway, -0.3, ink, 2.6);
  }

  sketchCircle(ctx, headX, headY, headR, PAPER_HEAD, ink, 2.6, 1.2);
  face(ctx, headX + 1, headY, ink, mood, jaw);

  // Comic bite impact lines at the snap.
  if (chomp === "lunge" && jaw === 0) {
    for (let i = -2; i <= 2; i++) {
      const ang = i * 0.35;
      const x0 = headX + headR + 4;
      sketchLine(ctx, x0 + Math.cos(ang) * 4, headY + 4 + Math.sin(ang) * 4, x0 + Math.cos(ang) * 16, headY + 4 + Math.sin(ang) * 16, 2.2, ink, 0.6);
    }
  }
}
