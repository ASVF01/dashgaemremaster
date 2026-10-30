import { describe, expect, it } from "vitest";
import { projectRoomPoint } from "./roomProjection";
import { roomLookAngles } from "./roomLookAngles";

// Replicates the shader's screen → authored-point mapping to check the inverse.
function shader(vx: number, vy: number, gx: number, gy: number, aspect: number) {
  const fx = 0.42 * Math.min(aspect, 1.6), fy = 0.42 * Math.min(1, 1.6 / aspect);
  const sx = (vx - 0.5) * 2, sy = (vy - 0.5) * 2;
  let x = sx * fx, y = sy * fy, z = -1;
  const { yaw, pitch } = roomLookAngles(gx, gy);
  [y, z] = [Math.cos(pitch) * y + Math.sin(pitch) * z, -Math.sin(pitch) * y + Math.cos(pitch) * z];
  [x, z] = [Math.cos(yaw) * x + Math.sin(yaw) * z, -Math.sin(yaw) * x + Math.cos(yaw) * z];
  const ax = Math.atan2(x, -z), ay = Math.atan2(y, Math.hypot(x, z));
  return { u: ax / (Math.atan(fx) * 1.08 * 2) + 0.5, v: ay / (Math.atan(fy) * 1.08 * 2) + 0.5 };
}

describe("projectRoomPoint", () => {
  it("lands the storage door control where the shader draws it while looking right", () => {
    const p = projectRoomPoint(0.82, 0.5, 0.64, 0.1, 16 / 9);
    const back = shader(p.x, 1 - p.y, 0.64, 0.1, 16 / 9);
    expect(back.u).toBeCloseTo(0.82, 4);
    expect(1 - back.v).toBeCloseTo(0.5, 4);
  });
  it("keeps the centre fixed with a centred gaze", () => {
    const p = projectRoomPoint(0.5, 0.5, 0, 0, 16 / 9);
    expect(p.x).toBeCloseTo(0.5, 6);
    expect(p.y).toBeCloseTo(0.5, 6);
  });
});
