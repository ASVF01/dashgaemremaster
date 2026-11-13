import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mayhemSfx } from "@/game/sfx";
import DeskConsole from "./DeskConsole";

vi.mock("@/game/sfx", () => ({ mayhemSfx: {
  generatorHover: vi.fn(), generatorImpact: vi.fn(), terminalSelect: vi.fn(), puzzleConnect: vi.fn(),
} }));

describe("office wire completion", () => {
  it("shows the Stevenson generator artwork with the code hint over its display", () => {
    const { container } = render(<DeskConsole progress={{ task: 1, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);

    expect(container.querySelector(".mo-stev img")).toHaveAttribute("src", expect.stringContaining("generator_panel_local.png"));
    expect(container.querySelector(".mo-stev-screen")).toHaveTextContent(/^(?:_|\d)(?: (?:_|\d)){3}$/);
  });

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

  it("draws a sagging cable that follows the pointer and jiggles on connection", () => {
    const onRound = vi.fn();
    const { container } = render(<DeskConsole progress={{ task: 3, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);
    const svg = container.querySelector("svg.mo-wires")!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(screen.getByRole("button", { name: "cyan plug" }));
    fireEvent(container.querySelector(".mo-con-wires")!, new MouseEvent("pointermove", {
      bubbles: true, clientX: 80, clientY: 60,
    }));
    expect(container.querySelector("path.mo-wire-live")?.getAttribute("d")).toBe("M 12 12.5 Q 46 80 80 60");

    fireEvent.click(screen.getByRole("button", { name: "cyan port" }));
    expect(container.querySelector("path.mo-wire-jiggle")?.getAttribute("d")).toMatch(/^M 12 12\.5 Q /);
    expect(onRound).not.toHaveBeenCalled();
  });

  it("does not play the Nights 1-4 generator reward sound when the wire task finishes", () => {
    vi.clearAllMocks();
    const onRound = vi.fn();
    render(<DeskConsole progress={{ task: 3, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);
    for (const color of ["cyan", "pink", "yellow", "lime"]) {
      fireEvent.click(screen.getByRole("button", { name: `${color} plug` }));
      fireEvent.click(screen.getByRole("button", { name: `${color} port` }));
    }
    expect(onRound).toHaveBeenCalledTimes(1);
    expect(mayhemSfx.generatorImpact).not.toHaveBeenCalled();
  });

  it("does not play the Nights 1-4 generator reward sound when the code task finishes", () => {
    vi.clearAllMocks();
    const onRound = vi.fn();
    render(<DeskConsole progress={{ task: 1, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);
    for (const btn of screen.getAllByRole("button")) {
      fireEvent.click(btn);
      if (onRound.mock.calls.length) break;
    }
    expect(onRound).toHaveBeenCalledTimes(1);
    expect(mayhemSfx.generatorImpact).not.toHaveBeenCalled();
  });
});