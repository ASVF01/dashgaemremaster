import { describe, expect, it } from "vitest";
import { beginEscape, createEvilChase } from "./evilChaseRules";
import { buildEvilChaseLevel } from "./evilChaseMap";

describe("escape doorway crossing", () => {
  it("starts the chase when jumping over the powered exit, including dashing past it in one frame", () => {
    const level = buildEvilChaseLevel();
    const gate = level.escapeEntrance;
    if (!gate) throw new Error("Missing escape entrance");
    for (const x of [gate.x, gate.x + 200]) {
      const state = createEvilChase(level.spawn, level.objectiveBoxes ?? []);
      state.boxes.forEach(b => { b.presses = 5; });
      state.route = [
        { x: x - 320, y: 900, facing: 1, pose: "jump" },
        { x, y: 900, facing: 1, pose: "jump" },
      ];
      expect(beginEscape(state, { x, y: 900, w: 28, h: 56 }, gate)).toBe(true);
      expect(state.phase).toBe("escape");
      expect(state.x).toBe(x - 320);
      expect(state.y).toBe(900);
    }
  });
});