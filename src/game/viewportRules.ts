export function usesTouchControls(coarsePointer: boolean): boolean {
  return coarsePointer;
}

export function gameplayZoom(height: number, mayhem: boolean): number {
  return mayhem ? 1.2 : Math.max(1.15, height / 720);
}

export function clampCamera(position: number, worldSize: number, visibleSize: number): number {
  return Math.max(0, Math.min(position, Math.max(0, worldSize - visibleSize)));
}