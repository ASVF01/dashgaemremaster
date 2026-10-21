import { describe, expect, it } from "vitest";
import { anbOutcome, lockdownAllows, nickyOutcome, tipsForNight } from "./encounterRules";

describe("encounter rules", () => {
  it("Nicky only kills after 2.5s of staring", () => {
    expect(nickyOutcome("hallway", 9000, 2400)).toBe("wait");
    expect(nickyOutcome("keyhole", 100, 2500)).toBe("kill");
  });
  it("THE DOOR counts as the office for Nicky", () => {
    expect(nickyOutcome("door", 2500, 0)).toBe("leave");
    expect(nickyOutcome("office", 2400, 0)).toBe("wait");
  });
  it("threat leaving is heard from hallway or office, not storage", () => {
    expect(hearsRunAway("hallway")).toBe(true);
    expect(hearsRunAway("door")).toBe(true);
    expect(hearsRunAway("storage")).toBe(false);
  });
  it("AN-B leaves after a 3s stare", () => {
    expect(anbOutcome(2900, 5000)).toBe("wait");
    expect(anbOutcome(3000, 5000)).toBe("stun");
  });
  it("lockdown blocks storage", () => {
    expect(lockdownAllows("storage", "hallway")).toBe(false);
    expect(lockdownAllows("office", "hallway")).toBe(true);
  });
  it("inside the office rooms the player is sealed in", () => {
    expect(lockdownAllows("hallway", "door")).toBe(false);
    expect(lockdownAllows("keyhole", "door")).toBe(true);
    expect(lockdownAllows("office", "door")).toBe(true);
  });
  it("lockdown lets the player back out of the storage keyhole and door", () => {
    expect(lockdownAllows("storage", "storageKeyhole")).toBe(true);
    expect(lockdownAllows("storage", "storageDoor")).toBe(true);
    expect(lockdownAllows("storage", "hallway")).toBe(false);
  });
  it("tip screens per night", () => {
    expect(tipsForNight(1)).toEqual([3, 4]);
    expect(tipsForNight(2)).toEqual([1, 2]);
  });
});
