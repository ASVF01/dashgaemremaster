import { Platform, Hazard, Enemy, Pickup } from "./constants";

export type Level = {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  goal: { x: number; y: number; w: number; h: number };
  platforms: Platform[];
  hazards: Hazard[];
  enemies: Enemy[];
  pickups: Pickup[];
};

export function buildLevel(): Level {
  const W = 6400;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    // long ground with gaps
    { x: 0, y: groundY, w: 1200, h: 80, kind: "ground" },
    { x: 1320, y: groundY, w: 900, h: 80, kind: "ground" },
    { x: 2300, y: groundY, w: 700, h: 80, kind: "ground" },
    { x: 3120, y: groundY, w: 1100, h: 80, kind: "ground" },
    { x: 4350, y: groundY, w: 800, h: 80, kind: "ground" },
    { x: 5280, y: groundY, w: 1120, h: 80, kind: "ground" },

    // slide-under low ceilings (we represent as blocks above)
    { x: 600, y: groundY - 120, w: 220, h: 30, kind: "block" },
    { x: 2400, y: groundY - 110, w: 260, h: 30, kind: "block" },
    { x: 4500, y: groundY - 110, w: 280, h: 30, kind: "block" },

    // floating platforms (multi-route)
    { x: 900, y: groundY - 220, w: 180, h: 22, kind: "block" },
    { x: 1150, y: groundY - 320, w: 160, h: 22, kind: "block" },
    { x: 1500, y: groundY - 260, w: 200, h: 22, kind: "block" },
    { x: 1800, y: groundY - 360, w: 180, h: 22, kind: "block" },
    { x: 2100, y: groundY - 280, w: 160, h: 22, kind: "block" },

    { x: 2500, y: groundY - 240, w: 180, h: 22, kind: "block" },
    { x: 2800, y: groundY - 340, w: 200, h: 22, kind: "block" },

    { x: 3300, y: groundY - 200, w: 220, h: 22, kind: "block" },
    { x: 3600, y: groundY - 320, w: 180, h: 22, kind: "block" },
    { x: 3900, y: groundY - 240, w: 160, h: 22, kind: "block" },

    { x: 4400, y: groundY - 280, w: 200, h: 22, kind: "block" },
    { x: 4700, y: groundY - 380, w: 180, h: 22, kind: "block" },
    { x: 5000, y: groundY - 260, w: 160, h: 22, kind: "block" },

    { x: 5400, y: groundY - 220, w: 200, h: 22, kind: "block" },
    { x: 5700, y: groundY - 340, w: 220, h: 22, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 1200, y: groundY - 18, w: 120, h: 18 },
    { x: 2220, y: groundY - 18, w: 80, h: 18 },
    { x: 3000, y: groundY - 18, w: 120, h: 18 },
    { x: 4220, y: groundY - 18, w: 130, h: 18 },
    { x: 5150, y: groundY - 18, w: 130, h: 18 },
  ];

  const enemies: Enemy[] = [
    { x: 800, y: groundY - 50, w: 32, h: 50, vx: -60, alive: true, kind: "grunt" },
    { x: 1600, y: groundY - 50, w: 32, h: 50, vx: 80, alive: true, kind: "grunt" },
    { x: 1900, y: groundY - 360 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.4 },
    { x: 2700, y: groundY - 50, w: 32, h: 50, vx: -90, alive: true, kind: "grunt" },
    { x: 3400, y: groundY - 50, w: 32, h: 50, vx: 70, alive: true, kind: "grunt" },
    { x: 3700, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.6 },
    { x: 4000, y: groundY - 50, w: 32, h: 50, vx: -100, alive: true, kind: "grunt" },
    { x: 4800, y: groundY - 380 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1 },
    { x: 5500, y: groundY - 50, w: 32, h: 50, vx: 90, alive: true, kind: "grunt" },
    { x: 5900, y: groundY - 50, w: 32, h: 50, vx: -110, alive: true, kind: "grunt" },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 18; i++) {
    pickups.push({ x: 400 + i * 320 + Math.random() * 80, y: groundY - 140 - Math.random() * 220, collected: false });
  }

  return {
    width: W,
    height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms,
    hazards,
    enemies,
    pickups,
  };
}
