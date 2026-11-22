import type { Level } from "./level";
import type { Platform } from "./constants";

/** Long forest ruins: open stairs, towers, a basin, overhead bridge and summit. */
export function buildEvilChaseLevel(): Level {
  const width = 30000, height = 1900;
  const platforms: Platform[] = [];
  // Continuous low floor means missing a high route is recoverable, not a void.
  platforms.push({ x: 0, y: 1800, w: width, h: 100, kind: "ground" });
  platforms.push({ x: 0, y: 1560, w: 5800, h: 340, kind: "ground" });
  // Wide, solid climbing steps; 130px rise is reachable with an ordinary held jump.
  for (let i = 0; i < 6; i++) platforms.push({ x: 5800 + i * 420, y: 1560 - i * 130, w: 420, h: 340 + i * 130, kind: "ground" });
  platforms.push({ x: 8320, y: 910, w: 1400, h: 990, kind: "ground" });
  for (let i = 0; i < 6; i++) platforms.push({ x: 9720 + i * 420, y: 1040 + i * 130, w: 420, h: 860 - i * 130, kind: "ground" });
  // The low basin is intentionally exposed, not a crawlspace.
  platforms.push({ x: 12240, y: 1690, w: 3800, h: 210, kind: "ground" });
  for (let i = 0; i < 6; i++) platforms.push({ x: 16040 + i * 420, y: 1690 - i * 130, w: 420, h: 210 + i * 130, kind: "ground" });
  platforms.push({ x: 18560, y: 1040, w: 3800, h: 30, kind: "block" });
  // Optional hanging ledges above the bridge, with generous head clearance.
  for (let i = 0; i < 5; i++) platforms.push({ x: 18850 + i * 580, y: 760 - (i % 2) * 130, w: 310, h: 24, kind: "block" });
  // Return ramps from the lower route to prevent a missed bridge trapping players.
  for (let i = 0; i < 6; i++) platforms.push({ x: 22200 + i * 380, y: 1690 - i * 130, w: 380, h: 210 + i * 130, kind: "ground" });
  platforms.push({ x: 24480, y: 1040, w: 620, h: 860, kind: "ground" });
  for (let i = 0; i < 3; i++) platforms.push({ x: 25100 + i * 380, y: 910 - i * 130, w: 380, h: 990 + i * 130, kind: "ground" });
  platforms.push({ x: 26240, y: 650, w: 900, h: 1250, kind: "ground" });
  for (let i = 0; i < 6; i++) platforms.push({ x: 27140 + i * 320, y: 780 + i * 130, w: 320, h: 1120 - i * 130, kind: "ground" });
  platforms.push({ x: 29060, y: 1430, w: 940, h: 470, kind: "ground" });
  // Optional upper routes in the starting clearing: no low-ceiling tunnels.
  for (let i = 0; i < 8; i++) platforms.push({ x: 1000 + i * 530, y: 1270 - (i % 3) * 130, w: 300, h: 24, kind: "block" });
  return {
    width, height, spawn: { x: 100, y: 1504 },
    goal: { x: 29650, y: 1310, w: 60, h: 120 },
    platforms, hazards: [], enemies: [], pickups: [],
    objectiveBoxes: [
      { x: 3000, y: 1496 }, { x: 8680, y: 846 }, { x: 14000, y: 1626 },
      { x: 20100, y: 976 }, { x: 26600, y: 586 },
    ],
  };
}