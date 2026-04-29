// Background music with seamless WebAudio crossfade looping.
// Decodes each track to an AudioBuffer once, then schedules overlapping
// source nodes with an equal-power crossfade at the loop point so there's
// no click/gap on loop.
import bgmJustRunBro from "@/assets/audio/bgm_just_run_bro.mp3";
import bgmMenu from "@/assets/audio/bgm_menu.mp3";
import bgmChampionPlay from "@/assets/audio/bgm_champion_play.mp3";
import bgmChampionDuel2 from "@/assets/audio/bgm_champion_duel2.mp3";
import bgmTutorial from "@/assets/audio/bgm_tutorial.mp3";
import bgmStarman from "@/assets/audio/bgm_starman.mp3";
import bgmSomSom from "@/assets/audio/a_lil_som_som.mp3";
import type { LevelId } from "@/game/level";

// Tutorial keeps its own original track. Champion play is the default for
// the rest, with chase getting the duel theme and just-run-bro its vibes.
const TRACKS: Partial<Record<LevelId, string>> = {
  tutorial: bgmTutorial,
  "scribble-1": bgmChampionPlay,
  "scribble-2": bgmChampionPlay,
  "scribble-3": bgmChampionPlay,
  "speed-test": bgmChampionPlay,
  chase: bgmChampionDuel2,
  "just-run-bro": bgmJustRunBro,
};

// Crossfade length in seconds for the seamless LOOP point inside one track.
// Short enough to be inaudible, long enough to mask the loop seam.
const CROSSFADE = 0.12;
// Longer crossfade used when switching BETWEEN different tracks (level
// transitions). Long enough to feel musical, short enough to feel snappy.
const TRACK_FADE = 0.35;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let lowpass: BiquadFilterNode | null = null;
let muted = false;
let volume = 0.35;
// Multiplier applied on top of `volume` when the level has ended (duck).
let endDuck = 1;

const bufferCache = new Map<string, AudioBuffer>();
const decodingCache = new Map<string, Promise<AudioBuffer>>();

// State of the currently-playing track
type Playing = {
  src: string;
  buffer: AudioBuffer;
  // The currently-audible source and its envelope gain
  source: AudioBufferSourceNode;
  gain: GainNode;
  // The next scheduled source for the crossfade (created ahead of time)
  nextSource: AudioBufferSourceNode | null;
  nextGain: GainNode | null;
  // ctx.currentTime at which the current source started playing (in track time = 0)
  startedAt: number;
  // The next scheduled loop boundary (ctx.currentTime when next source begins)
  nextLoopAt: number;
  rafId: number | null;
  stopped: boolean;
};

let playing: Playing | null = null;
let playRequestId = 0;

// "Open" lowpass cutoff — effectively bypasses filtering.
const LP_OPEN = 20000;
// Cutoff used when the level ends — ~50% perceived openness.
const LP_END = 480;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : volume * endDuck;
    lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = LP_OPEN;
    lowpass.Q.value = 0.7;
    masterGain.connect(lowpass);
    lowpass.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

async function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(src);
  if (cached) return cached;
  const inflight = decodingCache.get(src);
  if (inflight) return inflight;
  const c = ac();
  if (!c) throw new Error("no AudioContext");
  const p = (async () => {
    const res = await fetch(src);
    const arr = await res.arrayBuffer();
    const buf = await c.decodeAudioData(arr);
    bufferCache.set(src, buf);
    decodingCache.delete(src);
    return buf;
  })();
  decodingCache.set(src, p);
  return p;
}

// Schedule a source to start at `when` (ctx time), playing `buffer` from offset 0,
// fading in over CROSSFADE. Returns the source + its gain node.
function scheduleSource(c: AudioContext, buffer: AudioBuffer, when: number, fadeIn: boolean) {
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  if (fadeIn) {
    // equal-power-ish fade in
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(1, when + CROSSFADE);
  } else {
    g.gain.setValueAtTime(1, when);
  }
  src.connect(g).connect(masterGain!);
  src.start(when);
  return { src, g };
}

// Schedule the crossfade-out for the currently playing source, ending at `endAt`.
function scheduleFadeOut(g: GainNode, endAt: number) {
  // Hold full volume until the crossfade window starts, then ramp to 0
  // by the time the next source has fully faded in.
  const startFade = endAt - CROSSFADE;
  g.gain.cancelScheduledValues(startFade);
  g.gain.setValueAtTime(1, startFade);
  g.gain.linearRampToValueAtTime(0.0001, endAt);
}

// Loop scheduler: keep one "next" source pre-armed so the crossfade is
// sample-accurate. Re-arm whenever the current "next" becomes the active one.
function armNextLoop(c: AudioContext) {
  if (!playing) return;
  const { buffer, gain, startedAt } = playing;
  const dur = buffer.duration;
  // Loop boundary time on the ctx clock = when this iteration ends.
  const loopBoundary = startedAt + dur;
  // Start the next source CROSSFADE seconds before the boundary so they overlap.
  const nextStart = loopBoundary - CROSSFADE;

  // Schedule the next source (fade in) and the current source's fade out
  const next = scheduleSource(c, buffer, nextStart, true);
  scheduleFadeOut(gain, loopBoundary);

  playing.nextSource = next.src;
  playing.nextGain = next.g;
  playing.nextLoopAt = nextStart;

  // When the boundary passes, promote `next` to current and re-arm.
  const promoteAt = loopBoundary; // both sources are audible until here
  const tick = () => {
    if (!playing || playing.stopped) return;
    const now = c.currentTime;
    if (now >= promoteAt) {
      // Stop the old source slightly after the fade ends to free it.
      try { playing.source.stop(now + 0.05); } catch { /* already stopped */ }
      playing.source = playing.nextSource!;
      playing.gain = playing.nextGain!;
      playing.nextSource = null;
      playing.nextGain = null;
      // The new "current" source started at nextStart (= loopBoundary - CROSSFADE),
      // but its track-time-zero is `nextStart` on the ctx clock.
      playing.startedAt = nextStart;
      armNextLoop(c);
      return;
    }
    playing.rafId = requestAnimationFrame(tick);
  };
  playing.rafId = requestAnimationFrame(tick);
}

// Crossfade the currently-playing track out over `dur` seconds, starting at
// `startAt` (ctx time). The source is stopped just after the fade ends.
function fadeOutCurrent(c: AudioContext, dur: number, startAt: number) {
  if (!playing) return;
  const p = playing;
  playing = null;
  p.stopped = true;
  if (p.rafId != null) cancelAnimationFrame(p.rafId);
  try {
    p.gain.gain.cancelScheduledValues(startAt);
    p.gain.gain.setValueAtTime(p.gain.gain.value, startAt);
    p.gain.gain.linearRampToValueAtTime(0.0001, startAt + dur);
  } catch { /* noop */ }
  if (p.nextGain) {
    try {
      p.nextGain.gain.cancelScheduledValues(startAt);
      p.nextGain.gain.setValueAtTime(0.0001, startAt);
    } catch { /* noop */ }
  }
  try { p.source.stop(startAt + dur + 0.05); } catch { /* noop */ }
  try { p.nextSource?.stop(startAt + 0.05); } catch { /* noop */ }
}

function playSrc(src: string, restart = false) {
  // Already playing this track? leave it alone.
  if (!restart && playing && playing.src === src && !playing.stopped) {
    resetLevelEndFx();
    return;
  }
  const requestId = ++playRequestId;
  resetLevelEndFx();
  const c = ac();
  if (!c) return;

  loadBuffer(src).then((buffer) => {
    if (requestId !== playRequestId || !c || !masterGain) return;
    const hadPrevious = !!playing;
    const fadeDur = hadPrevious ? TRACK_FADE : 0;
    // Start the new track immediately; if there was a previous track,
    // fade IN over TRACK_FADE while the old one fades OUT (equal-power-ish).
    const startAt = c.currentTime + 0.02;
    if (hadPrevious) fadeOutCurrent(c, fadeDur, startAt);
    const first = scheduleSource(c, buffer, startAt, hadPrevious);
    // If we're crossfading in, stretch the fade-in to match TRACK_FADE
    if (hadPrevious) {
      first.g.gain.cancelScheduledValues(startAt);
      first.g.gain.setValueAtTime(0.0001, startAt);
      first.g.gain.linearRampToValueAtTime(1, startAt + fadeDur);
    }
    playing = {
      src,
      buffer,
      source: first.src,
      gain: first.g,
      nextSource: null,
      nextGain: null,
      startedAt: startAt,
      nextLoopAt: 0,
      rafId: null,
      stopped: false,
    };
    armNextLoop(c);
  }).catch(() => { /* decode failed; stay silent */ });
}

export function playBgmFor(levelId: LevelId, restart = false) {
  const src = TRACKS[levelId];
  if (!src) {
    stopBgm();
    return;
  }
  // Pre-warm decode so the crossfade has the buffer ready.
  loadBuffer(src).catch(() => { /* ignore */ });
  playSrc(src, restart);
}

// Pre-decode a track's buffer without playing it. Use to warm the cache
// before a level transition so the crossfade starts instantly.
export function preloadBgmFor(levelId: LevelId): Promise<void> {
  const src = TRACKS[levelId];
  if (!src) return Promise.resolve();
  ac(); // ensure ctx exists for decoding
  return loadBuffer(src).then(() => undefined).catch(() => undefined);
}

// True if the given level uses the same shared track that's already playing,
// so we should keep the music going instead of restarting on transition.
export function isSameTrackAs(levelId: LevelId): boolean {
  const src = TRACKS[levelId];
  if (!src) return false;
  return !!playing && !playing.stopped && playing.src === src;
}

export function playMenuBgm() {
  loadBuffer(bgmMenu).catch(() => { /* ignore */ });
  playSrc(bgmMenu);
}

// Play the Starman cheat track (replaces whatever is playing with a crossfade).
// Returns a promise resolving to the ctx-time when the track actually began
// playing (or null if audio is unavailable). Callers can use this to sync
// visuals to a specific timestamp inside the song.
let starmanStartCtxTime: number | null = null;
export function playStarmanBgm() {
  ac();
  loadBuffer(bgmStarman).catch(() => { /* ignore */ });
  starmanStartCtxTime = null;
  playSrc(bgmStarman, true);
  // poll briefly until playSrc has set up `playing`
  const c = ac();
  if (c) {
    const start = performance.now();
    const tick = () => {
      if (playing && playing.src === bgmStarman && !playing.stopped) {
        starmanStartCtxTime = playing.startedAt;
        return;
      }
      if (performance.now() - start > 4000) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// Seconds elapsed since the Starman track started playing, or null if it
// isn't currently playing.
export function getStarmanElapsed(): number | null {
  const c = ac();
  if (!c || !playing || playing.src !== bgmStarman || playing.stopped) return null;
  if (starmanStartCtxTime == null) return null;
  return c.currentTime - starmanStartCtxTime;
}

// "A lil som som" — invboi cheat track variant played only on just-run-bro.
let somSomStartCtxTime: number | null = null;
export function playSomSomBgm() {
  ac();
  loadBuffer(bgmSomSom).catch(() => { /* ignore */ });
  somSomStartCtxTime = null;
  playSrc(bgmSomSom, true);
  const c = ac();
  if (c) {
    const start = performance.now();
    const tick = () => {
      if (playing && playing.src === bgmSomSom && !playing.stopped) {
        somSomStartCtxTime = playing.startedAt;
        return;
      }
      if (performance.now() - start > 4000) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
export function getSomSomElapsed(): number | null {
  const c = ac();
  if (!c || !playing || playing.src !== bgmSomSom || playing.stopped) return null;
  if (somSomStartCtxTime == null) return null;
  return c.currentTime - somSomStartCtxTime;
}

export function stopBgm(fade = 0) {
  playRequestId++;
  if (!playing) return;
  const c = ac();
  if (fade > 0 && c) {
    fadeOutCurrent(c, fade, c.currentTime + 0.01);
    return;
  }
  const p = playing;
  playing = null;
  p.stopped = true;
  if (p.rafId != null) cancelAnimationFrame(p.rafId);
  try { p.source.stop(); } catch { /* noop */ }
  try { p.nextSource?.stop(); } catch { /* noop */ }
}

export function pauseBgm() {
  // WebAudio AudioContext.suspend pauses all scheduling cleanly.
  if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
}

export function resumeBgm() {
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

export function setBgmMuted(v: boolean) {
  muted = v;
  if (masterGain) masterGain.gain.value = muted ? 0 : volume * endDuck;
  try {
    if (typeof window !== "undefined") localStorage.setItem("bgmMuted", v ? "1" : "0");
  } catch { /* ignore */ }
}

export function isBgmMuted() { return muted; }

export function initBgmMutedFromStorage() {
  try {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem("bgmMuted");
    if (v === "1") setBgmMuted(true);
  } catch { /* ignore */ }
}

export function setBgmVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (masterGain && !muted) masterGain.gain.value = volume * endDuck;
}

// Called when the player completes (or otherwise ends) the level.
// Ducks volume slightly and closes the lowpass to ~50% to give the BGM a
// muffled "behind a wall" vibe while end-of-level UI plays.
export function bgmLevelEnd() {
  endDuck = 0.4;
  const c = ac();
  const now = c ? c.currentTime : 0;
  if (masterGain && c) {
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : volume * endDuck, now + 0.4);
  } else if (masterGain) {
    masterGain.gain.value = muted ? 0 : volume * endDuck;
  }
  if (lowpass && c) {
    lowpass.frequency.cancelScheduledValues(now);
    lowpass.frequency.setValueAtTime(lowpass.frequency.value, now);
    lowpass.frequency.linearRampToValueAtTime(LP_END, now + 0.4);
  } else if (lowpass) {
    lowpass.frequency.value = LP_END;
  }
}

function resetLevelEndFx() {
  endDuck = 1;
  if (masterGain) {
    const c = ac();
    if (c) masterGain.gain.cancelScheduledValues(c.currentTime);
    masterGain.gain.value = muted ? 0 : volume * endDuck;
  }
  if (lowpass) {
    const c = ac();
    if (c) lowpass.frequency.cancelScheduledValues(c.currentTime);
    lowpass.frequency.value = LP_OPEN;
  }
}

