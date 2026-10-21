import { describe, expect, it } from "vitest";
import { clampCamera, gameplayZoom, usesTouchControls } from "./viewportRules";

describe("gameplay viewport", () => {
  it("hides mobile controls for desktop pointers", () => {
    expect(usesTouchControls(false)).toBe(false);
    expect(usesTouchControls(true)).toBe(true);
  });
  it("keeps the view close even on tall desktop screens", () => {
    expect(gameplayZoom(935, false)).toBeCloseTo(935 / 600);
    expect(gameplayZoom(600, false)).toBe(1.4);
    expect(gameplayZoom(935, true)).toBe(1.2);
  });
  it("cannot scroll below the floor boundary", () => {
    expect(clampCamera(400, 720, 600)).toBe(120);
    expect(clampCamera(-50, 720, 600)).toBe(0);
  });
});