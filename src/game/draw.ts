// Sketchy "drawn-by-hand" rendering helpers
const INK = "#141414";
const PAPER = "#f0ead6";

function jr(seed: number) {
  // tiny deterministic-ish jitter
  return (Math.sin(seed * 9301.123 + 49297.7) * 43758.5453) % 1;
}

export function sketchLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  width = 2.4, color = INK, wobble = 1.2
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const segs = Math.max(2, Math.floor(len / 10));
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const px = x1 + dx * t + (Math.random() - 0.5) * wobble;
    const py = y1 + dy * t + (Math.random() - 0.5) * wobble;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

export function sketchRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string | null, stroke = INK, lineW = 2.6, wobble = 1.4
) {
  if (fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    // jagged rect path
    const pts = [
      [x, y], [x + w * 0.3, y - 1], [x + w * 0.6, y + 1], [x + w, y],
      [x + w + 1, y + h * 0.4], [x + w - 1, y + h * 0.7], [x + w, y + h],
      [x + w * 0.6, y + h + 1], [x + w * 0.3, y + h - 1], [x, y + h],
      [x - 1, y + h * 0.6], [x + 1, y + h * 0.3],
    ];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // stroked sides (sketchy)
  sketchLine(ctx, x, y, x + w, y, lineW, stroke, wobble);
  sketchLine(ctx, x + w, y, x + w, y + h, lineW, stroke, wobble);
  sketchLine(ctx, x + w, y + h, x, y + h, lineW, stroke, wobble);
  sketchLine(ctx, x, y + h, x, y, lineW, stroke, wobble);
}

export function sketchCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fill: string | null, stroke = INK, lineW = 2.4, wobble = 1.2
) {
  const segs = 22;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const rr = r + (Math.random() - 0.5) * wobble;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.stroke();
  ctx.restore();
}

export function jaggedBolt(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, width = 3, segments = 8, deviation = 14
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const nx = -dy;
  const ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const off = (Math.random() - 0.5) * deviation;
    const px = x1 + dx * t + (nx / len) * off;
    const py = y1 + dy * t + (ny / len) * off;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export { INK, PAPER };
