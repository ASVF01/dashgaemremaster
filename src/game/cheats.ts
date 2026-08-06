// Persistent cheat toggles, armed from the CHEATS tab in the shop.
const KEY = "sv_cheats_v1";

export type CheatFlag = "perfectAim";

type CheatState = Record<CheatFlag, boolean>;

const DEFAULTS: CheatState = { perfectAim: false };

function read(): CheatState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CheatState>) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(s: CheatState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function isCheatOn(flag: CheatFlag): boolean {
  return read()[flag];
}

/** Flips a cheat and returns its new value. */
export function toggleCheat(flag: CheatFlag): boolean {
  const s = read();
  s[flag] = !s[flag];
  write(s);
  return s[flag];
}

export function clearCheats() {
  write({ ...DEFAULTS });
}
