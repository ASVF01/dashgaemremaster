// Old Timer SSJ audio: charge cue, burst + grade stinger, looping grade aura, power-off.
import chargeA from "@/assets/saiyan/ssj_charge.mp3.asset.json";
import burstA from "@/assets/saiyan/ssj_burst.mp3.asset.json";
import gradeA from "@/assets/saiyan/ssj_grade.mp3.asset.json";
import offA from "@/assets/saiyan/ssj_off.mp3.asset.json";
import { isMuted } from "./sfx";

let live: HTMLAudioElement[] = [];
let active = false;
function play(url: string, loop = false, vol = 0.8) {
  if (isMuted()) return null;
  const a = new Audio(url); a.loop = loop; a.volume = vol;
  void a.play().catch(() => {});
  live.push(a);
  return a;
}
function stopAll() { for (const a of live) { a.pause(); a.src = ""; } live = []; }

export const ssjAudio = {
  charge() { stopAll(); active = true; play(chargeA.url); },
  burst() { if (!active) return; play(burstA.url, false, 0.9); play(gradeA.url, true, 0.55); },
  /** Silent cleanup (reset / exit). */
  stop() { active = false; stopAll(); },
  /** Power down with the off cue (only if transformed). */
  powerOff() { const was = active; this.stop(); if (was) play(offA.url); },
};
