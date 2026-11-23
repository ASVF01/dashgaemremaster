import { describe, it, expect } from "vitest";
import { createHeartBoss, stepHeartBoss, heartPhase, HEART_MAX_HP } from "./heartBossRules";

const far = { x: 0, y: 0, w: 28, h: 56 };
describe("heartbreaker", () => {
  it("has 12 hp and three phases", () => {
    expect(HEART_MAX_HP).toBe(12);
    expect(heartPhase(12)).toBe(1); expect(heartPhase(8)).toBe(2); expect(heartPhase(4)).toBe(3);
  });
  it("a parried prompt flies back and costs the heart 1 hp", () => {
    const b = createHeartBoss();
    b.shots.push({ x: 100, y: 100, vx: 0, vy: 0, r: 22, kind: "prompt", reflected: false, alive: true, t: 0 });
    const r = stepHeartBoss(b, 0.016, { x: 90, y: 80, w: 28, h: 56 }, true);
    expect(r.parried).not.toBeNull();
    for (let i = 0; i < 200; i++) stepHeartBoss(b, 0.016, far, false);
    expect(b.hp).toBe(11);
  });
  it("an unparried shot hurts the player", () => {
    const b = createHeartBoss();
    b.shots.push({ x: 100, y: 100, vx: 0, vy: 0, r: 14, kind: "heart", reflected: false, alive: true, t: 0 });
    expect(stepHeartBoss(b, 0.016, { x: 90, y: 80, w: 28, h: 56 }, false).playerHit).not.toBeNull();
  });
});
