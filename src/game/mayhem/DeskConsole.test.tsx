import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mayhemSfx } from "@/game/sfx";
import DeskConsole from "./DeskConsole";

vi.mock("@/game/sfx", () => ({ mayhemSfx: {
  generatorHover: vi.fn(), generatorImpact: vi.fn(), terminalSelect: vi.fn(), puzzleConnect: vi.fn(), puzzleSignal: vi.fn(), puzzleWrong: vi.fn(), generatorCount: vi.fn(),
} }));

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("office wire completion", () => {
  it("keeps the task title, controls, and close hint inside the console screen", () => {
    const { container } = render(<DeskConsole progress={{ task: 1, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);
    const screen = container.querySelector(".mo-console-screen");

    expect(screen?.querySelector(".mo-crt-title")).toBeInTheDocument();
    expect(screen?.querySelector(".mo-code-rig")).toBeInTheDocument();
    expect(screen?.querySelector(".mo-crt-foot")).toBeInTheDocument();
  });

  it("shows the Stevenson generator artwork with the code hint over its display", () => {
    vi.useFakeTimers();
    const { container } = render(<DeskConsole progress={{ task: 1, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(300); });

    expect(container.querySelector(".mo-stev img")).toHaveAttribute("src", expect.stringContaining("generator_panel_local.png"));
    expect(container.querySelector(".mo-stev-screen")).toHaveTextContent(/^HINT: \[ (?:_|\d)(?: (?:_|\d)){3} \]$/);
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

  describe("office Simon audio", () => {
    it("plays the bitcrushed demo signals and the wrong-input cue", () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      render(<DeskConsole progress={{ task: 2, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);

      act(() => { vi.advanceTimersByTime(3600); });
      expect(mayhemSfx.puzzleSignal).toHaveBeenCalledTimes(3);
      expect(mayhemSfx.puzzleSignal).toHaveBeenNthCalledWith(1, 0);
      expect(mayhemSfx.puzzleSignal).toHaveBeenNthCalledWith(2, 0);
      expect(mayhemSfx.puzzleSignal).toHaveBeenNthCalledWith(3, 0);

      fireEvent.click(screen.getByRole("button", { name: "Button B" }));
      expect(mayhemSfx.puzzleSignal).toHaveBeenLastCalledWith(1);
      expect(mayhemSfx.puzzleWrong).toHaveBeenCalledOnce();
    });

    it("plays the connect cue and advances after 200ms on a completed sequence", () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const onRound = vi.fn();
      render(<DeskConsole progress={{ task: 2, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);

      act(() => { vi.advanceTimersByTime(3600); });
      fireEvent.click(screen.getByRole("button", { name: "Button A" }));
      fireEvent.click(screen.getByRole("button", { name: "Button A" }));
      fireEvent.click(screen.getByRole("button", { name: "Button A" }));

      expect(mayhemSfx.puzzleConnect).toHaveBeenCalledOnce();
      expect(onRound).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(200); });
      expect(onRound).toHaveBeenCalledOnce();
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
    expect(container.querySelector("path.mo-wire-live")).toHaveAttribute("stroke-width", "6");

    fireEvent.click(screen.getByRole("button", { name: "cyan port" }));
    expect(container.querySelector("path.mo-wire-jiggle")?.getAttribute("d")).toMatch(/^M 12 12\.5 Q /);
    expect(onRound).not.toHaveBeenCalled();
  });

  it("renders the minimalist wiring panel with anchored cable and terminal controls", () => {
    const { container } = render(<DeskConsole progress={{ task: 3, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);
    const svg = container.querySelector("svg.mo-wires")!;

    expect(container.querySelector(".mo-wire-schematic")).toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(screen.getByRole("button", { name: "cyan plug" })).toHaveClass("mo-wire-plug", "mo-p-cyan");
    expect(screen.getByRole("button", { name: "cyan port" })).toHaveClass("mo-wire-terminal", "mo-p-cyan");
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
    vi.useFakeTimers();
    const onRound = vi.fn();
    render(<DeskConsole progress={{ task: 1, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);

    const answerButtons = screen.getAllByRole("button");
    for (const btn of answerButtons) {
      fireEvent.click(btn);
      if (onRound.mock.calls.length) {
        act(() => { vi.advanceTimersByTime(180); });
        break;
      }
      act(() => { vi.advanceTimersByTime(300); });
    }

    expect(onRound).toHaveBeenCalledTimes(1);
    expect(mayhemSfx.generatorImpact).not.toHaveBeenCalled();
  });

  it("shows a red wrong-answer flash without shaking the terminal", () => {
    const { container } = render(<DeskConsole progress={{ task: 1, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);
    const hint = container.querySelector(".mo-stev-screen")?.textContent?.match(/\[ (.*?) \]/)?.[1].split(" ");
    const hintPosition = hint?.findIndex((digit) => digit !== "_") ?? -1;
    const wrongOption = Array.from(container.querySelectorAll<HTMLButtonElement>(".mo-code-rig .mo-con-btn"))
      .find((button) => button.textContent?.trim()[hintPosition] !== hint?.[hintPosition]);

    expect(wrongOption).toBeDefined();
    fireEvent.click(wrongOption!);

    expect(container.querySelector(".mo-code-rig")).not.toHaveClass("shake");
    expect(wrongOption).toHaveClass("bad");
  });

  it("charges the surge breaker with taps and waits for its completion flash", () => {
    vi.useFakeTimers();
    const onRound = vi.fn();
    const { unmount } = render(<DeskConsole progress={{ task: 4, round: 0, done: false }} onRound={onRound} onClose={vi.fn()} />);
    const breaker = screen.getByRole("button", { name: "Charge emergency surge breaker" });
    const meter = screen.getByRole("meter", { name: "Capacitor charge" });

    for (let i = 0; i < 24; i++) fireEvent.click(breaker);
    expect(meter).toHaveAttribute("aria-valuenow", "96");
    fireEvent.click(breaker);

    expect(meter).toHaveAttribute("aria-valuenow", "100");
    expect(onRound).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(350); });
    expect(onRound).toHaveBeenCalledOnce();
    unmount();
  });

  it("charges continuously while E is held", () => {
    vi.useFakeTimers();
    const { unmount } = render(<DeskConsole progress={{ task: 4, round: 0, done: false }} onRound={vi.fn()} onClose={vi.fn()} />);
    const meter = screen.getByRole("meter", { name: "Capacitor charge" });

    fireEvent.keyDown(window, { code: "KeyE" });
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.keyUp(window, { code: "KeyE" });

    expect(Number(meter.getAttribute("aria-valuenow"))).toBeGreaterThan(4);
    unmount();
  });
});