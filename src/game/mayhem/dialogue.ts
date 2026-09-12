// MAYHEM dialogue system — data layer.
//
// A "script" is just an ordered list of lines. Anything that wants a character
// to talk in text form (intro cutscenes, keyhole warnings, floor arrivals,
// jumpscare taunts, endings) defines a script here and hands it to <DialogueBox>.

export type DialogueLine = {
  /** Name shown in the plate above the box. Omit for narration. */
  speaker?: string;
  /** The text itself. Kept short — long lines are hard to read on mobile. */
  text: string;
  /** HSL triplet (no hsl() wrapper) used for the speaker plate + text accent. */
  color?: string;
  /** ms per character. Lower = faster. Default 34. */
  speed?: number;
  /** Extra pause (ms) after the line finishes typing before auto-advance. */
  hold?: number;
  /** Auto-advance instead of waiting for input. */
  auto?: boolean;
  /** Rattle the box while this line types — for shouting / threats. */
  shake?: boolean;
  /** Optional portrait image URL (character face beside the text). */
  portrait?: string;
};

export type DialogueScript = {
  id: string;
  lines: DialogueLine[];
};

/** Palette for the voices we already know about. */
export const MAYHEM_VOICE = {
  narrator: "0 0% 78%",
  you: "190 90% 62%",
  she: "0 85% 58%",
  intercom: "45 90% 58%",
} as const;

const NARRATOR = MAYHEM_VOICE.narrator;

/**
 * Placeholder scripts. Text is easy to swap later — names of the four tower
 * threats aren't locked in yet, so nothing here references them directly.
 */
export const MAYHEM_SCRIPTS: Record<string, DialogueScript> = {
  intro: {
    id: "intro",
    lines: [
      { text: "The elevator stops moving at 3:04 AM.", color: NARRATOR, speed: 42, hold: 320 },
      { text: "Five floors above you. One window at the top.", color: NARRATOR, speed: 42, hold: 320 },
      { speaker: "INTERCOM", text: "Welcome to the night shift. Watch the halls. Don't open anything.", color: MAYHEM_VOICE.intercom },
      { speaker: "YOU", text: "...how long is the shift?", color: MAYHEM_VOICE.you },
      { speaker: "INTERCOM", text: "Until the light comes back.", color: MAYHEM_VOICE.intercom, hold: 420 },
      { speaker: "???", text: "I SEE YOU THROUGH THE KEYHOLE.", color: MAYHEM_VOICE.she, shake: true, speed: 26 },
      { text: "Floor 1. Go.", color: NARRATOR, speed: 46 },
    ],
  },
  keyholeWarning: {
    id: "keyholeWarning",
    lines: [
      { text: "Something is breathing on the other side of the door.", color: NARRATOR, speed: 40 },
      { text: "Stare through the keyhole until it leaves. Don't blink.", color: NARRATOR, speed: 40 },
    ],
  },
  redEyeWarning: {
    id: "redEyeWarning",
    lines: [
      { speaker: "???", text: "RED MEANS LOOK AWAY.", color: MAYHEM_VOICE.she, shake: true, speed: 24, hold: 260 },
    ],
  },
};
