// Pure timing rules for the Nicky (THE GIFTED) and AN-B hallway encounters.
export const NICKY_FLEE_MS = 2500;
export const ANB_STARE_MS = 3000;
/** AN-B breaches if she isn't stared down within this window. */
export const ANB_BREACH_MS = 12000;

export type EncounterView = "office" | "door" | "keyhole" | "hallway" | "storage" | "storageKeyhole" | "storageDoor";

/** While a hallway threat is active the player may only head toward the office.
 * Stepping back from the storage keyhole/door into storage counts as heading toward it. */
export function lockdownAllows(to: EncounterView, from?: EncounterView): boolean {
  if (to === "storage" && (from === "storageKeyhole" || from === "storageDoor")) return true;
  return to === "office" || to === "door" || to === "keyhole" || to === "hallway";
}

/** Nicky: peeking the keyhole kills instantly; outside the office when her timer ends kills. */
export function nickyOutcome(view: EncounterView, elapsedMs: number): "kill" | "leave" | "wait" {
  if (view === "keyhole") return "kill";
  if (elapsedMs < NICKY_FLEE_MS) return "wait";
  return view === "office" ? "leave" : "kill";
}

export function lookingAtAnb(view: EncounterView) {
  return view === "hallway" || view === "keyhole";
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
