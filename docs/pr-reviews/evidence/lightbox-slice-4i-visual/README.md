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

After PR #166's review (Astra), it also checks the three corrections:
- **F-01:** every price reads as an approximate total ("≈ $0.05", or
  "< $0.01"), never "up to"; the Opinion's name and tooltip add "input at
  digest limit";
- **N-01:** every control's accessible name starts with its visible label
  ("Run A, call A: …");
- **N-02:** the read headline's Re-analyze, focused and pressed, stays the
  same focused button through its rerun's start, landing, a second press
  and a failure.

And the writer's decision 47: the Opinion's Analyze, held and then failed,
keeps the earlier Opinion drawn, said to be the earlier one, never a
skeleton, with the host's reason after a failure.

This folder shows those controls from real host output at 1440, 1000 and
500 px, and checks that every control says what the host's board says it
should, that the keyboard reaches and presses them, and that nothing is cut,
overflows or clips a button. The harness is adapted from
[`../lightbox-slice-4h-visual/`](../lightbox-slice-4h-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: twelve states, each scrolled to the part of the page it is about, and the headline's rerun at three steps (`headline-rerun-analyzing`, `-landed`, `-failed`); 45 captures |
| `states/run-controls.json` | The host's messages and answers for ten moments of one board (the board a mount gets, the run's progress while one is in flight, or its end, the rail's shelves, the estimate with the run the host names), each lens's call, and the host's own refusal of the Opinion on the fresh board |
| `states/log.txt` | Every line the host logged, among them the Opinion refused with nothing to weigh, call B and call A run on their own, a call pressed while another ran refused, Finish, the headline's Analyze twice, read again and then failed, and the Opinion's Analyze, failed, its board saved with the earlier Opinion |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, answers the rail's and estimate's requests with the host's recorded answers, screenshots each state once two consecutive frames match, presses Enter on a control where the state names one, and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `checks.js` | The harness's price check (F-01) and its kept-Opinion check (decision 47), the kept words read from `LightboxOpinion.tsx` |
| `headline-rerun.js` | The harness's N-02 sequence: focus the read headline's Re-analyze, press Enter, replay the host's moments of that rerun, and check that the same button holds the focus at each step |
| `facts.json` | What each capture measured, from the DOM: the run press (its text, style, sparkle), the run note and Stop, every AI-read widget in view (its register, its badges, its one control's label, cost, accessible name, tooltip, disabled state, reason and keyboard reach), every measured tile's controls, each call's Run in the Lenses panel, the keyboard's result, the headline's rerun step by step, and any text cut or past its box, horizontal overflow, a scrolled page and clipped buttons |
| `errors.txt` | Every page error, console error and failed expectation, one per line. It is empty for this run |
| `errors-28a977e.txt` | The same harness against the reviewed head's bundle (see Results) |
| `errors-d255b8e.txt` | The same harness against the base bundle (see Results) |
| `tools/build-run-controls.test.ts` | How `states/` was made |

### The ten moments

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
5. **`rereading`**: the headline's Analyze (`{ mode: 'group', group: 'A',
   lens: 'headline' }`), A's reply held: A in flight again, its readings
   cleared, every other call still read.
6. **`reread`**: A released and read again, with the host's `finished`
   progress for that run.
7. **`failing`**: the headline's Analyze again, A held.
8. **`failed`**: A's reply fails (the stub throws; the host shows only its
   category, "The call failed before a reading came back. …"): A failed,
   every other call still read, with the run's `finished` progress.
9. **`opinionReading`**: the Opinion's Analyze (`{ mode: 'group', group:
   'F', lens: 'opinion' }`; decision 47), F's reply held: F in flight, its
   earlier Opinion still on the board.
10. **`opinionKept`**: F's reply fails: F failed, its earlier Opinion kept,
    with the run's `finished` progress; the board is saved holding it.

### States

| State | Moment | What the page must show, read from the host's board |
|---|---|---|
| `fresh-runline` | fresh | The run press says **Run AI analyses**, orange, with the sparkle; the note beside it states the calls and cost |
| `one-call-runline` | oneCall | **Finish**, orange, with the sparkle and the cost of the calls not back |
| `read-runline` | read | **Re-analyze**, orange, with the sparkle and its cost |
| `fresh-widgets` | fresh | Every AI-read widget in the grid: one **Analyze** each, priced, named for its call; no bare "read" badge; **COUNTED** beside it on a counted-read widget; a measured tile with none |
| `one-call-widgets` | oneCall | **Re-analyze** on call B's widgets (Characters, Voice, Subtext), **Analyze** on the rest; Enter on the Motifs widget's Analyze sends `{ mode: 'group', group: 'A', lens: 'motif' }` |
| `analyzing-widgets` | analyzing | **Analyzing…** on call A's widgets; every other control disabled, with its reason, and still reachable by the keyboard; Enter on the disabled Voice control sends nothing; the run line says "Analyzing… 0 of 1 call back" with Stop |
| `fresh-opinion` | fresh | The Opinion's Analyze, "≈ $0.05", disabled, with the host's own refusal shown under it on a line of its own; its name ends "· ≈ $0.05 · input at digest limit" |
| `one-call-lenses` | oneCall | A header per call, A to F in run order, each with one control: **Rerun B**, **Run** for the others, each priced "≈"; **Run F**'s name adds "input at digest limit" |
| `analyzing-lenses` | analyzing | **Running A…**, and every other call's Run disabled |
| `opinion-reading` | opinionReading | The earlier Opinion drawn, with "Analyzing… This is the earlier Opinion until the new one lands." and no skeleton; its Analyze says **Analyzing…**, disabled (decision 47) |
| `opinion-kept` | opinionKept | The earlier Opinion drawn, its stale mark kept, with "The new Opinion did not land, so the earlier one stays." and the host's reason; its Analyze says **Re-analyze** |
| `headline-rerun` | read, then rereading, reread, failing, failed | The read headline's **Re-analyze**; focused and pressed with Enter, it sends `{ mode: 'group', group: 'A', lens: 'headline' }`, then stays the same focused button as the host's moments arrive: **Analyzing…**, disabled, with the headline cleared; **Re-analyze** once it lands; pressed again, **Analyzing…**; **Analyze** after the failure, with the failure under the plain heading |

In every state, each control's accessible name starts with its visible
label ("Analyze, call B: …", "Rerun B, call B: …", "Running A…, call
A: …"), and its tooltip is its name, or its reason when it cannot run.

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
`npm run build` writes at this branch's code after the PR #166 corrections
and the writer's decisions 47 and 48 (`webview.js` SHA-256
`4297b7608e9b89684aa36979e5702a41e2749784815dca498bc61a0522fdd3b4`).

Across all 45 captures:
- every control says what the host's board says it should: the run press's
  three labels, orange with the sparkle; **Analyze**, **Re-analyze** and
  **Analyzing…** on the 16 AI-read widgets of the grid; the Opinion's
  disabled Analyze with the host's reason shown; **Run**, **Rerun** and
  **Running A…** in the Lenses panel;
- every control's accessible name starts with its visible label, and its
  tooltip is its name or its reason;
- every disabled control has a reason and stays reachable by the keyboard;
  Enter on an enabled Analyze sends that call, and on a disabled one sends
  nothing;
- the headline's Re-analyze keeps the focus, the same button, through its
  rerun's start, landing, second press and failure, at every width;
- the Opinion re-analyzed on its own stays drawn as the earlier one while
  the new one is weighed, and after the call fails, with the reason;
- no text is cut by its own box, and none runs past the part of the page it
  belongs to; no horizontal overflow, no clipped button, and at 1440 px the
  page itself never scrolls;
- no page error; `errors.txt` is empty.

The prices read "≈ $0.06" on a widget and a call's Run, and "≈ $0.05" on
the Opinion's Analyze and Run F, as the host's estimate prices them; no
control's price, name or tooltip says "up to". The run line keeps Slice
4D's note, "est. $0.33 · the Opinion up to its digest bound", unchanged:
its "est." is the approximation and the rest qualifies the Opinion's
input, the form the review cites as the earlier, qualified one.

**Two renders** of this bundle, with the harness as committed, gave
byte-identical `facts.json` and an empty `errors.txt`. 36 of the 45
captures were byte-identical; eight differ by raster noise, 6 to 36 pixels
at an edge or a scrollbar, and one, `one-call-runline` at 500 px, by a few
pixels of scroll: there the page scrolls as one, and the sticky ribbon
settles a few pixels apart between renders (as before the review).

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

**The corrected checks fail on the reviewed head.** Against the bundle
of `28a977e` (the head PR #166's review read; rebuilt here byte for byte,
`webview.js` `478dbd9b…`), the harness writes 303 errors and exits 1
(`errors-28a977e.txt`), each finding among them:
- **F-01 (39):** the Opinion's Analyze and Run F priced "up to $0.05" and
  named "Analyze call F: Opinion · up to $0.05", a total shown as a cap,
  with nothing said of its input apart from it;
- **N-01 (210):** every control named "Analyze call B: …", "Run call
  A: …", not by its label first;
- **N-02 (42):** after Enter on the headline's Re-analyze, the host's
  running board replaces the button and the focus falls to `BODY`, at
  every step and width, and the second press, with no button focused,
  sends nothing;
- **decision 47 (12):** given the host's board with the earlier Opinion
  kept, that bundle draws a skeleton in its place while the new one is
  weighed, and after the failure shows the reason with nothing saying the
  Opinion shown is the earlier one.

**The harness fails rather than skips.** Against the base bundle
(`epic/lightbox-reading-tolerance` at `d255b8e`, built from an export of
that commit whose `node_modules` is a link to this worktree's; `webview.js`
`f2c174fa255a41fe0443698460284139a9d191c1f20d2a303541830f84dc2224`), it
wrote 207 errors and exited 1 (`errors-d255b8e.txt`): the run press says
"Read the chapter", "Read the rest" and "Re-read", and the last two are
neither orange nor sparkled; an AI-read widget with no control, 147 times
across the states and widths; the
Lenses panel lists no calls; the Opinion shows no reason; the run note
says "Reading… 0 of 1 lens group back"; there is no control for the
keyboard to press; the read headline has no Analyze for the rerun
sequence; and the kept Opinion is drawn as a skeleton (186 errors with the
harness before the review's checks).

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
states rebuilt after merging the Slice 4H corrections (`467950d`, then
`bdec17f`) were byte-identical to the ones built before. For the PR #166
corrections the builder gained moments 5 to 8, and for decision 47 moments
9 and 10; each time the moments before rebuilt byte-identical, and
`log.txt` only gained the new runs' lines.
