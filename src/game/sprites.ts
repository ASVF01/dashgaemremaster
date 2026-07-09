// Player sprite registry. Add more states as PNGs are uploaded.
// Each sprite should face RIGHT — the renderer mirrors for left.
import standUrl from "@/assets/sprites/stand.png";
import walkUrl from "@/assets/sprites/walk.png";
import jumpUrl from "@/assets/sprites/jump.png";
import slideUrl from "@/assets/sprites/slide.png";
import diveUrl from "@/assets/sprites/dive.png";
import fallUrl from "@/assets/sprites/fall.png";
import dashUrl from "@/assets/sprites/dash.png";
import skidUrl from "@/assets/sprites/skid.png";
import hurtUrl from "@/assets/sprites/hurt.png";
import runFast1 from "@/assets/sprites/run_fast_1.png";
import runFast2 from "@/assets/sprites/run_fast_2.png";
import runFast3 from "@/assets/sprites/run_fast_3.png";
import runFast4 from "@/assets/sprites/run_fast_4.png";
import superDash1 from "@/assets/sprites/super_dash_1.png";
import superDash2 from "@/assets/sprites/super_dash_2.png";
import superDash3 from "@/assets/sprites/super_dash_3.png";
import beamAtkUrl from "@/assets/sprites/beam_atk.png";
import beamAtkJumpUrl from "@/assets/sprites/beam_atk_jump.png";
import altIdleAsset from "@/assets/sprites/alternate/alt_idle.png.asset.json";
import altWalkAsset from "@/assets/sprites/alternate/alt_walk.png.asset.json";
import altJumpAsset from "@/assets/sprites/alternate/alt_jump.png.asset.json";
import altRun1 from "@/assets/sprites/alternate/alt_run_1.png.asset.json";
import altRun2 from "@/assets/sprites/alternate/alt_run_2.png.asset.json";
import altRun3 from "@/assets/sprites/alternate/alt_run_3.png.asset.json";
import altRun4 from "@/assets/sprites/alternate/alt_run_4.png.asset.json";
import altRun5 from "@/assets/sprites/alternate/alt_run_5.png.asset.json";
import altRun6 from "@/assets/sprites/alternate/alt_run_6.png.asset.json";
import altRun7 from "@/assets/sprites/alternate/alt_run_7.png.asset.json";
import altRun8 from "@/assets/sprites/alternate/alt_run_8.png.asset.json";
import altSlideAsset from "@/assets/sprites/alternate/alt_slide.png.asset.json";
import altSkidAsset from "@/assets/sprites/alternate/alt_skid.png.asset.json";
import altFallAsset from "@/assets/sprites/alternate/alt_fall.png.asset.json";
import altDashAsset from "@/assets/sprites/alternate/alt_dash.png.asset.json";
import altDiveAsset from "@/assets/sprites/alternate/alt_dive.png.asset.json";
import altReadyAsset from "@/assets/sprites/alternate/alt_ready.png.asset.json";
import altAimAsset from "@/assets/sprites/alternate/alt_aim.png.asset.json";
import altFireAsset from "@/assets/sprites/alternate/alt_fire.png.asset.json";
import { getSelectedCharacter, type CharacterId } from "@/game/character";

export type SpriteState = "idle" | "run" | "runFast" | "jump" | "fall" | "slide" | "dive" | "dash" | "skid" | "superDash" | "hurt" | "beam" | "beamJump";

const URLS: Partial<Record<SpriteState, string>> = {
  idle: standUrl,
  run: walkUrl,
  jump: jumpUrl,
  fall: fallUrl,
  slide: slideUrl,
  dive: diveUrl,
  dash: dashUrl,
  skid: skidUrl,
  hurt: hurtUrl,
  beam: beamAtkUrl,
  beamJump: beamAtkJumpUrl,
};

// Animation cycles — array of frame URLs, played in order.
const CYCLES: Partial<Record<SpriteState, string[]>> = {
  runFast: [runFast1, runFast2, runFast3, runFast4],
  superDash: [superDash1, superDash2, superDash3],
};

// Per-character sprite overrides. Missing states fall back to the default
// (stick) URLS/CYCLES so partial sprite sets still render sensibly.
const CHAR_URLS: Partial<Record<CharacterId, Partial<Record<SpriteState, string>>>> = {
  x3mode: {
    idle: altIdleAsset.url,
    run: altWalkAsset.url,
    jump: altJumpAsset.url,
    slide: altSlideAsset.url,
    skid: altSkidAsset.url,
    fall: altFallAsset.url,
    dash: altDashAsset.url,
    dive: altDiveAsset.url,
  },
};

const CHAR_CYCLES: Partial<Record<CharacterId, Partial<Record<SpriteState, string[]>>>> = {
  x3mode: {
    // Alternate has an 8-frame run cycle — used as his fast-run animation.
    runFast: [
      altRun1.url, altRun2.url, altRun3.url, altRun4.url,
      altRun5.url, altRun6.url, altRun7.url, altRun8.url,
    ],
  },
};

type Key = string; // `${characterId}:${state}`
const cache: Record<Key, HTMLImageElement> = {};
const loaded: Record<Key, boolean> = {};
const cycleCache: Record<Key, HTMLImageElement[]> = {};
const cycleLoaded: Record<Key, boolean[]> = {};

function urlFor(char: CharacterId, state: SpriteState): string | undefined {
  return CHAR_URLS[char]?.[state] ?? URLS[state];
}
function cycleFor(char: CharacterId, state: SpriteState): string[] | undefined {
  return CHAR_CYCLES[char]?.[state] ?? CYCLES[state];
}

function load(char: CharacterId, state: SpriteState): HTMLImageElement | null {
  const url = urlFor(char, state);
  if (!url) return null;
  const key = `${char}:${state}`;
  if (cache[key]) return loaded[key] ? cache[key]! : null;
  const img = new Image();
  img.onload = () => { loaded[key] = true; };
  img.src = url;
  cache[key] = img;
  return null;
}

function loadCycle(char: CharacterId, state: SpriteState) {
  const urls = cycleFor(char, state);
  if (!urls) return;
  const key = `${char}:${state}`;
  if (cycleCache[key]) return;
  const imgs: HTMLImageElement[] = [];
  const flags: boolean[] = urls.map(() => false);
  urls.forEach((u, i) => {
    const img = new Image();
    img.onload = () => { flags[i] = true; };
    img.src = u;
    imgs.push(img);
  });
  cycleCache[key] = imgs;
  cycleLoaded[key] = flags;
}

// Eager-load default character on module init so the first frame can use them.
(Object.keys(URLS) as SpriteState[]).forEach((s) => load("stick", s));
(Object.keys(CYCLES) as SpriteState[]).forEach((s) => loadCycle("stick", s));
// Also warm alternate overrides so switching in-game is instant.
(Object.keys(CHAR_URLS.x3mode ?? {}) as SpriteState[]).forEach((s) => load("x3mode", s));
(Object.keys(CHAR_CYCLES.x3mode ?? {}) as SpriteState[]).forEach((s) => loadCycle("x3mode", s));

// Public gallery: every sprite (and animated cycle frame) with a label.
// Used by the SPRITE GALLERY in the main menu.
export type GallerySprite = { id: string; label: string; url: string };
export const SPRITE_GALLERY: GallerySprite[] = [
  { id: "idle",       label: "IDLE",         url: standUrl },
  { id: "run",        label: "RUN",          url: walkUrl },
  { id: "runFast-1",  label: "RUN FAST 1",   url: runFast1 },
  { id: "runFast-2",  label: "RUN FAST 2",   url: runFast2 },
  { id: "runFast-3",  label: "RUN FAST 3",   url: runFast3 },
  { id: "runFast-4",  label: "RUN FAST 4",   url: runFast4 },
  { id: "jump",       label: "JUMP",         url: jumpUrl },
  { id: "fall",       label: "FALL",         url: fallUrl },
  { id: "slide",      label: "SLIDE",        url: slideUrl },
  { id: "dive",       label: "DIVE",         url: diveUrl },
  { id: "dash",       label: "DASH",         url: dashUrl },
  { id: "skid",       label: "SKID",         url: skidUrl },
  { id: "superDash-1",label: "SUPER DASH 1", url: superDash1 },
  { id: "superDash-2",label: "SUPER DASH 2", url: superDash2 },
  { id: "superDash-3",label: "SUPER DASH 3", url: superDash3 },
  { id: "hurt",       label: "HURT",         url: hurtUrl },
  { id: "beam",       label: "BEAM ATK",     url: beamAtkUrl },
  { id: "beamJump",   label: "BEAM JUMP",    url: beamAtkJumpUrl },
];

// Returns the best available sprite for the requested state, with sensible
// fallbacks (fall → jump → idle, dive → slide → idle, etc.).
// `frame` is an arbitrary integer used to pick a frame for animated cycles.
export function getSprite(state: SpriteState, frame = 0): HTMLImageElement | null {
  const char = getSelectedCharacter();
  const key = (c: CharacterId, s: SpriteState) => `${c}:${s}`;

  // animated cycle? (currently only from default character)
  const cyc = cycleCache[key(char, state)] ?? cycleCache[key("stick", state)];
  if (cyc && cyc.length) {
    const flags = cycleLoaded[key(char, state)] ?? cycleLoaded[key("stick", state)]!;
    for (let i = 0; i < cyc.length; i++) {
      const idx = ((frame % cyc.length) + i) % cyc.length;
      if (flags[idx]) return cyc[idx];
    }
  }

  const order: SpriteState[] =
    state === "superDash" ? ["superDash", "runFast", "run", "idle"] :
    state === "runFast" ? ["runFast", "run", "idle"] :
    state === "fall"  ? ["fall", "jump", "idle"] :
    state === "dive"  ? ["dive", "slide", "jump", "idle"] :
    state === "slide" ? ["slide", "idle"] :
    state === "skid"  ? ["skid", "run", "idle"] :
    state === "hurt"  ? ["hurt", "idle"] :
    state === "jump"  ? ["jump", "idle"] :
    state === "beam"  ? ["beam", "idle"] :
    state === "beamJump" ? ["beamJump", "beam", "jump", "idle"] :
    state === "dash"  ? ["dash", "run", "idle"] :
    state === "run"   ? ["run", "idle"] :
                        ["idle"];
  // Try the selected character first, then fall back to the default (stick).
  const chars: CharacterId[] = char === "stick" ? ["stick"] : [char, "stick"];
  for (const c of chars) {
    for (const s of order) {
      const k = key(c, s);
      const img = cache[k];
      if (img && loaded[k]) return img;
      if (urlFor(c, s) && !cache[k]) load(c, s);
    }
  }
  return null;
}
