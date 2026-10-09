export function generatorGain(night: number): number {
  switch (night) {
    case 1: return 5;
    case 2: return 4;
    case 3: return 3.5;
    default: return 3;
  }
}

export function advanceGenerator(percent: number, night: number): number {
  return Math.min(100, percent + generatorGain(night));
}