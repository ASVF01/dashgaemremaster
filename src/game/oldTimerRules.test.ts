import { describe, it, expect } from "vitest";
import { chompPhase, canChomp, jawOpen, CHOMP_TOTAL } from "./oldTimerRules";

describe("Old Timer Feral Chomp", () => {
  it("runs windup, lunge, then chew", () => {
    expect(chompPhase(0.04)).toBe("windup");
    expect(chompPhase(0.15)).toBe("lunge");
    expect(chompPhase(0.3)).toBe("chew");
    expect(chompPhase(CHOMP_TOTAL + 0.01)).toBe("none");
  });
  it("cannot chomp again while cooling down or mid-bite", () => {
    expect(canChomp(true, 99, 0.5)).toBe(false);
    expect(canChomp(true, 0.1, 0)).toBe(false);
    expect(canChomp(true, 99, 0)).toBe(true);
    expect(canChomp(false, 99, 0)).toBe(false);
  });
  it("jaws are wide open in the lunge and snap shut at its end", () => {
    expect(jawOpen(0.1)).toBe(1);
    expect(jawOpen(0.22)).toBe(0);
  });
});
