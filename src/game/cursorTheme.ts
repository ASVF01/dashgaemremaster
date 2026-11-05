/**
 * TIC-80 cursor set by Dé (https://www.rw-designer.com/cursor-set/tic-80,
 * Creative Commons Noncommercial), decoded from the author's .cur files.
 *
 * Each pointer's hotspot came from the ICONDIRENTRY of the original .cur, so
 * clicks still land on the arrow tip / finger / I-beam centre. The images live
 * as CDN asset pointers; this module publishes them as CSS custom properties
 * that src/index.css consumes, keeping generated URLs out of the stylesheet.
 */
import arrowAsset from "@/assets/cursors/tic80-normal.png.asset.json";
import linkAsset from "@/assets/cursors/tic80-link.png.asset.json";
import textAsset from "@/assets/cursors/tic80-text.png.asset.json";
import blockedAsset from "@/assets/cursors/tic80-unavailable.png.asset.json";
import aimAsset from "@/assets/cursors/tic80-precision.png.asset.json";

type Pointer = { asset: { url: string }; x: number; y: number; fallback: string };

const POINTERS = {
  "--cursor-arrow": { asset: arrowAsset, x: 1, y: 1, fallback: "auto" },
  "--cursor-link": { asset: linkAsset, x: 6, y: 1, fallback: "pointer" },
  "--cursor-text": { asset: textAsset, x: 4, y: 7, fallback: "text" },
  "--cursor-blocked": { asset: blockedAsset, x: 6, y: 8, fallback: "not-allowed" },
  "--cursor-aim": { asset: aimAsset, x: 8, y: 6, fallback: "crosshair" },
} satisfies Record<string, Pointer>;

/** `url(...) x y, <native fallback>` — the fallback keeps the cursor working
 *  even if the CDN image fails to load. */
export function cursorValue(pointer: Pointer): string {
  return `url("${pointer.asset.url}") ${pointer.x} ${pointer.y}, ${pointer.fallback}`;
}

/** Call once before the first paint so no frame ever shows the OS cursor. */
export function applyTic80Cursors(root: HTMLElement = document.documentElement): void {
  for (const [name, pointer] of Object.entries(POINTERS) as [string, Pointer][]) {
    root.style.setProperty(name, cursorValue(pointer));
  }
}
