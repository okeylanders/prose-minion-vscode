# Lightbox Slice 5A.2 visual evidence: saved boards in the Workshop's design language

Lightbox Slice 5A.2 builds the writer's call on 5A.1's Boards panel (epic
decision 46): **one file per board**, named by date at its first save
("alice-1 - 10/23/2026 9:08 AM") and rewritten in place after; the Boards
side panel replaced by a **Boards menu** in the header and the Workshop's
**session browser, made shared**, over **every chapter's** boards; and
**"Open a board file…"** for a board file anywhere. After PR #167's review
it also shows **what a rename left to say** (F-03): a rename whose file
could not be written keeps its words under the header after the name sheet
closes, and the menu says "Name not saved".

This folder shows it from real host output, at 1440, 1000 and 500 px, and
shows the Workshop's own sessions menu and browser before and after they
became shared. The Lightbox harness is adapted from
[`../lightbox-slice-5a1-visual/`](../lightbox-slice-5a1-visual/README.md),
the Workshop's from
[`../lightbox-source-picker/`](../lightbox-source-picker/README.md); both
are unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: eleven states (below) |
| `workshop/<state>-{before,after}-<width>.png` | The Workshop's sessions menu and browser with the base bundle (before) and this branch's (after): five states at three widths |
| `states/boards.json` | The host's messages and answers for each Lightbox state: the board a mount gets, the shelf a mount's request gets, each board's shelf, the estimate, and the host's answers to the Open in `changed`, to "Open a board file…" in `outside`, and to the rename in `kept`. `files` lists the six board files the story wrote |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, with the page's clock pinned to 3:00 PM UTC on Oct 23, 2026; replays each state's messages; answers the tab's own requests with the host's recorded answers (echoing each request's id); acts as the writer would; takes each screenshot once two consecutive frames match; and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `facts.json` | What each Lightbox state's page showed, read from the DOM: the trigger's words and save status, the menu line by line, the browser (title, notes, grouping, search, each group's label and rows: name, chapter line, models, badge, Open), the rename field (label, value, focus, refusal), the delete confirm, what has focus, the notice above the board and whether it is first in the board's column, the outcome banner under the header (its role, words and Dismiss; PR #167 F-03), every rename the page sent (board, file, name and adoption; PR #167 F-02), whether the Boards panel is there, whether the menu or browser runs off screen, horizontal overflow, every button that runs past the box that clips it (PR #164's review), the saved-board requests the page posted, and whether any saved webview state named a board file or held a board's name |
| `errors.txt` | Every page error, console error and failed expectation, one per line. It is empty for this run |
| `errors-4e0be76.txt` | The same harness against the bundle of the head PR #167's review read (`4e0be76`): only `kept` fails, as F-03 and F-02 describe |
| `workshop-harness.js` | Renders the base and head bundles as the Workshop, answers `workshop_list_sessions` with four named sessions and the current room, drives each state, and records the SHA-256 of the menu's or dialog's markup and every computed style property and box of every element in it. It writes `workshop-facts.json` and `workshop-errors.txt`, and exits 1 on any difference |
| `workshop-facts.json` | Per state and width: element count, markup and computed styles and boxes identical or not (with their SHA-256), what has focus, and whether the menu or browser runs off screen, before and after |
| `workshop-errors.txt` | Every difference, page error and console error. It is empty for this run |
| `workshop-compare.py` | Differing pixels per Workshop shot, before against after |
| `tools/build-boards.test.ts` | How `states/` was made |
| `tools/workshopMarkupParity.test.tsx`, `tools/workshop-markup-compare.js` | The Workshop's menu and browser rendered alone (jsdom) in fifteen states, at the base and at the head, and compared |

### The Lightbox states

The story (`tools/build-boards.test.ts`), in UTC, across six working
sessions over one workspace, each a new host over the same files and
memento:
- **Oct 12, 2:05 PM:** alice-1 boarded, saved as "alice-1 - 10/12/2026
  2:05 PM"; groups A and B read by `model-v1`, rewriting that file at
  2:06 PM.
- **Oct 14:** alice-3 boarded: measured only.
- **Oct 19:** alice-2 boarded and read by `model-b`.
- **Oct 21:** alice-2 changed on disk; its Oct 19 board opened, and "Read
  the current text" started a new board in a new file, its readings
  carried and marked stale.
- **Oct 22:** alice-3 boarded again in a new window (no file while only
  measured: its Oct 14 file holds that text) and read for groups A and B:
  a new file at its first reading.
- **Oct 23, 9:08 AM:** alice-1 boarded again and read by `model-v1`: the
  board on screen. The writer named the Oct 12 file "alice-1 - first pass"
  and the Oct 19 file "alice-2 - second pass" from the browser's rows (the
  production rename route): rewritten in place, still six files in three
  chapter folders.
- **Then, PR #167 F-03:** the board on screen renamed "alice-1 - morning
  read" through the same route while its file's staged write fails (EIO).
  The host keeps the name on the board, leaves the file byte for byte as
  it was, and answers with its notice. `kept` replays that answer.

| State | What the writer did | What it shows |
|---|---|---|
| `menu` | Opened the Boards menu | The trigger "alice-1 - 10/23/2026 9:08 AM", "Saved". Board: Rename board…, Board another chapter…, Open prior board…; Recent: the five newest of the six boards, of three chapters, each with its chapter and when ("on screen", "Yesterday · 1:15 PM", "Wed · Oct 21", "Mon · Oct 19", "Oct 14"), the one on screen disabled; Browse all boards…. Focus on Rename board… |
| `browser-date` | Open prior board… | "Open a prior board": Today 1, This week 3, Earlier 2. Each row: name, chapter · saved time · lenses (and "18 stale" on the Oct 21 board) · cost, the models, On screen on today's; the folder and "Open a board file…" below. Focus in the search field; the shelf asked for again |
| `browser-chapter` | Chapter | Drafts/alice-1.md 2, Drafts/alice-3.md 2, Drafts/alice-2.md 2, in the order of each chapter's newest board |
| `browser-search` | Typed "pass" | The two named boards, of two chapters: This week 1, Earlier 1 |
| `browser-rename` | Rename on the Oct 21 row, typed "alice-2 - after the change" | The field in the row, focused, holding the words; nothing sent |
| `browser-delete` | Delete on the Oct 14 row | Confirm delete and Keep in the row, focus on Keep; nothing sent |
| `session-menu` | No folder open; opened the menu | "This session only"; "Boards are kept for this session only: no folder is open. Open one folder to save them."; "No saved boards yet." |
| `session-browser` | Open prior board… | The same note, "Boards are kept for this session only, so there are none to open here.", and "Open one folder, and boards save themselves there." beside "Open a board file…" |
| `changed` | alice-1 changed on disk; Open on "alice-1 - first pass" | The browser closed; the trigger names "alice-1 - first pass", "Saved"; above the board, first in its column, the amber notice "Opened from the board saved Oct 12, 2026, 2:06 PM. The file has changed since. …" with Read the current text |
| `outside` | "Open a board file…", picking a copy of the Oct 12 file kept outside the boards folder | The browser closed; the trigger names "alice-1 - first pass", "Not saved yet"; above the board, "Opened from a board file outside the boards folder, saved Oct 12, 2026, 2:06 PM. Its next save writes it there, as a file of its own. The file still holds the text it was read from." No file was written |
| `kept` | Rename board… from the menu, typed "alice-1 - morning read", Rename; the host could not write the file (PR #167 F-03) | The sheet closed. The trigger names "alice-1 - morning read" and says **"Name not saved"**, not "Saved". Under the header, a banner with an alert role: "**Saved boards** The board on screen is named, but the file it was saved to could not be changed. The output log says why.", with Dismiss. The rename the page sent names the board and the adoption the sheet was opened for (F-02) |

What the builder checks along the way: one file per board, by name and
count, at each step (one after the first day, three after the third, four
after Read the current text, still four after a measured-only re-board,
six at the end, and six after both renames); the shelf's rows, names,
chapters and order; the failed rename's notice, its row still under the
file's own name, and the file's bytes unchanged; the outside open writes
nothing; the log carries no paragraph of the text and no writer-given
name.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain: the worked examples'
excerpt, as `alice-1.md`; its first four paragraphs as `alice-2.md` and its
last four as `alice-3.md`. The added closing lines were written for this
evidence. The worked examples answer for the whole excerpt, so reading the
shorter chapters withholds the quotes they do not hold (the log counts
them); those boards are never on screen here.

**The models are stubs:** each group answers with its worked example, and
group F with the test harness's stand-in Opinion; the provider-reported
model is the placeholder `provider/model-v1` or `provider/model-b`. Each
recorded call costs $0.01. No provider was called.

## Results

From the committed `facts.json` and `workshop-facts.json`, rendered from
the bundle `npm run build` writes at this branch's code with PR #167's
corrections and `epic/lightbox` at `fcf86ff` (Slice 4I, PR #166) merged in
(`webview.js` SHA-256
`1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15`, the
same under Node 22 and Node 18), and, for the Workshop's before, from an
export of `fcf86ff` built the same way (`09deafc2…5fdd1`).

**After PR #167's corrections and the merge of 4I**, the ten earlier
states' DOM facts are identical to the render before: the same trigger,
status, menu, browser, field, confirm, focus, notice and checks, and the
same requests posted (their random ids aside). The two new facts are
empty in each: no outcome banner, no rename sent. Every capture's pixels
moved, because 4I's run controls (the run line's Re-analyze, each
widget's Analyze, each call's Run) are on the board behind the menus. The
host states changed only in two observation numbers in `outside` and
`changed`: the failed rename's answer and its shelf come before them now.
`kept` is new. Against the reviewed head's bundle (`4e0be76`,
`1f28383f…7a2e`) the harness writes 9 errors, all in `kept`, three at
each width (`errors-4e0be76.txt`): the menu says "Saved", no banner is
there once the sheet closes, and the rename it sent names no adoption.
Its other ten states pass there.

**After the merge of 4H, and before it**, the same harnesses ran on the
branch's bundles: `1f28383f…7a2e` against `08b0d22`'s `fc3a409f…0a0f`, and,
before that merge, the branch's own bundle
(`be9b6a9c…6aaa`, against `a57a5cd`'s `decd8431…9627` for the Workshop's
before), with the same results. The merge changed the states only in the
estimates (4H's 12,000-token output reserve, decision 38); the DOM facts of
all 30 Lightbox captures are identical before and after it. Twenty
screenshots are pixel-identical, eight differ in 7 to 81 pixels (tints),
and `changed` and `outside` at 1000 px differ in about 4,700, where the
ribbon's bars, under the notice, sit about a pixel apart.

**The Lightbox**, across all 33 captures: every state shows what the host's
answers say; no Boards panel; the menu and browser stay on screen; no
horizontal overflow; no button runs past the box that clips it; no saved
webview state names a board file or holds a board's name (9 to 16 states
saved per capture); no page error. `errors.txt` is empty.

**The Workshop**, before and after, in all fifteen state-and-width pairs:
the markup is identical, every computed style of every element (58 in the
menu, 239 to 250 in the browser) and every box is identical, and focus
lands on the same element. `workshop-errors.txt` is empty. Pixels:
`workshop-compare.py` counts 0 to 569 differing pixels per pair (largest
channel difference 5; 0 to 581 against `08b0d22`). The same bundle rendered in two runs differs by as
much: 0 to 605 pixels, largest channel difference 5, the worst in
`a57a5cd`'s own `browser-rename` at 500 px. Each before-and-after run
moved the counts about and found the DOM identical. The pixels are raster
noise and add nothing to the DOM's answer. Rendered
alone in jsdom (`tools/`), the menu and browser are identical in fifteen
states, focus included, at `fcf86ff` and at this branch (and before, at
`a57a5cd`). PR #167 N-04's change to the shared browser, focus on Close
when search is disabled after the last delete, is taken only by the
Lightbox's `returnFocus` opt-in.

**Four things the first renders caught**, fixed before these:
- At 500 px the menu, anchored to its trigger's right edge, ran off the
  window's left edge (the frame's header wraps its actions to the left at
  520 px and under). The Lightbox's menu now hangs from the actions block
  at the gutter; the Workshop's is unchanged.
- The browser's row glyph had its one icon pinned to the corner, as the
  Workshop's pins a persona's focus icon. It is centred now.
- At 500 px a row's chapter was cut to its first letter. The line now wraps
  between its parts.
- And in the Workshop, the browser's "Named sessions" heading had moved by
  0.015 px: the shared component wrote it as two text nodes where the
  Workshop's literal was one. It is one again.

**The states are deterministic.** `tools/build-boards.test.ts`, run again
before the merge of 4H, wrote `states/` byte for byte; after it, the same
but for the estimates. After 4I's merge, the estimates and every board
message are unchanged.

**The harness fails rather than skips.** Against the base bundle
(`fcf86ff`, `09deafc2…5fdd1`) it writes 204 errors and exits 1: the
Boards panel is there in all 33 captures; no menu, browser, rename field,
confirm or name sheet can be reached (33 "could not act"); no trigger or
save status; the notice above the board is missing after the open that
never happens; and in `kept`, no banner, no "Name not saved", and no
rename sent. The ten earlier states account for 183 of them, as they did
against `08b0d22` and `a57a5cd` (`fc3a409f…0a0f`, `decd8431…9627`).

**Bundle provenance.** `npm ci` into the worktree's own `node_modules`, a
real directory, not a symlink: webpack's production module ids come from
file paths. Then `npm run build`, which empties `dist/` first and runs
`verify:bundle`. Each base was built from an export of its commit whose
`node_modules` is a link to this worktree's, as 5A.1's was.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The Lightbox's requests are answered from recordings, so a state shows
  the host's answers as they were made, not a live host. No delete, and
  no rename but `kept`'s (answered from its recording), is sent from the
  page; both routes are covered by `LightboxBoardsBrowser.test.ts` and
  `LightboxBoardRenames.test.ts`.
- The system picker behind "Open a board file…" is VS Code's own dialog
  and cannot be captured; the harness plays its answer.
- Two windows saving one board (the fallback to a new file) has no visual
  state; `LightboxBoardStoreInPlace.test.ts` and
  `LightboxBoardsBrowser.test.ts` cover it.

## Rerunning it

Build the bundle and copy it out:

```sh
npm ci
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js $DIR/webview.js
```

Render the Lightbox states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js $DIR/webview.js $DIR/visual
```

and the Workshop's, with a base bundle built the same way from
`epic/lightbox` at `fcf86ff`:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node workshop-harness.js $DIR/webview.js $BASE/webview.js $DIR/visual
python3 -I workshop-compare.py $DIR/visual
```

(`PLAYWRIGHT_MODULE` names Playwright's folder when it is not installed
where the harnesses look.) Then copy `$DIR/visual/lightbox-*.png` into
`lightbox/`, `$DIR/visual/workshop/*.png` into `workshop/`, and the facts
and errors files here.

To rebuild `states/`:
1. Copy `tools/build-boards.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-boards.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

To compare the Workshop's markup alone: copy
`tools/workshopMarkupParity.test.tsx` into `packages/core/src/__tests__/`
of each tree, run it there with `WORKSHOP_PARITY_OUT=$DIR/base.json` (or
`head.json`) `npx jest <the copy>`, delete the copies, and run
`node tools/workshop-markup-compare.js $DIR`.

`$DIR` defaults to `/tmp/lightbox-5a2`; keep it outside the repository. No
fixture file is needed: the text is the worked examples'.
