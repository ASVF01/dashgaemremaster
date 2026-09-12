# Replace MAYHEM rain lines with particles

## Rain effect
- Remove the repeating diagonal-line rain overlay from the MAYHEM teaser.
- Render a lightweight field of individual rain particles with varied positions, lengths, opacity, speed, and start delay.
- Animate each droplet from above the panel to below it, then recycle it seamlessly so the rain never visibly jumps or pauses.
- Keep the droplets clipped to the teaser, layered above the drawing but below both red captions, and unable to intercept mouse movement.
- Keep the existing rain sound and mouse-driven image movement unchanged.
- Stop particle motion when reduced-motion mode is enabled.

## Verification
- Confirm the rain consists of separate droplets rather than a repeating stripe texture.
- Watch multiple cycles to ensure droplets loop continuously without a synchronized reset.
- Confirm image movement, captions, tab navigation, and rain audio still work.
