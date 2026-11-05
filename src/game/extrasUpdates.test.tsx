import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExtrasTab } from "./MainMenu";

vi.mock("./sfx", () => ({
  sfx: { menuConfirm: () => {} },
  setSfxVolume: () => {},
  unlockAudio: () => {},
}));

describe("EXTRAS tab", () => {
  it("shows the update log inside EXTRAS", () => {
    render(<ExtrasTab onPlay={() => {}} />);

    expect(screen.getByText("UPDATE LOG")).toBeInTheDocument();
    expect(screen.getByText("v1.0")).toBeInTheDocument();
  });
});
