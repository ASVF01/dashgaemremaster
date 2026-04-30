# Roaring Knight slash — long beam rework

Match the reference: a faint thin **red line** that streaks from the boss across the screen, passing through where the player is, then a slightly thicker **white line** in the same place that quickly thins out.

## Changes

**`src/game/GameCanvas.tsx` — `spawnBossSlash`**
- Replace the short diagonal-near-player slash with a beam that:
  - Starts at the boss's world position (camera anchor + screen offset).
  - Aims at the player's center (with tiny jitter so it's not laser-perfect).
  - Extends ~1600px past the player so it visually crosses the entire arena.
- Telegraph (red warning) duration stays at 0.5s; slash hitbox stays at 0.2s.

**`src/game/GameCanvas.tsx` — `drawBossWorldFx` (visual tuning to match GIF)**
- Red warning line:
  - Thinner: ~1.5px (was 2-4px), no glow / minimal shadow.
  - Steady alpha (~0.85) instead of pulsing/thickening — the reference is just a clean thin red line.
- White slash:
  - Starts at ~3px thickness (was 9px) and thins toward 0 over the 0.2s.
  - Soft white glow only at the very start, fades fast.
  - Keep the bright thin core for the "just got cut" snap.

## Result

The slash now reads as a beam-cut from the knight through the player's position, exactly like the Deltarune reference: thin red telegraph → white shing → quick thin-out. Parry / dodge mechanics stay identical.
