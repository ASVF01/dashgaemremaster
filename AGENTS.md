# Project Architecture Rules

- Playable character variants use `CharacterId` plus per-character sprite overrides; variants without gameplay branches inherit The Player mechanics to prevent physics drift.
- Distinct level environments use dedicated canvas scenery renderers while shared collisions stay data-driven in `level.ts`, keeping visuals isolated from physics.
- Boss cinematics live in boss runtime state and signal the page-level audio owner when combat begins, preventing visual and music timing drift.
- MAYHEM NPC reactions are triggered by page-level dialogue completion and animated in canvas runtime state, keeping story timing aligned with world visuals.