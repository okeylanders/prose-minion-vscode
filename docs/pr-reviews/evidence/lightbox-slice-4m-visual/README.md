# Lightbox Slice 4M visual evidence: design fixes

Lightbox Slice 4M makes two fixes the writer asked for:

1. **The ribbon's "chaos" mode** (a bug fix). Hovering an item whose
   paragraph references did not fit beside the ribbon's eyebrow wrapped the
   focus line onto a second row: the ribbon grew, the board moved, the item
   slid out from under the pointer, the line went back to its idle hint, and
   the loop repeated. Now the focus line has a row of its own and is one line
   tall in every state: its paragraphs are written as ranges and clipped, and
   a tail that never clips gives the count ("· 240 ¶").
2. **Re-analyze all beside Finish** (epic decision 53). Once a call has
   landed and another has not, the run line offers Finish (orange, the
   sparkle) and, right beside it, Re-analyze all (a secondary press that runs
   every call again), each with its own cost and its own reason.

This folder checks both in Chromium, with a real pointer, from real host
output, at 1440, 1000 and 500 px and again at 125% zoom, and checks the same
against the base bundle (`daec95d`), where the first fix's bug reproduces.
The harness follows the earlier Lightbox folders
(`../lightbox-slice-4j-visual/`).

## What is here

| Path | Contents |
|---|---|
| `ribbon-<item>-<config>.png` | The board with the pointer held still for 1.2 s on an item: `word` (the counted word that stands in the most paragraphs, "down", in 240 of 320), `column` (the ribbon's middle column), `dialogue-lane`, `sections-lane`, `section` (the middle section's band on the Sections lane: the writer's "hovering over a section") and `motif` (a reading: the first motif call A read) |
| `runline-<config>.png` | The board's head: the run line with Finish and Re-analyze all, and call B's note under it |
| `runline-nokey-<config>.png` | The same without an API key: both presses disabled, one reason |
| `base/` | Four of the same captures from the base bundle, where the bug shows, and its `facts-daec95d.json` (see Results) |
| `states/design-fixes.json` | The host's messages for the board: the board a mount gets, the rail's shelves, the estimate |
| `states/log.txt` | Every line the host logged while the state was made |
| `tools/build-design-fixes.test.ts` | How `states/` was made |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays the board's messages, moves the pointer as the writer would, screenshots, writes `facts.json` and `errors.txt`, and exits 1 when any check fails |
| `checks.js` | The page probes: boxes, the watch on the focus line and the ribbon's height, the layout signature, the run line's facts |
| `facts.json` | What each check measured, from the DOM |
| `errors.txt` | Every page error, console error and failed check. Empty for this run |
| `errors-daec95d.txt` | The same harness against the base bundle |

`<config>` is the window width, `1440`, `1000` or `500`, alone or with
`-zoom125`.

### The board

`tools/build-design-fixes.test.ts` drives the production pieces through
`lightboxBoardsHarness` (`LightboxHandler`, `LightboxReadingHandler` with its
press scope, `LightboxBoardsHandler`, `LightboxService`,
`LightboxReadingRunner`, `LightboxBoardStore` and `LightboxBoardLibrary`
over a memory file system), pressing as the webview presses: a long chapter
is boarded, then Run AI analyses (`{ mode: 'all' }`) runs with call B
failing, so every other call lands and the run line offers Finish.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's Adventures
in Wonderland" (1865), public domain, the worked examples' excerpt, forty
times over: 320 paragraphs, 20,320 words, bucketed into the ribbon's 96
columns, with 40 sections by their headings. A counted word stands in most
paragraphs ("down" in 240), so its focus line is long.

**The models are stubs:** each group answers with its worked example, and
group F with the test harness's stand-in Opinion; call B's provider throws;
the provider-reported model is the placeholder `provider/model-v1`. No
provider was called.

### The checks

**1. Hover never changes layout.** For each item, the pointer rests where it
hovers nothing, then moves to 3 px inside the item's top edge (where a board
that moves by a row leaves it) and holds still for 1.2 s, while a
`MutationObserver` records every change of the focus line's text and the
ribbon's height is read on every frame. The ribbon's box, its top area's
box, the focus line's box and the item's box must be the same before and
during the hover, to a half pixel; the focus line may change once (idle to
the item) and the ribbon's height never; the item must still be hovered at
the end; and the line must end with the item's paragraph count.

**1b. Every control.** Every visible button in the board's column (the
ribbon, the toolbar, every tile) is brought to the middle of its scroller and
hovered in turn; the box of every element of the Lightbox, the focus line's
own box included and only the words inside it excepted, must be the same
before and during.

**2. Re-analyze all beside Finish.** Finish must be the orange press with its
sparkle and its cost ("1 call · …"); Re-analyze all a secondary press
(`pm-lb-button`) right after it, with its own cost ("7 calls · …"), on the
same row whenever the run line has room for both; each named by its visible
label first; both inside the toolbar, no text past it, no horizontal
overflow. Without an API key both are disabled and described by one reason,
said once.

**Zoom.** The writer noted that font size makes it worse. The Lightbox's
type is set in CSS pixels, so a larger font is VS Code's zoom: the same
window at more device pixels per CSS pixel. The `-zoom125` configs render the
same windows at 1.25 device pixels per CSS pixel (1152, 800 and 400 CSS px
wide), with the root font and VS Code's font-size variables raised to 18 px.

## Results

**This branch: 48 captures, `errors.txt` empty.** Rendered from the
`webview.js` that `npm ci` then `npm run build` (with `verify:bundle`, under
Node 18.20.8) writes at this branch, SHA-256
`9509f3a25533c101100168aade5c71e9c4acb72c602085ce33dc1d0315d3c869`.
From `facts.json`, in every one of the six configs:
- **The ribbon is 302.75 px tall before and during every hover**, and its top
  area, its focus line and the hovered item keep their boxes to the half
  pixel. The focus line changes once (idle to the item) and the ribbon's
  height never, while the pointer holds still for 1.2 s; every item is still
  hovered at the end.
- **The line says the item.** "down · ¶1 ¶4–¶9 ¶12–¶17 ¶20–¶25 …" clipped,
  then "· 240 ¶"; "Dialogue share · ¶2 ¶4 ¶7–¶8 …" then "· 160 ¶"; "Sections
  · ¶1 ¶9 ¶17 …" then "· 40 ¶"; a column "¶161–¶163 · ¶161–¶163 · 3 ¶"; a
  section "Chapter I: Down the Rabbit-Hole · ¶161–¶168 · 8 ¶"; the motif
  "Going down · ¶1 ¶4–¶9 …" then "· 240 ¶". The long ones are clipped, the
  count never.
- **No control changes the layout on hover:** all 427 controls in the
  board's column hovered (404 at 500 px and 125% zoom, where the pointer
  cannot reach 23 of them at their middle, and they are skipped, on both
  bundles alike), 0 moved.
- **The run line** shows Finish ("1 call · est. $0.12", orange, the sparkle)
  and Re-analyze all ("7 calls · est. $0.88 · the Opinion up to its digest
  bound", secondary, the refresh icon) right after it, each named by its
  label first, inside the toolbar with no overflow. Where the run line has
  room for both (1440 px at 125% zoom, whose layout gives the board more
  width) they sit side by side; elsewhere the pair wraps, Re-analyze all
  directly under Finish, its cost under its label at 500 px. Without a key,
  both are disabled and described by the one reason, shown once.

**Against `daec95d`'s bundle** (SHA-256
`25398905b83ac57647e4762526bf73ae3dd824619f81741320eaebe80356d4e3`, built
the same way from an export of the base), the same harness writes 117 errors
(`errors-daec95d.txt`, the base's own facts in `base/facts-daec95d.json`, four
of its captures in `base/`):
- **The writer's loop, reproduced.** At 1440 px, the board at its top,
  hovering a section on the Sections lane (and the Sections lane's label):
  the focus line changed 34 (33) times in 1.2 s with the pointer still, the
  ribbon's height alternating 284.25, 306, 284.25, 306 … px, as the line
  wrapped onto a second row and back (`base/ribbon-section-1440.png` is one
  frame of it). The Dialogue lane's label at 1440 px: the ribbon grew, the
  label slid 21.6 px down from under the pointer, and the pointer landed on
  the Rhythm lane instead.
- **Layout on hover everywhere.** 45 box changes in the 36 hover checks: at
  1000 and 500 px the idle hint itself already wraps beside the eyebrow, so
  a column's short line shrinks the ribbon by 21.75 px and moves the column
  up (`base/ribbon-column-1000.png`); the focus line's own box changes width
  with its text in every config. The audit finds 378 to 381 of 426 controls
  changing the layout on hover (226 of 403 at 500 px and 125% zoom).
- **The old line**: 14 references then "+226", no count of its own (36
  checks).
- **No Re-analyze all** (6), and without a key no second press to disable or
  describe (12).

## Reproducing

```bash
# From the repository root, at this branch:
cp docs/pr-reviews/evidence/lightbox-slice-4m-visual/tools/build-design-fixes.test.ts packages/core/src/__tests__/
LIGHTBOX_EVIDENCE_DIR=$PWD/docs/pr-reviews/evidence/lightbox-slice-4m-visual \
  npx jest packages/core/src/__tests__/build-design-fixes.test.ts
rm packages/core/src/__tests__/build-design-fixes.test.ts
npm run build
node docs/pr-reviews/evidence/lightbox-slice-4m-visual/harness.js \
  apps/vscode-extension/dist/webview.js docs/pr-reviews/evidence/lightbox-slice-4m-visual
```

The harness needs Playwright's Chromium (`/opt/pw-browsers/chromium`, or
`$CHROMIUM_PATH`), takes several minutes (the audit hovers some 2,500
controls), and writes `lightbox.html` into its output folder; it names the
bundle's absolute path and is not committed.

## Limitations

- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- VS Code's zoom is emulated by the device scale factor. A webview's zoom in
  VS Code is the same mechanism (more device pixels per CSS pixel), but the
  window sizes here are fixed, not the writer's.
- Whether a moved board makes the pointer leave an item, and land on another,
  depends on where the pointer is; the checks hold it 3 px inside the item's
  top edge, the worst place for a board that moves down. A board whose boxes
  never change cannot move under the pointer anywhere.
