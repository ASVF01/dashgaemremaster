// Tiny WebAudio SFX engine — procedural, no assets.
import nySampleUrl from "@/assets/audio/ny.ogg";
import beamCriticalUrl from "@/assets/audio/beam_critical2.mp3";
import wwHitUrl from "@/assets/audio/ww.ogg";
import notBadUrl from "@/assets/audio/not_bad.ogg";
import auraUrl from "@/assets/audio/aura.mp3";
import swingSwipeUrl from "@/assets/audio/swing_swipe.ogg";

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

export function unlockAudio() { ac(); loadSample(nySampleUrl); loadSample(beamCriticalUrl); loadSample(notBadUrl); loadSample(wwHitUrl); loadSample(auraUrl); loadSample(swingSwipeUrl); }
let baseVol = 0.35;
export function setMuted(v: boolean) {
  muted = v;
  if (master) master.gain.value = v ? 0 : baseVol;
}
export function isMuted() { return muted; }
export function setSfxVolume(v: number) {
  baseVol = Math.max(0, Math.min(1, v)) * 0.5; // cap so 1.0 = current loud-ish max
  if (master && !muted) master.gain.value = baseVol;
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

export const sfx = {
  jump() {
    // Like the landing "ph" puff but stretched to ~0.3s — softer, breathier,
    // with a slightly lower body thump for the upward push.
    noise(0.22, 0.26, 110, 1300);                                  // long breathy puff
    noise(0.10, 0.14, 50, 520, 0.02);                              // low body
    tone({ freq: 95, to: 60, dur: 0.30, type: "sine", vol: 0.18, release: 0.18 });
  },
  land() {
    // "bsh" — voiced "b" thump + airy "sh" hiss tail
    tone({ freq: 130, to: 70, dur: 0.05, type: "sine", vol: 0.42, attack: 0.002, release: 0.03 }); // "b" body thump
    noise(0.018, 0.28, 120, 900);                                 // "b" burst
    noise(0.11, 0.26, 3500, 8500, 0.018);                         // "sh" hiss tail
  },
  slide() {
    // "thhh" — sustained airy noise around speech band
    noise(0.35, 0.16, 900, 5500);
  },
  slideEnd() {
    // short whoosh-puff — descending filtered noise + a soft low blip
    noise(0.16, 0.14, 600, 3800);
    noise(0.1, 0.08, 200, 1500, 0.02);
    tone({ freq: 280, to: 140, dur: 0.12, type: "triangle", vol: 0.1, attack: 0.005, release: 0.08 });
  },
  step() {
    // Original soft papery footstep — short filtered noise burst
    noise(0.05, 0.18, 280, 2600);
  },
  run() {
    // Slightly punchier papery footstep
    noise(0.06, 0.22, 280, 2800);
  },
  skid() {
    noise(0.18, 0.14, 500, 4500);
  },
  parryStart() {
    tone({ freq: 1200, to: 1800, dur: 0.06, type: "triangle", vol: 0.18 });
    playSample(auraUrl, { vol: 0.6 });
  },
  parryHit() {
    // 8-bit "ny" sample for successful parries.
    playPixelSample(nySampleUrl, { vol: 0.55, bits: 8, rateDiv: 4, lp: 8000 });
  },
  hit() {
    // long, soft fade-out on the voice sample
    playSampleClipped(wwHitUrl, 1.5, { vol: 0.6, fade: 0.6 });
    // little punchy hit on top
    tone({ freq: 220, to: 70, dur: 0.16, type: "sawtooth", vol: 0.3 });
    noise(0.14, 0.28, 250, 3200);
  },
  fatalHit() {
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
    playSample(notBadUrl, { vol: 0.7 });
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
    // BIG impact: layered sub-boom, sharp crack transient, body sweep, and
    // a tail rumble — designed to feel like a heavy hit on press.
    // 1) sharp crack: very short bright noise transient
    noise(0.025, 0.7, 3500, 12000);
    // 2) sub-boom: deep low sine drop, fat and short
    tone({ freq: 140, to: 35, dur: 0.22, type: "sine", vol: 0.55, attack: 0.001, release: 0.12 });
    // 3) body sweep: sawtooth descending for weight
    tone({ freq: 320, to: 70, dur: 0.18, type: "sawtooth", vol: 0.42, attack: 0.002, release: 0.08 });
    // 4) high whoosh: filtered noise body that decays through the dash
    noise(0.18, 0.42, 800, 5000, 0.04);
    // 5) tail rumble: low sub continuing the impact
    tone({ freq: 80, to: 50, dur: 0.28, type: "sine", vol: 0.28, attack: 0.01, release: 0.18, delay: 0.05 });
    // 6) metallic tick to add edge
    tone({ freq: 1800, to: 600, dur: 0.06, type: "square", vol: 0.18, release: 0.04 });
  },
  dash() {
    // sped-up swing/swipe sample, used for the normal dash
    playSample(swingSwipeUrl, { vol: 0.7, rate: 1.7 });
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
  heartbeat() {
    // faint "lub-dub" — two soft low thumps, very quick
    tone({ freq: 90, to: 55, dur: 0.05, type: "sine", vol: 0.16, attack: 0.003, release: 0.05 });
    tone({ freq: 75, to: 45, dur: 0.06, type: "sine", vol: 0.12, attack: 0.003, release: 0.06, delay: 0.11 });
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
  // Same band as the walk/run noise: hp ~280, lp ~2600 — soft, papery.
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 280;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(slideTargetVol, t0 + 0.06);
  src.connect(hp).connect(lp).connect(out).connect(master);
  src.start(t0);

  // very light low body so it doesn't feel hollow; quieter than before
  const rumble = c.createOscillator();
  rumble.type = "triangle";
  rumble.frequency.value = 95;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.012;
  rumble.connect(rumbleGain).connect(out);
  rumble.start(t0);

  slide = { src, out, lp, rumble, rumbleGain };
}

function setSlideIntensity(v: number) {
  // v in [0,1] — modulates volume + brightness, kept quiet to feel like footsteps.
  slideTargetVol = 0.025 + Math.max(0, Math.min(1, v)) * 0.09;
  if (!slide) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  try {
    slide.out.gain.cancelScheduledValues(t);
    slide.out.gain.setValueAtTime(slide.out.gain.value, t);
    slide.out.gain.linearRampToValueAtTime(slideTargetVol, t + 0.1);
    slide.lp.frequency.cancelScheduledValues(t);
    slide.lp.frequency.linearRampToValueAtTime(1800 + v * 1400, t + 0.1);
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
