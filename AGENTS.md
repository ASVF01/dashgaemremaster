# Project Architecture Rules

- Playable character variants use `CharacterId` plus per-character sprite overrides; variants without gameplay branches inherit The Player mechanics to prevent physics drift.
- Distinct level environments use dedicated canvas scenery renderers while shared collisions stay data-driven in `level.ts`, keeping visuals isolated from physics.