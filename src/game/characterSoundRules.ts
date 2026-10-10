import type { CharacterId } from "./character";

// Only player events are replaced: menus, ambience, and boss cues stay intact.
export const CHARACTER_ACTION_SOUNDS = [
  "jump", "land", "slide", "slideEnd", "step", "run", "skid",
  "parryStart", "parryHit", "hit", "chaserHit", "fatalHit", "enemyKill",
  "pickup", "shoot", "win", "die", "glassShatter", "mach", "superDash",
  "dash", "spawnWhoosh", "laserStart",
] as const;

export function usesCharacterActionSound(character: CharacterId, event: string): boolean {
  return character === "mmguy" && (CHARACTER_ACTION_SOUNDS as readonly string[]).includes(event);
}