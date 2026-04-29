// Player sprite registry. Add more states as PNGs are uploaded.
// Each sprite should face RIGHT — the renderer mirrors for left.
import standUrl from "@/assets/sprites/stand.png";
import walkUrl from "@/assets/sprites/walk.png";
import jumpUrl from "@/assets/sprites/jump.png";
import slideUrl from "@/assets/sprites/slide.png";
import diveUrl from "@/assets/sprites/dive.png";
import dashUrl from "@/assets/sprites/dash.png";
import runFast1 from "@/assets/sprites/run_fast_1.png";
import runFast2 from "@/assets/sprites/run_fast_2.png";
import runFast3 from "@/assets/sprites/run_fast_3.png";
import runFast4 from "@/assets/sprites/run_fast_4.png";

export type SpriteState = "idle" | "run" | "runFast" | "jump" | "fall" | "slide" | "dive" | "dash";

const URLS: Partial<Record<SpriteState, string>> = {
  idle: standUrl,
  run: walkUrl,
  jump: jumpUrl,
  // fall: fallUrl,  // (falls back to jump until you upload one)
  slide: slideUrl,
  dive: diveUrl,
  dash: dashUrl,
};

// Animation cycles — array of frame URLs, played in order.
const CYCLES: Partial<Record<SpriteState, string[]>> = {
  runFast: [runFast1, runFast2, runFast3, runFast4],
};

const cache: Partial<Record<SpriteState, HTMLImageElement>> = {};
const loaded: Partial<Record<SpriteState, boolean>> = {};
const cycleCache: Partial<Record<SpriteState, HTMLImageElement[]>> = {};
const cycleLoaded: Partial<Record<SpriteState, boolean[]>> = {};

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

function loadCycle(state: SpriteState) {
  const urls = CYCLES[state];
  if (!urls) return;
  if (cycleCache[state]) return;
  const imgs: HTMLImageElement[] = [];
  const flags: boolean[] = urls.map(() => false);
  urls.forEach((u, i) => {
    const img = new Image();
    img.onload = () => { flags[i] = true; };
    img.src = u;
    imgs.push(img);
  });
  cycleCache[state] = imgs;
  cycleLoaded[state] = flags;
}

// Eager-load on module init so the first frame can use them.
(Object.keys(URLS) as SpriteState[]).forEach(load);
(Object.keys(CYCLES) as SpriteState[]).forEach(loadCycle);

// Returns the best available sprite for the requested state, with sensible
// fallbacks (fall → jump → idle, dive → slide → idle, etc.).
// `frame` is an arbitrary integer used to pick a frame for animated cycles.
export function getSprite(state: SpriteState, frame = 0): HTMLImageElement | null {
  // animated cycle?
  const cyc = cycleCache[state];
  if (cyc && cyc.length) {
    const flags = cycleLoaded[state]!;
    // try requested frame, then walk forward to find any loaded one
    for (let i = 0; i < cyc.length; i++) {
      const idx = ((frame % cyc.length) + i) % cyc.length;
      if (flags[idx]) return cyc[idx];
    }
    // not loaded yet — fall through to fallbacks
  }

  const order: SpriteState[] =
    state === "runFast" ? ["runFast", "run", "idle"] :
    state === "fall"  ? ["fall", "jump", "idle"] :
    state === "dive"  ? ["dive", "slide", "jump", "idle"] :
    state === "slide" ? ["slide", "idle"] :
    state === "jump"  ? ["jump", "idle"] :
    state === "dash"  ? ["dash", "run", "idle"] :
    state === "run"   ? ["run", "idle"] :
                        ["idle"];
  for (const s of order) {
    const img = cache[s];
    if (img && loaded[s]) return img;
    if (URLS[s] && !cache[s]) load(s);
  }
  return null;
}
