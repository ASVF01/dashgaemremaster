# Project Architecture Rules

- Active game sessions use a fixed edge-to-edge stage and a viewport-sized canvas; scale logical dimensions uniformly on small screens to preserve world proportions, while keeping menu presentation independent.
- Touch controls follow the primary coarse-pointer media query, not touch API presence or window width; ordinary gameplay camera keeps the visible world inside the level; when the view is taller than the level the camera window sits lowered (a tested fraction of the extra view hangs below the level) and ground platforms extend to the screen bottom, so fullscreen can never expose below-level void.

- Footstep artwork is captured at each step in world-space canvas runtime state and rendered behind the player; its lifetime is independent of player transforms so it never follows the sprite.
- Slide dust follows feet, then captures its anchor and clock for a detached fade.
- Bestiary uses a body portal to clear menu stacking; intrinsic dossier sizing contains notes.

- Character selection uses timed shutter phases with roster and INFO interactions gated until open; exit keeps the roster stationary, resets main-menu presentation while fully covered, and reveals it before unmounting. Presentation stays independent of saved character state.



- Playable character variants use `CharacterId` plus per-character sprite overrides; variants without gameplay branches inherit The Player mechanics to prevent physics drift.
- Character-wide action audio overrides are selected by a tested event allowlist in the shared SFX engine; leave menu, ambience, and boss sounds untouched to avoid replacing unrelated world audio.
- Continuous character friction audio is gated by tested ground, velocity and active-gameplay rules each frame and stopped on canvas cleanup, so jumps, pauses and scene changes cannot leave scraping audible.
- Distinct level environments use dedicated canvas scenery renderers while shared collisions stay data-driven in `level.ts`, keeping visuals isolated from physics.
- Boss cinematics live in boss runtime state and signal the page-level audio owner when combat begins, preventing visual and music timing drift.

- Subdirectories have their own `AGENTS.md`; read it before changing files there.
