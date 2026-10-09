import { generatorGain } from "./generatorGain";

export type PuzzleKind = "simon" | "memory" | "flow";
export type UpgradeId = "pipes" | "brain" | "listen" | "grace" | "jumpstart" | "fiends" | "faces";
export type NightUpgrades = { puzzle?: PuzzleKind; grace?: boolean; jumpstart?: boolean; fiends?: boolean };
export const MERCHANT_UPGRADES: { id: UpgradeId; name: string; price: number; description: string; unavailable?: boolean }[] = [
  { id: "pipes", name: "nothing but pipes", price: 250, description: "Flow puzzles only." },
  { id: "brain", name: "brain test", price: 250, description: "Memory puzzles only." },
  { id: "listen", name: "better listen..", price: 250, description: "Simon puzzles only." },
  { id: "grace", name: "saving grace", price: 600, description: "First 5 puzzles restore 10% each." },
  { id: "jumpstart", name: "jumpstart", price: 900, description: "Start with 45% power." },
  { id: "fiends", name: "BACK YOU FIENDS!", price: 500, description: "Enemies move 25% less often this night." },
  { id: "faces", name: "oh, so thats what they look like..", price: 350, description: "Actual counterpart sprites.", unavailable: true },
];
export function upgradeCost(id: UpgradeId, freeUsed: boolean) {
  return freeUsed ? MERCHANT_UPGRADES.find((item) => item.id === id)?.price ?? Infinity : 0;
}
export function applyUpgrade(upgrades: NightUpgrades, id: UpgradeId): NightUpgrades {
  if (id === "pipes") return { ...upgrades, puzzle: "flow" };
  if (id === "brain") return { ...upgrades, puzzle: "memory" };
  if (id === "listen") return { ...upgrades, puzzle: "simon" };
  if (id === "faces") return upgrades;
  return { ...upgrades, [id]: true };
}
export function upgradedProgress(percent: number, night: number, round: number, upgrades: NightUpgrades) {
  return Math.min(100, percent + (upgrades.grace && round <= 5 ? 10 : generatorGain(night)));
}
export function startingPower(upgrades: NightUpgrades) { return upgrades.jumpstart ? 45 : 0; }
export function enemyMoveMultiplier(upgrades: NightUpgrades) { return upgrades.fiends ? 0.75 : 1; }