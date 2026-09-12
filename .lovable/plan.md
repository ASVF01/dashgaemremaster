# HELL (working title: HER MAYHEM) — horror tower mode

A new mode reached from the PLAY section: a 5-floor metal facility tower you climb with
the normal platformer controls. Each floor has a door that leads into a
Five-Nights-style survival room (Tealerland-flavoured). Since the door/room rules are
still coming, this plan builds the tower and the shell around it, with the door rooms
stubbed as a clearly-marked placeholder screen.

## Entry point

- In the PLAY section, add a separate mode card for the tower (labelled "HELL" for now,
  easy to rename to "HER MAYHEM" later).
- The card is styled differently from the level buttons: dark blue panel with soft
  falling rain particles drifting over it, faint flicker on the label.

## The tower (platformer)

- Pure black background — no paper grain, no dotted pattern.
- Facility construction: metal wall panels with rivets and seams, metal floor plates,
  and heavy metal doors. All hand-drawn in the existing sketch style but in cold greys
  on black instead of ink-on-paper.
- Vertical layout: 5 floors stacked, each floor a small room-and-corridor arrangement
  with platforms and a stairwell/ladder gap up to the next. Camera follows vertically.
- Dim ceiling lights cast small pools of light and flicker at random intervals.
- Each floor holds one metal door. Walking into it and pressing the interact key opens
  the floor's room.
- No timer, no score for now — this is a place, not a race.

## Sound

- Metal footsteps that change with speed.
- Continuous electrical buzz from the lights, with a louder crackle on each flicker.
- Low room tone drone underneath. All generated in the existing sound code until you
  send audio files.

## Door rooms (stubbed this pass)

Entering a door fades to black and shows a placeholder panel: floor number and
"ROOM SEALED — coming soon", with a way back to the tower. Once you explain the
FNAF-style rules (cameras, doors, power, what's hunting you), that panel gets replaced
with the real room.

## What I need from you

- The construction-paper art for walls/floors/doors (or I generate stand-in textures
  and swap them when yours arrive).
- The door-room rules: what you watch, what you close, what kills you, how a night ends.

## Technical notes

- New `MenuTab`-independent mode component `src/game/HellTower.tsx`, mounted from the
  PLAY tab, holding its own canvas loop and phase state (`tower` | `room` | `dead`).
- Level geometry in a new `src/game/hell/towerLevel.ts` producing the existing
  `Platform`/`Hazard` shapes so player physics from `GameCanvas` logic can be reused.
- Reuse `constants.ts` movement values and the current sprite set; rendering swaps to a
  dark palette drawn with the `sketchRect`/`sketchLine` helpers.
- Rain particles on the menu card are CSS-only; light flicker and buzz driven by the
  canvas loop and `sfx.ts`.
- New sounds added to `sfx.ts` and listed in the Extras SFX gallery, per the standing rule.
