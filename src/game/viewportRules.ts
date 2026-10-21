export function usesTouchControls(coarsePointer: boolean): boolean {
  return coarsePointer;
}

// Ordinary levels keep the original 1:1 framing with only a hair of zoom, so
// the view never closes in on the player the way height-scaled zoom did.
export function gameplayZoom(height: number, mayhem: boolean): number {
  return mayhem ? 1.2 : 1.07;
}

export function clampCamera(position: number, worldSize: number, visibleSize: number): number {
  const span = worldSize - visibleSize;
  // A view taller than the level cannot be scrolled: pin it so the floor sits
  // on the bottom edge and any slack appears above the level instead.
  if (span < 0) return span;
  return Math.max(0, Math.min(position, span));
}
