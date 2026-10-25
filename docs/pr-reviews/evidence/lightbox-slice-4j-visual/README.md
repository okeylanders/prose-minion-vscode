# Lightbox Slice 4J visual evidence: keep readings until they're replaced

Lightbox Slice 4J gives the writer's rule (epic decision 49): **every re-run
keeps the old readings until the new ones land**, so a failed or stopped run
never costs a reading the writer already paid for. In every run scope:
- a lens its call reads again keeps its reading on show, with "Analyzing…
  This is the earlier reading until the new one lands.", never a skeleton;
- a usable new block replaces the lens's reading;
- a failure, a Stop, a reply cut off before the lens's block, a withheld block
  or a block with no usable tile keeps the earlier reading, with its own
  standing and stale mark, under a quiet **Earlier reading** label and the
  reason;
- a call's lenses are decided on their own, and the Opinion follows the same
  rule in every scope.

And the writer's decision 52: **a failed call's error is said once, at the
call.** A call that failed, was stopped or was cut off shows its whole
message, the place a paid reply was saved included, in one note under the run
line; each widget of the call shows a short line pointing there ("Call A
failed: see its note by the run line. Analyze to try again.", or "Earlier
reading · this call failed: see its note by the run line."). Calls stopped in
the same words share one note.

This folder shows those states from real host output at 1440, 1000 and 500
px, and checks that every widget and every call note says what the host's
board says it should, and that nothing is cut, overflows or clips a button.
The harness is adapted from
[`../lightbox-slice-4i-visual/`](../lightbox-slice-4i-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: eleven states, each scrolled to the part of the page it is about; 33 captures |
| `states/keep-readings.json` | The host's messages and answers for eight moments of one board (the board a mount gets, the run's progress while one is in flight or the last progress of the run that ended, the rail's shelves, the estimate with the run the host names), and each lens's call |
| `states/log.txt` | Every line the host logged: the run of every call with call A's reply unusable and saved for recovery, Finish, Re-analyze held and stopped, Finish with the Opinion's call failing, call A's run with its motif block withheld, and call A's run unusable again |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, answers the rail's and estimate's requests with the host's recorded answers, screenshots each state once two consecutive frames match, and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `checks.js` | What each widget and call note must say, worked out from the host's board (decisions 49 and 52), and the page probe that reads them; the keep words, the label and the ceiling's prefix are read from the code that says them |
| `facts.json` | What each capture measured, from the DOM: each AI-read widget's notes (the live note over an earlier reading, the earlier note, the short line pointing to its call's note), its skeleton, what describes it and its note link's name; the call notes (text, role, focus); every Analyze's label and name; the run note; and any text cut or past its box, horizontal overflow, a scrolled page and clipped buttons |
| `errors.txt` | Every page error, console error and failed expectation, one per line. It is empty for this run |
| `errors-cf7f260.txt` | The same harness against the base bundle (see Results) |
| `tools/build-keep-readings.test.ts` | How `states/` was made |

### The eight moments

`tools/build-keep-readings.test.ts` drives the production pieces through
`lightboxBoardsHarness` (`LightboxHandler`, `LightboxReadingHandler` with its
press scope, `LightboxBoardsHandler`, `LightboxService`,
`LightboxReadingRunner`, `LightboxBoardStore` and `LightboxBoardLibrary`
over a memory file system), pressing as the webview presses:

1. **`fresh`**: the chapter boarded and measured, nothing analyzed.
2. **`firstFailed`**: Run AI analyses (`{ mode: 'all' }`), call A's reply
   unusable: A failed with nothing to keep, saved for recovery at its
   place; every other call read.
3. **`read`**: Finish (`{ mode: 'rest' }`): A read too.
4. **`rerunning`**: Re-analyze (`{ mode: 'all' }`), every chapter call's
   reply held: every call, the Opinion's too, in flight over its earlier
   readings.
5. **`stopped`**: Stop: every call stopped, every reading kept and said to
   be the earlier one; nothing saved of its own.
6. **`opinionKept`**: Finish, the Opinion's call failing: every chapter call
   read again, the earlier Opinion kept, stale since what it cites was read
   again.
7. **`mixed`**: call A's Run (`{ mode: 'group', group: 'A' }`), its motif
   block missing its friction: the headline, tension, gravity and palette
   replaced, the motif kept, with its own reason.
8. **`failedKept`**: call A's Run again, its reply unusable: A failed, all
   five of its readings kept, its one note naming where the reply was saved.

### States

| State | Moment | What the page must show, read from the host's board |
|---|---|---|
| `rerunning-top` | rerunning | The read headline still on show with "Analyzing… This is the earlier reading until the new one lands.", its Analyze saying Analyzing…; the tension line's earlier arc with its "earlier" badge; the run line in flight with Stop |
| `rerunning-widgets` | rerunning | Every widget of the grid with its earlier reading drawn and the live note, never a skeleton |
| `failed-kept-top` | failedKept | "CALL A · FAILED" and the whole message with the recovery path, once, under the run line, an alert; "CALL F · FAILED" beside it; the headline and the tension line saying "Earlier reading · this call failed: see its note by the run line."; the run line's "6 earlier readings kept" |
| `failed-kept-widgets` | failedKept | Motifs, Lexical gravity and Palette, each with its earlier reading and the short line, each described by call A's note; the message nowhere in a widget |
| `mixed-widgets` | mixed | Motifs kept, with "Earlier reading The re-analysis did not replace it. The motifs block names no friction; …"; Lexical gravity and Palette replaced, with no note |
| `stopped-top` | stopped | One note for every call, "CALLS A, B, C, D, E, G, F · STOPPED", a status; the run line's Finish and "19 earlier readings kept" |
| `stopped-widgets` | stopped | Every widget with its reading and "Earlier reading · this call was stopped: see its note by the run line."; a lens of a stopped call with nothing to keep says "Call D was stopped: see its note by the run line. Analyze to try again." |
| `opinion-kept` | opinionKept | The earlier Opinion drawn, under "Earlier reading · this call failed: see its note by the run line.", with its stale standing; its Analyze says Re-analyze |
| `opinion-kept-top` | opinionKept | "CALL F · FAILED" and the host's reason, once |
| `first-failed-top` | firstFailed | "CALL A · FAILED" with the whole message once; the plain heading with "The headline did not come back. Call A failed: see its note by the run line. Analyze to try again."; the tension line likewise |
| `first-failed-widgets` | firstFailed | A failed call with several widgets and nothing to keep (decision 52's state): Motifs, Lexical gravity and Palette, each with "Call A failed: see its note by the run line. Analyze to try again.", described by the note |

In every state each widget's Analyze says what the board says (Analyzing…
while its call reads it, earlier reading or none; Re-analyze while it holds a
reading; Analyze before), its accessible name starting with its label.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's Adventures
in Wonderland" (1865), public domain: the worked examples' excerpt.

**The models are stubs:** each group answers with its worked example, and
group F with the test harness's stand-in Opinion; an unusable reply is a
frame whose JSON stops mid-object; the provider-reported model is the
placeholder `provider/model-v1`. No provider was called.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The checks read the DOM and what describes each frame; they do not
  exercise a screen reader. Focus continuity is checked in the App tests
  (`LightboxAppKeepReadings.test.tsx`), not here.
- Text cut or past its box is checked in the parts of the page each state is
  about (the board's head, the grid, the Opinion). The ribbon's lane notes
  are ellipsized by design and are no part of this slice.

## Results

**This slice: 33 captures, `errors.txt` empty.** Rendered from the
`webview.js` of `npm ci` then `npm run build` (with `verify:bundle`) on
`epic/lightbox-keep-readings`, SHA-256 `a9aa1ba9…` (both builds, under
Node 22 and Node 18). Two renders give a byte-identical `facts.json` and the
same empty `errors.txt`; their screenshots differ by at most 49 pixels a
capture (scrollbar edges and text antialiasing). The states rebuild byte for
byte from the final code.

**After PR #170's corrections** (`epic/lightbox` at `13aff89` merged in;
one note per call or cut reply, a failure kept to its own lenses, a
reading from before Slice 4J keeping its model), `checks.js` mirrors the
new note rules, the states rebuild byte for byte, and the corrected bundle
(`webview.js` SHA-256 `2ffd7bcd…`, the same under Node 22 and Node 18)
gives the same `facts.json`, byte for byte, and an empty `errors.txt`. No
state here holds two cut replies of one call or a lens rerun on its own, so
nothing drawn changes: the captures are the earlier render's, which differ
from the new one by at most 49 pixels a capture, as two renders of one
bundle do. The corrections' own witnesses are tests (see the slice notes).

**After `epic/lightbox` at `f75ed80` (Slice 4L, the Lightbox's own model
setting) was merged in, and PR #170's re-review correction** (a lost
provenance origin stays unknown), the harness names the Lightbox's own
model selection in its model data, as the webview now reads it. The states
rebuild byte for byte, and the bundle (`webview.js` SHA-256 `55feaac0…`,
the same under Node 22 and Node 18) gives the same `facts.json`, byte for
byte, and an empty `errors.txt`. The captures were rendered again from it:
4L's header names the Lightbox's model, which moves the page at 500 px.

In every capture: each AI-read widget says what its call's state on the
host's board says (the live note over an earlier reading, the earlier note
and its reason, or the short line pointing to its call's note), with no
skeleton over a reading; each call that did not land has one note, said
once, an alert for a failure and a status for a stop; every widget whose
state is a call's message is described by that note, and its link is named
for it; no text is cut or past its box, the page never scrolls sideways and
no button is clipped.

**Against `cf7f260`'s bundle** (SHA-256 `c538aa9a…`, built the same way
from an export of the base), the same states and checks fail with 906
errors (`errors-cf7f260.txt`):

| Errors | What the base does |
|---:|---|
| 177 | A widget whose state is its call's message is not described by any note |
| 171 | The call's whole message repeats in every widget of the call |
| 162 | A kept reading carries no earlier note (the base clears it, or shows it as current) |
| 108 | A reading read again has no "Analyzing… This is the earlier reading…" note |
| 96 | A skeleton stands where the earlier reading was |
| 90 | The earlier reading is not drawn while it is read again |
| 36 | A widget of a call that failed or was stopped has no short line |
| 27 | No call note under the run line |
| 21 | The run note does not count the kept readings |
| 18 | The call's message is not said once |

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
`lightbox/`, and `facts.json` and `errors.txt` here. `checks.js` reads its
words from `packages/core/src`, so run it from this folder in a checkout.

To rebuild `states/`:
1. Copy `tools/build-keep-readings.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-keep-readings.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

`$DIR` defaults to `/tmp/lightbox-4j`; keep it outside the repository.
