# Grass movement audio for THE CHASE

## What will change
- Add a grass surface sound mode used only by THE CHASE.
- Replace walking and running steps with short leafy crunches, with faster runs sounding heavier.
- Give jumps and landings a soft turf push/crunch.
- Give skids and slides sustained grass-and-dirt scraping, including speed-based intensity.
- Reset the sound mode when leaving or restarting the level so every other stage keeps its current audio.

## Technical details
- Extend the existing procedural movement-audio modes rather than adding downloaded recordings.
- Select the grass mode from the active level in the game canvas.
- Update the looping slide filters and texture for grass while preserving INVBOI and MAYHEM audio priority.
- Verify THE CHASE movement in the live preview and confirm another level retains its normal movement sounds.
