// Pointer coordinates increase downwards; the projection's pitch must follow
// that sign so looking up samples the upper part of the room painting.
export function roomLookAngles(x: number, y: number) {
  return { yaw: -x * 0.19, pitch: y * 0.12 };
}