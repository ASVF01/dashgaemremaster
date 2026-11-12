import { describe, expect, it } from "vitest";
import {
  drainAir, GIFTED_DOOR_CLOSE_MS, GIFTED_REOPEN_DEATH_MS, GIFTED_WAIT_MS, isLaserHit, KID_BLAST_MS, KID_DAMAGE, KID_LASER_HALF_HEIGHT, KID_SHOT_INTERVAL_MS, KID_SHOTS_PER_ATTACK, KID_TELEGRAPH_MS, KID_WARNING_MS, MATA_DEATH_BLACK_MS, MATA_DRAIN_SECONDS, MATA_SHOCK_MS, mataRattleProfile,
} from "./managerOfficeRules";

describe("NEO-MATA vent air", () => {
  it("drains a full tank in 10 seconds and never goes negative", () => {
    expect(drainAir(100, 5)).toBe(50);
    expect(drainAir(100, 10)).toBe(0);
    expect(drainAir(5, 10)).toBe(0);
    expect(MATA_DRAIN_SECONDS).toBe(10);
  });
  it("keeps the air rattle slow, subdued, and within its designed range", () => {
    expect(mataRattleProfile(100)).toEqual({ playbackRate: 0.55, volume: 0.06, cutoffHz: 3200 });
    expect(mataRattleProfile(0)).toEqual({ playbackRate: 0.9, volume: 0.09, cutoffHz: 4200 });
  });
  it("shock shake lasts half a second", () => {
    expect(MATA_SHOCK_MS).toBe(500);
  });
  it("holds the black screen for three seconds before the death video", () => {
    expect(MATA_DEATH_BLACK_MS).toBe(3000);
  });
  it("uses the NEO-KID laser timing, damage, and cursor hit band", () => {
    expect(KID_TELEGRAPH_MS).toBe(380);
    expect(KID_BLAST_MS).toBe(220);
    expect(KID_DAMAGE).toBe(25);
    expect(KID_LASER_HALF_HEIGHT).toBe(38);
    expect(KID_WARNING_MS).toBe(6100);
    expect(KID_SHOTS_PER_ATTACK).toBe(4);
    expect(KID_SHOT_INTERVAL_MS).toBeGreaterThanOrEqual(KID_TELEGRAPH_MS + KID_BLAST_MS);
    expect(isLaserHit(138, 100)).toBe(true);
    expect(isLaserHit(139, 100)).toBe(false);
    expect(isLaserHit(140, 100, 40)).toBe(true);
  });
  it("uses the specified lethal door deadlines for The Gifted", () => {
    expect(GIFTED_DOOR_CLOSE_MS).toBe(4200);
    expect(GIFTED_REOPEN_DEATH_MS).toBe(500);
    expect(GIFTED_WAIT_MS).toBe(3500);
  });
});
