import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VentArtwork from "./VentArtwork";

describe("vent artwork fallback", () => {
  it("shows a local NEO-MATA illustration when the hosted image fails", () => {
    render(
      <VentArtwork
        src="/vent.png"
        alt="NEO-MATA in the vent"
        present
        shocked={false}
        onVentRef={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "NEO-MATA in the vent" })).toHaveAttribute("src", expect.stringContaining("vent_mata_local.png"));
    fireEvent.error(screen.getByRole("img", { name: "NEO-MATA in the vent" }));

    expect(screen.getByRole("img", { name: "NEO-MATA in the vent" }).tagName.toLowerCase()).toBe("svg");
  });

  it("keeps the shock animation class on the local fallback", () => {
    render(
      <VentArtwork
        src="/vent.png"
        alt="NEO-MATA in the vent"
        present
        shocked
        onVentRef={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "NEO-MATA in the vent" })).toHaveAttribute("src", expect.stringContaining("vent_mata_shocked_local.png"));
    fireEvent.error(screen.getByRole("img", { name: "NEO-MATA in the vent" }));

    expect(screen.getByRole("img", { name: "NEO-MATA in the vent" })).toHaveClass("mo-mata-shocked");
  });
});
