import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExtrasTab } from "./MainMenu";

// Any sfx member may be touched (gallery buttons, loop cleanup on unmount).
vi.mock("./sfx", () => ({
  sfx: new Proxy({}, { get: () => () => {} }),
  setSfxVolume: () => {},
  unlockAudio: () => {},
}));

describe("EXTRAS tab", () => {
  it("shows the update log inside EXTRAS", () => {
    const { unmount } = render(<ExtrasTab onPlay={() => {}} />);

    expect(screen.getByText("UPDATE LOG")).toBeInTheDocument();
    expect(screen.getByText("v1.0")).toBeInTheDocument();

    unmount();
  });
});
