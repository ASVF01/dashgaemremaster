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
  // Pre-placed invboi-star pickup (normally spawned by pressing E).
  // When set, the GameCanvas will spawn it at level init.
  invboiStart?: { x: number; y: number; facing: 1 | -1 };
};

export type LevelId = "tutorial" | "scribble-1" | "scribble-2" | "scribble-3" | "chase" | "speed-test" | "just-run-bro" | "meet-invboi" | "roaring-knight" | "aftermath-1" | "aftermath-2" | "aftermath-3" | "celestial-marathon";

export type LevelMeta = {
  id: LevelId;
  name: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4;
  par: number; // seconds
  hidden?: boolean;
};

export const LEVELS: LevelMeta[] = [
  { id: "tutorial",   name: "TUTORIAL",   subtitle: "learn to scribble",   difficulty: 1, par: 90 },
  { id: "scribble-1", name: "INK ALLEY",  subtitle: "warm up those legs",  difficulty: 2, par: 50 },
  { id: "scribble-2", name: "PAPER CUTS", subtitle: "shooters everywhere", difficulty: 3, par: 55 },
  { id: "scribble-3", name: "OVERDRIVE",  subtitle: "go absurdly fast",    difficulty: 4, par: 60 },
  { id: "chase",      name: "THE CHASE",  subtitle: "don't look back. parry to push it off.", difficulty: 4, par: 45 },
  { id: "speed-test", name: "??? SPEED TEST ???", subtitle: "the hallway never ends. or does it.", difficulty: 4, par: 30, hidden: true },
  { id: "just-run-bro", name: "JUST RUN BRO..", subtitle: "no obstacles. no enemies. just vibes.", difficulty: 1, par: 9999 },
  { id: "meet-invboi", name: "CELESTIAL ENCOUNTER", subtitle: "say hi to a new friend :)", difficulty: 1, par: 60 },
  { id: "roaring-knight", name: "THE ROARING KNIGHT", subtitle: "dodge. parry. dash to strike.", difficulty: 4, par: 120 },
  { id: "aftermath-1", name: "ASHEN MARGINS",  subtitle: "after the knight, the ink keeps bleeding.", difficulty: 4, par: 60 },
  { id: "aftermath-2", name: "TORN PAGES",     subtitle: "shooters in the gaps. mind the rips.",     difficulty: 4, par: 65 },
  { id: "aftermath-3", name: "FINAL DRAFT",    subtitle: "everything you've learned. one run.",      difficulty: 4, par: 75 },
];

export function buildLevel(id: LevelId = "scribble-1"): Level {
  let lv: Level;
  switch (id) {
    case "tutorial":   lv = buildTutorial(); break;
    case "scribble-1": lv = buildLevel1(); break;
    case "scribble-2": lv = buildLevel2(); break;
    case "scribble-3": lv = buildLevel3(); break;
    case "chase":      lv = buildChase(); break;
    case "speed-test": lv = buildSpeedTest(); break;
    case "just-run-bro": lv = buildJustRunBro(); break;
    case "meet-invboi": lv = buildMeetInvboi(); break;
    case "roaring-knight": lv = buildRoaringKnight(); break;
    case "aftermath-1": lv = buildAftermath1(); break;
    case "aftermath-2": lv = buildAftermath2(); break;
    case "aftermath-3": lv = buildAftermath3(); break;
  }
  // Fill any pit directly below a hazard with a ground platform so spikes
  // sit on solid floor instead of marking a bottomless gap.
  for (const h of lv.hazards) {
    const top = h.y + h.h; // floor must start at/below the spike's base
    const hasGround = lv.platforms.some(
      (pl) =>
        pl.y >= top - 2 &&
        pl.y <= top + 40 &&
        pl.x <= h.x &&
        pl.x + pl.w >= h.x + h.w,
    );
    if (!hasGround) {
      lv.platforms.push({
        x: h.x - 20,
        y: top,
        w: h.w + 40,
        h: Math.max(40, lv.height - top),
        kind: "ground",
      });
    }
  }
  return lv;
}

// ---------- JUST RUN BRO: flat, endless, no obstacles ----------
function buildJustRunBro(): Level {
  // A SUPER long flat stretch — no hazards, no enemies, just vibes.
  // The super dash ramp is intentionally slow, so this length rewards
  // committing to the hold for the full payoff.
  const W = 360000;
  const H = 720;
  const groundY = H - 80;
  const platforms: Platform[] = [
    { x: 0, y: groundY, w: W, h: 80, kind: "ground" },
  ];
  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 160, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards: [], enemies: [], pickups: [],
    signs: [
      { x: 200,    y: groundY - 110, text: "just run bro.." },
      { x: 1500,   y: groundY - 110, text: "seriously. that's it." },
      { x: 5000,   y: groundY - 110, text: "hold dash. trust me." },
      { x: 15000,  y: groundY - 110, text: "you're doing great bro" },
      { x: 35000,  y: groundY - 110, text: "still going? respect." },
      { x: 60000,  y: groundY - 110, text: "warm up complete bro" },
      { x: 90000,  y: groundY - 110, text: "this is the long haul" },
      { x: 130000, y: groundY - 110, text: "halfway-ish. keep vibing." },
      { x: 170000, y: groundY - 110, text: "bro is locked in" },
      { x: 210000, y: groundY - 110, text: "the horizon fears you" },
      { x: 250000, y: groundY - 110, text: "no thoughts. just run." },
      { x: 290000, y: groundY - 110, text: "bro you're built different" },
      { x: 320000, y: groundY - 110, text: "ok almost there bro" },
      { x: 345000, y: groundY - 110, text: "flag's right there bro" },
      { x: 358000, y: groundY - 110, text: "GO GO GO" },
    ],
  };
}

// ---------- MEET INVBOI: introduces the invboi-star pickup ----------
// Tiny flat level. Star is pre-placed in front of the player with a sign.
// On grab, GameCanvas fires onInvboiPickup so the parent can show the
// instructions overlay.
function buildMeetInvboi(): Level {
  const W = 14000;
  const H = 720;
  const groundY = H - 80;
  const platforms: Platform[] = [
    { x: 0, y: groundY, w: W, h: 80, kind: "ground" },

    // ---- pre-star: short stretch with the floating star ahead ----
    { x: 1400, y: groundY - 140, w: 160, h: 22, kind: "block" },
    { x: 1700, y: groundY - 220, w: 160, h: 22, kind: "block" },
    { x: 2000, y: groundY - 160, w: 160, h: 22, kind: "block" },

    // ---- post-star playground: enemies + obstacles to plow through ----
    { x: 2600, y: groundY - 200, w: 200, h: 22, kind: "block" },
    { x: 3100, y: groundY - 280, w: 200, h: 22, kind: "block" },
    { x: 3600, y: groundY - 180, w: 200, h: 22, kind: "block" },
    { x: 4200, y: groundY - 240, w: 220, h: 22, kind: "block" },
    { x: 4700, y: groundY - 320, w: 200, h: 22, kind: "block" },
    { x: 5200, y: groundY - 200, w: 200, h: 22, kind: "block" },
    { x: 5800, y: groundY - 280, w: 220, h: 22, kind: "block" },
    { x: 6400, y: groundY - 220, w: 200, h: 22, kind: "block" },
    { x: 7000, y: groundY - 340, w: 220, h: 22, kind: "block" },
    { x: 7600, y: groundY - 200, w: 200, h: 22, kind: "block" },
    { x: 8200, y: groundY - 280, w: 220, h: 22, kind: "block" },
    { x: 8800, y: groundY - 240, w: 200, h: 22, kind: "block" },
    { x: 9400, y: groundY - 320, w: 220, h: 22, kind: "block" },
    { x: 10000, y: groundY - 200, w: 200, h: 22, kind: "block" },
    { x: 10600, y: groundY - 280, w: 220, h: 22, kind: "block" },
    { x: 11200, y: groundY - 220, w: 200, h: 22, kind: "block" },
    { x: 11900, y: groundY - 340, w: 220, h: 22, kind: "block" },
    { x: 12600, y: groundY - 240, w: 200, h: 22, kind: "block" },
    { x: 13300, y: groundY - 300, w: 220, h: 22, kind: "block" },

    // a couple of slide tunnels (trivial as invboi but fun)
    { x: 4400, y: groundY - 90, w: 320, h: 28, kind: "block" },
    { x: 7200, y: groundY - 90, w: 320, h: 28, kind: "block" },
    { x: 10400, y: groundY - 90, w: 320, h: 28, kind: "block" },
  ];
  // Enemies sprinkled across the playground — invboi obliterates on touch.
  const enemies: Enemy[] = [
    { x: 1900, y: groundY - 50, w: 32, h: 50, vx: -70, alive: true, kind: "grunt" },
    { x: 2400, y: groundY - 50, w: 32, h: 50, vx: 80, alive: true, kind: "grunt" },
    { x: 3100, y: groundY - 280 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.2 },
    { x: 3700, y: groundY - 50, w: 32, h: 50, vx: -90, alive: true, kind: "grunt" },
    { x: 4300, y: groundY - 50, w: 32, h: 50, vx: 90, alive: true, kind: "grunt" },
    { x: 4720, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
    { x: 5400, y: groundY - 50, w: 32, h: 50, vx: -100, alive: true, kind: "grunt" },
    { x: 5820, y: groundY - 280 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.1 },
    { x: 6500, y: groundY - 50, w: 32, h: 50, vx: 100, alive: true, kind: "grunt" },
    { x: 7020, y: groundY - 340 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
    { x: 7700, y: groundY - 50, w: 32, h: 50, vx: -110, alive: true, kind: "grunt" },
    { x: 8220, y: groundY - 280 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
    { x: 8900, y: groundY - 50, w: 32, h: 50, vx: 110, alive: true, kind: "grunt" },
    { x: 9420, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
    { x: 10100, y: groundY - 50, w: 32, h: 50, vx: -110, alive: true, kind: "grunt" },
    { x: 10620, y: groundY - 280 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
    { x: 11300, y: groundY - 50, w: 32, h: 50, vx: 120, alive: true, kind: "grunt" },
    { x: 11920, y: groundY - 340 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
    { x: 12700, y: groundY - 50, w: 32, h: 50, vx: -120, alive: true, kind: "grunt" },
    { x: 13320, y: groundY - 300 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
  ];
  // Star location — right in front of the player spawn.
  const starX = 320;
  const starY = groundY - 80;
  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 160, y: groundY - 120, w: 50, h: 120 },
    platforms,
    hazards: [],
    enemies,
    pickups: [],
    signs: [
      { x: starX, y: groundY - 170, text: "Hey you! grab this!" },
      { x: 5000, y: groundY - 110, text: "go nuts. nothing can hurt you." },
      { x: 9000, y: groundY - 110, text: "spam that dash bro" },
      { x: 13000, y: groundY - 110, text: "flag's right there →" },
    ],
    invboiStart: { x: starX, y: starY, facing: 1 },
  };
}
// A long, mostly flat hallway. A "chaser" enemy spawns just behind the
// player's start and pursues forever. Touching it = damage. Parrying it
// blasts it back and stuns it briefly so you can recover ground.
function buildChase(): Level {
  const W = 24000;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    { x: 0, y: groundY, w: W, h: 80, kind: "ground" },
    // ceiling slab to keep it a hallway
    { x: 0, y: 80, w: W, h: 30, kind: "block" },
  ];

  // sparse low ceilings to force slides (keep momentum)
  for (let x = 1400; x < W - 1000; x += 1800) {
    platforms.push({ x, y: groundY - 80, w: 320, h: 26, kind: "block" });
  }
  // small step blocks for rhythm
  for (let x = 2200; x < W - 800; x += 1300) {
    platforms.push({ x, y: groundY - 50, w: 90, h: 50, kind: "block" });
  }

  const hazards: Hazard[] = [];
  for (let x = 3000; x < W - 800; x += 1700) {
    hazards.push({ x, y: groundY - 18, w: 60, h: 18 });
  }

  // The chaser — placed slightly behind the spawn. Tall and wide so it
  // visually fills the hallway like an encroaching wall.
  const enemies: Enemy[] = [
    {
      x: -260, y: groundY - 220, w: 90, h: 220,
      vx: 0, alive: true, kind: "chaser",
      baseSpeed: 360, stunTimer: 0,
    },
  ];

  const pickups: Pickup[] = [];
  for (let x = 500; x < W - 200; x += 220) {
    pickups.push({ x, y: groundY - 50 - ((x / 220) % 3) * 24, collected: false });
  }

  const signs = [
    { x: 120,  y: groundY - 110, text: "RUN. don't stop." },
    { x: 700,  y: groundY - 110, text: "press J to PARRY when it's close →" },
  ];

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 160, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups, signs,
  };
}

// ---------- SECRET: SPEED TEST ----------
// A long, flat hallway with a low ceiling so you must get fast. Pickups every
// stretch act as speed checkpoints. The goal sits at the very end.
function buildSpeedTest(): Level {
  const W = 24000;
  const H = 720;
  const groundY = H - 80;
  const ceilY = groundY - 220;

  const platforms: Platform[] = [
    // continuous floor
    { x: 0, y: groundY, w: W, h: 80, kind: "ground" },
    // continuous ceiling slab — far above so jumps work, but bounds the hallway
    { x: 0, y: 80, w: W, h: 30, kind: "block" },
  ];

  // periodic low-ceiling slide tunnels to reward sliding momentum
  for (let x = 1200; x < W - 800; x += 1600) {
    platforms.push({ x, y: groundY - 80, w: 360, h: 28, kind: "block" });
  }

  // little speed-pad blocks every so often (visual landmarks)
  for (let x = 800; x < W - 400; x += 800) {
    platforms.push({ x, y: ceilY, w: 60, h: 14, kind: "block" });
  }

  const hazards: Hazard[] = [];
  // sparse spikes you must dash/parry through later in the run
  for (let x = 8000; x < W - 600; x += 2400) {
    hazards.push({ x, y: groundY - 18, w: 60, h: 18 });
  }

  const enemies: Enemy[] = [];

  // pickup chains — visible ribbon down the hallway
  const pickups: Pickup[] = [];
  for (let x = 400; x < W - 200; x += 140) {
    pickups.push({ x, y: groundY - 40 - ((x / 140) % 3) * 18, collected: false });
  }

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 160, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}

// ---------- TUTORIAL ----------
function buildTutorial(): Level {
  const W = 6400;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    { x: 0,    y: groundY, w: 900,  h: 80, kind: "ground" },
    { x: 1000, y: groundY, w: 700,  h: 80, kind: "ground" },
    { x: 1820, y: groundY, w: 900,  h: 80, kind: "ground" },
    { x: 2820, y: groundY, w: 700,  h: 80, kind: "ground" },
    { x: 3620, y: groundY, w: 780,  h: 80, kind: "ground" },
    // new stretch: super dash hallway + finish
    { x: 4500, y: groundY, w: 900,  h: 80, kind: "ground" },
    { x: 5500, y: groundY, w: 900,  h: 80, kind: "ground" },

    // jump up tutorial
    { x: 500,  y: groundY - 140, w: 140, h: 22, kind: "block" },
    { x: 700,  y: groundY - 240, w: 140, h: 22, kind: "block" },

    // slide-under low ceiling
    { x: 1100, y: groundY - 90,  w: 460, h: 30, kind: "block" },

    // longer floats for momentum
    { x: 1900, y: groundY - 200, w: 160, h: 22, kind: "block" },
    { x: 2150, y: groundY - 280, w: 160, h: 22, kind: "block" },
    { x: 2400, y: groundY - 220, w: 180, h: 22, kind: "block" },

    // parry training platform
    { x: 3000, y: groundY - 220, w: 200, h: 22, kind: "block" },

    // dive-down chamber: a high block then a pit to dive across
    { x: 3700, y: groundY - 260, w: 200, h: 22, kind: "block" },
    { x: 3950, y: groundY - 320, w: 160, h: 22, kind: "block" },
    { x: 4200, y: groundY - 200, w: 180, h: 22, kind: "block" },

    // super-dash hallway floats — long flat run to build mach
    { x: 4700, y: groundY - 180, w: 240, h: 22, kind: "block" },
    { x: 5050, y: groundY - 260, w: 220, h: 22, kind: "block" },
    { x: 5380, y: groundY - 200, w: 200, h: 22, kind: "block" },

    // finale floats above flag
    { x: 5800, y: groundY - 240, w: 220, h: 22, kind: "block" },
    { x: 6100, y: groundY - 320, w: 180, h: 22, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 900,  y: groundY - 18, w: 100, h: 18 },
    { x: 1700, y: groundY - 18, w: 120, h: 18 },
    { x: 2720, y: groundY - 18, w: 100, h: 18 },
    { x: 3520, y: groundY - 18, w: 100, h: 18 },
    // new pits
    { x: 4400, y: groundY - 18, w: 100, h: 18 },
    { x: 5400, y: groundY - 18, w: 100, h: 18 },
  ];

  const enemies: Enemy[] = [
    // one easy grunt to stomp
    { x: 1300, y: groundY - 50, w: 32, h: 50, vx: 0, alive: true, kind: "grunt" },
    // a shooter for parry practice
    { x: 3200, y: groundY - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.6 },
    // a second grunt to test stomp + run momentum
    { x: 4850, y: groundY - 50, w: 32, h: 50, vx: 0, alive: true, kind: "grunt" },
    // a final shooter guarding the lane to the flag
    { x: 5750, y: groundY - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.4 },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 14; i++) {
    pickups.push({ x: 350 + i * 420, y: groundY - 160 - (i % 3) * 60, collected: false });
  }

  const signs = [
    { x: 120,  y: groundY - 110, text: "← → or A D to RUN" },
    { x: 420,  y: groundY - 110, text: "SPACE to JUMP" },
    { x: 1080, y: groundY - 130, text: "hold ↓ / S to SLIDE under stuff" },
    { x: 1880, y: groundY - 110, text: "stomp enemies from above!" },
    { x: 2900, y: groundY - 110, text: "press J to PARRY shots →" },
    { x: 3680, y: groundY - 110, text: "in the air, hold ↓ to DIVE down fast" },
    { x: 4620, y: groundY - 110, text: "build speed → tap SHIFT for a SUPER DASH" },
    { x: 5950, y: groundY - 110, text: "almost there!! reach the FLAG →" },
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

// ---------- BOSS: THE ROARING KNIGHT ----------
// Single-room arena. The boss isn't a regular enemy — the GameCanvas
// handles it via its own `boss` runtime state. We just provide an arena
// for the player to maneuver in.
function buildRoaringKnight(): Level {
  // Endless hallway — boss is screen-anchored so the camera can scroll forever.
  // Single huge ground + ceiling slab; the renderer already clips long platforms
  // to the visible window so this stays cheap.
  const W = 360000;
  const H = 720;
  const groundY = H - 80;
  const platforms: Platform[] = [
    { x: 0, y: groundY, w: W, h: 80, kind: "ground" },
    { x: 0, y: 60, w: W, h: 24, kind: "block" },
  ];
  return {
    width: W, height: H,
    spawn: { x: 120, y: groundY - 80 },
    goal: { x: -9999, y: -9999, w: 1, h: 1 },
    platforms, hazards: [], enemies: [], pickups: [],
  };
}


// ---------- AFTERMATH 1: ASHEN MARGINS ----------
// Post-boss "act 2" opener. Faster baseline than scribble-1, more verticality,
// shooters mixed with grunts. Built to feel like a harder remix of level 1.
function buildAftermath1(): Level {
  const W = 7600;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    { x: 0,    y: groundY, w: 1100, h: 80, kind: "ground" },
    { x: 1240, y: groundY, w: 800,  h: 80, kind: "ground" },
    { x: 2160, y: groundY, w: 700,  h: 80, kind: "ground" },
    { x: 2980, y: groundY, w: 1000, h: 80, kind: "ground" },
    { x: 4100, y: groundY, w: 900,  h: 80, kind: "ground" },
    { x: 5120, y: groundY, w: 800,  h: 80, kind: "ground" },
    { x: 6040, y: groundY, w: 1560, h: 80, kind: "ground" },

    // route platforms (mid)
    { x: 700,  y: groundY - 150, w: 200, h: 22, kind: "block" },
    { x: 1000, y: groundY - 260, w: 180, h: 22, kind: "block" },
    { x: 1500, y: groundY - 220, w: 200, h: 22, kind: "block" },
    { x: 1820, y: groundY - 320, w: 180, h: 22, kind: "block" },
    { x: 2400, y: groundY - 240, w: 200, h: 22, kind: "block" },
    { x: 2700, y: groundY - 340, w: 180, h: 22, kind: "block" },
    { x: 3200, y: groundY - 200, w: 220, h: 22, kind: "block" },
    { x: 3550, y: groundY - 320, w: 200, h: 22, kind: "block" },
    { x: 3900, y: groundY - 240, w: 180, h: 22, kind: "block" },
    { x: 4350, y: groundY - 280, w: 200, h: 22, kind: "block" },
    { x: 4700, y: groundY - 380, w: 180, h: 22, kind: "block" },
    { x: 5250, y: groundY - 240, w: 200, h: 22, kind: "block" },
    { x: 5600, y: groundY - 340, w: 180, h: 22, kind: "block" },
    { x: 6200, y: groundY - 220, w: 220, h: 22, kind: "block" },
    { x: 6550, y: groundY - 340, w: 200, h: 22, kind: "block" },
    { x: 6900, y: groundY - 240, w: 180, h: 22, kind: "block" },

    // a couple of slide tunnels
    { x: 1300, y: groundY - 90, w: 260, h: 28, kind: "block" },
    { x: 4100, y: groundY - 90, w: 320, h: 28, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 1100, y: groundY - 18, w: 140, h: 18 },
    { x: 2040, y: groundY - 18, w: 120, h: 18 },
    { x: 2860, y: groundY - 18, w: 120, h: 18 },
    { x: 3980, y: groundY - 18, w: 120, h: 18 },
    { x: 5000, y: groundY - 18, w: 120, h: 18 },
    { x: 5920, y: groundY - 18, w: 120, h: 18 },
  ];

  const enemies: Enemy[] = [
    { x: 600,  y: groundY - 50, w: 32, h: 50, vx: -90, alive: true, kind: "grunt" },
    { x: 1020, y: groundY - 260 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
    { x: 1600, y: groundY - 50, w: 32, h: 50, vx: 100, alive: true, kind: "grunt" },
    { x: 1840, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
    { x: 2500, y: groundY - 50, w: 32, h: 50, vx: -110, alive: true, kind: "grunt" },
    { x: 2720, y: groundY - 340 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.8 },
    { x: 3300, y: groundY - 50, w: 32, h: 50, vx: 110, alive: true, kind: "grunt" },
    { x: 3570, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.9 },
    { x: 4380, y: groundY - 50, w: 32, h: 50, vx: -100, alive: true, kind: "grunt" },
    { x: 4720, y: groundY - 380 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
    { x: 5300, y: groundY - 50, w: 32, h: 50, vx: 120, alive: true, kind: "grunt" },
    { x: 5620, y: groundY - 340 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.8 },
    { x: 6300, y: groundY - 50, w: 32, h: 50, vx: -110, alive: true, kind: "grunt" },
    { x: 6920, y: groundY - 240 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 1.0 },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 22; i++) {
    pickups.push({ x: 350 + i * 320 + Math.random() * 60, y: groundY - 150 - Math.random() * 240, collected: false });
  }

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}

// ---------- AFTERMATH 2: TORN PAGES ----------
// Lots of pits + sky shooters. Punishes sloppy jumps; rewards parry rhythm.
function buildAftermath2(): Level {
  const W = 8200;
  const H = 720;
  const groundY = H - 80;

  // chunky islands separated by pits
  const islands: Array<[number, number]> = [
    [0, 900], [1080, 600], [1820, 540], [2520, 700], [3360, 560],
    [4060, 760], [4980, 580], [5720, 720], [6600, 600], [7320, 880],
  ];

  const platforms: Platform[] = islands.map(([x, w]) => ({
    x, y: groundY, w, h: 80, kind: "ground" as const,
  }));

  // shooter perches above each gap
  for (let i = 0; i < islands.length - 1; i++) {
    const [x, w] = islands[i];
    const gapMid = x + w + 50;
    platforms.push({ x: gapMid, y: groundY - 280, w: 120, h: 22, kind: "block" });
  }

  // route hops between islands
  for (let i = 0; i < islands.length - 1; i++) {
    const [x, w] = islands[i];
    platforms.push({ x: x + w - 30, y: groundY - 160, w: 100, h: 22, kind: "block" });
    platforms.push({ x: x + w + 110, y: groundY - 220, w: 100, h: 22, kind: "block" });
  }

  // a few high floats for chains
  for (let i = 0; i < 6; i++) {
    platforms.push({ x: 700 + i * 1200, y: groundY - 360, w: 160, h: 22, kind: "block" });
  }

  const hazards: Hazard[] = [];
  for (let i = 0; i < islands.length - 1; i++) {
    const [x, w] = islands[i];
    const next = islands[i + 1];
    const gapStart = x + w;
    const gapEnd = next[0];
    hazards.push({ x: gapStart + 8, y: groundY - 18, w: gapEnd - gapStart - 16, h: 18 });
  }

  const enemies: Enemy[] = [];
  for (let i = 0; i < islands.length - 1; i++) {
    const [x, w] = islands[i];
    const gapMid = x + w + 50;
    enemies.push({
      x: gapMid + 40, y: groundY - 280 - 50, w: 32, h: 50, vx: 0,
      alive: true, kind: "shooter", shootTimer: 0.7 + (i % 3) * 0.2,
    });
  }
  // grunts on the fatter islands
  for (let i = 0; i < islands.length; i++) {
    const [x, w] = islands[i];
    if (w >= 700) {
      enemies.push({ x: x + w / 2, y: groundY - 50, w: 32, h: 50, vx: i % 2 ? 110 : -110, alive: true, kind: "grunt" });
    }
  }

  const pickups: Pickup[] = [];
  for (let i = 0; i < 26; i++) {
    pickups.push({ x: 300 + i * 300 + Math.random() * 60, y: groundY - 180 - Math.random() * 220, collected: false });
  }

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}

// ---------- AFTERMATH 3: FINAL DRAFT ----------
// The graduation level: long, dense, mixes slide tunnels + sky route + pits.
function buildAftermath3(): Level {
  const W = 9600;
  const H = 720;
  const groundY = H - 80;

  const platforms: Platform[] = [
    // mostly continuous floor with a few pits
    { x: 0,    y: groundY, w: 2000, h: 80, kind: "ground" },
    { x: 2140, y: groundY, w: 1600, h: 80, kind: "ground" },
    { x: 3880, y: groundY, w: 1700, h: 80, kind: "ground" },
    { x: 5720, y: groundY, w: 1600, h: 80, kind: "ground" },
    { x: 7460, y: groundY, w: 2140, h: 80, kind: "ground" },

    // slide tunnels
    { x: 600,  y: groundY - 80, w: 460, h: 28, kind: "block" },
    { x: 1500, y: groundY - 80, w: 420, h: 28, kind: "block" },
    { x: 2400, y: groundY - 80, w: 460, h: 28, kind: "block" },
    { x: 4200, y: groundY - 80, w: 480, h: 28, kind: "block" },
    { x: 5000, y: groundY - 80, w: 420, h: 28, kind: "block" },
    { x: 6000, y: groundY - 80, w: 460, h: 28, kind: "block" },
    { x: 7700, y: groundY - 80, w: 480, h: 28, kind: "block" },
    { x: 8600, y: groundY - 80, w: 460, h: 28, kind: "block" },

    // skybridge — full route across the top
    { x: 1200, y: groundY - 280, w: 700, h: 22, kind: "block" },
    { x: 2100, y: groundY - 360, w: 700, h: 22, kind: "block" },
    { x: 3000, y: groundY - 320, w: 700, h: 22, kind: "block" },
    { x: 4000, y: groundY - 380, w: 700, h: 22, kind: "block" },
    { x: 5000, y: groundY - 340, w: 700, h: 22, kind: "block" },
    { x: 6000, y: groundY - 380, w: 700, h: 22, kind: "block" },
    { x: 7000, y: groundY - 320, w: 700, h: 22, kind: "block" },
    { x: 8000, y: groundY - 360, w: 700, h: 22, kind: "block" },

    // mid hops
    { x: 800,  y: groundY - 200, w: 160, h: 22, kind: "block" },
    { x: 2700, y: groundY - 200, w: 160, h: 22, kind: "block" },
    { x: 4500, y: groundY - 220, w: 160, h: 22, kind: "block" },
    { x: 6300, y: groundY - 220, w: 160, h: 22, kind: "block" },
    { x: 8400, y: groundY - 240, w: 160, h: 22, kind: "block" },
  ];

  const hazards: Hazard[] = [
    { x: 2000, y: groundY - 18, w: 140, h: 18 },
    { x: 3740, y: groundY - 18, w: 140, h: 18 },
    { x: 5580, y: groundY - 18, w: 140, h: 18 },
    { x: 7320, y: groundY - 18, w: 140, h: 18 },
  ];

  const enemies: Enemy[] = [
    // ground patrols
    { x: 1300, y: groundY - 50, w: 32, h: 50, vx: -130, alive: true, kind: "grunt" },
    { x: 2400, y: groundY - 50, w: 32, h: 50, vx: 130, alive: true, kind: "grunt" },
    { x: 3300, y: groundY - 50, w: 32, h: 50, vx: -140, alive: true, kind: "grunt" },
    { x: 4400, y: groundY - 50, w: 32, h: 50, vx: 140, alive: true, kind: "grunt" },
    { x: 5400, y: groundY - 50, w: 32, h: 50, vx: -140, alive: true, kind: "grunt" },
    { x: 6500, y: groundY - 50, w: 32, h: 50, vx: 150, alive: true, kind: "grunt" },
    { x: 7700, y: groundY - 50, w: 32, h: 50, vx: -150, alive: true, kind: "grunt" },
    { x: 8800, y: groundY - 50, w: 32, h: 50, vx: 160, alive: true, kind: "grunt" },

    // sky shooters along the bridge
    { x: 1500, y: groundY - 280 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
    { x: 2400, y: groundY - 360 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.6 },
    { x: 3300, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
    { x: 4300, y: groundY - 380 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.6 },
    { x: 5300, y: groundY - 340 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.6 },
    { x: 6300, y: groundY - 380 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.6 },
    { x: 7300, y: groundY - 320 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
    { x: 8300, y: groundY - 360 - 50, w: 32, h: 50, vx: 0, alive: true, kind: "shooter", shootTimer: 0.7 },
  ];

  const pickups: Pickup[] = [];
  for (let i = 0; i < 32; i++) {
    pickups.push({ x: 280 + i * 290 + Math.random() * 60, y: groundY - 160 - Math.random() * 260, collected: false });
  }

  return {
    width: W, height: H,
    spawn: { x: 80, y: groundY - 80 },
    goal: { x: W - 120, y: groundY - 120, w: 50, h: 120 },
    platforms, hazards, enemies, pickups,
  };
}
