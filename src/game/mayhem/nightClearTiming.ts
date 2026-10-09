export const NIGHT_CLEAR_DURATION = 15.650272;
export const NIGHT_CLEAR_FADE = 2;
// Measured from the supplied completion track, independent of generator music.
export const NIGHT_CLEAR_BPM = 120;
export const NIGHT_CLEAR_FIRST_BEAT = 1.091;

export function nightClearBeatScale(time: number) {
  if (time < NIGHT_CLEAR_FIRST_BEAT) return 1;
  const phase = (time - NIGHT_CLEAR_FIRST_BEAT) % (60 / NIGHT_CLEAR_BPM);
  const pulse = Math.max(0, 1 - phase / 0.28);
  return 1 + 0.065 * pulse * pulse;
}

export function nightClearEnvelope(time: number, duration = NIGHT_CLEAR_DURATION) {
  const fade = Math.min(NIGHT_CLEAR_FADE, duration);
  return Math.max(0, Math.min(1, (duration - time) / fade));
}