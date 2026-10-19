# Lightbox Slice 2A visual evidence: the counted board

Lightbox Slice 2A adds the Lightbox tab and its counted board. This folder
shows the board's states from real host output, and checks that the Workshop
still renders exactly as it did on the Slice 1 bundle. The harness is adapted
from [`../pr-147-visual/`](../pr-147-visual/README.md), which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px |
| `workshop/excerpt-<width>.png` | The Workshop's excerpt state, rendered by this slice's bundle |
| `boards/board.json` | The `LIGHTBOX_BOARD` result `LightboxService` built for the chapter below |
| `boards/book.json` | The board for the whole book (all twelve chapters, 26,448 words, 815 paragraphs), for the paged inspector |
| `boards/refused.json` | The `LIGHTBOX_SOURCE_REFUSED` result for an over-ceiling source |
| `harness.js` | Renders a built `webview.js` as the Lightbox surface (`data-pm-surface="lightbox" data-pm-frame="fulltab"`) behind a stubbed VS Code API, drives each state with window messages, screenshots it once two consecutive frames match, and writes `facts.json` (lit ribbon columns, inspector title, region boxes, horizontal overflow) |
| `compare.py` | Workshop comparison across several runs of two bundles: DOM verbatim, and pixels against each bundle's own run-to-run noise |
| `tools/alice_chapter.py`, `tools/build-boards.test.ts` | How the fixture chapter and the two boards were made |

**Lightbox states:**
- `empty`: the host answered with no board yet;
- `board`: the counted board for the chapter below, with the word "alice"
  pinned, so the ribbon lights its paragraphs and the inspector shows it;
- `refused`: a source over the 50,000-word ceiling;
- `paged` (added for the PR #148 review, F-04): the whole book with "alice"
  pinned (385 times in 347 paragraphs, eight pages of addresses), jumped to
  its last address, ¶812. The inspector is scrolled into view at every
  width.

**Source text.** Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), public domain, from the Project Gutenberg text (taken from
the `wordcloud` 1.9.3 sdist on PyPI, since gutenberg.org is not reachable from
this container). Gutenberg quotes dialogue with single quotes, which the
shared dialogue matcher deliberately does not match
([tech debt](../../../../.todo/tech-debt/2026-10-19-dialogue-single-quote-convention.md)),
so `alice_chapter.py` sets the dialogue in curly double quotes, as a US
edition would. The refused source is the whole book twice over (52,872 words).
Both boards were built by the production `LightboxService` and measurement
services, with the Middle Grade publishing-standards preset.

**Limitation:** this is headless Chromium, not the VS Code webview host. Theme
variables are stubbed, and fonts come from the system.

## Results

**The Lightbox** (`facts.json` from the final run):

| State | 1440 | 1000 | 500 |
|---|---|---|---|
| Layout | rail 300 · main 800 · inspector 340 | rail and inspector share a 280 px left column beside the board; the tab scrolls as one page | everything stacks: rail, board, inspector |
| `board` | 31 columns; the 19 paragraphs holding "alice" are lit; inspector shows "alice" | same | same |
| `paged` | 96 columns, 90 lit; pager reads "¶765–¶812 (337–347 of 347)", Next disabled; 11 chips; ¶812 focused | same; the label wraps between its two parts in the 280 px column | same; the stacked inspector is in view |
| Horizontal overflow | none | none | none |

- No page errors in any state or width.
- The Read button is present and disabled in every board shot, with the note
  "Readings arrive in the next update". No cost is shown anywhere.
- On mount the tab posted `lightbox_request_board`, `request_api_key` (both
  as `webview.lightbox`), `request_model_data` and `request_account_balance`,
  and nothing of the Workshop's.

**The Workshop.** Three runs each of the Slice 1 bundle (`6b2fa84`) and this
slice's bundle, with the pr-147 harness unchanged:

| Shot | DOM at 1440 | Base vs base: min–max px (max Δ) | Head vs head: min–max px (max Δ) | Base vs head: min–max px (max Δ) |
|---|---|---|---|---|
| empty-1000 | - | 0–0 (0) | 0–15 (1) | 0–15 (1) |
| empty-1440 | identical | 0–32 (1) | 0–32 (1) | 0–32 (1) |
| empty-500 | - | 0–18 (1) | 0–0 (0) | 0–18 (1) |
| excerpt-1000 | - | 0–15 (1) | 0–9 (1) | 0–15 (1) |
| excerpt-1440 | identical | 0–0 (0) | 0–22 (1) | 0–22 (1) |
| excerpt-500 | - | 0–24 (7) | 0–0 (0) | 0–24 (7) |
| initial-1000 | - | 0–0 (0) | 0–0 (0) | 0–0 (0) |
| initial-1440 | identical | 0–0 (0) | 0–0 (0) | 0–0 (0) |
| initial-500 | - | 0–0 (0) | 0–0 (0) | 0–0 (0) |
| paused-1000 | - | 0–0 (0) | 0–0 (0) | 0–0 (0) |
| paused-1440 | identical | 0–0 (0) | 0–27 (1) | 0–27 (1) |
| paused-500 | - | 0–0 (0) | 0–0 (0) | 0–0 (0) |

- **DOM:** byte-identical in all four states (the `.pm-ws-with-aside` root
  modifier is stamped only when a tab renders an aside, and the Workshop does
  not).
- **Pixels:** every state at every width has a pixel-identical pair across
  the two bundles (minimum 0). Each nonzero difference also appears between
  two runs of one bundle, in the same box: header anti-aliasing at 1/255,
  and the 7/255 excerpt-500 flicker pr-147 recorded.
- The slice moved the rail cards (`.pm-ws-block*`) from the Workshop's sheet
  to the frame's with unchanged declarations; no earlier Workshop rule
  targets those elements, so the cascade result is the same, as the pixels
  confirm.

pr-147's own `compare.py` reports "DIFFERS" for these DOMs because it strips
the frame stamp from the result side only (Slice 1's change); both bundles
now carry it, hence the adapted `compare.py` here.

## PR #148 review fixes (2026-10-19)

Re-run at the fix head for the [review](../../pr-148-lightbox-counted-board-review.md)'s
F-04 (the inspector's addresses) with boards rebuilt by the fixed host:

- **Boards.** `board.json` and `refused.json` were rebuilt with the fixed
  `LightboxService`. The board's top words, counts and paragraphs are
  unchanged; its parts-of-speech paragraphs now come from the tagged
  occurrences (F-03), e.g. noun "alice" gains ¶14 (its curly possessive),
  adverb "so" goes from 13 paragraphs for 9 occurrences to 8, and adverb
  "down" no longer lights the "Down the Rabbit-Hole" heading, where it is not
  an adverb. The refusal now carries its host-minted `id` (F-02). `book.json`
  is new.
- **`paged` shots** (`lightbox/lightbox-paged-<width>.png`) show the pager
  after a jump: the last page of "alice"'s 347 addresses, never more than 48
  chips, the landing chip focused. No page errors; no horizontal overflow.
- **Unchanged states.** `empty`, `board` and `refused` were re-rendered from
  the fix head's bundle and boards. `empty` and `board` are pixel-identical
  to the committed shots at all three widths; `refused` differs in at most 10
  pixels by 1/255 (anti-aliasing), so the committed images stand.
- **The Workshop** was not re-shot: no frame style changed, only rules scoped
  to `[data-pm-surface="lightbox"]`.
- The harness now posts `LIGHTBOX_BOARD` as `{ board, refusal }`, the shape
  the host sends since F-02.

## Rerunning it

Build each bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/lightbox-2a/head-webview.js
# and the same at the Slice 1 commit (6b2fa84), e.g. from `git archive 6b2fa84`,
# as /tmp/lightbox-2a/base-webview.js
```

The Lightbox, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js /tmp/lightbox-2a/head-webview.js /tmp/lightbox-2a/visual/head
```

The Workshop, three runs per bundle with the unchanged pr-147 harness (from
`../pr-147-visual/`), then the comparison (from this folder):

```sh
for run in 1 2 3; do
  node ../pr-147-visual/harness.js /tmp/lightbox-2a/base-webview.js /tmp/lightbox-2a/visual/ws-base$run 'data-pm-surface="workshop" data-pm-frame="fulltab"'
  node ../pr-147-visual/harness.js /tmp/lightbox-2a/head-webview.js /tmp/lightbox-2a/visual/ws-head$run 'data-pm-surface="workshop" data-pm-frame="fulltab"'
done
V=/tmp/lightbox-2a/visual
python3 -I compare.py $V/ws-base1,$V/ws-base2,$V/ws-base3 $V/ws-head1,$V/ws-head2,$V/ws-head3
```

To rebuild `boards/`: extract `examples/alice.txt` from the `wordcloud` 1.9.3
sdist into `$DIR/download/alice/`, run `tools/alice_chapter.py` on it once per
chapter (`… $DIR/fixtures/alice-chapter-<n>.md <n>`, n = 1–12), copy
`tools/build-boards.test.ts` into `packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-boards.test.ts`,
delete the copy, and copy `$DIR/boards/*.json` here. `$DIR` defaults to
`/tmp/lightbox-2a`; keep it outside the repository.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then from
`/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`. `compare.py` needs Pillow
and NumPy.
