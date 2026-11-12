# Workshop Message Reactions Slice 3b: the reaction corner

Before/after captures of the reaction corner (ADR 2026-11-07 D8, Slice 3b
addendum), from the built webview bundle rendered in Chromium as the
Workshop surface, with one replayed session snapshot (made-up *Alice*
text): the writer's message carries Jill's heart; Jill's reply carries
three reactions (the writer's fire, Margot's eyes, Tobin's thinking).

| File | What it shows |
|---|---|
| `before-thread-900.png` | Base `3b8b0902`: chips under the text, a Hide link on each persona chip, "Add reaction" as a text button in the action row |
| `after-thread-900.png` | This slice: one cluster in each bubble's bottom-right corner, left to right, the writer's first; the icon "Add reaction" button after it on Jill's reply; none on the writer's message |
| `before-thread-narrow.png`, `after-thread-narrow.png` | The same with the bubbles held to 300 px. The Workshop tab itself does not reflow below ~900 px (pre-existing), so a phone-ish bubble is simulated by width; the corner stays inside the bubble and below its text |
| `after-palette-open.png` | The palette opened from Jill's corner, upward, right-aligned to the button |
| `after-palette-flip.png` | Jill's corner scrolled to the thread's top: the palette opens downward (`data-placement="down"`) |

The Workshop has one palette (the warm dark full-tab tokens in
`styles/fulltab/tokens.css`); there is no light theme to capture.

The harness caught one real bug on the way: the palette focused its first
option before its placement rendered, so the browser scrolled the thread
toward a palette still drawn on the side with no room. The palette now
draws hidden until measured and focuses only once placed
(`WorkshopApp.reactions.test.tsx` records the placement at focus).

## Reproduce

```bash
npm ci && npm run build   # apps/vscode-extension/dist/webview.js
node docs/pr-reviews/evidence/workshop-reactions-slice-3b-visual/harness.js \
  apps/vscode-extension/dist/webview.js /tmp/out after-
```

For the before captures, build `3b8b0902` in a worktree and pass its bundle
with the prefix `before-` (the harness skips the palette captures when the
bundle has no corner button).
