export const NIGHT_CLEAR_DURATION = 15.650272;
export const NIGHT_CLEAR_FADE = 2;

export function nightClearEnvelope(time: number, duration = NIGHT_CLEAR_DURATION) {
  const fade = Math.min(NIGHT_CLEAR_FADE, duration);
  return Math.max(0, Math.min(1, (duration - time) / fade));
}