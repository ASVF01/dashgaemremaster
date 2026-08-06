/**
 * Gapless looping audio.
 *
 * HTMLAudioElement `loop` re-seeks at the file boundary, and MP3/OGG encoders pad
 * the head and tail with silence — so a looped track audibly hiccups. This decodes
 * the file once through the Web Audio API, trims the padded silence, and loops an
 * AudioBufferSourceNode between the trimmed points, which is sample-accurate.
 *
 * The public surface mirrors the bits of HTMLAudioElement the game uses
 * (`play`, `pause`, `volume`, `currentTime`, `paused`) so it can be dropped in.
 */

const SILENCE = 0.0025; // amplitude below this counts as padding

let sharedCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!sharedCtx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new AC();
  }
  if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => { /* noop */ });
  return sharedCtx;
}

const bufferCache = new Map<string, Promise<AudioBuffer>>();
function loadBuffer(url: string): Promise<AudioBuffer> {
  let p = bufferCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx().decodeAudioData(ab));
    bufferCache.set(url, p);
  }
  return p;
}

/** first / last non-silent sample, in seconds */
function trimPoints(buf: AudioBuffer): { start: number; end: number } {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const data: Float32Array[] = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));

  let first = 0;
  outerA: for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) if (Math.abs(data[c][i]) > SILENCE) { first = i; break outerA; }
  }
  let last = len - 1;
  outerB: for (let i = len - 1; i >= 0; i--) {
    for (let c = 0; c < ch; c++) if (Math.abs(data[c][i]) > SILENCE) { last = i; break outerB; }
  }
  const start = first / buf.sampleRate;
  const end = Math.max(start + 0.05, (last + 1) / buf.sampleRate);
  return { start, end };
}

export class GaplessLoop {
  private url: string;
  private buf: AudioBuffer | null = null;
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private vol = 1;
  private startedAt = 0;
  private offset = 0;
  private wantPlay = false;
  private trim = { start: 0, end: 0 };

  constructor(url: string) {
    this.url = url;
  }

  get paused() { return !this.src; }

  get volume() { return this.vol; }
  set volume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.vol;
  }

  get currentTime() {
    if (!this.src || !this.buf) return this.offset;
    const span = this.trim.end - this.trim.start;
    const played = ctx().currentTime - this.startedAt;
    return this.trim.start + ((played + (this.offset - this.trim.start)) % span);
  }
  set currentTime(t: number) {
    this.offset = Math.max(0, t);
    if (this.src) { this.stopNode(); void this.play(); }
  }

  async play(): Promise<void> {
    this.wantPlay = true;
    if (!this.buf) {
      this.buf = await loadBuffer(this.url);
      this.trim = trimPoints(this.buf);
      if (!this.wantPlay) return;
    }
    if (this.src) return; // already running
    const c = ctx();
    const g = c.createGain();
    g.gain.value = this.vol;
    g.connect(c.destination);
    const s = c.createBufferSource();
    s.buffer = this.buf;
    s.loop = true;
    s.loopStart = this.trim.start;
    s.loopEnd = this.trim.end;
    s.connect(g);
    const from = Math.min(Math.max(this.offset, this.trim.start), this.trim.end - 0.01);
    s.start(0, from);
    this.startedAt = c.currentTime;
    this.offset = from;
    this.src = s;
    this.gain = g;
  }

  private stopNode() {
    try { this.src?.stop(); } catch { /* noop */ }
    try { this.src?.disconnect(); this.gain?.disconnect(); } catch { /* noop */ }
    this.src = null;
    this.gain = null;
  }

  pause() {
    this.wantPlay = false;
    if (this.src) this.offset = this.currentTime;
    this.stopNode();
  }

  stop() {
    this.wantPlay = false;
    this.offset = 0;
    this.stopNode();
  }
}
