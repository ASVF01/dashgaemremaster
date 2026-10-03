# MAYHEM Night Systems

## Goal
Complete the non-enemy survival systems for the current MAYHEM night. Night 5 remains untouched until its separate art and rules are provided.

## What will be built

### Generator station
- Add an interactable generator station to the office.
- Opening it pauses room navigation while the generator panel is in use, but the night itself continues unless the main pause menu is open.
- The repair cycle has the three agreed stages in order:
  1. Simon Says sequence.
  2. Three-card memory match.
  3. 6×6 Flow Free board.
- Completing all three restores the generator and returns the player to the office.
- Puzzle progress stays intact if the player closes the panel and returns later.

### Storage door controls
- Add a dedicated storage-door view called `THE DOOR`.
- The storage wall control opens and closes the metal door.
- The player must turn toward the door view to operate it; room navigation and labels update accordingly.
- This only establishes the defensive control. No NEO-MATA behavior is added yet.

### Terminal errors
- Add a 5% ERR_273 occurrence and a rarer 2% ERR_104 occurrence when the terminal boots, with only one error selected per boot.
- ERR_273 replaces the old waiting concept with a playable 9×9 Flow Free repair. Completing every colored path fixes the terminal immediately.
- ERR_104 locks terminal functions behind the full supplied YouTube video (`FtEOS-IyY0`). Playback can be paused when the player lowers the terminal and resumed from the same point when reopened.
- Error progress survives closing and reopening the terminal during the same night.
- Normal camera reset screens remain available after an error is cleared.

### Night integration
- Keep the existing clock, camera system, health pack, audio controls, pause behavior, and room transitions working.
- Do not add THE GIFTED, ANYDROID-B, NEO-KID, NEO-MATA, or any new enemy logic.
- Leave Night 5’s environment and special scenario unchanged for the later asset pass.

## Technical details
- Keep shared night state in `NightRooms` so terminal and generator progress survive panel close/reopen.
- Build reusable grid-path puzzle logic for both the 6×6 generator board and 9×9 terminal repair.
- Use deterministic solvable puzzle layouts and pointer/touch input, with clear completed-path feedback.
- Extend the existing MAYHEM visual language and semantic color tokens rather than introducing a separate style.
- Verify keyboard room navigation, panel close/reopen persistence, every puzzle completion path, terminal recovery, pause behavior, and the clean build.
