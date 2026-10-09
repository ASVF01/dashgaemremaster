export function generatorMusicState(percent: number) {
  const progress = Math.max(0, Math.min(100, percent));
  return {
    track: progress >= 50 ? "fury" as const : "glitchy" as const,
    rate: 0.65 + 0.35 * Math.min(progress / 50, 1),
  };
}

export function crushGeneratorSamples(input: Float32Array): Float32Array {
  const output = new Float32Array(input.length);
  let held = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % 4 === 0) held = Math.round(input[i] * 32) / 32;
    output[i] = held;
  }
  return output;
}