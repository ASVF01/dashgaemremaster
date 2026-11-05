import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_BINDS, loadBinds, saveBinds, keyLabel, matchesAction } from "./keybinds";

// Default bindings are Z = jump, X = parry, C = slide/dive, V = dash.
const KEYBINDS_KEY = "scribble-rush.keybinds.v1";

const LEGACY = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["Space", "KeyW", "ArrowUp"],
  slide: ["ShiftLeft", "KeyS", "ArrowDown"],
  parry: ["KeyJ", "ShiftRight"],
  dash: ["KeyK"],
};

describe("default keybinds", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to Z jump, X parry, C slide/dive, V dash", () => {
    expect(DEFAULT_BINDS.jump[0]).toBe("KeyZ");
    expect(DEFAULT_BINDS.parry[0]).toBe("KeyX");
    expect(DEFAULT_BINDS.slide[0]).toBe("KeyC");
    expect(DEFAULT_BINDS.dash[0]).toBe("KeyV");
  });

  it("labels the new keys as single letters", () => {
    expect(["KeyZ", "KeyX", "KeyC", "KeyV"].map(keyLabel)).toEqual(["Z", "X", "C", "V"]);
  });

  it("still accepts the older keys as alternates", () => {
    expect(matchesAction("KeyZ", "jump", DEFAULT_BINDS)).toBe(true);
    expect(matchesAction("Space", "jump", DEFAULT_BINDS)).toBe(true);
    expect(matchesAction("KeyX", "parry", DEFAULT_BINDS)).toBe(true);
    expect(matchesAction("KeyC", "slide", DEFAULT_BINDS)).toBe(true);
    expect(matchesAction("KeyV", "dash", DEFAULT_BINDS)).toBe(true);
    expect(matchesAction("KeyK", "dash", DEFAULT_BINDS)).toBe(true);
  });

  it("upgrades a save that was never customised", () => {
    localStorage.setItem(KEYBINDS_KEY, JSON.stringify(LEGACY));
    expect(loadBinds().jump[0]).toBe("KeyZ");
    expect(JSON.parse(localStorage.getItem(KEYBINDS_KEY)!).jump[0]).toBe("KeyZ");
  });

  it("keeps a player's own rebind", () => {
    saveBinds({ ...DEFAULT_BINDS, jump: ["KeyP"] });
    expect(loadBinds().jump).toEqual(["KeyP"]);
  });
});
