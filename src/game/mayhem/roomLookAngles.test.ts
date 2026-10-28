import { describe, expect, it } from "vitest";
import { roomLookAngles } from "./roomLookAngles";

describe("curved room look direction", () => {
  it("looks up when the mouse moves up", () => {
    expect(roomLookAngles(0, -1).pitch).toBe(-0.09);
  });
  it("looks down when the mouse moves down", () => {
    expect(roomLookAngles(0, 1).pitch).toBe(0.09);
  });
});
