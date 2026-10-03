# Roaring Knight cinematic entrance

## Build
- Remove the Knight's screen-bound positioning and place him at a fixed point inside the arena.
- Hold player controls and boss attacks while the entrance plays.
- Start with the camera on the player, then pan across the arena to the Knight.
- Play the sliced roar animation with the supplied roar sound and sustained screen shake.
- Follow with the sword-appear strip, then the full sword-equip strip.
- Return the camera to the semi-static arena framing, unlock combat, and start the boss music only after the equip animation ends.
- Keep the existing fight mechanics intact after the entrance.

## Technical details
- Add a timed intro phase to the existing boss runtime state and render frames directly from the sliced horizontal sprite strips.
- Route the uploaded roar through the existing game SFX volume controls.
- Delay the Roaring Knight track at the page-level music owner, then trigger it from the game when the intro completes.
- Verify the complete sequence, sound trigger, camera behavior, combat lock, and normal post-intro fight in the live preview.
