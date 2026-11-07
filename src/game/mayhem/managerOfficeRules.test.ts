import { describe, expect, it } from "vitest";
import { officeYaw, viewForKey, shuffledPorts, tryConnect, taskComplete, WIRE_COLORS, OFFICE_MAX_YAW, officePitch } from "./managerOfficeRules";

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
