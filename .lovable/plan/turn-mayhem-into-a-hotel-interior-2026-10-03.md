# Turn MAYHEM into a hotel interior

## What will change
- Replace the MAIN FLOOR industrial backdrop with a proper hotel reception: paneled walls, patterned carpet, front desk, key cubbies, lamps, seating, luggage, signage, and an elevator entrance.
- Replace FLOOR ONE's generic industrial scenery with a long hotel corridor: repeating guest-room doors, wall lights, carpet, framed art, service areas, and architectural transitions that still support the existing platforming route.
- Use the supplied `The_Receptionist.png` as the reception NPC artwork while preserving the current conversation, ticket handoff, and interaction range.

## What stays the same
- Keep all MAYHEM progression, collisions, goals, controls, dialogue, and night-mode logic unchanged.
- Keep THE OUTSIDE and the FNAF night rooms unchanged.

## Technical details
- Add the receptionist image through the project asset pipeline and render it only for the existing receptionist NPC.
- Split MAYHEM scenery by level so MAIN FLOOR and FLOOR ONE receive dedicated hotel renderers rather than the shared industrial backdrop.
- Preserve the collision geometry in `level.ts`; visual hotel fixtures will align with existing walkable blocks.
- Verify the lobby, Floor 1, receptionist interaction, and level transition in the live preview at desktop and mobile widths.
