import { describe, expect, it } from "vitest";
import { buildLevel } from "./level";
import { MAX_SPEED, PLAYER_H, PLAYER_W } from "./constants";
import { createEvilChase, stepEvilChase, pressBox, exitPowered, radiusBand, radiusMix, chaseRadiusBand, beginEscape, canFinishEvilChase, hasLineOfSight, cloneTouchesPlayer, CHASE_SPEED_MULTIPLIER } from "./evilChaseRules";

const player = { x: 100, y: 1504, w: PLAYER_W, h: PLAYER_H, facing: 1, pose: "idle" as const };

describe("Literally just you but evil", () => {
  it("spawns at the player's original spawn after exactly ten active seconds", () => {
    const state = createEvilChase(player, []);
    stepEvilChase(state, { ...player, x: 5000 }, 9.999, 0.016, []);
    expect(state.spawned).toBe(false);
    stepEvilChase(state, { ...player, x: 5000 }, 10, 0.016, []);
    expect(state.spawned).toBe(true);
    expect([state.x, state.y]).toEqual([100, 1504]);
  });
  it("has exactly five objective boxes", () => {
    expect(buildLevel("evil-you").objectiveBoxes).toHaveLength(5);
  });
  it("requires five individual presses per box, never completes at four", () => {
    const state = createEvilChase(player, [{ x: 100, y: 1500 }]);
    for (let i = 0; i < 4; i++) expect(pressBox(state, player)).toBe(true);
    expect(state.boxes[0].presses).toBe(4);
    expect(pressBox(state, player)).toBe(true);
    expect(state.boxes[0].presses).toBe(5);
    expect(pressBox(state, player)).toBe(false);
    expect(state.boxes[0].presses).toBe(5);
  });
  it("only powers the exit after all five boxes are complete", () => {
    const state = createEvilChase(player, Array.from({ length: 5 }, () => ({ x: 100, y: 1500 })));
    for (let i = 0; i < 24; i++) pressBox(state, player);
    expect(exitPowered(state)).toBe(false);
    pressBox(state, player);
    expect(exitPowered(state)).toBe(true);
  });
  it("ignores box interaction outside reach", () => {
    const state = createEvilChase(player, [{ x: 3000, y: 1500 }]);
    expect(pressBox(state, player)).toBe(false);
    expect(state.boxes[0].presses).toBe(0);
  });
  it("is a huge map with varied elevations and no low crawl ceilings", () => {
    const level = buildLevel("evil-you");
    expect(level.width).toBe(78000);
    expect(level.height).toBe(1900);
    const boxes = level.objectiveBoxes ?? [];
    expect(new Set(boxes.map(b => b.y)).size).toBe(5);
    for (const box of boxes) {
      expect(level.platforms.some(p => box.x >= p.x && box.x + 64 <= p.x + p.w && p.y === box.y + 64)).toBe(true);
    }
    for (const ceiling of level.platforms.filter(p => p.kind === "block")) {
      for (const floor of level.platforms) {
        const clearance = floor.y - (ceiling.y + ceiling.h);
        if (floor.x < ceiling.x + ceiling.w && floor.x + floor.w > ceiling.x && clearance >= 0) expect(clearance).toBeGreaterThanOrEqual(200);
      }
    }
  });
  it("runs slightly faster than the player without teleporting", () => {
    const state = createEvilChase({ x: 0, y: 0 }, []);
    state.spawned = true;
    stepEvilChase(state, { ...player, x: 10000, y: 0 }, 11, 1, []);
    expect(state.x).toBeCloseTo(MAX_SPEED * 1.08);
  });
  it("gives the chased player a modest twelve-percent boost", () => {
    expect(CHASE_SPEED_MULTIPLIER).toBe(1.12);
    expect(MAX_SPEED * CHASE_SPEED_MULTIPLIER).toBeCloseTo(1097.6);
  });
  it("uses three terror layers and BFF4 alone in chase", () => {
    expect(radiusMix(radiusBand(1700))).toEqual([1, 0, 0, 0]);
    expect(radiusMix(radiusBand(1000))).toEqual([1, 1, 0, 0]);
    expect(radiusMix(radiusBand(650))).toEqual([1, 1, 1, 0]);
    expect(radiusMix(radiusBand(300))).toEqual([0, 0, 0, 1]);
  });
  it("silences every stem when escaping all radii", () => {
    expect(radiusBand(1801)).toBe(0);
    expect(radiusMix(radiusBand(1801))).toEqual([0, 0, 0, 0]);
  });
  it("keeps only BFF4 playing through every terror band until escaping the outer radius", () => {
    let band = chaseRadiusBand(3, 420);
    expect(band).toBe(4);
    for (const distance of [650, 1000, 1700, 1800]) {
      band = chaseRadiusBand(band, distance);
      expect(radiusMix(band)).toEqual([0, 0, 0, 1]);
    }
    band = chaseRadiusBand(band, 1801);
    expect(radiusMix(band)).toEqual([0, 0, 0, 0]);
    expect(radiusMix(chaseRadiusBand(band, 1700))).toEqual([1, 0, 0, 0]);
  });
  it("starts the final pursuit only after five completed tasks and reaching the first exit", () => {
    const level = buildLevel("evil-you"), gate = level.escapeEntrance;
    if (!gate) throw new Error("Missing escape entrance");
    const state = createEvilChase(level.spawn, level.objectiveBoxes ?? []);
    const atGate = { ...player, x: gate.x, y: gate.y + 64 };
    expect(beginEscape(state, atGate, gate)).toBe(false);
    state.boxes.forEach(b => { b.presses = 5; });
    expect(canFinishEvilChase(state)).toBe(false);
    expect(beginEscape(state, player, gate)).toBe(false);
    state.route = Array.from({ length: 151 }, (_, i) => ({ ...player, x: gate.x - 1200 + i * 8, y: atGate.y }));
    expect(beginEscape(state, atGate, gate)).toBe(true);
    expect(state.phase).toBe("escape");
    expect(state.band).toBe(0); // chase OST waits for the close radius
    expect(state.x).toBe(gate.x - 1000);
    expect(state.y).toBe(atGate.y);
    expect(canFinishEvilChase(state)).toBe(true);
    expect(beginEscape(state, atGate, gate)).toBe(false);
  });
  it("adds a very long hallway with vertical landings and no freestanding pillars", () => {
    const level = buildLevel("evil-you");
    expect(level.goal.x - (level.escapeEntrance?.x ?? level.goal.x)).toBe(48000);
    const floor = level.platforms.filter(p => p.x >= 30000 && p.kind === "ground");
    expect(new Set(floor.map(p => p.y)).size).toBe(6);
    for (const p of floor) {
      expect(p.w).toBeGreaterThanOrEqual(400);
      expect(p.y + p.h).toBe(1900);
    }
    expect(level.platforms.filter(p => p.x >= 30000 && p.kind === "block")).toEqual([
      { x: 30000, y: 120, w: 48000, h: 40, kind: "block" },
    ]);
  });
  it("shakes for half a second upon seeing the player, not continuously retriggering", () => {
    const state = createEvilChase(player, []);
    state.spawned = true;
    stepEvilChase(state, { ...player, x: 800 }, 11, 0.016, []);
    expect(state.sightShake).toBe(0.5);
    stepEvilChase(state, { ...player, x: 800 }, 11.016, 0.016, []);
    expect(state.sightShake).toBeCloseTo(0.484);
  });
  it("terrain blocks sight", () => {
    expect(hasLineOfSight({ x: 0, y: 20 }, { x: 300, y: 20 }, [{ x: 100, y: 0, w: 20, h: 100 }])).toBe(false);
    expect(hasLineOfSight({ x: 0, y: 120 }, { x: 300, y: 120 }, [{ x: 100, y: 0, w: 20, h: 100 }])).toBe(true);
  });
  it("follows a vertical route rather than cutting through the corner", () => {
    const state = createEvilChase({ x: 0, y: 0 }, []);
    state.route.push({ ...player, x: 0, y: -500 });
    state.spawned = true;
    stepEvilChase(state, { ...player, x: 500, y: -500 }, 11, 0.1, []);
    expect(state.x).toBe(0);
    expect(state.y).toBeCloseTo(-105.84);
  });
  it("contact only counts after the clone spawns", () => {
    const state = createEvilChase(player, []);
    expect(cloneTouchesPlayer(state, player)).toBe(false);
    state.spawned = true;
    expect(cloneTouchesPlayer(state, player)).toBe(true);
  });
});
import { parryClone as _parry, CLONE_STUN_SECONDS as _STUN } from "./evilChaseRules";
describe("parrying the clone", () => {
  it("stuns it for 1.5s so it can't catch you", () => {
    const s = createEvilChase({ x: 0, y: 0 }, []);
    s.spawned = true;
    _parry(s);
    expect(_STUN).toBe(1.5);
    expect(cloneTouchesPlayer(s, { x: 0, y: 0, w: 20, h: 20 })).toBe(false);
    stepEvilChase(s, { x: 0, y: 0, facing: 1, pose: "idle" }, 20, 1.6, []);
    expect(cloneTouchesPlayer(s, { x: 0, y: 0, w: 20, h: 20 })).toBe(true);
  });
});
