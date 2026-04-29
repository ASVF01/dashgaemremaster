// Pure types & constants for SCRIBBLE RUSH
export const MACH_THRESHOLDS = [0, 280, 460, 640, 820]; // px/s tiers
export const MACH_COLORS = ["#7d8a8a", "#ffd11a", "#ff7a1a", "#f5234c", "#b14cff"];
export const MACH_LABELS = ["WALK", "MACH 1", "MACH 2", "MACH 3", "OVERDRIVE!!"];

export const GRAVITY = 2200;
export const MOVE_ACCEL = 1400;
export const MAX_SPEED = 980;
export const FRICTION = 1600;
export const JUMP_VEL = 900;
export const SLIDE_BOOST = 220;
export const SLIDE_FRICTION = 600;
export const PARRY_WINDOW = 0.22; // seconds
export const PARRY_COOLDOWN = 0.35;
export const PARRY_BOOST = 320;

export const PLAYER_W = 28;
export const PLAYER_H = 56;
export const SLIDE_H = 28;

export type Vec = { x: number; y: number };

export type Platform = { x: number; y: number; w: number; h: number; kind?: "ground" | "block" };
export type Hazard = { x: number; y: number; w: number; h: number };
export type Enemy = {
  x: number; y: number; w: number; h: number;
  vx: number; alive: boolean; kind: "grunt" | "shooter";
  shootTimer?: number;
  hitFlash?: number;
};
export type Projectile = {
  x: number; y: number; vx: number; vy: number; alive: boolean; r: number; danger: boolean;
};
export type Pickup = { x: number; y: number; collected: boolean };

export type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number; kind: "spark" | "smear" | "ring" | "shard";
  angle?: number;
};
