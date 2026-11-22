import type { CharacterId } from "./character";

// Characters released before Old Timer keep the original rainbow invboi look.
const CLASSIC_INVBOI: ReadonlySet<CharacterId> = new Set(["stick", "green", "dasher", "shadow", "x3mode", "mmguy"]);

/** Old Timer and every character added after him get the golden aura instead of sparkles + rainbow trail. */
export function usesSaiyanAura(id: CharacterId): boolean {
  return !CLASSIC_INVBOI.has(id);
}

/** Draws a flaring golden energy aura centred on (cx, cy) for a body w×h. */
export function drawSaiyanAura(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, time: number) {
  const rx = w * 0.95;
  const ry = h * 0.78;
  const baseY = cy + h * 0.5;
  const spikes = 22;
  const pulse = 1 + Math.sin(time * 18) * 0.04;

  const flame = (scale: number, jag: number, seed: number) => {
    ctx.beginPath();
    for (let i = 0; i <= spikes * 2; i++) {
      const t = i / (spikes * 2);
      const a = Math.PI + t * Math.PI * 2; // start at bottom-left, sweep round
      const tip = i % 2 === 1;
      const up = Math.max(0, -Math.sin(a)); // taller spikes on top
      const flick = Math.sin(time * 22 + i * 1.7 + seed) * 0.5 + 0.5;
      const len = tip ? jag * (0.45 + up * 1.1) * (0.7 + flick * 0.6) : 0;
      const ex = Math.cos(a) * (rx * scale + len * 0.55);
      const ey = Math.sin(a) * (ry * scale) - len * (0.4 + up);
      const px = cx + ex * pulse;
      const py = cy + ey * pulse;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, Math.min(py, baseY + 6));
    }
    ctx.closePath();
  };

  ctx.save();
  // outer gold flame
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#f5c400";
  flame(1, h * 0.38, 0);
  ctx.fill();
  // brighter inner flame
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#ffe95a";
  flame(0.78, h * 0.22, 3.1);
  ctx.fill();
  // white-hot core
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ry * 0.75);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.6, "rgba(255,252,225,0.6)");
  g.addColorStop(1, "rgba(255,240,150,0)");
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.72, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  // occasional crackle arcs
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "#fffbd0";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    if (Math.sin(time * 7 + k * 2.3) < 0.6) continue;
    const a0 = time * 3 + k * 2.7;
    ctx.beginPath();
    let x = cx + Math.cos(a0) * rx * 0.6, y = cy + Math.sin(a0) * ry * 0.6;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (Math.random() - 0.5) * 12; y -= 4 + Math.random() * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
