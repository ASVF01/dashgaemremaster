import { describe, expect, it } from "vitest";
import { roomPerspectiveOffset } from "./RoomPerspective";

describe("cylindrical room perspective", () => {
  it("keeps the centre and horizon fixed rather than tilting the picture", () => {
    expect(roomPerspectiveOffset(0.5, 0)).toBe(0);
    expect(roomPerspectiveOffset(0.5, 1)).toBe(0);
    expect(roomPerspectiveOffset(0, 0.5)).toBe(0);
  });
  it("curves the ceiling and floor symmetrically at both edges", () => {
    expect(roomPerspectiveOffset(0, 0)).toBeGreaterThan(0.16);
    expect(roomPerspectiveOffset(0, 1)).toBeLessThan(-0.16);
    expect(roomPerspectiveOffset(0, 0)).toBeCloseTo(roomPerspectiveOffset(1, 0));
  });
});