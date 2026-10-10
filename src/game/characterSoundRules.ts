import type { CharacterId } from "./character";

// Only movement events are replaced; combat and other cues stay intact.
export const CHARACTER_ACTION_SOUNDS = [
  "jump", "land", "slide", "slideEnd", "step", "run", "skid",
  "mach", "superDash", "dash",
] as const;

export function usesCharacterActionSound(character: CharacterId, event: string): boolean {
  return character === "mmguy" && (CHARACTER_ACTION_SOUNDS as readonly string[]).includes(event);
}

export function stoneScrapeActive(character: CharacterId, onGround: boolean, speed: number, playing: boolean): boolean {
  return character === "mmguy" && onGround && Math.abs(speed) > 1 && playing;
}