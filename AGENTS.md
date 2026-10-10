# Project Architecture Rules

- Receptionist merchant dialogue cues use an isolated overlay that owns shop audio; session upgrades are passed from the page into NightRooms and pure merchant rules, keeping effects testable and enemy activation deferred.
- DialogueBox reports its active line to external character artwork; merchant expression assignments live alongside its script so artwork changes stay synchronized without duplicating dialogue progression.
- Generator control hover cues are delegated from its puzzle container and use the shared night SFX bus with cached crushed samples; this covers every puzzle without changing terminal Flow audio.

- Generator-only music uses an isolated audio lifecycle with a pure progress-to-track/rate rule and displayed progress as its clock; start both loops on one audio-clock boundary with matching rate and loop length, switch their gains rather than restart, and derive button beats from that audio clock. Duck the night soundtrack while audible and release all sources on dismissal so timing, pause, and room audio stay independent.

- Playable character variants use `CharacterId` plus per-character sprite overrides; variants without gameplay branches inherit The Player mechanics to prevent physics drift.
- Character-wide action audio overrides are selected by a tested event allowlist in the shared SFX engine; leave menu, ambience, and boss sounds untouched to avoid replacing unrelated world audio.
- Distinct level environments use dedicated canvas scenery renderers while shared collisions stay data-driven in `level.ts`, keeping visuals isolated from physics.
- Boss cinematics live in boss runtime state and signal the page-level audio owner when combat begins, preventing visual and music timing drift.
- MAYHEM night-clear cinematics own their media lifecycle and derive picture beats and the shared sound/picture fade from the completion audio clock; separate descent and pulse transform layers preserve both motions, while the page prepares the next available floor and keeps gameplay frozen until reveal finishes.
- Generator progress gains use a pure helper fed by the active night captured in NightRooms, keeping all puzzle types consistent and the completion cap testable.
- Generator double-charge rewards use a pure helper with an explicit random roll and persist the bonus flag in owned progress; award feedback reads that flag and routes the boss parry sample through the night bus so muted platformer audio cannot suppress it.
- Generator completion feedback animates displayed progress independently from owned progress, starting layered impact audio with the reward and count audio on the rise clock; final night completion waits for the rise.
- NightRooms drives generator and flip-tab look offsets from the existing smoothed gaze through separate transform layers, preserving independent flip and reward animations.
- MAYHEM room looking is a flat 2D pan (scale + translate only); no perspective, rotation, or displacement distortion — the user rejected the FNAF-style curved effect.
- MAYHEM NPC reactions are triggered by page-level dialogue completion and animated in canvas runtime state, keeping story timing aligned with world visuals.
- MAYHEM night puzzle and terminal-error progress is owned by `NightRooms` and passed into overlays, so lowering a panel never resets an active repair.- MAYHEM night threats live on the 12×12 grid in `useGridRoster` (roster config + per-night move chance), owned by `NightRooms` so movement continues while the map is closed.
