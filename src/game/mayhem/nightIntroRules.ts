export const NIGHT_STATIC_MS = 500;
export const NIGHT_TITLE_ENTER_MS = 600;
export const NIGHT_TITLE_HOLD_MS = 3500;
export const NIGHT_TITLE_EXIT_MS = 600;
export const NIGHT_REVEAL_MS = 480;

export function canExitNightTitle(elapsed: number, assetsReady: boolean): boolean {
  return assetsReady && elapsed >= NIGHT_STATIC_MS + NIGHT_TITLE_ENTER_MS + NIGHT_TITLE_HOLD_MS;
}

// The room is already mounted underneath the Night card, so the player can
// turn their head from the moment the card appears instead of waiting for it
// to finish. Before the card (the tip screen) the gaze stays parked.
export function nightLookActive(nightReady: boolean, nightTitle: boolean): boolean {
  return nightReady || nightTitle;
}