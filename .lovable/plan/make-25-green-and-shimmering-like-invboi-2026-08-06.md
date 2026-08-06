# Make "$25" green and shimmering like invboi

## Goal
In the **v1.4 MASSIVE update** entry, the "\$25" text should be styled green with a shimmer effect similar to the existing invboi/rainbow shimmer.

## Current state
- The update log entry is in `src/game/MainMenu.tsx` at line 1247: `"[this took me $25 to get finished with... 〒▽〒]"`.
- The update list currently renders each change as plain text inside a `<li>`.
- The invboi shimmer uses a moving gradient background-clip (`rainbow-text` in `src/index.css`).

## Plan
1. **Add a green shimmer CSS class** in `src/index.css` (e.g., `.green-shimmer`) that uses a shifting green gradient background-clip, mirroring the `rainbow-text` animation but with a green/cyan palette.
2. **Wrap the "$25" substring** in the v1.4 update entry with a `<span className="green-shimmer">$25</span>` so only those characters shimmer.
3. **Adjust the update list renderer** in `src/game/MainMenu.tsx` so the `changes` array can contain `ReactNode` elements (or JSX) in addition to strings; the current `u.changes.map((c) => <li>{c}</li>)` already supports JSX, but the `UpdateEntry` type may need its `changes` type relaxed to `ReactNode[]` or `(string | ReactNode)[]`.
4. **Verify** in the preview that the "$25" text stands out as green and shimmers, and the rest of the update log remains unchanged.
