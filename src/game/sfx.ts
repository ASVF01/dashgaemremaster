// Tiny WebAudio SFX engine — procedural, no assets.
import nySampleUrl from "@/assets/audio/ny.ogg";
import beamCriticalUrl from "@/assets/audio/beam_critical2.mp3";

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

function playPixelSample(url: string, opts: { vol?: number; bits?: number; rateDiv?: number; lp?: number } = {}) {
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
}

function playSample(url: string, opts: { vol?: number } = {}) {
  const c = ac(); if (!c || !master) return;
  const buf = sampleCache.get(url);
  if (!buf) { loadSample(url); return; }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = opts.vol ?? 0.55;
  src.connect(g).connect(master);
  src.start(c.currentTime);
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

export function unlockAudio() { ac(); loadSample(nySampleUrl); loadSample(beamCriticalUrl); }
export function setMuted(v: boolean) {
  muted = v;
  if (master) master.gain.value = v ? 0 : 0.35;
}
export function isMuted() { return muted; }

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

export const sfx = {
  jump() {
    tone({ freq: 380, to: 720, dur: 0.12, type: "square", vol: 0.25 });
    tone({ freq: 220, to: 420, dur: 0.1, type: "triangle", vol: 0.15, delay: 0.01 });
  },
  land() {
    noise(0.08, 0.25, 80, 1200);
    tone({ freq: 120, to: 60, dur: 0.08, type: "sine", vol: 0.2 });
  },
  slide() {
    noise(0.35, 0.18, 400, 5000);
  },
  step() {
    // soft, short footstep — pitched noise blip
    noise(0.05, 0.12, 300, 2200);
    tone({ freq: 110 + Math.random() * 30, dur: 0.04, type: "triangle", vol: 0.06 });
  },
  run() {
    // punchier, faster footstep for running speeds
    noise(0.06, 0.2, 250, 3000);
    tone({ freq: 140 + Math.random() * 40, dur: 0.05, type: "triangle", vol: 0.1 });
  },
  skid() {
    noise(0.18, 0.14, 500, 4500);
  },
  parryStart() {
    tone({ freq: 1200, to: 1800, dur: 0.06, type: "triangle", vol: 0.18 });
  },
  parryHit() {
    // 8-bit "ny" sample for successful parries.
    playPixelSample(nySampleUrl, { vol: 0.55, bits: 8, rateDiv: 4, lp: 8000 });
  },
  hit() {
    tone({ freq: 220, to: 70, dur: 0.18, type: "sawtooth", vol: 0.35 });
    noise(0.18, 0.3, 200, 3000);
  },
  enemyKill() {
    tone({ freq: 600, to: 200, dur: 0.12, type: "square", vol: 0.28 });
    noise(0.1, 0.2, 400, 4000);
  },
  pickup() {
    tone({ freq: 880, dur: 0.06, type: "triangle", vol: 0.25 });
    tone({ freq: 1320, dur: 0.08, type: "triangle", vol: 0.2, delay: 0.05 });
  },
  shoot() {
    tone({ freq: 700, to: 250, dur: 0.08, type: "sawtooth", vol: 0.18 });
  },
  win() {
    tone({ freq: 523, dur: 0.12, type: "square", vol: 0.3 });
    tone({ freq: 659, dur: 0.12, type: "square", vol: 0.3, delay: 0.12 });
    tone({ freq: 784, dur: 0.18, type: "square", vol: 0.3, delay: 0.24 });
    tone({ freq: 1046, dur: 0.3, type: "square", vol: 0.32, delay: 0.42 });
  },
  die() {
    tone({ freq: 400, to: 60, dur: 0.5, type: "sawtooth", vol: 0.35 });
    noise(0.4, 0.25, 100, 2000, 0.05);
  },
  mach() {
    tone({ freq: 200, to: 1200, dur: 0.18, type: "square", vol: 0.22 });
    noise(0.2, 0.18, 600, 6000, 0.02);
  },
  superDash() {
    playSample(beamCriticalUrl, { vol: 0.7 });
  },
  meow() {
    // cute lil kitten "mrow" — two pitched sweeps, second a bit higher
    tone({ freq: 520, to: 780, dur: 0.14, type: "triangle", vol: 0.22, attack: 0.02, release: 0.06 });
    tone({ freq: 760, to: 460, dur: 0.18, type: "triangle", vol: 0.2, attack: 0.02, release: 0.08, delay: 0.13 });
    tone({ freq: 260, to: 320, dur: 0.18, type: "sine", vol: 0.08, delay: 0.0 });
  },
  shineStart() { startShine(); },
  shineStop() { stopShine(); },
  rainStart() { startRain(); },
  rainStop() { stopRain(); },
  slideStart() { startSlideLoop(); },
  slideStop() { stopSlideLoop(); },
  slideIntensity(v: number) { setSlideIntensity(v); },
  thunder() {
    // bright crack, then deep rumble
    noise(0.08, 0.45, 2000, 9000);
    noise(0.05, 0.35, 4000, 12000, 0.02);
    tone({ freq: 90, to: 35, dur: 0.9, type: "sawtooth", vol: 0.32, delay: 0.06, release: 0.4 });
    noise(0.7, 0.32, 60, 700, 0.08);
    noise(0.5, 0.18, 120, 400, 0.4);
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

// ---------- looping slide sound (filtered noise + low rumble) ----------
let slide: { src: AudioBufferSourceNode; out: GainNode; lp: BiquadFilterNode; rumble: OscillatorNode; rumbleGain: GainNode } | null = null;
let slideTargetVol = 0.22;

function startSlideLoop() {
  const c = ac(); if (!c || !master || slide) return;
  const t0 = c.currentTime;
  // 1.5s of pinkish noise, looped
  const len = Math.floor(c.sampleRate * 1.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.04 * white) / 1.04;
    data[i] = last * 2.6 + (Math.random() * 2 - 1) * 0.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 350;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(slideTargetVol, t0 + 0.05);
  src.connect(hp).connect(lp).connect(out).connect(master);
  src.start(t0);

  // sub rumble for weighty grit
  const rumble = c.createOscillator();
  rumble.type = "sawtooth";
  rumble.frequency.value = 70;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.05;
  rumble.connect(rumbleGain).connect(out);
  rumble.start(t0);

  slide = { src, out, lp, rumble, rumbleGain };
}

function setSlideIntensity(v: number) {
  // v in [0,1] — modulates volume + brightness
  slideTargetVol = 0.08 + Math.max(0, Math.min(1, v)) * 0.28;
  if (!slide) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  try {
    slide.out.gain.cancelScheduledValues(t);
    slide.out.gain.setValueAtTime(slide.out.gain.value, t);
    slide.out.gain.linearRampToValueAtTime(slideTargetVol, t + 0.08);
    slide.lp.frequency.cancelScheduledValues(t);
    slide.lp.frequency.linearRampToValueAtTime(2400 + v * 3200, t + 0.08);
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
