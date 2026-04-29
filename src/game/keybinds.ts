// Keybinds — persisted in localStorage, shared between menu UI and GameCanvas.
import { useEffect, useState } from "react";

export type ActionId = "left" | "right" | "jump" | "slide" | "parry" | "dash";

export type Keybinds = Record<ActionId, string[]>; // KeyboardEvent.code values

export const ACTIONS: { id: ActionId; label: string; desc: string }[] = [
  { id: "left",  label: "MOVE LEFT",  desc: "run left" },
  { id: "right", label: "MOVE RIGHT", desc: "run right" },
  { id: "jump",  label: "JUMP",       desc: "hold for higher jump" },
  { id: "slide", label: "SLIDE / DIVE", desc: "slide on ground, dive in air" },
  { id: "parry", label: "PARRY",      desc: "deflect projectiles + counter" },
  { id: "dash",  label: "DASH",       desc: "burst forward (2.5s cooldown)" },
];

export const DEFAULT_BINDS: Keybinds = {
  left:  ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump:  ["Space", "KeyW", "ArrowUp"],
  slide: ["ShiftLeft", "KeyS", "ArrowDown"],
  parry: ["KeyJ", "ShiftRight"],
  dash:  ["KeyK"],
};

const STORAGE_KEY = "scribble-rush.keybinds.v1";

export function loadBinds(): Keybinds {
  if (typeof window === "undefined") return DEFAULT_BINDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BINDS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BINDS, ...parsed };
  } catch {
    return DEFAULT_BINDS;
  }
}

export function saveBinds(b: Keybinds) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* noop */ }
}

// Friendly label for a KeyboardEvent.code
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "SPACE";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "ShiftLeft") return "L-SHIFT";
  if (code === "ShiftRight") return "R-SHIFT";
  if (code === "ControlLeft") return "L-CTRL";
  if (code === "ControlRight") return "R-CTRL";
  if (code === "AltLeft") return "L-ALT";
  if (code === "AltRight") return "R-ALT";
  if (code === "Enter") return "ENTER";
  if (code === "Escape") return "ESC";
  if (code === "Tab") return "TAB";
  if (code === "Backspace") return "BKSP";
  return code.toUpperCase();
}

// Live binds singleton (so GameCanvas's keydown handler always sees latest)
let LIVE: Keybinds = loadBinds();
const listeners = new Set<(b: Keybinds) => void>();

export function getLiveBinds(): Keybinds { return LIVE; }
export function setLiveBinds(b: Keybinds) {
  LIVE = b; saveBinds(b); listeners.forEach((fn) => fn(b));
}
export function subscribeBinds(fn: (b: Keybinds) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useKeybinds(): [Keybinds, (b: Keybinds) => void] {
  const [b, setB] = useState<Keybinds>(LIVE);
  useEffect(() => { const u = subscribeBinds(setB); return () => { u(); }; }, []);
  return [b, setLiveBinds];
}

export function isPressed(keys: Record<string, boolean>, action: ActionId, b: Keybinds = LIVE): boolean {
  return b[action].some((c) => keys[c]);
}

export function matchesAction(code: string, action: ActionId, b: Keybinds = LIVE): boolean {
  return b[action].includes(code);
}
