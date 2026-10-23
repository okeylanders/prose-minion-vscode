# Lightbox Slice 4I visual evidence: run controls

Lightbox Slice 4I gives the writer's run controls (epic decisions 41–45):
- the run line says **Run AI analyses**, **Finish** and **Re-analyze**, all
  in the primary (orange) style with the sparkle;
- every AI-read widget carries an **Analyze** button in its header that
  runs its call, and says **Re-analyze** after and **Analyzing…** while it
  runs; a counted-read widget keeps a **COUNTED** chip beside it;
- the Opinion's Analyze runs the Opinion alone, and is disabled with the
  host's own reason while nothing on the board is read and current;
- the Lenses panel lists the lenses under a header per call, each with its
  **Run A** / **Rerun A**.

This folder shows those controls from real host output at 1440, 1000 and
500 px, and checks that every control says what the host's board says it
should, that the keyboard reaches and presses them, and that nothing is cut,
overflows or clips a button. The harness is adapted from
[`../lightbox-slice-4h-visual/`](../lightbox-slice-4h-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: nine states, each scrolled to the part of the page it is about |
| `states/run-controls.json` | The host's messages and answers for four moments of one board (the board a mount gets, the run's progress while one is in flight, the rail's shelves, the estimate with the run the host names), each lens's call, and the host's own refusal of the Opinion on the fresh board |
| `states/log.txt` | Every line the host logged, among them the Opinion refused with nothing to weigh, call B and call A run on their own, a call pressed while another ran refused, and Finish |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, answers the rail's and estimate's requests with the host's recorded answers, screenshots each state once two consecutive frames match, presses Enter on a control where the state names one, and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `facts.json` | What each capture measured, from the DOM: the run press (its text, style, sparkle), the run note and Stop, every AI-read widget in view (its register, its badges, its one control's label, cost, accessible name, disabled state, reason and keyboard reach), every measured tile's controls, each call's Run in the Lenses panel, the keyboard's result, and any text cut or past its box, horizontal overflow, a scrolled page and clipped buttons |
| `errors.txt` | Every page error, console error and failed expectation, one per line. It is empty for this run |
| `errors-d255b8e.txt` | The same harness against the base bundle (see Results) |
| `tools/build-run-controls.test.ts` | How `states/` was made |

### The four moments

`tools/build-run-controls.test.ts` drives the production pieces through
`lightboxBoardsHarness` (`LightboxHandler`, `LightboxReadingHandler` with its
press scope, `LightboxBoardsHandler`, `LightboxService`,
`LightboxReadingRunner`, `LightboxBoardStore` and `LightboxBoardLibrary`
over a memory file system), pressing as the webview presses:

1. **`fresh`**: the chapter boarded and measured, nothing analyzed. The
   Opinion pressed alone (`{ mode: 'group', group: 'F', lens: 'opinion' }`)
   is refused with "Nothing on the board is read and current, so the
   Opinion has nothing to weigh. Analyze another call first, then the
   Opinion."
2. **`oneCall`**: the Voice widget's Analyze (`{ mode: 'group', group: 'B',
   lens: 'voice' }`): call B read alone, every other call not run.
3. **`analyzing`**: call A's Run in the Lenses panel (`{ mode: 'group',
   group: 'A' }`), its reply held: A in flight, B read. A press of call C
   then is refused: "This board is already being read. Stop that run
   first."
4. **`read`**: A released, then Finish (`{ mode: 'rest' }`): C, D, E, G and
   F, the Opinion last; every call read.

### States

| State | Moment | What the page must show, read from the host's board |
|---|---|---|
| `fresh-runline` | fresh | The run press says **Run AI analyses**, orange, with the sparkle; the note beside it states the calls and cost |
| `one-call-runline` | oneCall | **Finish**, orange, with the sparkle and the cost of the calls not back |
| `read-runline` | read | **Re-analyze**, orange, with the sparkle and its cost |
| `fresh-widgets` | fresh | Every AI-read widget in the grid: one **Analyze** each, priced, named for its call; no bare "read" badge; **COUNTED** beside it on a counted-read widget; a measured tile with none |
| `one-call-widgets` | oneCall | **Re-analyze** on call B's widgets (Characters, Voice, Subtext), **Analyze** on the rest; Enter on the Motifs widget's Analyze sends `{ mode: 'group', group: 'A', lens: 'motif' }` |
| `analyzing-widgets` | analyzing | **Analyzing…** on call A's widgets; every other control disabled, with its reason, and still reachable by the keyboard; Enter on the disabled Voice control sends nothing; the run line says "Analyzing… 0 of 1 call back" with Stop |
| `fresh-opinion` | fresh | The Opinion's Analyze ("up to" its digest bound) disabled, with the host's own refusal shown under it on a line of its own |
| `one-call-lenses` | oneCall | A header per call, A to F in run order, each with one control: **Rerun B**, **Run** for the others, each priced |
| `analyzing-lenses` | analyzing | **Running A…**, and every other call's Run disabled |

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's Adventures
in Wonderland" (1865), public domain: the worked examples' excerpt.

**The models are stubs:** each group answers with its worked example, and
group F with the test harness's stand-in Opinion; the provider-reported
model is the placeholder `provider/model-v1`. No provider was called.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The keyboard check presses Enter on a focused button in Chromium; it does
  not exercise a screen reader.

## Results

From the committed `facts.json`, rendered from the bundle a clean
`npm run build` writes at this branch's code (`webview.js` SHA-256
`478dbd9b19ebcb8ce2aab5e50a74ba99f6919117d8decf289a95631d094b978f`).

Across all 27 captures:
- every control says what the host's board says it should: the run press's
  three labels, orange with the sparkle; **Analyze**, **Re-analyze** and
  **Analyzing…** on the 16 AI-read widgets of the grid; the Opinion's
  disabled Analyze with the host's reason shown; **Run**, **Rerun** and
  **Running A…** in the Lenses panel;
- every disabled control has a reason and stays reachable by the keyboard;
  Enter on an enabled Analyze sends that call, and on a disabled one sends
  nothing;
- no text is cut by its own box, and none runs past the part of the page it
  belongs to; no horizontal overflow, no clipped button, and at 1440 px the
  page itself never scrolls;
- no page error; `errors.txt` is empty.

The prices read "≈ $0.06" on a widget and a call's Run, and "up to $0.05"
on the Opinion's, as the host's estimate prices them.

**Two renders** gave byte-identical `facts.json`. Their screenshots differ
by raster noise (at most 42 pixels, by one level of 256) in all but one
state: in `one-call-runline` at 1000 and 500 px, where the page scrolls as
one, the sticky ribbon settles a few pixels apart between renders.

**Two layout faults this evidence found, both fixed before it was
committed** (in `3331db05`):
- The visually hidden reason and call name were absolutely positioned with
  no positioned ancestor, so they stretched the document; scrolling a part
  of the board into view then scrolled the whole page and hid the frame's
  head at 1440 px. The harness now fails on a scrolled page above 1240 px
  (it wrote 7 errors against the bundle before the fix).
- The Opinion's shown reason sat beside its chip, set mid-height, at 1000
  px. A call showing its own reason now keeps its chips and button at the
  right of the head and gives the reason a full-width line under it.

**The harness fails rather than skips.** Against the base bundle
(`epic/lightbox-reading-tolerance` at `d255b8e`, built from an export of
that commit whose `node_modules` is a link to this worktree's; `webview.js`
`f2c174fa255a41fe0443698460284139a9d191c1f20d2a303541830f84dc2224`), it
wrote 186 errors and exited 1 (`errors-d255b8e.txt`): the run press says
"Read the chapter", "Read the rest" and "Re-read", and the last two are
neither orange nor sparkled; an AI-read widget with no control, 147 times
across the states and widths; the
Lenses panel lists no calls; the Opinion shows no reason; the run note
says "Reading… 0 of 1 lens group back"; and there is no control for the
keyboard to press.

**Bundle provenance.** `npm ci` into the worktree's own `node_modules`, a
real directory, not a symlink: webpack's production module ids come from
file paths. Then `npm run build`, which empties `dist/` first and runs
`verify:bundle`.

## Rerunning it

Build the bundle and copy it out:

```sh
npm ci
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js $DIR/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js $DIR/webview.js $DIR/visual
```

(`PLAYWRIGHT_MODULE` names Playwright's folder when it is not installed
where the harness looks.) Then copy `$DIR/visual/lightbox-*.png` into
`lightbox/`, and `facts.json` and `errors.txt` here. The harness reads the
sparkle's path from `packages/core/src/shared/constants/iconPaths.ts`, so
run it from this folder in a checkout.

To rebuild `states/`:
1. Copy `tools/build-run-controls.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-run-controls.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

`$DIR` defaults to `/tmp/lightbox-4i`; keep it outside the repository. The
states rebuilt after merging the Slice 4H corrections (`467950d`) were
byte-identical to the ones built before.
