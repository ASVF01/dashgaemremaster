# Horror tower and keyhole-survival mode

Build the horror mode as two connected experiences: climbing the supplied tower layout, then surviving office rounds through its doors. The four enemy identities and artwork remain replaceable placeholders until their designs are supplied.

## Tower structure

- Add a distinct horror-mode entry to the PLAY section, visually separated from the normal level buttons.
- Recreate the supplied vertical layout: main floor with elevator, floors 1–5 above it, danger floors on 3–5, and the top window as the eventual exit.
- Use normal platforming controls to explore the black, hand-drawn metal facility, with a vertical camera, wall panels, platforms, heavy doors, flickering ceiling lights, and restrained industrial ambience.
- Each relevant door transitions through a short blackout into the office-survival view; returning from a completed round restores the player to the correct tower floor.

## Office-survival view

- Present the room in the four-part visual language of the reference comic: desk/CCTV station, hallway door with keyhole, health/maintenance display, and threat close-ups.
- The player survives a six-minute night using the desk camera system to anticipate arrivals and the keyhole to identify the enemy outside.
- Keyhole viewing is a deliberate hold interaction, with a clear exit action so the player can immediately look away.
- Keep the hand-drawn style, but switch to cold industrial greys, dirty monitor greens, warning red, and near-black shadows.

## Four-enemy rule set

- Start with four visually distinct placeholder enemies: two normal-eye threats and two red-eye threats. Their names and final appearances stay data-driven for easy replacement.
- **Normal-eye enemy:** no red flash appears. The player must continuously stare through the keyhole for 4.2 seconds; completing the stare drives it away.
- Looking away before 4.2 seconds breaks the continuous stare and requires the player to start that counter again.
- **Red-eye enemy:** its eye flashes red for 0.3 seconds when first seen. The player must look away before the 3.1-second “glory time” expires.
- A red-eye enemy naturally leaves after 10.23 seconds if the player waits without checking again.
- Looking through the keyhole again resets both its 3.1-second glory-time window and its 10.23-second departure timer, so repeated peeking keeps the threat present.
- If glory time expires while the player is still looking, play that enemy’s 1.52-second jumpscare and deal 40 damage. The round continues if health remains.
- Show timing through animation, sound, and screen behavior rather than exposing countdown numbers, except where later accessibility settings may require them.

## Health, maintenance, and SHE

- Give the office player persistent health for the current night; reaching zero triggers the death sequence.
- Reserve the storage-room/terminal interaction for healing and camera maintenance as depicted in the reference. Its exact repair puzzle and healing amount remain a marked placeholder until those rules are supplied.
- Reserve SHE as a separate instant-kill encounter, visually foreshadowed but not implemented as one of the four standard enemies until her behavior is fully specified.
- Ensure ordinary jumpscares and SHE are clearly different: standard red-eye mistakes deal 40 damage; SHE ends the run immediately.

## Audio and feedback

- Add positional hallway cues, keyhole handling, the 0.3-second red-eye warning, growls, departure cues, monitor noise, electrical buzz, metal footsteps, and distinct 1.52-second jumpscares.
- Prevent tower, office, jumpscare, and menu music from overlapping.
- Add every new sound used by the mode to the Extras sound gallery.
- Include reduced-flash handling so the red-eye cue remains readable without relying on intense flashing alone.

## States and progression

- Track tower floor, office-night phase, player health, active enemy, stare progress, glory time, enemy departure time, camera condition, and completed doors in one mode-level state flow.
- Pause all survival timers during transitions, menus, and loss screens; resume only when the office is active.
- On death, finish the current jumpscare before showing retry/return choices.
- Save completed tower floors and unlocked progression with the game’s existing local progress system.

## Technical details

- Build a dedicated horror-mode component and separate tower geometry/enemy-definition modules, reusing existing movement constants, character sprites, sketch drawing helpers, sound controls, and touch controls where appropriate.
- Implement the office as a state-driven interactive scene rather than a static image, with pointer/touch and keyboard parity.
- Keep enemy configuration data-driven (`eyeType`, warning duration, stare duration, departure duration, damage, jumpscare duration) so names, art, and later unique behaviors can be added without rewriting the core encounter logic.
- Verify desktop and mobile landscape layouts, keyhole hold/release behavior, all exact timers, health deductions, no audio overlap, death sequencing, and tower-to-office return state.

## Deferred decisions

- Final mode name and menu-card artwork.
- Names and finished designs for all four enemies.
- Which enemies appear on which floors and how difficulty scales.
- Exact storage-room healing and camera-repair rules.
- SHE’s warnings, encounter logic, and counterplay.
- Final top-window escape/win sequence.
