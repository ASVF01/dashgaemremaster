# Roadmap

- [ ] Refine dust to the Stylish Sprint reference: immediate contact, one-shot frame progression, backward expansion and smooth fade; verify running and jumping.

- [x] Lower the camera window on tall views: less empty sky, ground rendering fills below the level, never exposing below-level void; verify in the tutorial.
- [x] Animate footstep dust with the supplied dust_kick frames and replace the jump puff with dust_jump; store uploads as assets.

- [x] Restore the pre-zoom camera framing with only a slight zoom in (flat 1.07 on ordinary levels, MAYHEM unchanged) while keeping the floor pinned to the bottom edge; verified with viewport-rule tests and a tutorial run.

- [x] Hide desktop touch controls, use ESC to leave levels, and tighten the player camera without changing movement physics; verified desktop ESC, mobile controls, floor framing, and three viewport-rule tests.

- [x] Make platformer gameplay edge-to-edge and hide the page header during runs; verified movement, exact viewport coverage at desktop/landscape sizes, and return to menu without runtime errors.

- [x] Remove run lines, reduce afterimages, and add the supplied transparent dust at world-space footstep positions; verified running in the tutorial with detached ground dust and no errors.

- [x] Clean up character-select exit: close over the unchanged roster, reset the menu while covered, and reopen onto it; verified the full exit and selection/sound tests.

- [x] Fix the character-select jagged borders to repeat seamlessly without jumping at the loop boundary.

- [x] Move green (Green Machine) to the joke-characters page; canonical page shows 4 characters plus one "?" slot.

- [x] Swap M&M's Guy's character-select icon to the newly supplied drawing (in-game sprite unchanged).
- [x] Character select background: now a grid that drifts upward (canvas; vertical columns static, horizontal rows scroll up, seamless one-cell loop). Lines are solid black and thick (3px minor, 6px every 4th); the drifting diagonal stripes are black too (8px, one 160px period per loop).
- [x] Rework character select to the supplied sketch, remove previews, add moving borders and entry/exit transitions; verify selection, paging and INFO.
- [x] Swap in supplied INFO.png banner art and Leave.png / Leave_hover.png arrow art (white keyed out of the arrows), and enlarge the leave button.

- [x] Character select: page 1 real characters, page 2 joke characters (Sir Wobble removed).

- [x] Add 25% double-charge rewards with stronger impact, boss parry audio, and the supplied fading picture; verify chance, gains, and completion cap.
- [x] Add the "I'm not gonna sugarcoat it" callout to doubled generator charges alongside the boss parry cue.

- [x] Add the supplied lower-pitched, bitcrushed generator hover sound and new Receptionist greeting/question poses.
- [x] Apply the supplied paper-giving pose when the Receptionist offers the tutorial paper.

- [x] Add Floor 2 Receptionist dialogue, tutorial comic, bag sound, shop music, free first upgrade and generator upgrades.
- [ ] Place the merchant on Floors 3–4 when those floors are supplied; replacement enemy sprites await the user's art. Existing enemies remain disabled.

- [x] Add supplied crushed generator loops, fade on opening/closing, accelerate to original speed at 50%, switch to Fury, and verify audio lifecycle.

- [x] Match the reference generator snap, add subtle looking movement to panel and flip tab, remove the table square, and layer the three supplied impact sounds.

- [x] Add office generator with Simon, three-pair memory, and 6×6 Flow Free stages.
- [x] Add dedicated storage door room and control.
- [x] Add persistent ERR_273 and ERR_104 terminal recovery flows.
- [x] Verify pause behavior, puzzle completion, terminal recovery, and build.
- [x] Replace generator completion with randomized 15%-per-puzzle rounds and a progress bar.
- [x] Randomize the generator and ERR_273 Flow Free solutions.
- [x] Verify randomized generator rounds and both Flow Free boards.
- [x] Add rain, wind, grass movement, and normal dash audio to the hotel exterior.
- [x] Add the supplied night-clear picture and sound with frozen gameplay and a synchronized fade into Floor 2; keep the completion screen after Night 2 because Floor 3 is not supplied.
- [x] Verify timing tests and the live floor transition; verify uploaded media using browser interception because local CDN requests return HTML.
- [x] Shop portrait: use the counter from the user's own doodle (not the flat drawn bar) - key the doodle, clear trapped white gaps, re-upload pointer.

- [x] Apply the supplied Receptionist shop-UI expression as the shop portrait (counter kept as drawn, white keyed out).
- [x] Shop stall portrait: keep the corner-table doodle on white (the blue-box drawing stays only in the post-bag dialogue).

- [x] Post-bag dialogue: use the newly supplied Receptionist expression (Recep_Shop_UI_Dialouge_2.png, white keyed out); shop stall keeps the counter doodle.
- [x] Make M&M's Guy playable with the supplied icon/sprite, ground-only stone scraping, voice on jumps/dashes/dive impacts and powered invboi audio.
- [x] Character icons: drop the diagonal stripe and the diagonal cut so each sprite shows exactly as supplied (only the red X and yellow lock remain).

