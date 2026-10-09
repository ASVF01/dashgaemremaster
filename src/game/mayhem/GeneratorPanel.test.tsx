import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GeneratorPanel, { type GeneratorProgress } from "./GeneratorPanel";
import { mayhemSfx } from "@/game/sfx";

vi.mock("@/game/sfx", () => ({ mayhemSfx: { generatorHover: vi.fn(), generatorImpact: vi.fn(), generatorParry: vi.fn(), generatorCount: vi.fn() } }));
vi.mock("./useGeneratorMusic", () => ({ useGeneratorMusic: vi.fn() }));
vi.mock("@/game/settings", () => ({ useSettings: () => [{ bgmVolume: 1 }] }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const progress: GeneratorProgress = { percent: 0, round: 1, kind: "memory", seed: 17, memoryMatched: Array(6).fill(false) };
const props = { night: 2, paused: false, progress, onProgress: vi.fn(), onClose: vi.fn(), onComplete: vi.fn() };

describe("generator hover cues", () => {
  it("adds the boss parry cue only for doubled rewards", () => {
    const { rerender } = render(<GeneratorPanel {...props} />);
    rerender(<GeneratorPanel {...props} progress={{ ...progress, percent: 8, doubled: true }} />);
    expect(mayhemSfx.generatorImpact).toHaveBeenCalledWith(true);
    expect(mayhemSfx.generatorParry).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary rewards free of the bonus parry cue", () => {
    const { rerender } = render(<GeneratorPanel {...props} />);
    rerender(<GeneratorPanel {...props} progress={{ ...progress, percent: 4, doubled: false }} />);
    expect(mayhemSfx.generatorImpact).toHaveBeenCalledWith(false);
    expect(mayhemSfx.generatorParry).not.toHaveBeenCalled();
  });
  it("plays once on entering each memory button, not when moving within it", () => {
    render(<GeneratorPanel {...props} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.pointerOver(buttons[0]);
    // jsdom lacks PointerEvent; MouseEvent preserves relatedTarget for React's pointer handler.
    fireEvent(buttons[0], new MouseEvent("pointerover", { bubbles: true, relatedTarget: buttons[0] }));
    fireEvent(buttons[1], new MouseEvent("pointerover", { bubbles: true, relatedTarget: buttons[0] }));
    expect(mayhemSfx.generatorHover).toHaveBeenCalledTimes(2);
  });

  it("covers Flow cells too", () => {
    render(<GeneratorPanel {...props} progress={{ ...progress, kind: "flow" }} />);
    fireEvent.pointerOver(screen.getByRole("button", { name: "Flow cell 1, 1" }));
    expect(mayhemSfx.generatorHover).toHaveBeenCalledTimes(1);
  });

  it.each([{ paused: true }, { closing: true }])("stays silent while inactive: %j", (state) => {
    render(<GeneratorPanel {...props} {...state} />);
    fireEvent.pointerOver(screen.getAllByRole("button")[0]);
    expect(mayhemSfx.generatorHover).not.toHaveBeenCalled();
  });
});