export function generatorReward(percent: number, gain: number, roll: number) {
  const doubled = roll < 0.25;
  return { percent: Math.min(100, percent + gain * (doubled ? 2 : 1)), doubled };
}