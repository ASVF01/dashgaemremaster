import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GeneratorArtwork from "./GeneratorArtwork";

vi.mock("@/assets/mayhem/generator_panel_local.png", () => ({
  default: "/src/assets/mayhem/generator_panel_local.png",
}));

describe("generator artwork", () => {
  it("uses the bundled Stevenson image", () => {
    render(<GeneratorArtwork className="generator-test" />);

    expect(screen.getByRole("img", { name: "Stevenson's Ultra Power Generator 9000" }))
      .toHaveAttribute("src", expect.stringContaining("generator_panel_local.png"));
  });

  it("keeps a visual fallback if the bundled image cannot be decoded", () => {
    render(<GeneratorArtwork className="generator-test" />);
    fireEvent.error(screen.getByRole("img", { name: "Stevenson's Ultra Power Generator 9000" }));

    expect(screen.getByRole("img", { name: "Stevenson's Ultra Power Generator 9000" }).tagName.toLowerCase()).toBe("svg");
  });
});
