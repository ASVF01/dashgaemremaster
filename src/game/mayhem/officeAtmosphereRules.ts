/** Storm is SFX, independent of music mute; duck only for an audible soundtrack. */
export function officeStormGain(sfxVolume: number, musicAudible: boolean, active = true) {
  if (!active) return 0;
  return Math.max(0, Math.min(1, sfxVolume)) * (musicAudible ? 0.1 : 0.18);
}