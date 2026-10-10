// Tiny WebAudio SFX engine — procedural, no assets.
import { getSelectedCharacter } from "@/game/character";
import { stoneScrapeActive, usesCharacterActionSound } from "@/game/characterSoundRules";
import mmguySound from "@/assets/audio/mmguy-action.mp3.asset.json";
import nySampleUrl from "@/assets/audio/ny.ogg";
import sugarcoatSampleUrl from "@/assets/sugarcoat.mp3";
import beamCriticalUrl from "@/assets/audio/beam_critical2.mp3";
import wwHitUrl from "@/assets/audio/ww.ogg";
import notBadUrl from "@/assets/audio/not_bad.ogg";
import auraUrl from "@/assets/audio/aura.mp3";
import swingSwipeUrl from "@/assets/audio/swing_swipe.ogg";
import sfxCompleteUrl from "@/assets/audio/sfx_complete.ogg";
import sfxYesUrl from "@/assets/audio/sfx_yes.ogg";
import laserBeamUrl from "@/assets/audio/weapon_beam3_3.mp3";
import mayhemFootstepsAsset from "@/assets/audio/mayhem-room-footsteps.ogg.asset.json";
import mayhemDoorCloseAsset from "@/assets/audio/DoorClose_Tabook-2.wav.asset.json";
import mayhemTurnAsset from "@/assets/audio/mayhem-turn.wav.asset.json";
import crtOnAsset from "@/assets/audio/CRT_On_kyles.wav.asset.json";
import crtAmbientAsset from "@/assets/audio/CRT_Ambient_kyles.ogg.asset.json";
import firewallOpenAsset from "@/assets/audio/FirewallOpenV2.ogg.asset.json";
import firewallCloseAsset from "@/assets/audio/FirewallClosev2.ogg.asset.json";
import terminalDoneAsset from "@/assets/audio/Tlure_FixedSound.wav.asset.json";
import countupAsset from "@/assets/audio/countup.mp3.asset.json";
import generatorHoverAsset from "@/assets/audio/generator-hover.mp3.asset.json";
import generatorImpactW from "@/assets/audio/generator-impact-w.ogg.asset.json";
import generatorImpact28 from "@/assets/audio/generator-impact-28.ogg.asset.json";
import generatorImpact8d from "@/assets/audio/generator-impact-8d.ogg.asset.json";
import keyholeEnterAsset from "@/assets/audio/keyhole-enter.wav.asset.json";
import animInHallAsset from "@/assets/audio/NewAnimInHall.wav.asset.json";
import animGrowlAsset from "@/assets/audio/TealerGrowl.wav.asset.json";
import animKeyholeAsset from "@/assets/audio/AnimKeyhole.ogg.asset.json";
import animMove1Asset from "@/assets/audio/AnimMove1.wav.asset.json";
import animMove4Asset from "@/assets/audio/AnimMove4.wav.asset.json";
import jumpscareAsset from "@/assets/audio/JumpscareRevised3.ogg.asset.json";
import chaserHitUrl from "@/assets/audio/trtf-5-jumpscare.mp3";
import knightRoarAsset from "@/assets/audio/snd_knightroar.wav.asset.json";
import knightDrawPowerAsset from "@/assets/audio/snd_knight_drawpower.wav.asset.json";
import knightSwordFallAsset from "@/assets/audio/snd_knight_fallingsword_big.wav.asset.json";
import knightSwordCutAsset from "@/assets/audio/snd_knight_cut2.wav.asset.json";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

// Sample cache for one-shot decoded buffers (e.g. parry "ny" sting).
const sampleCache = new Map<string, AudioBuffer>();
const samplePending = new Map<string, Promise<AudioBuffer | null>>();

async function loadSample(url: string): Promise<AudioBuffer | null> {
  const c = ac(); if (!c) return null;
  const cached = sampleCache.get(url);
  if (cached) return cached;
  const pending = samplePending.get(url);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await c.decodeAudioData(arr);
      sampleCache.set(url, buf);
      return buf;
    } catch {
      return null;
    } finally {
      samplePending.delete(url);
    }
  })();
  samplePending.set(url, p);
  return p;
}

// Bitcrush + downsample a buffer for a "pixelated" 8-bit feel.
// bits: target bit depth (e.g. 4-6). rateDiv: integer downsample factor (e.g. 6-10).
function pixelateBuffer(c: AudioContext, src: AudioBuffer, bits: number, rateDiv: number): AudioBuffer {
  const ch = src.numberOfChannels;
  const out = c.createBuffer(ch, src.length, src.sampleRate);
  const steps = Math.pow(2, bits);
  for (let k = 0; k < ch; k++) {
    const inD = src.getChannelData(k);
    const outD = out.getChannelData(k);
    let held = 0;
    for (let i = 0; i < inD.length; i++) {
      if (i % rateDiv === 0) {
        // quantize to N steps
        held = Math.round(inD[i] * steps) / steps;
      }
      outD[i] = held;
    }
  }
  return out;
}

const pixelCache = new Map<string, AudioBuffer>();
const GENERATOR_IMPACT_URLS = [generatorImpactW.url, generatorImpact28.url, generatorImpact8d.url];
let generatorHoverSource: AudioBufferSourceNode | null = null;
let generatorSugarcoatSource: AudioBufferSourceNode | null = null;
function getPixelated(url: string, bits: number, rateDiv: number): AudioBuffer | null {
  const c = ac(); if (!c) return null;
  const key = `${url}|${bits}|${rateDiv}`;
  const cached = pixelCache.get(key);
  if (cached) return cached;
  const base = sampleCache.get(url);
  if (!base) return null;
  const px = pixelateBuffer(c, base, bits, rateDiv);
  pixelCache.set(key, px);
  return px;
}

function playPixelSample(url: string, opts: { vol?: number; bits?: number; rateDiv?: number; lp?: number; maxDur?: number } = {}) {
  const c = ac(); if (!c || !master) return;
  const buf = getPixelated(url, opts.bits ?? 5, opts.rateDiv ?? 8);
  if (!buf) {
    // not decoded yet — kick off load and bail (next press will play)
    loadSample(url);
    return;
  }
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lpf = c.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = opts.lp ?? 5500;
  const g = c.createGain();
  g.gain.value = opts.vol ?? 0.5;
  src.connect(lpf).connect(g).connect(master);
  src.start(t0);
  if (opts.maxDur) src.stop(t0 + opts.maxDur);
}

function playSample(url: string, opts: { vol?: number; rate?: number } = {}) {
  const c = ac(); if (!c || !master) return;
  const buf = sampleCache.get(url);
  if (!buf) { loadSample(url); return; }
  const src = c.createBufferSource();
  src.buffer = buf;
  if (opts.rate) src.playbackRate.value = opts.rate;
  const g = c.createGain();
  g.gain.value = opts.vol ?? 0.55;
  src.connect(g).connect(master);
  src.start(c.currentTime);
}

// Same as playSample but routed through the MAYHEM night bus, which stays
// audible while night mode mutes the main sfx bus.
function nSample(url: string, opts: { vol?: number; rate?: number } = {}) {
  const c = ac(); const b = nbus(); if (!c || !b) return;
  const buf = sampleCache.get(url);
  if (!buf) { loadSample(url); return; }
  const src = c.createBufferSource();
  src.buffer = buf;
  if (opts.rate) src.playbackRate.value = opts.rate;
  const g = c.createGain();
  g.gain.value = opts.vol ?? 0.55;
  src.connect(g).connect(b);
  src.start(c.currentTime);
}

// Night-bus sample that hard-stops after `maxDur` seconds (with a short fade).
function nSampleClipped(url: string, maxDur: number, opts: { vol?: number; fade?: number } = {}) {
  const c = ac(); const b = nbus(); if (!c || !b) return;
  const buf = sampleCache.get(url);
  if (!buf) { loadSample(url); return; }
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const vol = opts.vol ?? 0.55;
  const fade = opts.fade ?? 0.05;
  g.gain.setValueAtTime(vol, t0);
  const stopAt = t0 + Math.max(0.05, maxDur);
  g.gain.setValueAtTime(vol, Math.max(t0, stopAt - fade));
  g.gain.linearRampToValueAtTime(0.0001, stopAt);
  src.connect(g).connect(b);
  src.start(t0);
  src.stop(stopAt + 0.02);
}



// Like playSample but stops after `maxDur` seconds with a short fade-out.
function playSampleClipped(url: string, maxDur: number, opts: { vol?: number; fade?: number } = {}) {
  const c = ac(); if (!c || !master) return;
  const buf = sampleCache.get(url);
  if (!buf) { loadSample(url); return; }
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const vol = opts.vol ?? 0.55;
  const fade = opts.fade ?? 0.05;
  g.gain.setValueAtTime(vol, t0);
  const stopAt = t0 + Math.max(0.05, maxDur);
  g.gain.setValueAtTime(vol, Math.max(t0, stopAt - fade));
  g.gain.linearRampToValueAtTime(0.0001, stopAt);
  src.connect(g).connect(master);
  src.start(t0);
  try { src.stop(stopAt + 0.02); } catch { /* noop */ }
}



function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

const MAYHEM_SAMPLE_URLS = [
  mayhemFootstepsAsset.url,
  mayhemDoorCloseAsset.url,
  mayhemTurnAsset.url,
  crtOnAsset.url,
  crtAmbientAsset.url,
  firewallOpenAsset.url,
  firewallCloseAsset.url,
  terminalDoneAsset.url,
  countupAsset.url,
  generatorHoverAsset.url,
  nySampleUrl,
  sugarcoatSampleUrl,
  ...GENERATOR_IMPACT_URLS,
  keyholeEnterAsset.url,
  animInHallAsset.url,
  animGrowlAsset.url,
  animKeyholeAsset.url,
  animMove1Asset.url,
  animMove4Asset.url,
  jumpscareAsset.url,
];

export function preloadMayhemSfx(): Promise<void> {
  ac();
  return Promise.all(MAYHEM_SAMPLE_URLS.map((url) => loadSample(url))).then(() => {
    GENERATOR_IMPACT_URLS.forEach((url) => getPixelated(url, 8, 2));
    getPixelated(generatorHoverAsset.url, 6, 4);
  });
}

export function unlockAudio() {
  ac();
  loadSample(mmguySound.url);
  loadSample(nySampleUrl);
  loadSample(beamCriticalUrl);
  loadSample(notBadUrl);
  loadSample(wwHitUrl);
  loadSample(auraUrl);
  loadSample(swingSwipeUrl);
  loadSample(laserBeamUrl);
  loadSample(chaserHitUrl);
  void preloadMayhemSfx();
}
let baseVol = 0.35;
export function setMuted(v: boolean) {
  muted = v;
  if (master) master.gain.value = v ? 0 : baseVol;
}
export function isMuted() { return muted; }
// Hard-stop everything currently playing through the master bus and silence
// future sfx until unmuted. Used for the boss-death cutscene.
export function silenceAllSfx() {
  try { stopLaser(); } catch { /* noop */ }
  setMuted(true);
}
export function setSfxVolume(v: number) {
  baseVol = Math.max(0, Math.min(1, v)) * 0.5; // cap so 1.0 = current loud-ish max
  if (master && !muted) master.gain.value = baseVol;
}

// ---------- CELESTIAL MODE (invboi / rainboi) ----------
// When on, movement-style sfx layer a sparkly bell-tone shimmer on top so
// every step / slide / dash sounds like the player is interacting with
// shining magical surfaces. Toggled by GameCanvas based on starman/somSom.
let celestialMode = false;
// When `replaceDefaults` is true, movement/action sfx skip their normal
// synth body and play ONLY the shimmer — so the player sounds purely
// celestial. We enable this only for invboi (rainboi), not som-som.
let celestialReplace = false;
export function setCelestialMode(on: boolean, opts: { replaceDefaults?: boolean } = {}) {
  celestialMode = on;
  celestialReplace = !!(on && opts.replaceDefaults);
  if (on) startSlideShimmer(); else stopSlideShimmer();
}
export function isCelestialMode() { return celestialMode; }
function shimmerReplaces() { return celestialMode && celestialReplace; }

// ---------- THUNDER MODE (som-som — invboi on just-run-bro) ----------
// Layered low-end booms + crackles on movement sfx so every action feels
// like a thunderclap rolling across a stormy plain.
let thunderMode = false;
export function setThunderMode(on: boolean) { thunderMode = on; }
export function isThunderMode() { return thunderMode; }

// ---------- METAL MODE (MAYHEM's tower approach) ----------
// Replaces the papery movement foley with hard industrial impacts/scrapes.
let metalMode = false;
export function setMetalMode(on: boolean) { metalMode = on; }
export function isMetalMode() { return metalMode; }
function metalReplaces() { return metalMode && !shimmerReplaces(); }

// ---------- GRASS MODE (THE CHASE forest trail) ----------
// Replaces the default paper foley with soft turf impacts and leafy scrapes.
let grassMode = false;
export function setGrassMode(on: boolean) {
  if (grassMode === on) return;
  grassMode = on;
  // Rebuild an active slide loop so its filters immediately match the surface.
  if (slideActive) {
    stopSlideLoop();
    if (!shimmerReplaces()) startSlideLoop();
  }
}
export function isGrassMode() { return grassMode; }
function grassReplaces() { return grassMode && !metalReplaces() && !shimmerReplaces(); }

function grassCrunch(intensity = 1, heavy = false) {
  // Low dirt thud plus several tiny, dry leaf snaps.
  noise(heavy ? 0.12 : 0.075, (heavy ? 0.25 : 0.17) * intensity, 90, heavy ? 950 : 1450);
  noise(heavy ? 0.08 : 0.05, 0.12 * intensity, 1200, 4400, 0.006);
  const snaps = heavy ? 4 : 2;
  for (let i = 0; i < snaps; i++) {
    noise(0.012 + Math.random() * 0.018, 0.055 * intensity, 1800, 6200, 0.008 + i * 0.012);
  }
  if (heavy) tone({ freq: 92, to: 54, dur: 0.11, type: "sine", vol: 0.11 * intensity, release: 0.07 });
}

function grassScrape(dur = 0.22, intensity = 1) {
  noise(dur, 0.15 * intensity, 180, 2100);
  noise(Math.min(dur, 0.16), 0.08 * intensity, 1700, 5200, 0.015);
}

function metalHit(base = 420, intensity = 1) {
  const f = base * (0.92 + Math.random() * 0.16);
  tone({ freq: f, to: f * 0.42, dur: 0.12, type: "square", vol: 0.24 * intensity, attack: 0.001, release: 0.08 });
  tone({ freq: f * 2.37, to: f * 1.4, dur: 0.08, type: "triangle", vol: 0.12 * intensity, attack: 0.001, release: 0.05, delay: 0.006 });
  tone({ freq: f * 0.48, to: f * 0.25, dur: 0.16, type: "sine", vol: 0.16 * intensity, attack: 0.001, release: 0.1 });
  noise(0.055, 0.20 * intensity, 900, 6200);
  noise(0.14, 0.08 * intensity, 2600, 11000, 0.012);
}

function metalScrape(dur = 0.2, intensity = 1) {
  noise(dur, 0.18 * intensity, 1200, 7600);
  tone({ freq: 1500, to: 760, dur, type: "sawtooth", vol: 0.055 * intensity, attack: 0.004, release: 0.08 });
  tone({ freq: 290, to: 160, dur: Math.min(0.16, dur), type: "square", vol: 0.07 * intensity, attack: 0.002, release: 0.08, delay: 0.01 });
}

function thunderBoom(opts: { intensity?: number; crack?: boolean; rumbleDur?: number } = {}) {
  if (!thunderMode) return;
  const intensity = opts.intensity ?? 1;
  // 1) sharp lightning crack — bright noise transient
  if (opts.crack !== false) {
    noise(0.04, 0.55 * intensity, 3500, 13000);
  }
  // 2) deep sub boom — fat low sine drop
  tone({ freq: 90 + Math.random() * 30, to: 28, dur: 0.35, type: "sine",
         vol: 0.55 * intensity, attack: 0.002, release: 0.22 });
  // 3) body weight — sawtooth descent for mass
  tone({ freq: 220, to: 55, dur: 0.22, type: "sawtooth",
         vol: 0.32 * intensity, attack: 0.003, release: 0.15, delay: 0.01 });
  // 4) rolling rumble — long low filtered noise tail
  const rdur = opts.rumbleDur ?? 0.7;
  noise(rdur, 0.28 * intensity, 40, 420, 0.04);
  // 5) distant secondary boom for the "rolling thunder" feel
  tone({ freq: 60, to: 35, dur: rdur * 0.8, type: "triangle",
         vol: 0.22 * intensity, attack: 0.04, release: 0.3, delay: 0.08 });
}

// Pick a frequency from a pleasant pentatonic scale around the given base.
const PENTATONIC_RATIOS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3];
function pentaPick(base: number, idx?: number) {
  const i = idx == null ? Math.floor(Math.random() * PENTATONIC_RATIOS.length) : idx;
  return base * PENTATONIC_RATIOS[Math.abs(i) % PENTATONIC_RATIOS.length];
}

// Layered "twinkle on shiny stuff" — a couple of short bright bells +
// a tiny airy hiss. Cheap, stacks freely, sits on top of any sfx.
// `intensity` 0..1 scales the volume; `count` 1..3 layered notes.
function celestialShimmer(opts: { base?: number; intensity?: number; count?: number; spread?: number; lo?: boolean } = {}) {
  if (!celestialMode) return;
  const base = opts.base ?? 1600;
  const intensity = opts.intensity ?? 1;
  const count = opts.count ?? 2;
  const spread = opts.spread ?? 0.04;
  for (let i = 0; i < count; i++) {
    const f = pentaPick(base);
    const vol = (0.10 + 0.05 * Math.random()) * intensity;
    tone({
      freq: f, to: f * (1.5 + Math.random() * 0.5),
      dur: 0.22 + Math.random() * 0.18,
      type: "triangle",
      vol,
      attack: 0.003,
      release: 0.18,
      delay: i * spread + Math.random() * 0.01,
    });
    // soft sine "halo" beneath the bell for body
    tone({
      freq: f * 0.5, to: f * 0.5,
      dur: 0.18,
      type: "sine",
      vol: vol * 0.5,
      attack: 0.005,
      release: 0.12,
      delay: i * spread,
    });
  }
  // tiny sparkle hiss in the very high band
  noise(0.10 * intensity, 0.06 * intensity, 5500, 14000);
  if (opts.lo) {
    // optional sub bell for big impacts (super dash, mach)
    tone({ freq: base * 0.25, dur: 0.4, type: "sine", vol: 0.18 * intensity, attack: 0.01, release: 0.25 });
  }
}

type ToneOpts = {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  attack?: number;
  release?: number;
  delay?: number;
};

function tone(o: ToneOpts) {
  const c = ac(); if (!c || !master) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  const v = o.vol ?? 0.4;
  const a = o.attack ?? 0.005;
  const rel = o.release ?? 0.05;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur + rel);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + rel + 0.02);
}

function noise(dur: number, vol = 0.4, hp = 200, lp = 4000, delay = 0) {
  const c = ac(); if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = hp;
  const lpf = c.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = lp;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hpf).connect(lpf).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function characterActionOverride(event: string): boolean {
  if (!usesCharacterActionSound(getSelectedCharacter(), event)) return false;
  return true;
}

let stoneSource: AudioBufferSourceNode | null = null;
let stoneGain: GainNode | null = null;
function stopStoneScrape() {
  stoneSource?.stop();
  stoneSource?.disconnect();
  stoneGain?.disconnect();
  stoneSource = null;
  stoneGain = null;
}

export const sfx = {
  stoneScrape(onGround: boolean, speed: number, sliding: boolean, playing: boolean) {
    if (muted || !stoneScrapeActive(getSelectedCharacter(), onGround, speed, playing)) {
      stopStoneScrape();
      return;
    }
    const c = ac();
    if (!c || !master) return;
    if (!stoneSource) {
      // Rough, granular friction rather than rhythmic footstep impacts.
      const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = buffer.getChannelData(0);
      let body = 0;
      for (let i = 0; i < data.length; i++) {
        const grain = Math.random() * 2 - 1;
        body = body * 0.94 + grain * 0.06;
        data[i] = (body * 3 + grain * 0.22) * (0.65 + 0.35 * Math.sin(i * 0.0017));
      }
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1900;
      const gain = c.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      source.start();
      stoneSource = source;
      stoneGain = gain;
    }
    stoneSource.playbackRate.setTargetAtTime(0.65 + Math.min(1, Math.abs(speed) / 600) * 0.65, c.currentTime, 0.035);
    stoneGain?.gain.setTargetAtTime((sliding ? 0.45 : 0.32) * Math.min(1, Math.abs(speed) / 100), c.currentTime, 0.025);
  },
  stoneScrapeStop() { stopStoneScrape(); },
  characterAction() {
    if (getSelectedCharacter() === "mmguy" && !muted) {
      void loadSample(mmguySound.url).then((buffer) => {
        if (buffer && getSelectedCharacter() === "mmguy" && !muted) playSample(mmguySound.url, { vol: 0.5 });
      });
    }
  },
  jump() {
    if (characterActionOverride("jump")) return;
    if (metalReplaces()) {
      metalHit(520, 0.62);
      metalScrape(0.08, 0.42);
    } else if (grassReplaces()) {
      grassCrunch(0.85, false);
      grassScrape(0.09, 0.45);
    } else if (!shimmerReplaces()) {
      noise(0.22, 0.26, 110, 1300);                                  // long breathy puff
      noise(0.10, 0.14, 50, 520, 0.02);                              // low body
      tone({ freq: 95, to: 60, dur: 0.30, type: "sine", vol: 0.18, release: 0.18 });
    }
    celestialShimmer({ base: 1400, count: 3, intensity: 1.0, spread: 0.05 });
    thunderBoom({ intensity: 0.85, rumbleDur: 0.6 });
  },
  land() {
    if (characterActionOverride("land")) return;
    if (metalReplaces()) {
      metalHit(360, 1.08);
      metalScrape(0.1, 0.34);
    } else if (grassReplaces()) {
      grassCrunch(1.15, true);
      grassScrape(0.13, 0.55);
    } else if (!shimmerReplaces()) {
      // "bsh" — voiced "b" thump + airy "sh" hiss tail
      tone({ freq: 130, to: 70, dur: 0.05, type: "sine", vol: 0.42, attack: 0.002, release: 0.03 });
      noise(0.018, 0.28, 120, 900);
      noise(0.11, 0.26, 3500, 8500, 0.018);
    }
    celestialShimmer({ base: 1100, count: 3, intensity: 1.1, spread: 0.03, lo: true });
    thunderBoom({ intensity: 1.15, rumbleDur: 0.9 });
  },
  slide() {
    if (characterActionOverride("slide")) return;
    if (metalReplaces()) {
      metalScrape(0.34, 0.9);
      metalHit(680, 0.25);
    } else if (grassReplaces()) {
      grassScrape(0.38, 1);
      grassCrunch(0.65, false);
    } else if (!shimmerReplaces()) {
      // "thhh" — sustained airy noise around speech band
      noise(0.35, 0.16, 900, 5500);
    }
    celestialShimmer({ base: 1800, count: 2, intensity: 0.9, spread: 0.06 });
    thunderBoom({ intensity: 0.7, crack: false, rumbleDur: 0.8 });
  },
  slideEnd() {
    if (characterActionOverride("slideEnd")) return;
    if (metalReplaces()) {
      metalHit(430, 0.55);
    } else if (grassReplaces()) {
      grassScrape(0.14, 0.7);
      grassCrunch(0.5, false);
    } else if (!shimmerReplaces()) {
      noise(0.16, 0.14, 600, 3800);
      noise(0.1, 0.08, 200, 1500, 0.02);
      tone({ freq: 280, to: 140, dur: 0.12, type: "triangle", vol: 0.1, attack: 0.005, release: 0.08 });
    }
    celestialShimmer({ base: 1500, count: 2, intensity: 0.9 });
    thunderBoom({ intensity: 0.7, rumbleDur: 0.5 });
  },
  step() {
    if (characterActionOverride("step")) return;
    if (metalReplaces()) {
      metalHit(620 + Math.random() * 100, 0.34);
    } else if (grassReplaces()) {
      grassCrunch(0.72, false);
    } else if (!shimmerReplaces()) {
      // Original soft papery footstep — short filtered noise burst
      noise(0.05, 0.18, 280, 2600);
    }
    // tiny twinkle — like landing on a star
    celestialShimmer({ base: 1900, count: 1, intensity: 0.7 });
    // small rolling rumble — like distant thunder beneath each step
    if (thunderMode) {
      tone({ freq: 70, to: 40, dur: 0.22, type: "sine", vol: 0.32, attack: 0.003, release: 0.14 });
      noise(0.18, 0.16, 50, 380, 0.01);
    }
  },
  run() {
    if (characterActionOverride("run")) return;
    if (metalReplaces()) {
      metalHit(520 + Math.random() * 160, 0.42);
    } else if (grassReplaces()) {
      grassCrunch(0.95, true);
    } else if (!shimmerReplaces()) {
      noise(0.06, 0.22, 280, 2800);
    }
    celestialShimmer({ base: 1900, count: 1, intensity: 0.8 });
    if (thunderMode) {
      tone({ freq: 80, to: 42, dur: 0.24, type: "sine", vol: 0.36, attack: 0.003, release: 0.14 });
      noise(0.2, 0.18, 50, 420, 0.01);
    }
  },
  skid() {
    if (characterActionOverride("skid")) return;
    if (metalReplaces()) {
      metalScrape(0.24, 1.1);
      tone({ freq: 2100, to: 900, dur: 0.16, type: "square", vol: 0.07, attack: 0.002, release: 0.09 });
    } else if (grassReplaces()) {
      grassScrape(0.26, 1.15);
      grassCrunch(0.75, true);
    } else if (!shimmerReplaces()) {
      noise(0.18, 0.14, 500, 4500);
    }
    celestialShimmer({ base: 1700, count: 2, intensity: 0.9, spread: 0.05 });
    thunderBoom({ intensity: 0.8, rumbleDur: 0.55 });
  },
  parryStart() {
    if (characterActionOverride("parryStart")) return;
    tone({ freq: 1200, to: 1800, dur: 0.06, type: "triangle", vol: 0.18 });
    playSample(auraUrl, { vol: 0.6 });
  },
  parryHit() {
    if (characterActionOverride("parryHit")) return;
    if (!shimmerReplaces()) {
      // 8-bit "ny" sample for successful parries.
      playPixelSample(nySampleUrl, { vol: 0.55, bits: 8, rateDiv: 4, lp: 8000 });
    }
    celestialShimmer({ base: 2200, count: 3, intensity: 1.2, spread: 0.04, lo: true });
    thunderBoom({ intensity: 1.1, rumbleDur: 0.8 });
  },
  hit() {
    if (characterActionOverride("hit")) return;
    // long, soft fade-out on the voice sample
    playSampleClipped(wwHitUrl, 1.5, { vol: 0.6, fade: 0.6 });
    // little punchy hit on top
    tone({ freq: 220, to: 70, dur: 0.16, type: "sawtooth", vol: 0.3 });
    noise(0.14, 0.28, 250, 3200);
  },
  chaserHit() {
    if (characterActionOverride("chaserHit")) return;
    playSample(chaserHitUrl, { vol: 0.9 });
  },
  fatalHit() {
    if (characterActionOverride("fatalHit")) return;
    // ~3s cinematic "final hit" stinger — layered impact + long rumble tail.
    // 1) bright crash transient (the "smack")
    noise(0.06, 0.85, 4000, 14000);
    // 2) huge sub-boom drop
    tone({ freq: 180, to: 30, dur: 0.45, type: "sine", vol: 0.7, attack: 0.001, release: 0.25 });
    // 3) body weight — descending sawtooth for impact mass
    tone({ freq: 380, to: 60, dur: 0.4, type: "sawtooth", vol: 0.5, attack: 0.002, release: 0.15 });
    // 4) metallic screech, slightly delayed so it reads as the "ring" after impact
    tone({ freq: 1600, to: 380, dur: 0.9, type: "square", vol: 0.22, attack: 0.005, release: 0.5, delay: 0.05 });
    // 5) mid whoosh tail
    noise(0.9, 0.45, 200, 2400, 0.08);
    // 6) long sub rumble carrying the rest of the ~3s
    tone({ freq: 70, to: 35, dur: 2.4, type: "sine", vol: 0.45, attack: 0.02, release: 0.5, delay: 0.15 });
    tone({ freq: 55, to: 28, dur: 2.6, type: "triangle", vol: 0.28, attack: 0.05, release: 0.6, delay: 0.2 });
    // 7) low filtered noise rumble that fades over the full duration
    noise(2.6, 0.32, 40, 500, 0.25);
    // 8) sparse high "debris" ticks fading out
    tone({ freq: 2200, to: 1400, dur: 0.08, type: "triangle", vol: 0.16, release: 0.05, delay: 0.5 });
    tone({ freq: 1800, to: 900, dur: 0.08, type: "triangle", vol: 0.13, release: 0.05, delay: 0.95 });
    tone({ freq: 1500, to: 700, dur: 0.09, type: "triangle", vol: 0.10, release: 0.06, delay: 1.6 });
    tone({ freq: 1100, to: 500, dur: 0.09, type: "triangle", vol: 0.08, release: 0.06, delay: 2.3 });
  },
  enemyKill() {
    if (characterActionOverride("enemyKill")) return;
    if (!shimmerReplaces()) {
      tone({ freq: 600, to: 200, dur: 0.12, type: "square", vol: 0.28 });
      noise(0.1, 0.2, 400, 4000);
    }
    celestialShimmer({ base: 2000, count: 2, intensity: 1.0 });
    thunderBoom({ intensity: 1.0, rumbleDur: 0.7 });
  },
  pickup() {
    if (characterActionOverride("pickup")) return;
    if (!shimmerReplaces()) {
      tone({ freq: 880, dur: 0.06, type: "triangle", vol: 0.25 });
      tone({ freq: 1320, dur: 0.08, type: "triangle", vol: 0.2, delay: 0.05 });
    }
    celestialShimmer({ base: 2400, count: 2, intensity: 0.9 });
  },
  shoot() {
    if (characterActionOverride("shoot")) return;
    tone({ freq: 700, to: 250, dur: 0.08, type: "sawtooth", vol: 0.18 });
  },
  win() {
    if (characterActionOverride("win")) return;
    playSample(notBadUrl, { vol: 0.7 });
  },
  die() {
    if (characterActionOverride("die")) return;
    tone({ freq: 400, to: 60, dur: 0.5, type: "sawtooth", vol: 0.35 });
    noise(0.4, 0.25, 100, 2000, 0.05);
  },
  glassShatter() {
    if (characterActionOverride("glassShatter")) return;
    // hard impact + bright shard rain
    tone({ freq: 220, to: 40, dur: 0.16, type: "square", vol: 0.55, attack: 0.001, release: 0.10 });
    noise(0.02, 0.7, 200, 1200); // punchy thump transient
    // shard sparkle — several short high-pitched pings staggered
    for (let i = 0; i < 8; i++) {
      const f = 2600 + Math.random() * 4200;
      const d = 0.04 + i * 0.02;
      tone({ freq: f, to: f * 0.6, dur: 0.09, type: "triangle", vol: 0.14, attack: 0.001, release: 0.07, delay: d });
    }
    noise(0.35, 0.22, 3500, 12000, 0.02); // shimmery shard cloud
    noise(0.55, 0.14, 60, 400, 0.05); // low rumble tail
  },
  mach() {
    if (characterActionOverride("mach")) return;
    if (!shimmerReplaces()) {
      tone({ freq: 200, to: 1200, dur: 0.18, type: "square", vol: 0.22 });
      noise(0.2, 0.18, 600, 6000, 0.02);
    }
    celestialShimmer({ base: 1800, count: 3, intensity: 1.1, spread: 0.04, lo: true });
    thunderBoom({ intensity: 1.2, rumbleDur: 1.0 });
  },
  superDash() {
    if (characterActionOverride("superDash")) return;
    if (!shimmerReplaces()) {
      // BIG impact: layered sub-boom, sharp crack transient, body sweep, and tail rumble.
      noise(0.025, 0.7, 3500, 12000);
      tone({ freq: 140, to: 35, dur: 0.22, type: "sine", vol: 0.55, attack: 0.001, release: 0.12 });
      tone({ freq: 320, to: 70, dur: 0.18, type: "sawtooth", vol: 0.42, attack: 0.002, release: 0.08 });
      noise(0.18, 0.42, 800, 5000, 0.04);
      tone({ freq: 80, to: 50, dur: 0.28, type: "sine", vol: 0.28, attack: 0.01, release: 0.18, delay: 0.05 });
      tone({ freq: 1800, to: 600, dur: 0.06, type: "square", vol: 0.18, release: 0.04 });
    }
    celestialShimmer({ base: 1600, count: 3, intensity: 1.3, spread: 0.05, lo: true });
    thunderBoom({ intensity: 1.4, rumbleDur: 1.2 });
  },
  dash() {
    if (characterActionOverride("dash")) return;
    if (metalReplaces()) {
      metalScrape(0.16, 0.95);
      metalHit(760, 0.62);
      tone({ freq: 180, to: 82, dur: 0.16, type: "sine", vol: 0.18, attack: 0.001, release: 0.1 });
    } else if (!shimmerReplaces()) {
      // sped-up swing/swipe sample, used for the normal dash
      playSample(swingSwipeUrl, { vol: 0.7, rate: 1.7 });
    }
    celestialShimmer({ base: 2000, count: 2, intensity: 1.0, spread: 0.04 });
    thunderBoom({ intensity: 1.0, rumbleDur: 0.7 });
  },
  spawnWhoosh() {
    if (characterActionOverride("spawnWhoosh")) return;
    // quick airy "swoosh" with a sparkly upward chime — for the invboi-star spawn
    noise(0.18, 0.22, 800, 6500);
    noise(0.10, 0.14, 2400, 9500, 0.02);
    tone({ freq: 320, to: 1400, dur: 0.18, type: "triangle", vol: 0.18, attack: 0.005, release: 0.10 });
    tone({ freq: 1200, to: 2200, dur: 0.16, type: "sine", vol: 0.14, attack: 0.005, release: 0.10, delay: 0.04 });
    tone({ freq: 1800, to: 3000, dur: 0.14, type: "sine", vol: 0.10, attack: 0.005, release: 0.10, delay: 0.08 });
  },
  meow() {
    // cute lil kitten "mrow" — two pitched sweeps, second a bit higher
    tone({ freq: 520, to: 780, dur: 0.14, type: "triangle", vol: 0.22, attack: 0.02, release: 0.06 });
    tone({ freq: 760, to: 460, dur: 0.18, type: "triangle", vol: 0.2, attack: 0.02, release: 0.08, delay: 0.13 });
    tone({ freq: 260, to: 320, dur: 0.18, type: "sine", vol: 0.08, delay: 0.0 });
  },
  // --- Menu UI sounds: small, snappy, pen-on-paper feel ---
  menuHover() {
    tone({ freq: 880, to: 1180, dur: 0.05, type: "triangle", vol: 0.07, attack: 0.002, release: 0.04 });
    noise(0.025, 0.04, 2400, 8000);
  },
  menuClick() {
    // crisp "tk" — short noise tick + tiny pitched ping
    noise(0.018, 0.18, 1800, 7000);
    tone({ freq: 1200, to: 700, dur: 0.07, type: "triangle", vol: 0.16, attack: 0.001, release: 0.05 });
    tone({ freq: 320, to: 220, dur: 0.05, type: "sine", vol: 0.10, attack: 0.002, release: 0.04 });
  },
  menuTab() {
    // slightly chunkier two-step "thunk" for switching tabs
    tone({ freq: 520, to: 360, dur: 0.06, type: "square", vol: 0.13, attack: 0.001, release: 0.05 });
    tone({ freq: 720, to: 480, dur: 0.07, type: "triangle", vol: 0.12, attack: 0.001, release: 0.05, delay: 0.03 });
    noise(0.03, 0.10, 800, 4500);
  },
  menuConfirm() {
    // upbeat little "ba-ding!" for PLAY / confirm actions
    tone({ freq: 520, dur: 0.10, type: "triangle", vol: 0.22, attack: 0.005, release: 0.08 });
    tone({ freq: 780, dur: 0.14, type: "triangle", vol: 0.22, attack: 0.005, release: 0.10, delay: 0.07 });
    tone({ freq: 1040, dur: 0.20, type: "sine",     vol: 0.18, attack: 0.005, release: 0.16, delay: 0.14 });
    noise(0.04, 0.12, 2000, 8000);
  },
  menuBack() {
    // descending tiny "blip" for back / cancel
    tone({ freq: 700, to: 380, dur: 0.10, type: "triangle", vol: 0.16, attack: 0.002, release: 0.08 });
    noise(0.02, 0.08, 1200, 5000);
  },
  shineStart() { startShine(); },
  shineStop() { stopShine(); },
  laserStart() { if (!characterActionOverride("laserStart")) startLaser(); },
  laserStop() { stopLaser(); },
  rainStart() { startRain(); },
  rainStop() { stopRain(); },
  windStart() { startWind(); },
  windStop() { stopWind(); },
  slideStart() { slideActive = true; if (getSelectedCharacter() !== "mmguy" && !shimmerReplaces()) startSlideLoop(); },
  slideStop() { slideActive = false; stopSlideLoop(); },
  slideIntensity(v: number) { setSlideIntensity(v); },
  thunder() {
    // bright crack, then deep rumble
    noise(0.08, 0.45, 2000, 9000);
    noise(0.05, 0.35, 4000, 12000, 0.02);
    tone({ freq: 90, to: 35, dur: 0.9, type: "sawtooth", vol: 0.32, delay: 0.06, release: 0.4 });
    noise(0.7, 0.32, 60, 700, 0.08);
    noise(0.5, 0.18, 120, 400, 0.4);
  },
  heartbeat() {
    // faint "lub-dub" — two soft low thumps, very quick
    tone({ freq: 90, to: 55, dur: 0.05, type: "sine", vol: 0.16, attack: 0.003, release: 0.05 });
    tone({ freq: 75, to: 45, dur: 0.06, type: "sine", vol: 0.12, attack: 0.003, release: 0.06, delay: 0.11 });
  },
  slashShing() {
    // bright metallic "shing" — fast rising tone + airy hiss
    tone({ freq: 1800, to: 4200, dur: 0.12, type: "triangle", vol: 0.28, attack: 0.002, release: 0.08 });
    tone({ freq: 2600, to: 5200, dur: 0.10, type: "square", vol: 0.10, attack: 0.002, release: 0.06, delay: 0.01 });
    noise(0.13, 0.18, 4000, 12000);
  },
  bossHurt() {
    // quick wet "thock" + bright spark
    tone({ freq: 320, to: 90, dur: 0.18, type: "sawtooth", vol: 0.42, attack: 0.002, release: 0.1 });
    noise(0.06, 0.36, 600, 5500);
    tone({ freq: 1500, to: 700, dur: 0.1, type: "triangle", vol: 0.18, release: 0.06 });
  },
  bossRoar() {
    void loadSample(knightRoarAsset.url).then((buf) => {
      if (buf) playPixelSample(knightRoarAsset.url, { vol: 0.9, bits: 5, rateDiv: 8, lp: 4200 });
    });
  },
  bossDrawPower() {
    void loadSample(knightDrawPowerAsset.url).then((buf) => {
      if (buf) playSample(knightDrawPowerAsset.url, { vol: 0.9 });
    });
  },
  bossSwordFall() {
    void loadSample(knightSwordFallAsset.url).then((buf) => {
      if (buf) playSample(knightSwordFallAsset.url, { vol: 0.95 });
    });
  },
  bossSwordCut() {
    void loadSample(knightSwordCutAsset.url).then((buf) => {
      if (buf) playSample(knightSwordCutAsset.url, { vol: 0.95 });
    });
  },
  preloadBossRoar() {
    void loadSample(knightRoarAsset.url);
    void loadSample(knightDrawPowerAsset.url);
    void loadSample(knightSwordFallAsset.url);
    void loadSample(knightSwordCutAsset.url);
  },
  bossDefeat() {
    // Fire both victory stings simultaneously when a boss is beaten.
    playSample(sfxCompleteUrl, { vol: 0.9 });
    playSample(sfxYesUrl, { vol: 0.9 });
    // Pre-warm decode cache for next time.
    loadSample(sfxCompleteUrl);
    loadSample(sfxYesUrl);
  },
  keyJingle() {
    // little bunch-of-keys jingle — several bright metallic pings clustered
    const pings = 7;
    for (let i = 0; i < pings; i++) {
      const f = 2200 + Math.random() * 3200;
      tone({ freq: f, to: f * (0.85 + Math.random() * 0.2), dur: 0.09 + Math.random() * 0.06,
             type: "triangle", vol: 0.10 + Math.random() * 0.05, attack: 0.001, release: 0.07,
             delay: i * 0.025 + Math.random() * 0.015 });
      tone({ freq: f * 2, dur: 0.05, type: "square", vol: 0.03, attack: 0.001, release: 0.04,
             delay: i * 0.025 });
    }
    noise(0.18, 0.05, 4000, 12000);
  },
  cheatChime() {
    // secret-code confirm: rising 3-note sparkle
    const notes = [660, 880, 1320];
    notes.forEach((f, i) => {
      tone({ freq: f, to: f * 1.01, dur: 0.16, type: "triangle", vol: 0.16,
             attack: 0.002, release: 0.12, delay: i * 0.07 });
      tone({ freq: f * 2, dur: 0.10, type: "sine", vol: 0.06,
             attack: 0.002, release: 0.08, delay: i * 0.07 });
    });
    noise(0.10, 0.04, 5000, 13000, 0.14);
  },
  /** Warbling siren — used for the "reset progress" point of no return. */
  alarm() {
    for (let i = 0; i < 4; i++) {
      const d = i * 0.42;
      tone({ freq: 520, to: 900, dur: 0.2, type: "square", vol: 0.16, attack: 0.01, release: 0.06, delay: d });
      tone({ freq: 900, to: 520, dur: 0.2, type: "square", vol: 0.16, attack: 0.01, release: 0.06, delay: d + 0.21 });
      tone({ freq: 260, to: 450, dur: 0.4, type: "sawtooth", vol: 0.07, attack: 0.01, release: 0.1, delay: d });
    }
  },
  // ---- MAYHEM dialogue ----
  // Short dry blip per character while text types out.
  dialogueBlip(pitch = 1) {
    tone({ freq: 320 * pitch, to: 260 * pitch, dur: 0.035, type: "square", vol: 0.045, attack: 0.001, release: 0.02 });
    noise(0.02, 0.03, 900, 4200);
  },
  // Line finished / advance.
  dialogueAdvance() {
    tone({ freq: 180, to: 120, dur: 0.09, type: "triangle", vol: 0.1, attack: 0.002, release: 0.05 });
    noise(0.05, 0.05, 400, 2200);
  },
};


// ---------- looping "shine" sound for the invboi (starman) state ----------
type ShineNodes = {
  osc1: OscillatorNode; osc2: OscillatorNode;
  lfo: OscillatorNode; lfoGain: GainNode;
  bell: OscillatorNode; bellGain: GainNode;
  master: GainNode;
};
let shine: ShineNodes | null = null;
let shineSparkleId: number | null = null;

function startShine() {
  const c = ac(); if (!c || !master || shine) return;
  const t0 = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.18, t0 + 0.25);
  out.connect(master);

  // two detuned high triangle waves for a glistening pad
  const osc1 = c.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.value = 1760;
  const osc2 = c.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = 2637; // high E
  // slow LFO modulating amplitude to "shimmer"
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 6;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.08;
  const ampMix = c.createGain();
  ampMix.gain.value = 0.12;
  lfo.connect(lfoGain).connect(ampMix.gain);
  osc1.connect(ampMix);
  osc2.connect(ampMix);
  ampMix.connect(out);

  // soft bell on top
  const bell = c.createOscillator();
  bell.type = "sine";
  bell.frequency.value = 3520;
  const bellGain = c.createGain();
  bellGain.gain.value = 0.05;
  bell.connect(bellGain).connect(out);

  osc1.start(t0); osc2.start(t0); lfo.start(t0); bell.start(t0);

  shine = { osc1, osc2, lfo, lfoGain, bell, bellGain, master: out };

  // sprinkle little "ting" sparkles every ~280ms while active
  const sparkle = () => {
    if (!shine) return;
    const f = 2200 + Math.random() * 2200;
    tone({ freq: f, to: f * 1.2, dur: 0.12, type: "triangle", vol: 0.12, attack: 0.005, release: 0.1 });
    shineSparkleId = window.setTimeout(sparkle, 220 + Math.random() * 200);
  };
  shineSparkleId = window.setTimeout(sparkle, 200);
}

function stopShine() {
  const c = ac(); if (!c || !shine) return;
  const t = c.currentTime;
  const s = shine;
  shine = null;
  if (shineSparkleId != null) { clearTimeout(shineSparkleId); shineSparkleId = null; }
  try {
    s.master.gain.cancelScheduledValues(t);
    s.master.gain.setValueAtTime(s.master.gain.value, t);
    s.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  } catch { /* noop */ }
  const stopAt = t + 0.3;
  try { s.osc1.stop(stopAt); } catch { /* noop */ }
  try { s.osc2.stop(stopAt); } catch { /* noop */ }
  try { s.lfo.stop(stopAt); } catch { /* noop */ }
  try { s.bell.stop(stopAt); } catch { /* noop */ }
}

// ---------- looping rain (filtered noise) ----------
let rain: { src: AudioBufferSourceNode; out: GainNode } | null = null;

function startRain() {
  const c = ac(); if (!c || !master || rain) return;
  const t0 = c.currentTime;
  // 2s of brown-ish noise, looped
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5 + (Math.random() * 2 - 1) * 0.4;
  }
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 600;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5500;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.22, t0 + 0.6);
  src.connect(hp).connect(lp).connect(out).connect(master);
  src.start(t0);
  rain = { src, out };
}

function stopRain() {
  const c = ac(); if (!c || !rain) return;
  const t = c.currentTime;
  const r = rain; rain = null;
  try {
    r.out.gain.cancelScheduledValues(t);
    r.out.gain.setValueAtTime(r.out.gain.value, t);
    r.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  } catch { /* noop */ }
  try { r.src.stop(t + 0.45); } catch { /* noop */ }
}

// ---------- looping storm wind (slow filtered gusts) ----------
let wind: { src: AudioBufferSourceNode; out: GainNode; lfo: OscillatorNode } | null = null;

function startWind() {
  const c = ac(); if (!c || !master || wind) return;
  const t0 = c.currentTime;
  const len = Math.floor(c.sampleRate * 4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < len; i++) {
    smooth += ((Math.random() * 2 - 1) - smooth) * 0.035;
    data[i] = smooth;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1150;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.18, t0 + 1.1);
  const lfo = c.createOscillator();
  const gust = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.12;
  gust.gain.value = 0.09;
  lfo.connect(gust).connect(out.gain);
  src.connect(hp).connect(lp).connect(out).connect(master);
  src.start(t0);
  lfo.start(t0);
  wind = { src, out, lfo };
}

function stopWind() {
  const c = ac(); if (!c || !wind) return;
  const t = c.currentTime;
  const current = wind;
  wind = null;
  try { current.lfo.disconnect(); } catch { /* noop */ }
  try {
    current.out.gain.cancelScheduledValues(t);
    current.out.gain.setValueAtTime(Math.max(0.0001, current.out.gain.value), t);
    current.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  } catch { /* noop */ }
  try { current.src.stop(t + 0.55); } catch { /* noop */ }
  try { current.lfo.stop(t + 0.55); } catch { /* noop */ }
}

// ---------- looping slide sound (filtered noise + low rumble) ----------
let slide: { src: AudioBufferSourceNode; out: GainNode; lp: BiquadFilterNode; rumble: OscillatorNode; rumbleGain: GainNode } | null = null;
// Tracks whether the player is currently sliding, independent of whether the
// regular slide noise loop is running (it's suppressed during invboi-replace).
let slideActive = false;
let slideTargetVol = 0.06;

function startSlideLoop() {
  const c = ac(); if (!c || !master || slide) return;
  const t0 = c.currentTime;
  // 1.5s of plain noise, looped — match walk/run footstep timbre.
  const len = Math.floor(c.sampleRate * 1.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;
  // Surface-specific texture: metal is bright, grass is low and leafy.
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = metalMode ? 760 : grassMode ? 150 : 280;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = metalMode ? 5600 : grassMode ? 2100 : 2600;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(slideTargetVol, t0 + 0.06);
  src.connect(hp).connect(lp).connect(out).connect(master);
  src.start(t0);

  // very light low body so it doesn't feel hollow; metal mode gets a harsher industrial grind
  const rumble = c.createOscillator();
  rumble.type = metalMode ? "square" : "triangle";
  rumble.frequency.value = metalMode ? 146 : grassMode ? 68 : 95;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.012;
  rumble.connect(rumbleGain).connect(out);
  rumble.start(t0);

  slide = { src, out, lp, rumble, rumbleGain };
}

function setSlideIntensity(v: number) {
  // v in [0,1] — modulates volume + brightness, kept quiet to feel like footsteps.
  slideTargetVol = 0.025 + Math.max(0, Math.min(1, v)) * (metalMode ? 0.12 : grassMode ? 0.105 : 0.09);
  if (!slide) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  try {
    slide.out.gain.cancelScheduledValues(t);
    slide.out.gain.setValueAtTime(slide.out.gain.value, t);
    slide.out.gain.linearRampToValueAtTime(slideTargetVol, t + 0.1);
    slide.lp.frequency.cancelScheduledValues(t);
    slide.lp.frequency.linearRampToValueAtTime(metalMode ? 3200 + v * 3000 : grassMode ? 1350 + v * 1300 : 1800 + v * 1400, t + 0.1);
  } catch { /* noop */ }
}

function stopSlideLoop() {
  const c = ac(); if (!c || !slide) return;
  const t = c.currentTime;
  const s = slide; slide = null;
  try {
    s.out.gain.cancelScheduledValues(t);
    s.out.gain.setValueAtTime(s.out.gain.value, t);
    s.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  } catch { /* noop */ }
  try { s.src.stop(t + 0.22); } catch { /* noop */ }
  try { s.rumble.stop(t + 0.22); } catch { /* noop */ }
}

// ---------- LASER (held beam attack) ----------
// On press: play the uploaded mp3 ONCE as an intro sting.
// While held: a continuous procedural humming loop runs underneath.
type LaserNodes = {
  out: GainNode;
  carrier: OscillatorNode;
  detune: OscillatorNode;
  sub: OscillatorNode;
  noiseSrc: AudioBufferSourceNode;
  noiseGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};
let laser: LaserNodes | null = null;

function startLaser() {
  const c = ac(); if (!c || !master) return;
  if (laser) return;

  // 1) ONE-SHOT intro sting from the uploaded mp3 (not looped).
  playSample(laserBeamUrl, { vol: 0.85 });

  // 2) Procedural humming loop underneath that sustains until stopLaser.
  const t0 = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.32, t0 + 0.06);
  out.connect(master);

  // Main carrier (sawtooth) + slightly detuned for thickness.
  const carrier = c.createOscillator();
  carrier.type = "sawtooth";
  carrier.frequency.value = 220;
  const detune = c.createOscillator();
  detune.type = "sawtooth";
  detune.frequency.value = 224;
  // Sub for body
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 110;

  // LFO for shimmer (slight pitch wobble on detune)
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 7.5;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain).connect(detune.frequency);

  // High-pass filtered noise for "sizzle"
  const len = Math.floor(c.sampleRate * 1);
  const nbuf = c.createBuffer(1, len, c.sampleRate);
  const nd = nbuf.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = nbuf; noiseSrc.loop = true;
  const nhp = c.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 2200;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.18;

  // Mild lowpass on the carriers to keep it from being harsh.
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;

  carrier.connect(lp);
  detune.connect(lp);
  sub.connect(lp);
  lp.connect(out);
  noiseSrc.connect(nhp).connect(noiseGain).connect(out);

  carrier.start(t0); detune.start(t0); sub.start(t0); lfo.start(t0); noiseSrc.start(t0);

  laser = { out, carrier, detune, sub, noiseSrc, noiseGain, lfo, lfoGain };
}

function stopLaser() {
  const c = ac(); if (!c || !laser) return;
  const t = c.currentTime;
  const l = laser; laser = null;
  try {
    l.out.gain.cancelScheduledValues(t);
    l.out.gain.setValueAtTime(l.out.gain.value, t);
    l.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  } catch { /* noop */ }
  const stopAt = t + 0.15;
  try { l.carrier.stop(stopAt); } catch { /* noop */ }
  try { l.detune.stop(stopAt); } catch { /* noop */ }
  try { l.sub.stop(stopAt); } catch { /* noop */ }
  try { l.lfo.stop(stopAt); } catch { /* noop */ }
  try { l.noiseSrc.stop(stopAt); } catch { /* noop */ }
}


// ---------- celestial slide shimmer (looping) ----------
// Layered on top of the regular slide loop while celestial mode is active —
// scheduled twinkly bell ticks so sliding sounds like skating over starlight.
let slideShimmer: { timer: number } | null = null;

function startSlideShimmer() {
  if (slideShimmer) return;
  const tick = () => {
    if (!slideShimmer) return;
    if (celestialMode && slideActive) {
      // tiny bell sparkle per tick
      celestialShimmer({ base: 2400, count: 1, intensity: 0.55 });
    }
    // randomized cadence — irregular twinkles feel more "magical"
    const next = 90 + Math.random() * 130;
    slideShimmer.timer = window.setTimeout(tick, next);
  };
  slideShimmer = { timer: window.setTimeout(tick, 60) };
}

function stopSlideShimmer() {
  if (!slideShimmer) return;
  clearTimeout(slideShimmer.timer);
  slideShimmer = null;
}

// ---------- MAYHEM NIGHT SFX BUS ----------
// Realistic-leaning placeholder sounds for the MAYHEM night ("fnaf") mode.
// They run on a dedicated bus so they still play while the mode mutes the
// main sfx bus (night mode silences all "gamey" sounds on purpose).
let nightBus: GainNode | null = null;
// MAYHEM night sfx follow the SFX VOLUME slider like every other sound.
let nightSfxVolume = 0.9;
export function setNightSfxVolume(v: number) {
  nightSfxVolume = Math.max(0, Math.min(1, v)) * 0.9;
  if (nightBus) nightBus.gain.value = nightSfxVolume;
}
function nbus(): GainNode | null {
  const c = ac(); if (!c) return null;
  if (!nightBus) {
    nightBus = c.createGain();
    nightBus.gain.value = nightSfxVolume;
    nightBus.connect(c.destination);
  }
  return nightBus;
}

// CRT monitor ambient hum — loops while the camera system is active.
let crtAmbientSource: AudioBufferSourceNode | null = null;
let crtAmbientGain: GainNode | null = null;
export function startCrtAmbient() {
  const c = ac(); const b = nbus(); if (!c || !b) return;
  if (crtAmbientSource) return;
  const buf = sampleCache.get(crtAmbientAsset.url);
  if (!buf) { loadSample(crtAmbientAsset.url); return; }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = c.createGain();
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.28, c.currentTime + 0.25);
  src.connect(g).connect(b);
  src.start();
  crtAmbientSource = src;
  crtAmbientGain = g;
}
export function stopCrtAmbient() {
  const c = ac(); if (!c) return;
  if (crtAmbientGain) {
    const g = crtAmbientGain;
    const now = c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  }
  if (crtAmbientSource) {
    const src = crtAmbientSource;
    const stopAt = c.currentTime + 0.22;
    try { src.stop(stopAt); } catch { /* noop */ }
    setTimeout(() => { try { src.stop(0); } catch { /* noop */ } }, 250);
    crtAmbientSource = null;
    crtAmbientGain = null;
  }
}

function nTone(o: ToneOpts) {
  const c = ac(); const b = nbus(); if (!c || !b) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  const v = o.vol ?? 0.4;
  const a = o.attack ?? 0.005;
  const rel = o.release ?? 0.05;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur + rel);
  osc.connect(g).connect(b);
  osc.start(t0);
  osc.stop(t0 + o.dur + rel + 0.02);
}

// Noise with an optional frequency sweep on the lowpass for whooshes.
function nNoise(dur: number, vol = 0.4, hp = 200, lp = 4000, delay = 0, lpTo?: number) {
  const c = ac(); const b = nbus(); if (!c || !b) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = hp;
  const lpf = c.createBiquadFilter(); lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(lp, t0);
  if (lpTo !== undefined) lpf.frequency.exponentialRampToValueAtTime(Math.max(40, lpTo), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hpf).connect(lpf).connect(g).connect(b);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const mayhemSfx = {
  // terminal panel sliding up — uploaded FirewallOpenV2 sample
  terminalOpen() {
    nSample(firewallOpenAsset.url, { vol: 0.7 });
  },
  // terminal sliding back down — uploaded FirewallClosev2 sample
  terminalClose() {
    nSample(firewallCloseAsset.url, { vol: 0.7 });
  },
  // terminal sequence completes and the DONE screen appears
  terminalDone() {
    nSample(terminalDoneAsset.url, { vol: 0.75 });
  },
  generatorCount() {
    nSample(countupAsset.url, { vol: 0.55, rate: 0.7 });
  },
  generatorHover() {
    const c = ac(); const b = nbus();
    if (!c || !b) return;
    const buffer = getPixelated(generatorHoverAsset.url, 6, 4);
    if (!buffer) { void loadSample(generatorHoverAsset.url); return; }
    // Replace the previous cue rather than piling up a full counting sample.
    if (generatorHoverSource) generatorHoverSource.stop();
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.9;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.008);
    source.connect(gain).connect(b);
    generatorHoverSource = source;
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (generatorHoverSource === source) generatorHoverSource = null;
    };
    source.start();
  },
  generatorParry() {
    const c = ac(); const b = nbus();
    if (!c || !b) return;
    const buffer = getPixelated(nySampleUrl, 8, 4);
    if (!buffer) { void loadSample(nySampleUrl); return; }
    const source = c.createBufferSource(); source.buffer = buffer;
    const filter = c.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 8000;
    const gain = c.createGain(); gain.gain.value = 0.55;
    source.connect(filter).connect(gain).connect(b);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start();
  },
  // "I'm not gonna sugarcoat it" callout — plays on a doubled generator charge.
  generatorSugarcoat() {
    const c = ac(); const b = nbus();
    if (!c || !b) return;
    const buffer = sampleCache.get(sugarcoatSampleUrl);
    if (!buffer) { void loadSample(sugarcoatSampleUrl); return; }
    // A fresh reward replaces the previous callout instead of stacking voices.
    if (generatorSugarcoatSource) generatorSugarcoatSource.stop();
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = 0.7;
    source.connect(gain).connect(b);
    generatorSugarcoatSource = source;
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (generatorSugarcoatSource === source) generatorSugarcoatSource = null;
    };
    source.start();
  },
  generatorImpact(doubled = false) {
    const c = ac(); const b = nbus();
    if (!c || !b) return;
    const buffers = GENERATOR_IMPACT_URLS.map((url) => getPixelated(url, 8, 2));
    if (buffers.some((buffer) => buffer === null)) { void preloadMayhemSfx(); return; }
    const startAt = c.currentTime + 0.005;
    buffers.forEach((buffer) => {
      if (!buffer) return;
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.92;
      const gain = c.createGain();
      gain.gain.value = doubled ? 0.6 : 0.4;
      source.connect(gain).connect(b);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(startAt);
    });
  },
  // boot hum + two soft confirm blips
  terminalBoot() {
    nTone({ freq: 60, dur: 1.0, type: "sine", vol: 0.14, attack: 0.08, release: 0.3 });
    nNoise(0.9, 0.03, 500, 3000, 0.05);
    nTone({ freq: 740, dur: 0.05, type: "sine", vol: 0.12, attack: 0.004, release: 0.05, delay: 0.55 });
    nTone({ freq: 990, dur: 0.06, type: "sine", vol: 0.12, attack: 0.004, release: 0.06, delay: 0.75 });
  },
  // plastic key press — short tick + faint electronic blip
  terminalSelect() {
    nNoise(0.018, 0.3, 1400, 8000);
    nTone({ freq: 620, dur: 0.035, type: "sine", vol: 0.10, attack: 0.002, release: 0.04, delay: 0.008 });
  },
  // ---- generator puzzle feedback ----
  puzzleGrab(pitch = 1) {
    nNoise(0.02, 0.22, 900, 5000);
    nTone({ freq: 330 * pitch, to: 440 * pitch, dur: 0.07, type: "square", vol: 0.06, attack: 0.002, release: 0.05 });
  },
  puzzleStep(step = 0) {
    const f = 520 + (step % 12) * 38;
    nTone({ freq: f, dur: 0.03, type: "triangle", vol: 0.07, attack: 0.002, release: 0.03 });
  },
  puzzleConnect() {
    nTone({ freq: 660, dur: 0.06, type: "square", vol: 0.07, attack: 0.002, release: 0.05 });
    nTone({ freq: 990, dur: 0.09, type: "square", vol: 0.07, attack: 0.002, release: 0.07, delay: 0.06 });
  },
  puzzleRelease() {
    nNoise(0.015, 0.12, 600, 3000);
  },
  puzzlePad(pad = 0) {
    const f = [262, 330, 392, 523][pad % 4];
    nTone({ freq: f, dur: 0.16, type: "square", vol: 0.08, attack: 0.003, release: 0.1 });
  },
  // Simon playback signal — lower pitch, bitcrushed + downsampled for a gritty CRT feel
  puzzleSignal(pad = 0) {
    const c = ac(); const b = nbus(); if (!c || !b) return;
    const f = [262, 330, 392, 523][pad % 4] * 0.6;
    const dur = 0.18, rel = 0.12;
    const len = Math.floor(c.sampleRate * (dur + rel));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    const a = 0.005, v = 0.14;
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate;
      const env = t < a ? t / a : t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel);
      const ph = (f * t) % 1;
      data[i] = env * v * (ph < 0.5 ? 1 : -1);
    }
    const steps = Math.pow(2, 4);
    let held = 0;
    for (let i = 0; i < len; i++) {
      if (i % 8 === 0) held = Math.round(data[i] * steps) / steps;
      data[i] = held;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const lpf = c.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 2400;
    src.connect(lpf).connect(b);
    src.start();
  },
  puzzleWrong() {
    nTone({ freq: 160, to: 90, dur: 0.3, type: "sawtooth", vol: 0.1, attack: 0.004, release: 0.15 });
    nNoise(0.12, 0.1, 200, 1500);
  },
  puzzleFlip() {
    nNoise(0.04, 0.2, 1800, 7000);
    nTone({ freq: 480, to: 720, dur: 0.05, type: "sine", vol: 0.06, attack: 0.002, release: 0.04 });
  },
  puzzleMatch() {
    nTone({ freq: 784, dur: 0.08, type: "triangle", vol: 0.09, attack: 0.002, release: 0.06 });
    nTone({ freq: 1046, dur: 0.12, type: "triangle", vol: 0.09, attack: 0.002, release: 0.08, delay: 0.08 });
  },
  puzzleMiss() {
    nTone({ freq: 300, to: 220, dur: 0.14, type: "square", vol: 0.06, attack: 0.002, release: 0.08 });
  },
  cameraOpen() {
    // Procedural pullback/rush transition texture — the CRT power-on sample
    // is triggered separately when the camera scene actually appears.
    const c = ac(); const b = nbus(); if (!c || !b) return;
    nNoise(0.12, 0.16, 700, 6200);
    nTone({ freq: 74, to: 52, dur: 0.18, type: "square", vol: 0.12, attack: 0.003, release: 0.1 });
    nTone({ freq: 860, dur: 0.035, type: "sine", vol: 0.1, attack: 0.002, release: 0.05, delay: 0.09 });
  },
  cameraCrtOn() {
    const c = ac(); const b = nbus(); if (!c || !b) return;
    const buf = sampleCache.get(crtOnAsset.url);
    if (buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 0.75;
      src.connect(g).connect(b);
      src.start(c.currentTime);
    } else {
      loadSample(crtOnAsset.url);
    }
    startCrtAmbient();
  },
  cameraSwitch() {
    nNoise(0.07, 0.22, 900, 7600);
    nTone({ freq: 520, to: 760, dur: 0.045, type: "square", vol: 0.07, attack: 0.002, release: 0.04 });
  },
  cameraClose() {
    stopCrtAmbient();
    nTone({ freq: 170, to: 54, dur: 0.16, type: "sawtooth", vol: 0.08, attack: 0.004, release: 0.1 });
    nNoise(0.09, 0.12, 500, 3200, 0.03);
  },
  // A small, slightly raspy one-second cat meow for the office desk buddy.
  meow() {
    nTone({ freq: 430, to: 760, dur: 0.26, type: "sawtooth", vol: 0.075, attack: 0.025, release: 0.05 });
    nTone({ freq: 760, to: 540, dur: 0.5, type: "sawtooth", vol: 0.08, attack: 0.015, release: 0.16, delay: 0.24 });
    nTone({ freq: 215, to: 270, dur: 0.27, type: "triangle", vol: 0.1, attack: 0.02, release: 0.12, delay: 0.05 });
    nNoise(0.68, 0.018, 350, 1800, 0.04, 900);
  },
  // pause menu opening — deep soft thunk + slow air swell
  pauseOpen() {
    nTone({ freq: 72, to: 36, dur: 0.28, type: "sine", vol: 0.4, attack: 0.004, release: 0.22 });
    nNoise(0.5, 0.06, 60, 500, 0.03, 220);
  },
  // door — latch click, slow hinge creak, closing-air thud
  doorOpen() {
    nNoise(0.02, 0.32, 1600, 9000);
    nTone({ freq: 1250, dur: 0.04, type: "square", vol: 0.06, attack: 0.001, release: 0.04, delay: 0.005 });
    nTone({ freq: 235, to: 168, dur: 0.5, type: "sawtooth", vol: 0.045, attack: 0.06, release: 0.12, delay: 0.05 });
    nNoise(0.45, 0.05, 150, 900, 0.06, 380);
    nTone({ freq: 64, to: 40, dur: 0.14, type: "sine", vol: 0.28, attack: 0.003, release: 0.12, delay: 0.5 });
  },
  // turning around — cloth whoosh + a single soft footstep
  turn() {
    nSample(mayhemTurnAsset.url, { vol: 0.6, rate: 0.98 + Math.random() * 0.05 });
  },
  // walking between rooms — supplied quick footstep recording
  walk(steps = 3) {
    // The recording already contains the full quick crossing. Keep the old
    // `steps` argument as a small intensity hint so office turns stay softer.
    nSample(mayhemFootstepsAsset.url, {
      vol: steps <= 2 ? 0.48 : 0.62,
      rate: 0.97 + Math.random() * 0.06,
    });
  },
  // door closing behind you — uploaded heavy door-close recording
  doorClose(delay = 0) {
    const c = ac(); const b = nbus(); if (!c || !b) return;
    const buf = sampleCache.get(mayhemDoorCloseAsset.url);
    if (!buf) { loadSample(mayhemDoorCloseAsset.url); return; }
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.95, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + buf.duration + 0.02);
    src.connect(g).connect(b);
    src.start(t0);
    // tiny low thud underneath the latch for weight
    nTone({ freq: 58, to: 34, dur: 0.22, type: "sine", vol: 0.24, attack: 0.003, release: 0.2, delay: delay + 0.14 });
  },
  // full room transition: the door starts closing over the ongoing footsteps
  roomSwitch() {
    mayhemSfx.walk(3);
    mayhemSfx.doorClose(0.25);
  },
  // leaning into the keyhole — supplied short keyhole-enter recording
  keyhole() {
    nSample(keyholeEnterAsset.url, { vol: 0.75 });
  },

  // ---- test animatronic ----
  // Its sounds are tracked so they can all be cut when it leaves.
  animInHall() {
    playTrackedAnim(animInHallAsset.url, 0.85);
  },
  animHallEncounter() {
    playTrackedAnim(animGrowlAsset.url, 0.8);
  },
  animKeyholeStare() {
    playTrackedAnim(animGrowlAsset.url, 0.8);
    playTrackedAnim(animKeyholeAsset.url, 0.7);
  },
  animMove() {
    stopAnimSounds();
    playTrackedAnim(Math.random() < 0.5 ? animMove1Asset.url : animMove4Asset.url, 0.8);
  },
  stopAnimSounds,
  // Full-volume scream when the player holds eye contact too long.
  jumpscare() {
    stopAnimSounds();
    nSampleClipped(jumpscareAsset.url, 1.05, { vol: 1 });
  },
};

// Every animatronic one-shot goes through here so `stopAnimSounds()` can
// silence anything it made recently (growls, hall stomp, keyhole rattle).
let animSources: { src: AudioBufferSourceNode; gain: GainNode }[] = [];
function playTrackedAnim(url: string, vol: number) {
  const c = ac(); const b = nbus(); if (!c || !b) return;
  const buf = sampleCache.get(url);
  if (!buf) { loadSample(url); return; }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(b);
  src.start(c.currentTime);
  const entry = { src, gain: g };
  animSources.push(entry);
  src.onended = () => { animSources = animSources.filter((s) => s !== entry); };
}
function stopAnimSounds() {
  const c = ac();
  const list = animSources;
  animSources = [];
  list.forEach(({ src, gain }) => {
    try {
      if (c) {
        const now = c.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        src.stop(now + 0.14);
      } else {
        src.stop(0);
      }
    } catch { /* noop */ }
  });
}
