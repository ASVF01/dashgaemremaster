import { PLAYER_H, PLAYER_W } from "./constants";
import { sketchLine, sketchRect, sketchCircle } from "./draw";
import { getSprite } from "./sprites";
import { BOX_PRESSES, EVIL_SPAWN_DELAY, exitPowered, nearbyBox, type EvilChaseState } from "./evilChaseRules";

export type EvilPalette = Record<"ink" | "eye" | "fog" | "ground" | "platform" | "edge" | "box" | "power" | "label" | "shadow", string>;
let palette: EvilPalette | undefined;
export function evilPalette(): EvilPalette {
  if (!palette) {
    const css = getComputedStyle(document.documentElement);
    palette = Object.fromEntries(["ink", "eye", "fog", "ground", "platform", "edge", "box", "power", "label", "shadow"].map(key => [key, css.getPropertyValue(`--evil-${key}`).trim()])) as EvilPalette;
  }
  return palette;
}
const silhouettes = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

function drawReflection(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, pose: EvilChaseState["pose"], time: number, alpha: number, eye: boolean) {
  const colors = evilPalette();
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(x + PLAYER_W / 2, y + PLAYER_H);
  ctx.scale(facing, 1);
  const sprite = getSprite(pose, Math.floor(time * 24));
  if (sprite) {
    let dark = silhouettes.get(sprite);
    if (!dark) {
      dark = document.createElement("canvas"); dark.width = sprite.width; dark.height = sprite.height;
      const g = dark.getContext("2d");
      if (g) {
        g.drawImage(sprite, 0, 0); g.globalCompositeOperation = "source-in";
        g.fillStyle = colors.ink; g.fillRect(0, 0, dark.width, dark.height);
        silhouettes.set(sprite, dark);
      }
    }
    const ratio = sprite.width / sprite.height;
    const wide = ratio > 1.1;
    const drawH = pose === "slide" ? PLAYER_W * 2.2 / ratio : wide ? PLAYER_W * 1.6 / ratio : PLAYER_H;
    const drawW = drawH * ratio;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = colors.fog; ctx.shadowBlur = eye ? 3 : 0;
    ctx.drawImage(dark ?? sprite, -drawW / 2, -drawH, drawW, drawH);
    ctx.shadowBlur = 0;
  } else {
    sketchCircle(ctx, 0, -45, 11, colors.ink, colors.fog, 2);
    sketchLine(ctx, 0, -33, 0, -15, 5, colors.ink);
    sketchLine(ctx, 0, -15, -12, 0, 5, colors.ink);
    sketchLine(ctx, 0, -15, 12, 0, 5, colors.ink);
  }
  if (eye) {
    const pulse = 0.6 + 0.4 * Math.pow(Math.sin(time * 7), 2);
    const ex = 4, ey = pose === "slide" || pose === "dive" ? -20 : -44;
    const radius = 8 + pulse * 3;
    ctx.fillStyle = colors.eye; ctx.shadowColor = colors.eye; ctx.shadowBlur = 8 + pulse * 8;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const r = i % 2 === 0 ? radius : radius * 0.22;
      const px = ex + Math.cos(a) * r, py = ey + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawEvilClone(ctx: CanvasRenderingContext2D, state: EvilChaseState, time: number) {
  if (!state.spawned) return;
  for (const trail of state.trail) drawReflection(ctx, trail.x, trail.y, trail.facing, trail.pose, time, trail.life * 0.85, false);
  drawReflection(ctx, state.x, state.y, state.facing, state.pose, time, 1, true);
}

export function drawEvilBoxes(ctx: CanvasRenderingContext2D, state: EvilChaseState, player: { x: number; y: number; w: number; h: number }) {
  const colors = evilPalette();
  const nearby = nearbyBox(state, player);
  state.boxes.forEach((box, i) => {
    const done = box.presses === BOX_PRESSES;
    const color = done ? colors.power : colors.label;
    sketchRect(ctx, box.x, box.y, 64, 64, colors.box, color, 3, 1.4);
    sketchRect(ctx, box.x + 9, box.y + 10, 46, 28, colors.ink, colors.edge, 2, 1);
    ctx.save(); ctx.textAlign = "center"; ctx.font = "18px 'Permanent Marker', cursive";
    ctx.fillStyle = color; ctx.fillText(done ? "OK" : `${box.presses}/5`, box.x + 32, box.y + 32);
    for (let n = 0; n < 5; n++) sketchLine(ctx, box.x + 9 + n * 10, box.y + 48, box.x + 14 + n * 10, box.y + 48, 4, n < box.presses ? colors.power : colors.edge, 0.5);
    ctx.font = "16px 'Permanent Marker', cursive";
    ctx.fillText(`#${i + 1}`, box.x + 32, box.y - 12);
    if (box === nearby) {
      ctx.font = "22px 'Permanent Marker', cursive";
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 5; ctx.lineJoin = "round";
      const text = `[R]  ${box.presses}/5`;
      ctx.strokeText(text, box.x + 32, box.y - 37); ctx.fillText(text, box.x + 32, box.y - 37);
    }
    ctx.restore();
  });
}

export function drawEvilExit(ctx: CanvasRenderingContext2D, state: EvilChaseState, goal: { x: number; y: number; w: number; h: number }) {
  const colors = evilPalette(), open = exitPowered(state);
  sketchRect(ctx, goal.x, goal.y, goal.w, goal.h, colors.ink, open ? colors.power : colors.eye, 4, 1.5);
  for (let i = 0; i < 5; i++) sketchLine(ctx, goal.x + 12, goal.y + 16 + i * 20, goal.x + goal.w - 12, goal.y + 16 + i * 20, 5, state.boxes[i]?.presses === 5 ? colors.power : colors.eye);
  ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = colors.label;
  ctx.font = "20px 'Permanent Marker', cursive";
  ctx.fillText(open ? "GET OUT!" : "LOCKED", goal.x + goal.w / 2, goal.y - 18); ctx.restore();
}

export function drawEvilAtmosphere(ctx: CanvasRenderingContext2D, state: EvilChaseState, width: number, height: number, time: number, player: { x: number; y: number; w: number; h: number }) {
  const colors = evilPalette();
  ctx.save();
  if (state.atmosphere > 0.01) {
    const radius = Math.hypot(width / 2, height / 2);
    const shadow = ctx.createRadialGradient(width / 2, height / 2, radius * 0.28, width / 2, height / 2, radius);
    shadow.addColorStop(0, "transparent"); shadow.addColorStop(0.65, colors.shadow); shadow.addColorStop(1, colors.shadow);
    ctx.globalAlpha = state.atmosphere * 0.76; ctx.fillStyle = shadow; ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  // Below the existing HUD, with a stable two-line readout.
  ctx.textAlign = "left"; ctx.font = "21px 'Permanent Marker', cursive";
  ctx.strokeStyle = colors.ink; ctx.lineWidth = 6; ctx.lineJoin = "round";
  ctx.fillStyle = colors.label;
  const complete = state.boxes.filter(b => b.presses === 5).length;
  const text = exitPowered(state) ? "EXIT POWERED" : `BOXES  ${complete}/5`;
  ctx.strokeText(text, 24, 160); ctx.fillText(text, 24, 160);
  ctx.font = "17px 'Permanent Marker', cursive";
  const notice = !state.spawned ? `HEAD START  ${Math.max(0, Math.ceil(EVIL_SPAWN_DELAY - time))}` : state.band === 4 ? "DON'T STOP." : "";
  ctx.fillStyle = state.band === 4 ? colors.eye : colors.label;
  ctx.strokeText(notice, 24, 186); ctx.fillText(notice, 24, 186);
  const box = nearbyBox(state, player);
  if (box) {
    ctx.textAlign = "center"; ctx.font = "24px 'Permanent Marker', cursive"; ctx.fillStyle = colors.label;
    const text = `[R]  ${box.presses}/5`;
    ctx.strokeText(text, width / 2, height - 120); ctx.fillText(text, width / 2, height - 120);
  }
  ctx.restore();
}