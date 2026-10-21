export function usesTouchControls(coarsePointer: boolean): boolean {
  return coarsePointer;
}

// Ordinary levels keep the original 1:1 framing with only a hair of zoom, so
// the view never closes in on the player the way height-scaled zoom did.
export function gameplayZoom(height: number, mayhem: boolean): number {
  return mayhem ? 1.2 : 1.07;
}

export function clampCamera(
  position: number,
  worldSize: number,
  visibleSize: number,
  belowFraction = 0,
): number {
  const span = worldSize - visibleSize;
  // A view taller than the level cannot be scrolled: slide the window down so
  // less empty sky shows, while extended ground rendering fills what hangs
  // below the level (belowFraction of the extra view) — never past the level
  // top, so fullscreen cannot expose below-level void.
  if (span < 0) return Math.min(span + -span * belowFraction, 0);
  return Math.max(0, Math.min(position, span));
}
