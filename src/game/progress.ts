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
];

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
