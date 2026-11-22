// Old Timer's Super Saiyan transformation timeline (pure, testable).
export const SSJ_CHARGE = 1.3; // charging stance + push-in, synced to the "who is" cue
export const SSJ_SCREAM = 0.7; // scream pose + horizontal shake after the snap
/** Seconds the transformed state holds before it powers itself down. */
export const SSJ_DURATION = 20;

/** True once the powered state has held long enough to end. */
export function ssjExpired(elapsed: number): boolean {
  return elapsed >= SSJ_DURATION;
}

export type SsjPhase = "none" | "charge" | "scream" | "done";

export function ssjPhase(t: number): SsjPhase {
  if (t < 0) return "none";
  if (t < SSJ_CHARGE) return "charge";
  if (t < SSJ_CHARGE + SSJ_SCREAM) return "scream";
  return "done";
}

/** Extra camera zoom: eases in during the charge, then snaps past 1 and settles. */
export function ssjZoom(t: number): number {
  const ph = ssjPhase(t);
  if (ph === "charge") { const k = t / SSJ_CHARGE; return 1 + 0.45 * k * k; }
  if (ph === "scream") { const s = t - SSJ_CHARGE; return 1 - 0.1 * Math.exp(-s * 9) * Math.cos(s * 30); }
  return 1;
}

/** Horizontal shake offset in px (scream only), decaying. */
export function ssjShakeX(t: number): number {
  if (ssjPhase(t) !== "scream") return 0;
  const s = t - SSJ_CHARGE;
  return Math.sin(s * 95) * 5 * (1 - s / SSJ_SCREAM);
}
