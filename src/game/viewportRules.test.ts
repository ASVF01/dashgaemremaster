import { describe, expect, it } from "vitest";
import { clampCamera, gameplayZoom, usesTouchControls } from "./viewportRules";

describe("gameplay viewport", () => {
  it("hides mobile controls for desktop pointers", () => {
    expect(usesTouchControls(false)).toBe(false);
    expect(usesTouchControls(true)).toBe(true);
  });
  it("uses a gentler zoom while keeping tall screens within the level", () => {
    expect(gameplayZoom(935, false)).toBeCloseTo(935 / 780);
    expect(gameplayZoom(600, false)).toBe(1.1);
    expect(gameplayZoom(935, true)).toBe(1.2);
  });
  it("cannot scroll below the floor boundary", () => {
    expect(clampCamera(400, 720, 600)).toBe(120);
    expect(clampCamera(-50, 720, 600)).toBe(0);
  });
  it("pins the floor to the bottom edge when the view is taller than the level", () => {
    expect(clampCamera(0, 720, 780)).toBe(-60);
    expect(clampCamera(-60, 720, 780)).toBe(-60);
    expect(clampCamera(-200, 720, 780)).toBe(-60);
  });
});
