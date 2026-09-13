# Add MAYHEM HP and watch clock

## What will change
- Add a MAYHEM-only HP display in the top-right during the night section, starting at full health.
- Clean the uploaded watch sprite by removing its green background and use the transparent result in-game.
- Hold **R** to raise the watch; releasing **R** hides it.
- Advance the watch from **12 AM** to **6 AM** across exactly six real-time minutes, showing each hour for one minute.
- Keep the HP and watch above room, terminal, and camera visuals where appropriate without interfering with controls.

## Technical details
- Add the cleaned watch as a project asset.
- Keep the six-minute night clock and R-key state in the night-room session so they reset when a new night starts.
- Use a compact horror-style HP readout and place the current hour over the watch face.
- Verify the night view, keyboard interaction, and current build after implementation.
