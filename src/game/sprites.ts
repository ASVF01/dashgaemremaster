// Player sprite registry. Add more states as PNGs are uploaded.
// Each sprite should face RIGHT — the renderer mirrors for left.
import standUrl from "@/assets/sprites/stand.png";
import walkUrl from "@/assets/sprites/walk.png";
import jumpUrl from "@/assets/sprites/jump.png";
import slideUrl from "@/assets/sprites/slide.png";
import diveUrl from "@/assets/sprites/dive.png";

export type SpriteState = "idle" | "run" | "jump" | "fall" | "slide" | "dive";

const URLS: Partial<Record<SpriteState, string>> = {
  idle: standUrl,
  run: walkUrl,
  jump: jumpUrl,
  // fall: fallUrl,  // (falls back to jump until you upload one)
  slide: slideUrl,
  dive: diveUrl,
};

const cache: Partial<Record<SpriteState, HTMLImageElement>> = {};
const loaded: Partial<Record<SpriteState, boolean>> = {};

function load(state: SpriteState): HTMLImageElement | null {
  const url = URLS[state];
  if (!url) return null;
  if (cache[state]) return loaded[state] ? cache[state]! : null;
  const img = new Image();
  img.onload = () => { loaded[state] = true; };
  img.src = url;
  cache[state] = img;
  return null;
}

// Eager-load on module init so the first frame can use them.
(Object.keys(URLS) as SpriteState[]).forEach(load);

// Returns the best available sprite for the requested state, with sensible
// fallbacks (fall → jump → idle, dive → slide → idle, etc.).
export function getSprite(state: SpriteState): HTMLImageElement | null {
  const order: SpriteState[] =
    state === "fall"  ? ["fall", "jump", "idle"] :
    state === "dive"  ? ["dive", "slide", "jump", "idle"] :
    state === "slide" ? ["slide", "idle"] :
    state === "jump"  ? ["jump", "idle"] :
    state === "run"   ? ["run", "idle"] :
                        ["idle"];
  for (const s of order) {
    const img = cache[s];
    if (img && loaded[s]) return img;
    if (URLS[s] && !cache[s]) load(s);
  }
  return null;
}
