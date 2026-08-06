// SHOP — tokens ("T") economy, beam skins and Star Vanisher abilities.
// Everything is persisted locally and read by both the shop UI and the
// Star Vanisher mini game.

const TOKENS_KEY = "dashgaem_tokens_v1";
const OWNED_KEY = "dashgaem_shop_owned_v1";
const EQUIP_SKIN_KEY = "dashgaem_shop_beamskin_v1";
const EQUIP_ABIL_KEY = "dashgaem_shop_abilities_v1";

export const MAX_ABILITY_SLOTS = 2;

export type BeamSkin = {
  id: string;
  name: string;
  price: number;
  /** inner core colour */
  core: string;
  /** outer beam colour */
  edge: string;
  /** particle / accent colour */
  accent: string;
  desc: string;
};

export type Ability = {
  id: string;
  name: string;
  price: number;
  desc: string;
};

export const BEAM_SKINS: BeamSkin[] = [
  { id: "default", name: "STOCK PINK", price: 0, core: "#ffffff", edge: "#ff4d86", accent: "#ffd3e2", desc: "The beam you already own. Loud and rude." },
  { id: "voltage", name: "VOLTAGE", price: 400, core: "#f4ffff", edge: "#39e0ff", accent: "#b6f6ff", desc: "Crackling cyan. Reads cleaner on big stars." },
  { id: "acid", name: "ACID GREEN", price: 650, core: "#f6ffe8", edge: "#8bff3a", accent: "#d9ff9c", desc: "Toxic sludge cannon. Smells illegal." },
  { id: "sunburst", name: "SUNBURST", price: 900, core: "#fffbe6", edge: "#ffb02e", accent: "#ffe08a", desc: "A slab of daylight, fired sideways." },
  { id: "violet", name: "VIOLET HOUR", price: 1200, core: "#f6ecff", edge: "#a24dff", accent: "#dcbaff", desc: "Quiet, expensive, a little smug." },
  { id: "alternate", name: "X3 CRIMSON", price: 2000, core: "#ffecec", edge: "#ff2130", accent: "#ff8a8a", desc: "THE ALTERNATE's colours. Hits like a grudge." },
  { id: "void", name: "VOID INK", price: 2600, core: "#c8c8ff", edge: "#1b1b2e", accent: "#8f8fd6", desc: "A beam of pure nothing. Somehow still explodes." },
];

export const ABILITIES: Ability[] = [
  { id: "steady", name: "STEADY HAND", price: 700, desc: "The vanish field pulses 20% slower. Easier reads." },
  { id: "wide", name: "WIDE EYE", price: 1000, desc: "PERFECT and OKAY windows are 25% more forgiving." },
  { id: "greed", name: "GREED", price: 1400, desc: "+30% score, but the field pulses 15% faster." },
  { id: "revive", name: "SECOND WIND", price: 2200, desc: "Survive your first MISS of a run, once per run." },
  { id: "payday", name: "PAYDAY", price: 1800, desc: "+50% tokens earned from every run." },
];

export type ShopState = {
  tokens: number;
  owned: string[];
  beamSkin: string;
  abilities: string[];
};

function readNum(key: string, fallback: number) {
  try {
    const raw = Number(localStorage.getItem(key));
    return Number.isFinite(raw) ? raw : fallback;
  } catch { return fallback; }
}

function readList(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

let state: ShopState = {
  tokens: readNum(TOKENS_KEY, 0),
  owned: readList(OWNED_KEY),
  beamSkin: (() => {
    try { return localStorage.getItem(EQUIP_SKIN_KEY) ?? "default"; } catch { return "default"; }
  })(),
  abilities: readList(EQUIP_ABIL_KEY),
};

const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(TOKENS_KEY, String(state.tokens));
    localStorage.setItem(OWNED_KEY, JSON.stringify(state.owned));
    localStorage.setItem(EQUIP_SKIN_KEY, state.beamSkin);
    localStorage.setItem(EQUIP_ABIL_KEY, JSON.stringify(state.abilities));
  } catch { /* noop */ }
  listeners.forEach((fn) => fn());
}

export function getShop(): ShopState { return state; }

export function subscribeShop(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function addTokens(n: number) {
  state = { ...state, tokens: Math.max(0, Math.round(state.tokens + n)) };
  persist();
}

export function isOwned(id: string) {
  return id === "default" || state.owned.includes(id);
}

export function buy(id: string, price: number): boolean {
  if (isOwned(id) || state.tokens < price) return false;
  state = { ...state, tokens: state.tokens - price, owned: [...state.owned, id] };
  persist();
  return true;
}

export function equipBeamSkin(id: string) {
  if (!isOwned(id)) return;
  state = { ...state, beamSkin: id };
  persist();
}

export function toggleAbility(id: string) {
  if (!isOwned(id)) return;
  const on = state.abilities.includes(id);
  let next = on ? state.abilities.filter((a) => a !== id) : [...state.abilities, id];
  if (next.length > MAX_ABILITY_SLOTS) next = next.slice(next.length - MAX_ABILITY_SLOTS);
  state = { ...state, abilities: next };
  persist();
}

export function activeBeamSkin(): BeamSkin {
  return BEAM_SKINS.find((s) => s.id === state.beamSkin) ?? BEAM_SKINS[0];
}

export function hasAbility(id: string) {
  return state.abilities.includes(id);
}

/** score -> tokens conversion for a finished Star Vanisher run */
export function tokensForScore(score: number) {
  const base = Math.floor(score / 100);
  return hasAbility("payday") ? Math.floor(base * 1.5) : base;
}
