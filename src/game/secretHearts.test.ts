import { describe, it, expect } from "vitest";
import { heartbreakerUnlocked, requiredLevels, HEART_LEVELS } from "./secretHearts";
import { LEVELS } from "./level";

const beatAll = Object.fromEntries(requiredLevels(LEVELS).map(id => [id, { bestTimeMs: 1, bestScore: 0, plays: 1 }]));

describe("heartbreaker unlock", () => {
  it("needs every level beaten and all three hearts", () => {
    expect(heartbreakerUnlocked(LEVELS, beatAll, HEART_LEVELS)).toBe(true);
  });
  it("stays locked missing one heart", () => {
    expect(heartbreakerUnlocked(LEVELS, beatAll, ["scribble-1", "scribble-2"])).toBe(false);
  });
  it("stays locked with one level unbeaten", () => {
    const s = { ...beatAll }; delete (s as Record<string, unknown>)["tutorial"];
    expect(heartbreakerUnlocked(LEVELS, s, HEART_LEVELS)).toBe(false);
  });
  it("hearts live in ink alley, paper cuts and overdrive", () => {
    expect(HEART_LEVELS).toEqual(["scribble-1", "scribble-2", "scribble-3"]);
  });
});
