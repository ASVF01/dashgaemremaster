/** Five-bit quantization and ~6 kHz sample-and-hold: deliberately crunchy. */
export function crushOfficeChannel(input: Float32Array, sampleRate: number): Float32Array {
  const output = new Float32Array(input.length);
  const holdFrames = Math.max(1, Math.round(sampleRate / 6000));
  const steps = 16; // 32 signed amplitude levels (five bits).
  let held = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % holdFrames === 0) {
      held = Math.max(-1, Math.min(15 / steps, Math.round(input[i] * steps) / steps));
    }
    output[i] = held;
  }
  return output;
}