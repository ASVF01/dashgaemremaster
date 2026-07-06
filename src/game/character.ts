// Selected playable character + unlock state, persisted to localStorage.
// A tiny pub/sub so the game loop / sprite registry can read live values
// without React re-renders.
import { useEffect, useState } from "react";

export type CharacterId = "stick" | "dasher" | "shadow" | "x3mode";

export type CharacterState = {
  selected: CharacterId;
  unlocked: Record<CharacterId, boolean>;
};

const DEFAULTS: CharacterState = {
  selected: "stick",
  unlocked: { stick: true, dasher: true, shadow: true, x3mode: false },
};

const KEY = "dashgaem_character_v1";

let current: CharacterState = load();
const listeners = new Set<(s: CharacterState) => void>();

function load(): CharacterState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, unlocked: { ...DEFAULTS.unlocked } };
    const parsed = JSON.parse(raw) as Partial<CharacterState>;
    return {
      selected: parsed.selected ?? DEFAULTS.selected,
      unlocked: { ...DEFAULTS.unlocked, ...(parsed.unlocked ?? {}) },
    };
  } catch {
    return { ...DEFAULTS, unlocked: { ...DEFAULTS.unlocked } };
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* noop */ }
}

function emit() { listeners.forEach((l) => l(current)); }

export function getCharacterState(): CharacterState { return current; }
export function getSelectedCharacter(): CharacterId { return current.selected; }
export function isUnlocked(id: CharacterId): boolean { return !!current.unlocked[id]; }

export function selectCharacter(id: CharacterId) {
  if (!current.unlocked[id]) return;
  if (current.selected === id) return;
  current = { ...current, selected: id };
  persist(); emit();
}

export function unlockCharacter(id: CharacterId) {
  if (current.unlocked[id]) return;
  current = { ...current, unlocked: { ...current.unlocked, [id]: true } };
  persist(); emit();
}

export function useCharacter(): CharacterState {
  const [state, setState] = useState<CharacterState>(current);
  useEffect(() => {
    const fn = (s: CharacterState) => setState(s);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return state;
}
