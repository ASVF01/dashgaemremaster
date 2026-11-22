// Old Timer — Feral Chomp timing rules (pure, testable).
export const CHOMP_WINDUP = 0.08;
export const CHOMP_LUNGE = 0.15;
export const CHOMP_CHEW = 0.12;
export const CHOMP_TOTAL = CHOMP_WINDUP + CHOMP_LUNGE + CHOMP_CHEW;
export const CHOMP_COOLDOWN = 1.2;
export const CHOMP_LUNGE_SPEED = 1300;
export const CHOMP_REACH = 70;

export type ChompPhase = "none" | "windup" | "lunge" | "chew";

/** `elapsed` = seconds since B was pressed. */
export function chompPhase(elapsed: number): ChompPhase {
  if (elapsed < 0) return "none";
  if (elapsed < CHOMP_WINDUP) return "windup";
  if (elapsed < CHOMP_WINDUP + CHOMP_LUNGE) return "lunge";
  if (elapsed < CHOMP_TOTAL) return "chew";
  return "none";
}

export function canChomp(alive: boolean, elapsed: number, cooldown: number): boolean {
  return alive && chompPhase(elapsed) === "none" && cooldown <= 0;
}

/** Jaw opening 0..1 for drawing: wide during lunge, snaps shut at its end, chews twice. */
export function jawOpen(elapsed: number): number {
  const ph = chompPhase(elapsed);
  if (ph === "windup") return 0.3 + (elapsed / CHOMP_WINDUP) * 0.4;
  if (ph === "lunge") {
    const t = (elapsed - CHOMP_WINDUP) / CHOMP_LUNGE;
    return t < 0.75 ? 1 : 0;
  }
  if (ph === "chew") {
    const t = (elapsed - CHOMP_WINDUP - CHOMP_LUNGE) / CHOMP_CHEW;
    return Math.abs(Math.sin(t * Math.PI * 2)) * 0.35;
  }
  return 0;
}
