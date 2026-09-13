// Full "nuke the save" helper used by Settings → Reset game progress.
import { resetSettings } from "@/game/settings";
import { resetShop } from "@/game/shop";
import { resetCharacterProgress } from "@/game/character";

/** Every localStorage key this game writes to. */
const PROGRESS_KEYS = [
  "dashgaem_level_stats_v1",
  "dashgaem_starvanisher_hs_v1",
  "dashgaem_starvanisher_tut_v1",
  "dashgaem_tokens_v1",
  "dashgaem_shop_owned_v1",
  "dashgaem_shop_beamskin_v1",
  "dashgaem_shop_abilities_v1",
  "dashgaem_character_v1",
  "dashgaem_settings_v1",
  "scribble-rush.keybinds.v1",
  "badge_jrb",
  "badge_face",
  "dark_mode",
  "sv_cheats_v1",
  NIGHT_KEY,
];

// ---- MAYHEM night counter + animatronic AI levels ----

const NIGHT_KEY = "dashgaem_mayhem_night_v1";

/** AI level (1–20) per night. Night 5+: 50/50 movement chance every 5s. */
export function mayhemAiLevel(night: number): number {
  const table = [2, 4, 6, 8, 10];
  return table[Math.min(Math.max(night, 1), 5) - 1];
}

export function getMayhemNight(): number {
  try {
    const n = Number(localStorage.getItem(NIGHT_KEY));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  } catch {
    return 1;
  }
}

export function setMayhemNight(night: number) {
  try { localStorage.setItem(NIGHT_KEY, String(Math.max(1, Math.floor(night)))); } catch { /* noop */ }
}

/** Clears saves, best times, tokens, badges, unlocks and settings. */
export function resetAllProgress() {
  try {
    for (const k of PROGRESS_KEYS) localStorage.removeItem(k);
    // catch any stray dashgaem_* keys added later
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("dashgaem_")) localStorage.removeItem(k);
    }
  } catch { /* noop */ }

  // Reset the in-memory stores so the UI updates without a reload.
  resetShop();
  resetCharacterProgress();
  resetSettings();
  try { window.dispatchEvent(new CustomEvent("dashgaem-level-stats")); } catch { /* noop */ }
}
