import { useEffect, useMemo, useRef } from "react";
import { buildLevel, type LevelId } from "@/game/level";

// Low-res "autoplay" of the level: a tiny runner sprints through the real
// level geometry, rendered at 160x90 and upscaled with nearest-neighbour.
const W = 160, H = 90, ZOOM = 0.09;

const PALETTES: [string, string, string, string, string][] = [
  // sky top, sky bottom, ground, hazard, runner
  ["#1a1030", "#3b2060", "#e8e0d0", "#ff3b6b", "#ffffff"],
  ["#0d1b2a", "#1b3a5a", "#d8e8f0", "#ff6b3b", "#ffe14d"],
  ["#200a14", "#5a1030", "#f0d8e0", "#ffd11a", "#ffffff"],
  ["#0a1a10", "#1c4a2a", "#e0f0d0", "#ff3b9a", "#ffffff"],
];

export default function LevelPreviewPixel({ id, locked }: { id: LevelId; locked?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lv = useMemo(() => { try { return buildLevel(id); } catch { return null; } }, [id]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let raf = 0, last = performance.now(), x = lv?.spawn.x ?? 0, y = lv?.spawn.y ?? 0, vy = 0, t = 0;
    const pal = PALETTES[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTES.length];
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // 5-bit-ish banded sky
      for (let b = 0; b < 6; b++) { ctx.fillStyle = b % 2 ? pal[1] : pal[0]; ctx.fillRect(0, (b * H) / 6, W, H / 6 + 1); }
      if (locked || !lv) {
        for (let i = 0; i < 260; i++) { ctx.fillStyle = Math.random() < 0.5 ? "#000" : "#2a2a2a"; ctx.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 2, 2); }
        ctx.fillStyle = "#ff4f9a"; const cx = W / 2, cy = H / 2 + Math.round(Math.sin(t * 3) * 2);
        for (const [dx, dy, w] of [[-6, -4, 5], [1, -4, 5], [-7, -2, 14], [-6, 0, 12], [-4, 2, 8], [-2, 4, 4]] as const) ctx.fillRect(cx + dx, cy + dy, w, 2);
        raf = requestAnimationFrame(frame); return;
      }
      // autoplay: run right, snap to ground under feet, hop over gaps
      x += 900 * dt;
      if (x > lv.goal.x || x > lv.width) { x = lv.spawn.x; y = lv.spawn.y; vy = 0; }
      const under = lv.platforms.filter(p => x >= p.x && x <= p.x + p.w && p.y >= y - 120).sort((a, b) => a.y - b.y)[0];
      vy += 2600 * dt; y += vy * dt;
      if (under && y >= under.y) { y = under.y; vy = 0; if (Math.random() < 0.02) vy = -900; }
      if (!under && vy >= 0 && y > lv.height) { vy = -1100; y = lv.height; }
      const camX = x - W * 0.35 / ZOOM, camY = y - H * 0.6 / ZOOM;
      const sx = (wx: number) => Math.round((wx - camX) * ZOOM), sy = (wy: number) => Math.round((wy - camY) * ZOOM);
      ctx.fillStyle = pal[2];
      for (const p of lv.platforms) { const a = sx(p.x), b = sx(p.x + p.w); if (b < 0 || a > W) continue; ctx.fillRect(a, sy(p.y), Math.max(1, b - a), Math.max(2, Math.round(p.h * ZOOM))); }
      ctx.fillStyle = pal[3];
      for (const h of lv.hazards) { const a = sx(h.x); if (a < -4 || a > W) continue; ctx.fillRect(a, sy(h.y), Math.max(2, Math.round(h.w * ZOOM)), Math.max(2, Math.round(h.h * ZOOM))); }
      ctx.fillStyle = "#000";
      for (const e of lv.enemies) { const a = sx(e.x); if (a < -4 || a > W) continue; ctx.fillRect(a, sy(e.y), 3, 3); }
      ctx.fillStyle = pal[4];
      const gx = sx(lv.goal.x); if (gx > -4 && gx < W) { ctx.fillRect(gx, sy(lv.goal.y), 1, 8); ctx.fillRect(gx + 1, sy(lv.goal.y), 4, 3); }
      // runner: 3x5 pixel stick with flickering legs
      const rx = sx(x), ry = sy(y), leg = Math.floor(t * 14) % 2;
      ctx.fillRect(rx - 1, ry - 7, 3, 3); ctx.fillRect(rx, ry - 4, 1, 2);
      ctx.fillRect(rx - 1 + leg, ry - 2, 1, 2); ctx.fillRect(rx + 1 - leg, ry - 2, 1, 2);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lv, id, locked]);

  return <canvas ref={ref} width={W} height={H} className="pf-pixel" aria-hidden="true" />;
}
