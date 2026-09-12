# Replace HELL teaser with MAYHEM artwork

## Teaser artwork
- Upload the supplied `COMING_SOON!.png` through the project asset system and use it as the full 976×440 teaser image.
- Remove the current generated office, tower, title, status footer, and locked-entry artwork from this preview.
- Display the drawing slightly enlarged and cropped inside the panel.
- Add restrained mouse-driven parallax so the enlarged image shifts toward the pointer while always covering the panel; return it smoothly toward center when the pointer leaves.
- Keep the behavior touch-safe and disable movement when reduced motion is preferred.

## Text and atmosphere
- Overlay red text inside the panel so it remains readable even when the matching words in the drawing are cropped:
  - Top left: `WHERE THERE IS LIGHT THERE IS DARKNESS`
  - Bottom right: `NEW MODE COMING SOON`
- Add animated rain streaks over the artwork without blocking pointer movement or obscuring the text.
- Start the existing looping rain sound when MAYHEM is opened and stop it when leaving the tab or closing the menu, preventing duplicate loops.

## Menu tab
- Rename the visible `HELL` tab to `MAYHEM` while keeping it a visual-only, non-playable preview.
- Retain its distinct dark metal/red warning styling.

## Verification
- Confirm mouse movement pans the zoomed image without exposing empty edges.
- Confirm both red captions stay inside the panel at desktop and mobile-landscape sizes.
- Confirm rain visuals and audio start only on MAYHEM and stop after switching tabs.
- Confirm the preview remains non-functional and other menu tabs still work.
