import type { CharacterId } from "./character";

// Characters released before Old Timer keep the original rainbow invboi look.
const CLASSIC_INVBOI: ReadonlySet<CharacterId> = new Set(["stick", "green", "dasher", "shadow", "x3mode", "mmguy"]);

/** Old Timer and every character added after him get the golden aura instead of sparkles + rainbow trail. */
export function usesSaiyanAura(id: CharacterId): boolean {
  return !CLASSIC_INVBOI.has(id);
}

/** Minimal aura: one thin gold flame outline with a faint fill. `power` 0..1 grows it in. */
export function drawSaiyanAura(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, time: number, power = 1) {
  if (power <= 0) return;
  const rx = w * 0.85 * (0.6 + 0.4 * power);
  const ry = h * 0.62 * (0.6 + 0.4 * power);
  const spikes = 7;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const a = Math.PI + (i / (spikes * 2)) * Math.PI * 2;
    const up = Math.max(0, -Math.sin(a));
    const tip = i % 2 === 1;
    const flick = 0.75 + 0.25 * Math.sin(time * 14 + i * 2.1);
    const len = tip ? h * 0.32 * up * flick * power : 0;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry - len;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.18 * power;
  ctx.fillStyle = "#ffd84a";
  ctx.fill();
  ctx.globalAlpha = 0.9 * power;
  ctx.strokeStyle = "#f2b800";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}
