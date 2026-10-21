import { describe, expect, it } from "vitest";
import { slideDustAnchor, slideDustFrame } from "./slideDustRules";

describe("slide dust", () => {
  it("plays the supplied frames in 1, 4, 3, 2 order and loops", () => {
    expect([0, 0.081, 0.161, 0.241, 0.321].map(slideDustFrame)).toEqual([1, 4, 3, 2, 1]);
  });
  it("stays attached to the current player position and follows facing", () => {
    expect(slideDustAnchor(100, 200, 30, 20, 1)).toEqual({ x: 107, y: 222 });
    expect(slideDustAnchor(150, 220, 30, 20, 1)).toEqual({ x: 157, y: 242 });
    expect(slideDustAnchor(150, 220, 30, 20, -1)).toEqual({ x: 173, y: 242 });
  });
});