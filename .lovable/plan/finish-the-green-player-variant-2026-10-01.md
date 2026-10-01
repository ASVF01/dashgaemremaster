# Finish the Green Player Variant

Add an always-unlocked sub-character of The Player with a distinct green look while preserving the original Player’s movement, health, and abilities.

## What will change

- Add a new selectable character named **GREEN MACHINE** to the character selection screen.
- Create green-tinted versions of The Player’s portrait, preview, and complete gameplay sprite set while preserving transparency and hand-drawn details.
- Register the new character in saved selection state and sprite loading so every normal Player animation uses the green artwork.
- Give the selection entry its own short description, lore, and ability labels, while clearly keeping the same core moveset.
- Keep the character unlocked by default and leave character-specific SFX for a later update.
- Reflow the character grid so the fifth entry remains readable on desktop and mobile.

## Technical details

- Extend the playable character ID/state safely so existing saved games gain the new unlocked entry automatically.
- Generate recolored PNG assets locally from the existing Player art and sprites; no gameplay logic branches are added because the variant shares Player mechanics.
- Update the character selection data and card layout only where needed.
- Verify selection, rendered sprite changes, desktop/mobile layout, and the project build.
