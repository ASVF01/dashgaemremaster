// Tiny WebAudio SFX engine — procedural, no assets.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

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

export function unlockAudio() { ac(); }
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
  skid() {
    noise(0.18, 0.14, 500, 4500);
  },
  parryStart() {
    tone({ freq: 1200, to: 1800, dur: 0.06, type: "triangle", vol: 0.18 });
  },
  parryHit() {
    tone({ freq: 900, to: 1900, dur: 0.08, type: "square", vol: 0.32 });
    tone({ freq: 1400, to: 2600, dur: 0.12, type: "triangle", vol: 0.25, delay: 0.02 });
    noise(0.12, 0.25, 1500, 8000, 0.01);
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
};
