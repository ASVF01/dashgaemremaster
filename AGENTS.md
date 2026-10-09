# Project Architecture Rules

- Playable character variants use `CharacterId` plus per-character sprite overrides; variants without gameplay branches inherit The Player mechanics to prevent physics drift.
- Distinct level environments use dedicated canvas scenery renderers while shared collisions stay data-driven in `level.ts`, keeping visuals isolated from physics.
- Boss cinematics live in boss runtime state and signal the page-level audio owner when combat begins, preventing visual and music timing drift.
- MAYHEM night-clear cinematics own their media lifecycle and use one playback envelope for sound and picture; the page prepares the next available floor beneath the fade and keeps gameplay frozen until reveal finishes.
- Generator progress gains use a pure helper fed by the active night captured in NightRooms, keeping all puzzle types consistent and the completion cap testable.
- MAYHEM NPC reactions are triggered by page-level dialogue completion and animated in canvas runtime state, keeping story timing aligned with world visuals.
- MAYHEM night puzzle and terminal-error progress is owned by `NightRooms` and passed into overlays, so lowering a panel never resets an active repair.- MAYHEM night threats live on the 12×12 grid in `useGridRoster` (roster config + per-night move chance), owned by `NightRooms` so movement continues while the map is closed.
