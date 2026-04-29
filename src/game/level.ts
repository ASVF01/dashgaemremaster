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
  // tutorial-only signs
  signs?: { x: number; y: number; text: string }[];
};

export type LevelId = "tutorial" | "scribble-1" | "scribble-2" | "scribble-3";

export type LevelMeta = {
  id: LevelId;
  name: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4;
  par: number; // seconds
};

export const LEVELS: LevelMeta[] = [
  { id: "tutorial",   name: "TUTORIAL",   subtitle: "learn to scribble",   difficulty: 1, par: 60 },
  { id: "scribble-1", name: "INK ALLEY",  subtitle: "warm up those legs",  difficulty: 2, par: 50 },
  { id: "scribble-2", name: "PAPER CUTS", subtitle: "shooters everywhere", difficulty: 3, par: 55 },
  { id: "scribble-3", name: "OVERDRIVE",  subtitle: "go absurdly fast",    difficulty: 4, par: 60 },
];

export function buildLevel(id: LevelId = "scribble-1"): Level {
  switch (id) {
    case "tutorial":   return buildTutorial();
    case "scribble-1": return buildLevel1();
    case "scribble-2": return buildLevel2();
    case "scribble-3": return buildLevel3();
  }
}

// ---------- TUTORIAL ----------
function buildTutorial(): Level {
  const W = 4200;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    { x: 0,    y: groundY, w: 900,  h: 80, kind: "ground" },
    { x: 1000, y: groundY, w: 700,  h: 80, kind: "ground" },
    { x: 1820, y: groundY, w: 900,  h: 80, kind: "ground" },
    { x: 2820, y: groundY, w: 700,  h: 80, kind: "ground" },
    { x: 3620, y: groundY, w: 580,  h: 80, kind: "ground" },

    // jump up tutorial
    { x: 500,  y: groundY - 140, w: 140, h: 22, kind: "block" },
    { x: 700,  y: groundY - 240, w: 140, h: 22, kind: "block" },

    // slide-under low ceiling
    { x: 1100, y: groundY - 90,  w: 460, h: 30, kind: "block" },

    // longer floats for momentum
    { x: 1900, y: groundY - 200, w: 160, h: 22, kind: "block" },
    { x: 2150, y: groundY - 280, w: 160, h: 22, kind: "block" },
    { x: 2400, y: groundY - 220, w: 180, h: 22, kind: "block" },

    // parry training platforms
    { x: 3000, y: groundY - 220, w: 200, h: 22, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 900,  y: groundY - 18, w: 100, h: 18 },
    { x: 1700, y: groundY - 18, w: 120, h: 18 },
    { x: 2720, y: groundY - 18, w: 100, h: 18 },
    { x: 3520, y: groundY - 18, w: 100, h: 18 },
  ];

  const enemies: Enemy[] = [
    // one easy grunt to stomp
    { x: 1300, y: groundY - 50, w: 32, h: 50, vx: 0,   alive: true, kind: "grunt" },
    // a shooter for parry practice
    { x: 3200, y: groundY - 50, w: 32, h: 50, vx: 0,   alive: true, kind: "shooter", shootTimer: 1.6 },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 8; i++) {
    pickups.push({ x: 350 + i * 420, y: groundY - 160 - (i % 3) * 60, collected: false });
  }

  const signs = [
    { x: 120,  y: groundY - 110, text: "← → or A D to RUN" },
    { x: 420,  y: groundY - 110, text: "SPACE to JUMP" },
    { x: 1080, y: groundY - 130, text: "hold ↓ / S to SLIDE under stuff" },
    { x: 1880, y: groundY - 110, text: "stomp enemies from above!" },
    { x: 2900, y: groundY - 110, text: "press J to PARRY shots →" },
    { x: 3700, y: groundY - 110, text: "reach the FLAG to win!" },
  ];

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups, signs,
  };
}

// ---------- LEVEL 1 (the original) ----------
function buildLevel1(): Level {
  const W = 6400;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    { x: 0, y: groundY, w: 1200, h: 80, kind: "ground" },
    { x: 1320, y: groundY, w: 900, h: 80, kind: "ground" },
    { x: 2300, y: groundY, w: 700, h: 80, kind: "ground" },
    { x: 3120, y: groundY, w: 1100, h: 80, kind: "ground" },
    { x: 4350, y: groundY, w: 800, h: 80, kind: "ground" },
    { x: 5280, y: groundY, w: 1120, h: 80, kind: "ground" },

    { x: 600, y: groundY - 120, w: 220, h: 30, kind: "block" },
    { x: 2400, y: groundY - 110, w: 260, h: 30, kind: "block" },
    { x: 4500, y: groundY - 110, w: 280, h: 30, kind: "block" },

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
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}

// ---------- LEVEL 2: shooter heavy ----------
function buildLevel2(): Level {
  const W = 6800;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    { x: 0, y: groundY, w: 1000, h: 80, kind: "ground" },
    { x: 1140, y: groundY, w: 600, h: 80, kind: "ground" },
    { x: 1880, y: groundY, w: 800, h: 80, kind: "ground" },
    { x: 2820, y: groundY, w: 900, h: 80, kind: "ground" },
    { x: 3860, y: groundY, w: 700, h: 80, kind: "ground" },
    { x: 4700, y: groundY, w: 900, h: 80, kind: "ground" },
    { x: 5740, y: groundY, w: 1060, h: 80, kind: "ground" },

    // shooter perches
    { x: 700,  y: groundY - 180, w: 120, h: 22, kind: "block" },
    { x: 1400, y: groundY - 220, w: 120, h: 22, kind: "block" },
    { x: 2200, y: groundY - 240, w: 120, h: 22, kind: "block" },
    { x: 3100, y: groundY - 260, w: 120, h: 22, kind: "block" },
    { x: 4000, y: groundY - 280, w: 120, h: 22, kind: "block" },
    { x: 4900, y: groundY - 260, w: 120, h: 22, kind: "block" },
    { x: 5900, y: groundY - 240, w: 120, h: 22, kind: "block" },

    // route platforms
    { x: 1000, y: groundY - 120, w: 140, h: 22, kind: "block" },
    { x: 1740, y: groundY - 120, w: 140, h: 22, kind: "block" },
    { x: 2680, y: groundY - 120, w: 140, h: 22, kind: "block" },
    { x: 3720, y: groundY - 120, w: 140, h: 22, kind: "block" },
    { x: 4560, y: groundY - 120, w: 140, h: 22, kind: "block" },
    { x: 5600, y: groundY - 120, w: 140, h: 22, kind: "block" },

    // slide tunnels
    { x: 2000, y: groundY - 90, w: 320, h: 28, kind: "block" },
    { x: 4150, y: groundY - 90, w: 360, h: 28, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 1000, y: groundY - 18, w: 140, h: 18 },
    { x: 1740, y: groundY - 18, w: 140, h: 18 },
    { x: 2680, y: groundY - 18, w: 140, h: 18 },
    { x: 3720, y: groundY - 18, w: 140, h: 18 },
    { x: 4560, y: groundY - 18, w: 140, h: 18 },
    { x: 5600, y: groundY - 18, w: 140, h: 18 },
  ];

  const enemies: Enemy[] = [
    { x: 720,  y: groundY - 180 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
    { x: 1420, y: groundY - 220 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.2 },
    { x: 2220, y: groundY - 240 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
    { x: 3120, y: groundY - 260 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.1 },
    { x: 4020, y: groundY - 280 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.8 },
    { x: 4920, y: groundY - 260 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
    { x: 5920, y: groundY - 240 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.3 },
    { x: 1900, y: groundY - 50, w: 32, h: 50, vx: -80, alive: true, kind: "grunt" },
    { x: 3500, y: groundY - 50, w: 32, h: 50, vx: 90,  alive: true, kind: "grunt" },
    { x: 5200, y: groundY - 50, w: 32, h: 50, vx: -100, alive: true, kind: "grunt" },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 22; i++) {
    pickups.push({ x: 300 + i * 290 + Math.random() * 60, y: groundY - 150 - Math.random() * 200, collected: false });
  }

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}

// ---------- LEVEL 3: speed run ----------
function buildLevel3(): Level {
  const W = 8000;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    // mostly continuous fast ground
    { x: 0,    y: groundY, w: 2400, h: 80, kind: "ground" },
    { x: 2520, y: groundY, w: 1800, h: 80, kind: "ground" },
    { x: 4440, y: groundY, w: 2000, h: 80, kind: "ground" },
    { x: 6560, y: groundY, w: 1440, h: 80, kind: "ground" },

    // slide tunnels (need to stay fast)
    { x: 800,  y: groundY - 80, w: 500, h: 28, kind: "block" },
    { x: 1700, y: groundY - 80, w: 500, h: 28, kind: "block" },
    { x: 2700, y: groundY - 80, w: 500, h: 28, kind: "block" },
    { x: 3600, y: groundY - 80, w: 500, h: 28, kind: "block" },
    { x: 4600, y: groundY - 80, w: 500, h: 28, kind: "block" },
    { x: 5500, y: groundY - 80, w: 500, h: 28, kind: "block" },
    { x: 6700, y: groundY - 80, w: 500, h: 28, kind: "block" },

    // skybridge route
    { x: 1500, y: groundY - 280, w: 700, h: 22, kind: "block" },
    { x: 2400, y: groundY - 360, w: 700, h: 22, kind: "block" },
    { x: 3300, y: groundY - 320, w: 700, h: 22, kind: "block" },
    { x: 4400, y: groundY - 380, w: 700, h: 22, kind: "block" },
    { x: 5400, y: groundY - 320, w: 700, h: 22, kind: "block" },
    { x: 6400, y: groundY - 360, w: 700, h: 22, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 2400, y: groundY - 18, w: 120, h: 18 },
    { x: 4320, y: groundY - 18, w: 120, h: 18 },
    { x: 6440, y: groundY - 18, w: 120, h: 18 },
  ];

  const enemies: Enemy[] = [
    { x: 1500, y: groundY - 50, w: 32, h: 50, vx: -120, alive: true, kind: "grunt" },
    { x: 2900, y: groundY - 50, w: 32, h: 50, vx: 130,  alive: true, kind: "grunt" },
    { x: 3900, y: groundY - 50, w: 32, h: 50, vx: -130, alive: true, kind: "grunt" },
    { x: 5000, y: groundY - 50, w: 32, h: 50, vx: 140,  alive: true, kind: "grunt" },
    { x: 6000, y: groundY - 50, w: 32, h: 50, vx: -130, alive: true, kind: "grunt" },
    { x: 7100, y: groundY - 50, w: 32, h: 50, vx: 150,  alive: true, kind: "grunt" },

    // sky shooters
    { x: 2700, y: groundY - 360 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.8 },
    { x: 3700, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
    { x: 4800, y: groundY - 380 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.6 },
    { x: 5800, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
    { x: 6800, y: groundY - 360 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.8 },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 28; i++) {
    pickups.push({ x: 300 + i * 270 + Math.random() * 60, y: groundY - 150 - Math.random() * 240, collected: false });
  }

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}
