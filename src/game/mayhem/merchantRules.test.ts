import { describe, expect, it } from "vitest";
import { applyUpgrade, enemyMoveMultiplier, MERCHANT_UPGRADES, startingPower, upgradeCost, upgradedProgress } from "./merchantRules";

describe("Receptionist upgrades", () => {
  it("makes the first upgrade free and later ones paid", () => {
    expect(upgradeCost("jumpstart", false)).toBe(0);
    expect(upgradeCost("jumpstart", true)).toBe(900);
  });
  it("keeps every price at or below 1000", () => { expect(MERCHANT_UPGRADES.every((u) => u.price > 0 && u.price <= 1000)).toBe(true); });
  it("restricts each puzzle upgrade to its specified game", () => {
    expect(applyUpgrade({}, "pipes").puzzle).toBe("flow");
    expect(applyUpgrade({}, "brain").puzzle).toBe("memory");
    expect(applyUpgrade({ puzzle: "flow" }, "listen").puzzle).toBe("simon");
  });
  it("gives 10 percentage points for exactly the first five puzzles", () => {
    for (let round = 1; round <= 5; round++) expect(upgradedProgress(0, 2, round, { grace: true })).toBe(10);
    expect(upgradedProgress(0, 2, 6, { grace: true })).toBe(4);
    expect(upgradedProgress(95, 2, 5, { grace: true })).toBe(100);
  });
  it("jumpstarts at 45 percent", () => { expect(startingPower({ jumpstart: true })).toBe(45); expect(startingPower({})).toBe(0); });
  it("slows movement only when this night's upgrade is present", () => {
    expect(enemyMoveMultiplier({ fiends: true })).toBe(0.75);
    expect(enemyMoveMultiplier({})).toBe(1);
  });
  it("keeps counterpart sprites unavailable", () => { expect(MERCHANT_UPGRADES.find((u) => u.id === "faces")?.unavailable).toBe(true); });
});