import { type HeartBoss, HEART_MAX_HP, ARENA_W, GROUND_Y } from "./heartBossRules";

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, wob = 0) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5 + wob, cy + s * 0.1, cx - s * 0.9, cy - s * 1.0, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.0, cx + s * 1.5 - wob, cy + s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}
function grad(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
  g.addColorStop(0, "#ff8a3d"); g.addColorStop(0.5, "#ff3d8b"); g.addColorStop(1, "#8b5cff");
  return g;
}

/** Soft gradient sky behind the arena (world space). */
export function drawHeartBackdrop(ctx: CanvasRenderingContext2D, camX: number, viewW: number, viewH: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, "#1a0f2e"); g.addColorStop(0.6, "#3a1240"); g.addColorStop(1, "#5a1a3a");
  ctx.fillStyle = g; ctx.fillRect(camX - 50, -400, viewW + 100, viewH + 800);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 14; i++) {
    const x = (i * 137) % ARENA_W, y = 80 + ((i * 89 + t * 20) % 420);
    ctx.fillStyle = grad(ctx, x, y, 12); heartPath(ctx, x, y, 10); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawHeartBoss(ctx: CanvasRenderingContext2D, b: HeartBoss) {
  // beams
  for (const bm of b.beams) {
    if (bm.t < 0) continue;
    if (bm.t < bm.warn) {
      ctx.strokeStyle = `rgba(255,61,139,${0.3 + 0.5 * Math.abs(Math.sin(bm.t * 20))})`;
      ctx.setLineDash([18, 12]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, bm.y); ctx.lineTo(ARENA_W, bm.y); ctx.stroke(); ctx.setLineDash([]);
    } else {
      const g = ctx.createLinearGradient(0, 0, ARENA_W, 0);
      g.addColorStop(0, "#ff8a3d"); g.addColorStop(0.5, "#ff3d8b"); g.addColorStop(1, "#8b5cff");
      ctx.fillStyle = g; ctx.fillRect(0, bm.y - 18, ARENA_W, 36);
      ctx.fillStyle = "#fff"; ctx.fillRect(0, bm.y - 5, ARENA_W, 10);
    }
  }
  // rings
  for (const rg of b.rings) {
    ctx.strokeStyle = "#ff3d8b"; ctx.lineWidth = 6;
    for (const dir of [-1, 1]) {
      const x = rg.x + dir * rg.radius;
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.quadraticCurveTo(x + dir * 8, GROUND_Y - 34, x, GROUND_Y - 40); ctx.stroke();
    }
  }
  // shots
  for (const s of b.shots) {
    if (s.kind === "heart") { ctx.fillStyle = grad(ctx, s.x, s.y, s.r); heartPath(ctx, s.x, s.y, s.r); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); continue; }
    ctx.font = "bold 14px monospace"; const w = ctx.measureText(s.label ?? "").width + 20;
    ctx.fillStyle = s.reflected ? "#fff34a" : "#ffffff";
    ctx.beginPath(); ctx.roundRect(s.x - w / 2, s.y - 15, w, 30, 15); ctx.fill();
    ctx.strokeStyle = s.reflected ? "#ff8a3d" : "#ff3d8b"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#1a0f2e"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s.label ?? "", s.x, s.y + 1);
  }
  // the heart
  const pulse = 1 + Math.sin(b.t * (b.attack ? 9 : 4)) * 0.06;
  const dying = b.defeated ? Math.max(0, 1 - b.defeatT / 1.6) : 1;
  if (dying <= 0) return;
  const s = 90 * pulse * dying;
  ctx.save();
  ctx.globalAlpha = dying;
  ctx.shadowColor = "#ff3d8b"; ctx.shadowBlur = 40;
  ctx.fillStyle = b.hurtFlash > 0 ? "#ffffff" : grad(ctx, b.x, b.y, s);
  heartPath(ctx, b.x, b.y, s, Math.sin(b.t * 3) * 6); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = "#1a0f2e"; ctx.lineWidth = 5; ctx.stroke();
  if (b.defeated) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, b.y - s * 0.35); ctx.lineTo(b.x - 14, b.y); ctx.lineTo(b.x + 10, b.y + 20); ctx.lineTo(b.x, b.y + s * 0.9); ctx.stroke(); }
  // face: two dot eyes + mood mouth
  const angry = b.attack !== null;
  ctx.fillStyle = "#1a0f2e";
  ctx.beginPath(); ctx.arc(b.x - 24, b.y - 4, 7, 0, Math.PI * 2); ctx.arc(b.x + 24, b.y - 4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.beginPath();
  if (angry) { ctx.moveTo(b.x - 38, b.y - 22); ctx.lineTo(b.x - 14, b.y - 14); ctx.moveTo(b.x + 38, b.y - 22); ctx.lineTo(b.x + 14, b.y - 14); ctx.moveTo(b.x - 16, b.y + 30); ctx.quadraticCurveTo(b.x, b.y + 18, b.x + 16, b.y + 30); }
  else { ctx.moveTo(b.x - 16, b.y + 18); ctx.quadraticCurveTo(b.x, b.y + 32, b.x + 16, b.y + 18); }
  ctx.stroke();
  ctx.restore();
}

/** Screen-space HP bar. */
export function drawHeartHud(ctx: CanvasRenderingContext2D, b: HeartBoss, w: number) {
  const bw = Math.min(520, w - 80), x = (w - bw) / 2, y = 110;
  ctx.fillStyle = "#1a0f2e"; ctx.fillRect(x - 4, y - 4, bw + 8, 24);
  const g = ctx.createLinearGradient(x, 0, x + bw, 0);
  g.addColorStop(0, "#ff8a3d"); g.addColorStop(0.5, "#ff3d8b"); g.addColorStop(1, "#8b5cff");
  ctx.fillStyle = g; ctx.fillRect(x, y, bw * (b.hp / HEART_MAX_HP), 16);
  ctx.fillStyle = "#fff"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText("THE HEARTBREAKER", w / 2, y - 8);
}
