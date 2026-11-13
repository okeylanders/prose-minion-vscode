# Workshop Message Reactions Slice 3c: the writer's tapback

Before/after captures of personas' reactions on the writer's own message
(ADR 2026-11-07 D8, Slice 3c note), from the built webview bundle rendered
in Chromium as the Workshop surface at `deviceScaleFactor: 2`, with one
replayed session snapshot (made-up *Alice* text):

- `turn-1` (writer): Jill's heart.
- `turn-2` (Jill): the writer's fire, Margot's eyes, Theo's thinking. A
  persona bubble, which keeps 3b's in-bubble corner.
- `turn-3` (writer, a short message): Jill's, Margot's and Theo's reactions.
- `turn-4` (writer): no reactions.

Before is the base `16690cc5`; after is this slice.

| File | What it shows |
|---|---|
| `*-writer-one.png` | One persona reaction. Before: the pill sits below the action row (Bookmark · Save to memory…), detached. After: it sits on the bubble's bottom-right corner, half on the edge, with the action row clear below it |
| `*-writer-three.png` | Three personas on a short message. Before: the cluster stands wider than the bubble, past its left edge, under the actions. After: the bubble widens to hold the cluster, which stays 10 px inside both edges |
| `*-persona.png` | Jill's reply: unchanged (3b's corner, cluster and add button in its footer) |
| `*-thread-900.png` | The room at 900 px. `turn-4` shows a writer bubble with no reactions takes no extra room |
| `*-thread-narrow.png` | Each turn held to 260 px. The Workshop tab itself does not reflow below ~900 px (pre-existing), so a phone-ish bubble is simulated by width |
| `*-writer-wrap.png` | `turn-3` held to 170 px: the cluster wraps inside the bubble's width and grows downward; the action row still clears it |

## Measured (CSS px, from the harness's output, after)

| Bubble | On the bubble | Below its edge | Clear of the text | Clear of the action row | Inside left / right | Bubble → actions |
|---|---|---|---|---|---|---|
| `turn-1`, 900 and 260 px | 15 | 15 | 10 | 12 | ≥ 192 / 10 | 27 |
| `turn-3`, 900 and 260 px | 15 | 15 | 10 | 12 | 10 / 10 | 27 |
| `turn-3`, 170 px (wrapped) | 15 | 41 | 10 | 12 | 10 / 10 | 53 |
| `turn-4` (no reactions) | n/a | n/a | n/a | n/a | n/a | 12, as before |

The thread never scrolls sideways at any width. Before, every writer
cluster stood 79 px below the bubble and overlapped the action row's
measured box (`clearsActions` −67), and `turn-3`'s cluster stood 79 px past
the bubble's left edge.

## How it is built

The writer bubble and its corner share one frame
(`WorkshopWriterMessage`, `.pm-ws-turn-message-frame`), a one-column grid.
The corner is in flow after the text, pulled up by half the cluster's
30 px height (`margin-top: -15px`), so:

- the DOM order (text, reactions, actions) is the reading and tab order;
- a cluster wider than the text widens the bubble instead of spilling
  past it (the grid column is as wide as the widest of the two);
- the action row clears the overhang without any fixed spacing, and a
  bubble without reactions reserves nothing (`data-pm-reaction-tapback`
  and the extra bottom padding come only with reactions).

The brief suggested absolute positioning. An absolutely positioned pill
leaves the flow, so the action row and the bubble's width would each need
hand-tuned room for it, and a wide cluster on a short message would
overflow the bubble's left edge. The in-flow overlap gives the same look
and gets those three for free.

The Workshop has one palette (the warm dark full-tab tokens), so there is
no light theme to capture.

## Reproduce

```bash
npm ci && npm run build   # apps/vscode-extension/dist/webview.js
node docs/pr-reviews/evidence/workshop-reactions-slice-3c-tapback/harness.js \
  apps/vscode-extension/dist/webview.js /tmp/out after-
```

For the before captures, build `16690cc5` and pass its bundle with the
prefix `before-`.
