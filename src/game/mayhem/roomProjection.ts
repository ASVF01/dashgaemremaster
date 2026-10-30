import { roomLookAngles } from "./roomLookAngles";

// Forward version of the CurvedRoom shader: maps an authored screen-space
// point (0..1, as laid out over the cover-cropped flat painting) to where the
// curved renderer currently draws it. Must stay in sync with CurvedRoom.tsx.
export const ROOM_LENS = 0.42;

export function projectRoomPoint(sx: number, sy: number, gazeX: number, gazeY: number, aspect: number) {
  const fx = ROOM_LENS * Math.min(aspect, 1.6);
  const fy = ROOM_LENS * Math.min(1, 1.6 / aspect);
  const ex = Math.atan(fx) * 1.08;
  const ey = Math.atan(fy) * 1.08;
  // GL uv has y up; authored top% has y down.
  const ax = (sx - 0.5) * 2 * ex;
  const ay = (0.5 - sy) * 2 * ey;
  let x = Math.sin(ax) * Math.cos(ay);
  let y = Math.sin(ay);
  let z = -Math.cos(ax) * Math.cos(ay);
  const { yaw, pitch } = roomLookAngles(gazeX, gazeY);
  // Undo yaw (shader: x' = cos*x + sin*z, z' = -sin*x + cos*z).
  const cy = Math.cos(yaw), sny = Math.sin(yaw);
  [x, z] = [cy * x - sny * z, sny * x + cy * z];
  // Undo pitch.
  const cp = Math.cos(pitch), snp = Math.sin(pitch);
  [y, z] = [cp * y - snp * z, snp * y + cp * z];
  const px = x / -z / fx;
  const py = y / -z / fy;
  return { x: px / 2 + 0.5, y: 0.5 - py / 2 };
}

export function projectRoomRect(left: number, top: number, width: number, height: number, gx: number, gy: number, aspect: number) {
  const a = projectRoomPoint(left, top, gx, gy, aspect);
  const b = projectRoomPoint(left + width, top + height, gx, gy, aspect);
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}
