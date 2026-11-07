import { describe, expect, it } from "vitest";
import { officeYaw, viewForKey, shuffledPorts, tryConnect, taskComplete, WIRE_COLORS, OFFICE_MAX_YAW, officePitch, edgeScrollYaw, ventStepsCrossed, propScreenBox, OFFICE_FURNITURE_SCALE, OFFICE_DESK_DEPTH, OFFICE_UTIL_DEPTH } from "./managerOfficeRules";

describe("manager office look", () => {
  it("centered cursor faces the desk, edges face the side walls", () => {
    expect(officeYaw(0)).toBe(0);
    expect(officeYaw(1)).toBeCloseTo(OFFICE_MAX_YAW);
    expect(officeYaw(-1)).toBeCloseTo(-OFFICE_MAX_YAW);
    expect(OFFICE_MAX_YAW).toBe(90);
    expect(officePitch("ceiling")).toBe(90);
  });
  it("only W and S change the view; A and D do nothing", () => {
    expect(viewForKey("KeyW", "desk")).toBe("ceiling");
    expect(viewForKey("KeyS", "ceiling")).toBe("desk");
    expect(viewForKey("KeyA", "desk")).toBe("desk");
    expect(viewForKey("KeyD", "ceiling")).toBe("ceiling");
  });
});

describe("edge-scroll look and vent steps", () => {
  it("cursor at the left edge turns left and the view stays when centered", () => {
    let yaw = 0;
    for (let i = 0; i < 60; i++) yaw = edgeScrollYaw(yaw, -1, 0.05);
    expect(yaw).toBe(-90);
    expect(edgeScrollYaw(yaw, 0, 0.05)).toBe(-90);
    expect(edgeScrollYaw(30, 0.2, 0.05)).toBe(30);
  });
  it("vent jolts once per step, including across the loop", () => {
    expect(ventStepsCrossed(0, 0.2)).toBe(1);
    expect(ventStepsCrossed(0.2, 1.4)).toBe(0);
    expect(ventStepsCrossed(3.1, 0.2)).toBe(1);
  });
});

describe("wire patch task", () => {
  it("right ports are never already in order", () => {
    let n = 0;
    const seq = [0.99, 0.99, 0.99, 0.1, 0.5, 0.2];
    const ports = shuffledPorts(() => seq[n++ % seq.length]);
    expect(ports.some((c, i) => c !== WIRE_COLORS[i])).toBe(true);
  });
  it("mismatched colors don't connect; all four matched completes", () => {
    let done = tryConnect([], "cyan", "pink");
    expect(done).toEqual([]);
    for (const c of WIRE_COLORS) done = tryConnect(done, c, c);
    expect(taskComplete(done)).toBe(true);
  });
});

import { edgeZone, stepYawTarget } from "./managerOfficeRules";
describe("instant edge turn", () => {
  it("snaps one wall per edge entry and holds", () => {
    expect(stepYawTarget(0, 0, edgeZone(-0.9))).toBe(-90);
    expect(stepYawTarget(-90, -1, edgeZone(-0.9))).toBe(-90);
    expect(stepYawTarget(-90, 0, edgeZone(0))).toBe(-90);
    expect(stepYawTarget(-90, 0, edgeZone(0.9))).toBe(0);
    expect(stepYawTarget(0, 0, edgeZone(0.9))).toBe(90);
  });
});

describe("office furniture placement", () => {
  const VW = 1280, VH = 800, ROOM_H = 831.9, S = 1427.8;
  const desk = (scale: number, k: number) =>
    propScreenBox(VW, VH, ROOM_H, 0.745 * S * scale * k, 0.564 * ROOM_H * scale * k, k);
  const util = (scale: number, k: number) =>
    propScreenBox(VW, VH, ROOM_H, S * scale * k, 0.374 * ROOM_H * scale * k, k);

  it("the manager's desk stays on screen and shows its top", () => {
    const b = desk(OFFICE_FURNITURE_SCALE, OFFICE_DESK_DEPTH);
    expect(b.left).toBeGreaterThan(0);
    expect(b.right).toBeLessThan(VW);
    expect(b.width / VW).toBeGreaterThan(0.5);
    expect(b.top / VH).toBeGreaterThan(0.45);
    expect(b.bottom).toBeGreaterThanOrEqual(VH);
  });
  it("the utilities desk sits low in the view", () => {
    const b = util(OFFICE_FURNITURE_SCALE, OFFICE_UTIL_DEPTH);
    expect(b.top / VH).toBeGreaterThan(0.6);
    expect(b.bottom).toBeGreaterThanOrEqual(VH);
  });
  it("desks stand in front of the walls so the wall art can't cover them", () => {
    expect(OFFICE_DESK_DEPTH).toBeLessThan(1);
    expect(OFFICE_UTIL_DEPTH).toBeLessThan(1);
  });
  it("shrinking the desk lifts its top edge toward the middle", () => {
    expect(desk(1.9, 0.62).top).toBeLessThan(desk(OFFICE_FURNITURE_SCALE, OFFICE_DESK_DEPTH).top);
  });
});
