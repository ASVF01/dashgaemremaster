#!/usr/bin/env python3
"""
Sprite QA: verify that on the player "hurt" sprite, near-white pixels exist
ONLY inside the head region (the round outline at the top of the figure).
Any near-white pixel found outside that region is a bug — leftover from the
white-background removal pass — and the script exits non-zero.

Usage:
    python3 scripts/verify_hurt_sprite.py [path/to/hurt.png]

What it checks:
  1. The sprite has at least N near-white pixels (head was actually filled).
  2. All near-white pixels are clustered into a single connected region.
  3. That region is positioned in the top portion of the sprite (the head),
     not down on the body/legs/arms.
  4. No stray near-white pixels exist outside that head cluster.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("Pillow is required: python3 -m pip install --no-cache-dir pillow\n")
    sys.exit(2)


# A pixel counts as "near-white" if it has alpha and all RGB channels are
# at least this bright. Loose enough to catch slight off-white leftovers.
NEAR_WHITE_MIN = 230
# A head-fill region must have at least this many pixels (sanity check that
# the head actually got filled and isn't just a stray speck).
MIN_HEAD_PIXELS = 40
# The head must sit in the upper part of the sprite. We require the region's
# vertical centroid to land inside the top 60% of the canvas.
HEAD_TOP_FRACTION = 0.60


def is_near_white(rgba: tuple[int, int, int, int]) -> bool:
    r, g, b, a = rgba
    return a > 0 and r >= NEAR_WHITE_MIN and g >= NEAR_WHITE_MIN and b >= NEAR_WHITE_MIN


def find_components(white_pixels: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    """4-connected flood fill to group near-white pixels into clusters."""
    components: list[set[tuple[int, int]]] = []
    unvisited = set(white_pixels)
    while unvisited:
        seed = next(iter(unvisited))
        comp: set[tuple[int, int]] = set()
        q: deque[tuple[int, int]] = deque([seed])
        while q:
            p = q.popleft()
            if p in comp or p not in unvisited:
                continue
            comp.add(p)
            unvisited.remove(p)
            x, y = p
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if (nx, ny) in unvisited:
                    q.append((nx, ny))
        components.append(comp)
    return components


def verify(path: Path) -> int:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size

    white_pixels: set[tuple[int, int]] = set()
    for y in range(h):
        for x in range(w):
            if is_near_white(px[x, y]):
                white_pixels.add((x, y))

    print(f"[verify] {path}: {w}x{h}, near-white pixels: {len(white_pixels)}")

    if len(white_pixels) < MIN_HEAD_PIXELS:
        print(
            f"[FAIL] only {len(white_pixels)} near-white pixels found — "
            f"head fill seems missing (need >= {MIN_HEAD_PIXELS}).",
        )
        return 1

    components = find_components(white_pixels)
    components.sort(key=len, reverse=True)
    head = components[0]
    strays = [c for c in components[1:] if c]

    # Centroid of the largest cluster.
    cy_avg = sum(y for _, y in head) / len(head)
    cy_frac = cy_avg / h
    print(
        f"[verify] head cluster: {len(head)} px, "
        f"centroid_y={cy_avg:.1f} ({cy_frac:.2f} of height)"
    )

    if cy_frac > HEAD_TOP_FRACTION:
        print(
            f"[FAIL] largest white cluster sits below the top {HEAD_TOP_FRACTION:.0%} "
            f"of the sprite — that's not the head."
        )
        return 1

    if strays:
        total_strays = sum(len(c) for c in strays)
        # Show up to 10 stray pixel samples to make debugging easy.
        sample = []
        for c in strays:
            for p in c:
                sample.append(p)
                if len(sample) >= 10:
                    break
            if len(sample) >= 10:
                break
        print(
            f"[FAIL] {len(strays)} stray near-white cluster(s) outside the head "
            f"({total_strays} px total). Sample coords: {sample}"
        )
        return 1

    print("[OK] head is filled white; no stray near-white pixels elsewhere.")
    return 0


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else "src/assets/sprites/hurt.png"
    path = Path(arg)
    if not path.exists():
        print(f"[FAIL] sprite not found: {path}")
        return 2
    return verify(path)


if __name__ == "__main__":
    sys.exit(main())
