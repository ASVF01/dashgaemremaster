import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeskConsole from "./DeskConsole";

vi.mock("@/game/sfx", () => ({ mayhemSfx: {
  generatorHover: vi.fn(), generatorImpact: vi.fn(), terminalSelect: vi.fn(), puzzleConnect: vi.fn(),
} }));

describe("office wire completion", () => {
  it("advances exactly once on the fourth matching wire without a cancellable timer", () => {
    const onRound = vi.fn();
    render(<DeskConsole progress={{ task: 3, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);
    const colors = ["cyan", "pink", "yellow", "lime"];
    colors.forEach((color, index) => {
      fireEvent.click(screen.getByRole("button", { name: `${color} plug` }));
      fireEvent.click(screen.getByRole("button", { name: `${color} port` }));
      expect(onRound).toHaveBeenCalledTimes(index === 3 ? 1 : 0);
    });
  });

  it("does not advance after a mismatched wire", () => {
    const onRound = vi.fn();
    render(<DeskConsole progress={{ task: 3, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "cyan plug" }));
    fireEvent.click(screen.getByRole("button", { name: "pink port" }));
    expect(onRound).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "cyan plug" })).not.toBeDisabled();
  });
});