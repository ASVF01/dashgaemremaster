import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { YouTubeTab } from "./MainMenu";

// Stub audio helpers used elsewhere in MainMenu's module scope
vi.mock("./sfx", () => ({ sfx: { menuConfirm: () => {} } }));

beforeEach(() => {
  // Make the reachability probe succeed so blocking only happens via the shortcut.
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(""))));
});

describe("YouTubeTab GoGuardian shortcut", () => {
  it("blocks all playlists when 1+Backspace is pressed", async () => {
    render(<YouTubeTab />);

    expect(screen.queryByText(/CURSE YOU GOGUARDIAN/i)).toBeNull();

    await act(async () => {
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "Backspace" });
    });

    expect(screen.getByText(/CURSE YOU GOGUARDIAN/i)).toBeInTheDocument();
  });

  it("does not block when only Backspace is pressed", async () => {
    render(<YouTubeTab />);
    await act(async () => {
      fireEvent.keyDown(window, { key: "Backspace" });
    });
    expect(screen.queryByText(/CURSE YOU GOGUARDIAN/i)).toBeNull();
  });
});
