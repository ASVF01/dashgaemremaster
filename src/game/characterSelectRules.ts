import type { CharacterId } from "@/game/character";

export const CHARACTER_SELECT_HOLD_MS = 3000;
export const CHARACTER_SELECT_CLOSE_MS = 700;
// Entry: both borders slide in and close together before the hold begins.
export const CHARACTER_SELECT_SHUT_MS = 850;
// Exit: the shutter animation is trimmed to match the clipped wall cues, so the
// whole leave transition ends about when the sounds do.
export const CHARACTER_SELECT_EXIT_CLOSE_MS = 300;
export const CHARACTER_SELECT_EXIT_OPEN_MS = 280;

export function characterPage(id: CharacterId): 1 | 2 {
  return id === "mmguy" || id === "green" ? 2 : 1;
}