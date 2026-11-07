import { describe, expect, it } from "vitest";
import { addSurge, completeRound, makeCodeRound, makeSimonSequence, startConsole, type ConsoleProgress } from "./officeConsoleRules";

const runRounds = (p: ConsoleProgress, n: number) => { for (let i = 0; i < n; i++) p = completeRound(p); return p; };

describe("office console", () => {
  it("power is one round, then code starts", () => expect(runRounds(startConsole(), 1)).toEqual({ task: 1, round: 0, done: false }));
  it("code takes 10 rounds before simon", () => expect(runRounds(startConsole(), 1 + 10).task).toBe(2));
  it("simon takes 7 rounds before wires", () => expect(runRounds(startConsole(), 1 + 10 + 7).task).toBe(3));
  it("wires take 12 rounds before surge", () => expect(runRounds(startConsole(), 1 + 10 + 7 + 12).task).toBe(4));
  it("surge completes the console", () => expect(runRounds(startConsole(), 31).done).toBe(true));
  it("hint digit identifies only the answer", () => {
    for (let i = 0; i < 50; i++) {
      const r = makeCodeRound();
      const hint = r.options[r.answer][r.hintPos];
      expect(r.options.filter((o) => o[r.hintPos] === hint)).toHaveLength(1);
      expect(r.options).toHaveLength(4);
    }
  });
  it("simon uses 6 buttons and grows", () => {
    expect(makeSimonSequence(0)).toHaveLength(3);
    expect(makeSimonSequence(6).every((b) => b >= 0 && b < 6)).toBe(true);
  });
  it("surge caps at 100", () => expect(addSurge(98, 4)).toBe(100));
});
