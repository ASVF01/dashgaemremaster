// Pure timing rules for the Nicky (THE GIFTED) and AN-B hallway encounters.
export const NICKY_FLEE_MS = 2500;
/** Nicky only kills after being stared at (hallway or keyhole) this long. */
export const NICKY_STARE_KILL_MS = 2500;
export const ANB_STARE_MS = 3000;
/** AN-B breaches if she isn't stared down within this window. */
export const ANB_BREACH_MS = 12000;
/** Length of the "enemy in hall" cue heard from inside the office. */
export const HALL_ENTRY_MS = 5100;

export type EncounterView = "office" | "door" | "keyhole" | "hallway" | "storage" | "storageKeyhole" | "storageDoor";

/** THE DOOR (and its keyhole) are sub-rooms of the office. */
export function inOfficeRooms(view: EncounterView) {
  return view === "office" || view === "door" || view === "keyhole";
}

/** While a hallway threat is active the player may only head toward the office.
 * Once inside the office rooms, they stay sealed in until the threat leaves.
 * Stepping back from the storage keyhole/door into storage counts as heading toward it. */
export function lockdownAllows(to: EncounterView, from?: EncounterView): boolean {
  if (from && inOfficeRooms(from)) return inOfficeRooms(to);
  if (to === "storage" && (from === "storageKeyhole" || from === "storageDoor")) return true;
  return inOfficeRooms(to) || to === "hallway";
}

export function staringAtThreat(view: EncounterView) {
  return view === "hallway" || view === "keyhole";
}

/** Nicky kills only after 2.5s of staring; she leaves once the player waits inside the office rooms without staring. */
export function nickyOutcome(view: EncounterView, elapsedMs: number, staredMs = 0): "kill" | "leave" | "wait" {
  if (staredMs >= NICKY_STARE_KILL_MS) return "kill";
  if (elapsedMs >= NICKY_FLEE_MS && inOfficeRooms(view) && !staringAtThreat(view)) return "leave";
  return "wait";
}

export function lookingAtAnb(view: EncounterView) {
  return staringAtThreat(view);
}

/** The run-away cue plays when a threat leaves while the player is in the hallway or office rooms. */
export function hearsRunAway(view: EncounterView) {
  return view === "hallway" || inOfficeRooms(view);
}

export function anbOutcome(staredMs: number, elapsedMs: number): "stun" | "breach" | "wait" {
  if (staredMs >= ANB_STARE_MS) return "stun";
  if (elapsedMs >= ANB_BREACH_MS) return "breach";
  return "wait";
}

/** Tip screen per night: Night 1 → tip 3 or 4, Night 2 → tip 1 or 2, otherwise any. */
export function tipsForNight(night: number): number[] {
  if (night === 1) return [3, 4];
  if (night === 2) return [1, 2];
  return [1, 2, 3, 4];
}
