const SLIDE_FRAMES = [1, 4, 3, 2] as const;

export function slideDustFrame(elapsed: number) {
  return SLIDE_FRAMES[Math.floor(Math.max(0, elapsed) / 0.055) % SLIDE_FRAMES.length];
}

export function slideDustSpread(elapsed: number) {
  const progress = Math.min(1, Math.max(0, elapsed) / 0.22);
  return 1 - Math.pow(1 - progress, 3);
}

export function slideDustAnchor(x: number, y: number, width: number, height: number, facing: number) {
  return { x: x + width / 2 - facing * 8, y: y + height + 2 };
}