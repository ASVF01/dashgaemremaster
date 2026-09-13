# FNAF-Style Animatronic AI

Replace the test enemy with a classic FNAF movement AI: a hidden "AI level" per night, dice-rolled movement checks, and a fixed route toward your door.

## How it works

1. **AI level per night.** Each night the animatronic gets a level from 1–20. Night 1 starts easy (level 2); it climbs each night. On night 5 it gets the special rule you asked for: a 50/50 chance to move every 5 seconds (level 10 equivalent).
2. **Movement checks.** Every 5 seconds the game rolls a die (1–20). If the roll is at or under the AI level, it moves one step along its route:
   ```text
   CAM 1 → CAM 3 → CAM 5 → HALLWAY → DOOR/KEYHOLE → (attack)
   ```
3. **Camera static on move.** Whenever it moves while you're watching the cameras, the 0.3s static burst plays (and only then — watching an empty cam stays clean).
4. **At the door.** Same rules as now: its eye appears in the keyhole, the growl + keyhole sounds play, and you have 4.2 seconds to look away. Stare too long → the 1.05s jumpscare with the white/black after-burn.
5. **Giving up.** If you don't stare, it leaves after 15 seconds — all its sounds cut, then AnimMove1 or AnimMove4 plays — and it restarts its route after a short delay.
6. **Night counter.** The current night is saved between sessions. Reaching 6 AM advances you to the next night (harder AI). The debug [I] key stays for testing.

## Changes to existing behavior

- The randomized 14–26s idle spawn and shuffled cam order go away — movement is now fully driven by the dice-roll AI.
- Hallway-entry sound (NewAnimInHall) still plays only when you're not in the hallway.

## Technical notes

- Rewrite `src/game/mayhem/useTestEnemy.ts` into a `useAnimatronic` hook: a 5-second movement-check loop, `roll(1..20) <= aiLevel` gate, route index state, and the same scare/stare logic kept intact.
- Night number + AI level table in `src/game/progress.ts` (night 1: lvl 2, 2: 4, 3: 6, 4: 8, 5: 10 = the 50/50).
- `NightRooms.tsx` passes the night number in and shows "NIGHT N" on the R-held timer panel; on 6 AM it saves night+1.
- `CameraSystem.tsx` gets an `onEnemyMove` trigger that fires the existing static overlay.
