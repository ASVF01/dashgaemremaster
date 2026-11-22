// Old Timer SSJ audio: charge cue, burst + grade stinger, looping grade aura, power-off.
import chargeA from "@/assets/saiyan/ssj_charge.mp3.asset.json";
import burstA from "@/assets/saiyan/ssj_burst.mp3.asset.json";
import gradeA from "@/assets/saiyan/ssj_grade.mp3.asset.json";
import offA from "@/assets/saiyan/ssj_off.mp3.asset.json";
import { isMuted } from "./sfx";

let live: HTMLAudioElement[] = [];
let active = false;
let chargeEl: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
/** Fade the charge cue to silence across whatever playtime it has left. */
function fadeChargeOut() {
  const a = chargeEl; if (!a) return;
  const left = Number.isFinite(a.duration) ? Math.max(0, a.duration - a.currentTime) : 0;
  if (left <= 0.05) return;
  const start = a.volume, t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (left * 1000));
    a.volume = Math.max(0, start * (1 - k));
    if (k >= 1 && fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  }, 30);
}
function play(url: string, loop = false, vol = 0.8) {
  if (isMuted()) return null;
  const a = new Audio(url); a.loop = loop; a.volume = vol;
  void a.play().catch(() => {});
  live.push(a);
  return a;
}
function stopAll() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } chargeEl = null; for (const a of live) { a.pause(); a.src = ""; } live = []; }

export const ssjAudio = {
  charge() { stopAll(); active = true; chargeEl = play(chargeA.url); },
  burst() { if (!active) return; fadeChargeOut(); play(burstA.url, false, 0.9); play(gradeA.url, true, 0.55); },
  /** Silent cleanup (reset / exit). */
  stop() { active = false; stopAll(); },
  /** Power down with the off cue (only if transformed). */
  powerOff() { const was = active; this.stop(); if (was) play(offA.url); },
};
