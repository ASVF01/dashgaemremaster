import { MAX_SPEED, PLAYER_H, PLAYER_W, type Platform } from "./constants";

export const EVIL_SPAWN_DELAY = 10;
export const BOX_PRESSES = 5;
export const CLONE_SPEED_MULTIPLIER = 1.08;
export const CHASE_SPEED_MULTIPLIER = 1.12;
export const SIGHT_SHAKE_SECONDS = 0.5;
/** A parried clone is frozen and harmless for this long. */
export const CLONE_STUN_SECONDS = 1.5;
export const PARRY_FLASH_SECONDS = 0.35;
export const RADII = [2600, 1900, 1300, 420] as const;
export type RadiusBand = 0 | 1 | 2 | 3 | 4;
export type RoutePoint = { x: number; y: number; facing: number; pose: "idle" | "runFast" | "jump" | "fall" | "dash" | "slide" | "dive" };
export type ObjectiveBox = { x: number; y: number; presses: number };
export type EvilChaseState = {
  x: number; y: number; facing: number; pose: RoutePoint["pose"];
  spawned: boolean; band: RadiusBand; sawPlayer: boolean; sightShake: number;
  atmosphere: number; route: RoutePoint[]; cursor: number;
  boxes: ObjectiveBox[]; trail: { x: number; y: number; facing: number; pose: RoutePoint["pose"]; life: number }[];
  trailClock: number;
  phase: "objectives" | "escape";
  stun: number; parryFlash: number;
  eyeTrail: { x: number; y: number; t: number }[];
};

export function radiusBand(distance: number): RadiusBand {
  if (distance <= RADII[3]) return 4;
  if (distance <= RADII[2]) return 3;
  if (distance <= RADII[1]) return 2;
  if (distance <= RADII[0]) return 1;
  return 0;
}

/** Once spotted at close range, BFF4 owns the whole encounter until fully escaped. */
export function chaseRadiusBand(previous: RadiusBand, distance: number): RadiusBand {
  if (distance > RADII[0]) return 0;
  return previous === 4 ? 4 : radiusBand(distance);
}

/** BFF1–3 are cumulative terror stems; BFF4 replaces them in chase. */
export function radiusMix(band: RadiusBand): number[] {
  if (band === 4) return [0, 0, 0, 1];
  return [1, 2, 3, 4].map(n => n <= band ? 1 : 0);
}

export function createEvilChase(spawn: { x: number; y: number }, boxes: { x: number; y: number }[]): EvilChaseState {
  return {
    ...spawn, facing: 1, pose: "idle", spawned: false, band: 0, phase: "objectives",
    sawPlayer: false, sightShake: 0, atmosphere: 0,
    route: [{ ...spawn, facing: 1, pose: "idle" }], cursor: 0,
    boxes: boxes.map(b => ({ ...b, presses: 0 })), trail: [], trailClock: 0,
    stun: 0, parryFlash: 0, eyeTrail: [],
  };
}

export function exitPowered(state: EvilChaseState): boolean {
  return state.boxes.length === 5 && state.boxes.every(b => b.presses === BOX_PRESSES);
}

export function beginEscape(state: EvilChaseState, player: { x: number; y: number; w: number; h: number }, gate: { x: number; y: number; w: number; h: number }): boolean {
  // Crossing the doorway starts pursuit even during a jump or fast dash.
  if (state.phase !== "objectives" || !exitPowered(state) || player.x + player.w <= gate.x) return false;
  state.phase = "escape";
  // Reappear behind the player on their actual approach, not through a wall.
  const latest: RoutePoint = { x: player.x, y: player.y, facing: 1, pose: "runFast" };
  state.route.push(latest);
  let index = state.route.length - 1, distance = 0;
  while (index > 0 && distance < 1000) {
    const a = state.route[index], b = state.route[index - 1];
    distance += Math.hypot(a.x - b.x, a.y - b.y);
    index--;
  }
  const anchor = state.route[index];
  state.x = anchor.x; state.y = anchor.y; state.facing = anchor.facing; state.pose = anchor.pose;
  state.route = state.route.slice(index); state.cursor = 0;
  state.spawned = true; state.sightShake = SIGHT_SHAKE_SECONDS;
  state.trail = []; state.trailClock = 0;
  return true;
}

export function canFinishEvilChase(state: EvilChaseState): boolean {
  return state.phase === "escape" && exitPowered(state);
}

export function nearbyBox(state: EvilChaseState, player: { x: number; y: number; w: number; h: number }): ObjectiveBox | undefined {
  return state.boxes.find(b => b.presses < BOX_PRESSES &&
    Math.hypot(player.x + player.w / 2 - (b.x + 32), player.y + player.h / 2 - (b.y + 32)) < 105);
}

export function pressBox(state: EvilChaseState, player: { x: number; y: number; w: number; h: number }): boolean {
  const box = nearbyBox(state, player);
  if (!box) return false;
  box.presses = Math.min(BOX_PRESSES, box.presses + 1);
  return true;
}

/** Segment/rectangle slabs: terrain genuinely blocks the clone's sight. */
export function hasLineOfSight(a: { x: number; y: number }, b: { x: number; y: number }, platforms: Platform[]): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const p of platforms) {
    let entry = 0, exit = 1;
    let hits = true;
    for (const [start, delta, min, max] of [[a.x, dx, p.x, p.x + p.w], [a.y, dy, p.y, p.y + p.h]]) {
      if (Math.abs(delta) < 0.00001) {
        if (start < min || start > max) { hits = false; break; }
      } else {
        const t1 = (min - start) / delta, t2 = (max - start) / delta;
        entry = Math.max(entry, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
        if (entry > exit) { hits = false; break; }
      }
    }
    if (hits && exit > 0.001 && entry < 0.999) return false;
  }
  return true;
}

/** Replay the player's traversable route, not a ground-pinned or wall-phasing chaser. */
export function stepEvilChase(state: EvilChaseState, player: RoutePoint, elapsed: number, dt: number, platforms: Platform[], normalSpeed = MAX_SPEED): void {
  const last = state.route[state.route.length - 1];
  if (!last || Math.hypot(player.x - last.x, player.y - last.y) >= 8) state.route.push({ ...player });
  if (elapsed < EVIL_SPAWN_DELAY) return;
  // The spawn frame is held at the original spawn, before any route traversal.
  if (!state.spawned) { state.spawned = true; return; }
  state.parryFlash = Math.max(0, state.parryFlash - dt);
  if (state.stun > 0) { state.stun = Math.max(0, state.stun - dt); return; }
  let budget = normalSpeed * CLONE_SPEED_MULTIPLIER * dt;
  while (budget > 0 && state.cursor < state.route.length) {
    const target = state.route[state.cursor];
    const dx = target.x - state.x, dy = target.y - state.y;
    const distance = Math.hypot(dx, dy);
    state.facing = target.facing;
    state.pose = target.pose;
    if (distance <= budget) {
      state.x = target.x; state.y = target.y;
      budget -= distance; state.cursor++;
    } else {
      state.x += dx / distance * budget; state.y += dy / distance * budget;
      budget = 0;
    }
  }
  if (state.cursor > 128) { state.route.splice(0, state.cursor); state.cursor = 0; }
  const distance = Math.hypot(player.x - state.x, player.y - state.y);
  state.band = chaseRadiusBand(state.band, distance);
  const seen = distance <= RADII[0] && hasLineOfSight(
    { x: state.x + PLAYER_W / 2, y: state.y + 14 },
    { x: player.x + PLAYER_W / 2, y: player.y + 14 }, platforms);
  state.sightShake = Math.max(0, state.sightShake - dt);
  if (seen && !state.sawPlayer) state.sightShake = SIGHT_SHAKE_SECONDS;
  state.sawPlayer = seen;
  state.atmosphere += ((state.band === 4 ? 1 : 0) - state.atmosphere) * Math.min(1, dt * 5);
  for (const t of state.trail) t.life -= dt;
  state.trail = state.trail.filter(t => t.life > 0);
  state.trailClock -= dt;
  if (state.trailClock <= 0) {
    state.trailClock = 0.07;
    state.trail.push({ x: state.x, y: state.y, facing: state.facing, pose: state.pose, life: 0.35 });
  }
}

/** Parrying while touching the clone stuns it instead of killing the player. */
export function parryClone(state: EvilChaseState): void {
  state.stun = CLONE_STUN_SECONDS;
  state.parryFlash = PARRY_FLASH_SECONDS;
}

export function cloneTouchesPlayer(state: EvilChaseState, player: { x: number; y: number; w: number; h: number }): boolean {
  return state.spawned && state.stun <= 0 && player.x < state.x + PLAYER_W && player.x + player.w > state.x &&
    player.y < state.y + PLAYER_H && player.y + player.h > state.y;
}