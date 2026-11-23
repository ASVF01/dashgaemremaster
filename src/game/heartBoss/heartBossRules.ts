// THE HEARTBREAKER — pure boss rules. No canvas, no audio: GameCanvas feeds
// the player box and dt, then reads back hits/reflections to apply effects.

export const HEART_MAX_HP = 12;
export const ARENA_W = 1600;
export const GROUND_Y = 640;

export type HeartAttack = "rain" | "beam" | "pulse" | "prompts";
export type Shot = { x: number; y: number; vx: number; vy: number; r: number; kind: "heart" | "prompt"; label?: string; reflected: boolean; alive: boolean; t: number };
export type Beam = { y: number; t: number; warn: number; dur: number; hit: boolean };
export type Ring = { x: number; y: number; radius: number; speed: number; hit: boolean };

export type HeartBoss = {
  hp: number;
  x: number; y: number; // center
  t: number;
  attack: HeartAttack | null;
  attackT: number;
  rest: number; // seconds until next attack
  order: number; // attack cycle index
  spawnAcc: number;
  shots: Shot[];
  beams: Beam[];
  rings: Ring[];
  hurtFlash: number;
  defeated: boolean;
  defeatT: number;
};

const ORDER: HeartAttack[] = ["prompts", "rain", "beam", "prompts", "pulse", "rain"];
const PROMPTS = ["FIX IT", "MAKE IT POP", "ADD AUTH", "TRY AGAIN", "BUILD", "♥"];

export function createHeartBoss(): HeartBoss {
  return { hp: HEART_MAX_HP, x: ARENA_W / 2, y: 230, t: 0, attack: null, attackT: 0, rest: 2.2, order: 0, spawnAcc: 0, shots: [], beams: [], rings: [], hurtFlash: 0, defeated: false, defeatT: 0 };
}

/** Phase 1 > 8 HP, phase 2 > 4 HP, phase 3 below. Later phases speed everything up. */
export function heartPhase(hp: number): 1 | 2 | 3 { return hp > 8 ? 1 : hp > 4 ? 2 : 3; }
export function phaseSpeed(hp: number): number { return [1, 1, 1.25, 1.5][heartPhase(hp)]; }

export function attackDuration(a: HeartAttack): number {
  return a === "rain" ? 4 : a === "beam" ? 4.2 : a === "pulse" ? 3.6 : 3.4;
}

type Box = { x: number; y: number; w: number; h: number };
const hitsBox = (cx: number, cy: number, r: number, b: Box) =>
  cx + r > b.x && cx - r < b.x + b.w && cy + r > b.y && cy - r < b.y + b.h;

export type StepResult = { playerHit: { x: number; y: number } | null; parried: { x: number; y: number } | null; bossHit: boolean };

/**
 * Advance the boss. `parrying` = player's parry window is open. Parrying a
 * prompt bubble sends it back at the heart; it's the only way to damage her.
 */
export function stepHeartBoss(b: HeartBoss, dt: number, player: Box, parrying: boolean, rand: () => number = Math.random): StepResult {
  const res: StepResult = { playerHit: null, parried: null, bossHit: false };
  b.t += dt;
  if (b.hurtFlash > 0) b.hurtFlash -= dt;
  if (b.defeated) { b.defeatT += dt; b.shots = []; b.beams = []; b.rings = []; return res; }
  const sp = phaseSpeed(b.hp);
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  b.y = 230 + Math.sin(b.t * 1.6) * 24;
  b.x += ((ARENA_W / 2 + Math.sin(b.t * 0.5) * 380) - b.x) * Math.min(1, dt * 1.5);

  if (!b.attack) {
    b.rest -= dt * sp;
    if (b.rest <= 0) { b.attack = ORDER[b.order % ORDER.length]; b.order++; b.attackT = 0; b.spawnAcc = 0;
      if (b.attack === "beam") {
        const lanes = [GROUND_Y - 24, GROUND_Y - 180, GROUND_Y - 320];
        const first = Math.floor(rand() * 3);
        b.beams.push({ y: lanes[first], t: 0, warn: 1.0 / sp, dur: 0.6, hit: false });
        b.beams.push({ y: lanes[(first + 1 + Math.floor(rand() * 2)) % 3], t: -1.6 / sp, warn: 1.0 / sp, dur: 0.6, hit: false });
      }
    }
  } else {
    b.attackT += dt * sp;
    b.spawnAcc += dt * sp;
    if (b.attack === "rain" && b.spawnAcc > 0.22) {
      b.spawnAcc = 0;
      b.shots.push({ x: 60 + rand() * (ARENA_W - 120), y: -20, vx: 0, vy: 380 * sp, r: 14, kind: "heart", reflected: false, alive: true, t: 0 });
    } else if (b.attack === "prompts" && b.spawnAcc > 0.85) {
      b.spawnAcc = 0;
      const dx = px - b.x, dy = py - b.y, d = Math.hypot(dx, dy) || 1, v = 330 * sp;
      b.shots.push({ x: b.x, y: b.y, vx: dx / d * v, vy: dy / d * v, r: 22, kind: "prompt", label: PROMPTS[Math.floor(rand() * PROMPTS.length)], reflected: false, alive: true, t: 0 });
    } else if (b.attack === "pulse" && b.spawnAcc > 1.1) {
      b.spawnAcc = 0;
      b.rings.push({ x: b.x, y: GROUND_Y, radius: 10, speed: 520 * sp, hit: false });
    }
    if (b.attackT >= attackDuration(b.attack)) { b.attack = null; b.rest = 1.6; }
  }

  for (const s of b.shots) {
    if (!s.alive) continue;
    s.t += dt;
    if (s.reflected) { // home onto the heart
      const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy) || 1;
      s.vx = dx / d * 900; s.vy = dy / d * 900;
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.reflected && Math.hypot(b.x - s.x, b.y - s.y) < 70) {
      s.alive = false; b.hp -= 1; b.hurtFlash = 0.35; res.bossHit = true;
      if (b.hp <= 0) { b.hp = 0; b.defeated = true; }
      continue;
    }
    if (!s.reflected && hitsBox(s.x, s.y, s.r, player)) {
      if (parrying && s.kind === "prompt") { s.reflected = true; res.parried = { x: s.x, y: s.y }; }
      else if (parrying) { s.alive = false; res.parried = { x: s.x, y: s.y }; }
      else { s.alive = false; res.playerHit = { x: s.x, y: s.y }; }
    }
    if (s.y > GROUND_Y + 10 || s.y < -400 || s.x < -100 || s.x > ARENA_W + 100) s.alive = false;
  }
  b.shots = b.shots.filter(s => s.alive);

  for (const bm of b.beams) {
    bm.t += dt;
    const live = bm.t > bm.warn && bm.t < bm.warn + bm.dur;
    if (live && !bm.hit && player.y < bm.y + 18 && player.y + player.h > bm.y - 18) { bm.hit = true; res.playerHit = { x: px, y: bm.y }; }
  }
  b.beams = b.beams.filter(bm => bm.t < bm.warn + bm.dur);

  for (const rg of b.rings) {
    rg.radius += rg.speed * dt;
    const onGround = player.y + player.h >= GROUND_Y - 6;
    if (!rg.hit && onGround && Math.abs(Math.abs(px - rg.x) - rg.radius) < 20) { rg.hit = true; res.playerHit = { x: px, y: GROUND_Y }; }
  }
  b.rings = b.rings.filter(rg => rg.radius < ARENA_W);
  return res;
}
