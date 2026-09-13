# Add the MAYHEM camera system

## What will change
- Add the five supplied camera scenes to MAYHEM’s night mode.
- Let the player open cameras by pressing `W` in the office or clicking the office camera hotspot.
- Show the selected camera full-screen with the existing dark/static atmosphere and mouse-look movement.
- Place a compact control unit at the bottom-left, tilted slightly right.
- Make camera buttons `1–5` clickable and support keyboard number selection.
- Keep each highlighted number precisely aligned to the control artwork instead of stretching hotspot positions.
- Close the camera view with `S`, `W`, or a dedicated close control, returning to the office.
- Add fitting procedural camera-open, camera-switch, and camera-close sounds without using uploaded audio.

## Technical details
- Store the uploaded camera images as project assets.
- Build a focused `CameraSystem` component and integrate it into `NightRooms` without changing terminal behavior.
- Use the supplied control panel as the visual base and draw the selected camera number/button state at fixed proportional coordinates; this also covers camera 2 even though a separate `CTRL_PANEL_2` image was not supplied.
- Block room navigation while cameras are open and preserve the terminal’s existing storage-only controls.
- Verify opening, switching all five views, clicking controls, keyboard controls, and returning to the office.
