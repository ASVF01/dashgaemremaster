// MAYHEM night-shift music: its own WebAudio chain so it can be slowed,
// pitched down, echoed and heavily muffled independently of the game BGM.
import trackAsset from "@/assets/audio/bgm_play.mp3.asset.json";

const RATE = 0.85; // speed -15%
const DETUNE = -216; // cents; 0.85 * 2^(-216/1200) ≈ 0.75 (pitch -25%)
const MUFFLE = 760; // Hz low-pass — hazy and distant, but clearer than before
const VOLUME = 1.0;

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let master: GainNode | null = null;
let buffer: AudioBuffer | null = null;
let element: HTMLAudioElement | null = null;
let token = 0;
// User-controlled music volume (0..1), mirrors the settings slider live.
let userVolume = 1;

export async function preloadNightBgm(): Promise<void> {
  const c = ac();
  if (!c || buffer) return;
  const response = await fetch(trackAsset.url);
  if (!response.ok) throw new Error("Night music failed to load");
  const audioData = await response.arrayBuffer();
  buffer = await c.decodeAudioData(audioData);
}

export function setNightBgmVolume(v: number) {
  userVolume = Math.max(0, Math.min(1, v));
  if (ctx && master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(VOLUME * userVolume, now, 0.05);
  }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function startNightBgm() {
  const c = ac();
  if (!c) return;
  stopNightBgm(0);
  const id = ++token;

  // If the browser blocks audio until a gesture, retry on the next input.
  if (c.state !== "running") {
    const kick = () => {
      c.resume().catch(() => {});
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
  }


  const build = (buf: AudioBuffer) => {
    if (id !== token || !c) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = RATE;
    try { src.detune.value = DETUNE; } catch { /* unsupported */ }

    // muffle
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = MUFFLE;
    lp.Q.value = 0.6;
    const lp2 = c.createBiquadFilter();
    lp2.type = "lowpass";
    lp2.frequency.value = MUFFLE * 1.4;

    // echo: feedback delay on a wet send
    const delay = c.createDelay(2);
    delay.delayTime.value = 0.42;
    const fb = c.createGain();
    fb.gain.value = 0.42;
    const wet = c.createGain();
    wet.gain.value = 0.55;
    const dry = c.createGain();
    dry.gain.value = 0.8;

    const out = c.createGain();
    out.gain.value = 0.0001;

    src.connect(lp);
    lp.connect(lp2);
    lp2.connect(dry);
    dry.connect(out);
    lp2.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(out);
    out.connect(c.destination);

    const now = c.currentTime;
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(VOLUME * userVolume, now + 1.2);

    src.start(now);
    source = src;
    master = out;
  };

  if (buffer) { build(buffer); return; }
  preloadNightBgm()
    .then(() => { if (buffer) build(buffer); })
    .catch(() => { fallback(id); });
}

// Last resort: plain <audio> playback (still slowed + muffled via the graph).
function fallback(id: number) {
  const c = ctx;
  if (!c || id !== token) return;
  try {
    const el = new Audio(trackAsset.url);
    el.loop = true;
    el.playbackRate = RATE;
    el.crossOrigin = "anonymous";
    const node = c.createMediaElementSource(el);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = MUFFLE;
    const out = c.createGain();
    out.gain.value = VOLUME * userVolume;
    node.connect(lp);
    lp.connect(out);
    out.connect(c.destination);
    master = out;
    element = el;
    el.play().catch(() => {});
  } catch { /* noop */ }
}

export function stopNightBgm(fadeMs = 300) {
  token++;
  const c = ctx;
  const s = source;
  const g = master;
  const el = element;
  source = null;
  master = null;
  element = null;
  if (el) { try { el.pause(); el.src = ""; } catch { /* noop */ } }
  if (!c || !s) return;
  const now = c.currentTime;
  try {
    if (g) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
    }
    s.stop(now + fadeMs / 1000 + 0.05);
  } catch { /* noop */ }
}
