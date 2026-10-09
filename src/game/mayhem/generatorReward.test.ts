import { describe, expect, it } from "vitest";
import { generatorReward } from "./generatorReward";
import { generatorGain } from "./generatorGain";
import { upgradedProgress } from "./merchantRules";

describe("double-charge rewards", () => {
  it("doubles exactly the lowest 25% of rolls", () => {
    const rewards = Array.from({ length: 100 }, (_, i) => generatorReward(0, 5, i / 100));
    expect(rewards.filter((reward) => reward.doubled)).toHaveLength(25);
    expect(generatorReward(10, 5, 0.25)).toEqual({ percent: 15, doubled: false });
  });
  it.each([[1, 10], [2, 8], [3, 7], [4, 6]])("doubles Night %i's awarded charge to %i", (night, gain) => {
    expect(generatorReward(40, generatorGain(night), 0.1)).toEqual({ percent: 40 + gain, doubled: true });
  });
  it("doubles the upgraded award rather than total stored charge", () => {
    expect(generatorReward(45, upgradedProgress(0, 2, 1, { grace: true }), 0.1).percent).toBe(65);
  });
  it("caps double-charge at 100%", () => {
    expect(generatorReward(97, 5, 0.1)).toEqual({ percent: 100, doubled: true });
  });
});