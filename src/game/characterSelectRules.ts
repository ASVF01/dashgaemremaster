import type { CharacterId } from "@/game/character";

export const CHARACTER_SELECT_HOLD_MS = 3000;
export const CHARACTER_SELECT_CLOSE_MS = 700;

export function characterPage(id: CharacterId): 1 | 2 {
  return id === "mmguy" ? 2 : 1;
}