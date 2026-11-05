import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditsTab } from "./MainMenu";

// Stub audio helpers used elsewhere in MainMenu's module scope
vi.mock("./sfx", () => ({ sfx: { menuConfirm: () => {} } }));

describe("Credits screen credit total", () => {
  it("shows the real credit count instead of the bracketed note", () => {
    render(<CreditsTab />);

    const line = screen.getByText(/Vibe Coded Web-Game/i);
    expect(line.textContent).toContain("695.85");
    expect(line.textContent).not.toContain("[");
    expect(line.textContent).toContain("credits, which is wonderful");
  });
});
