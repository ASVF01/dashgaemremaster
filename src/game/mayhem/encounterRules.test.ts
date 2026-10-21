import { describe, expect, it } from "vitest";
import { anbOutcome, lockdownAllows, nickyOutcome, tipsForNight } from "./encounterRules";

describe("encounter rules", () => {
  it("Nicky gives 2.5s to reach the office", () => {
    expect(nickyOutcome("door", 2400)).toBe("wait");
    expect(nickyOutcome("door", 2500)).toBe("kill");
    expect(nickyOutcome("office", 2500)).toBe("leave");
  });
  it("peeking at Nicky through the keyhole kills instantly", () => {
    expect(nickyOutcome("keyhole", 100)).toBe("kill");
  });
  it("AN-B leaves after a 3s stare", () => {
    expect(anbOutcome(2900, 5000)).toBe("wait");
    expect(anbOutcome(3000, 5000)).toBe("stun");
  });
  it("lockdown blocks storage", () => {
    expect(lockdownAllows("storage")).toBe(false);
    expect(lockdownAllows("office")).toBe(true);
  });
  it("tip screens per night", () => {
    expect(tipsForNight(1)).toEqual([3, 4]);
    expect(tipsForNight(2)).toEqual([1, 2]);
  });
});
