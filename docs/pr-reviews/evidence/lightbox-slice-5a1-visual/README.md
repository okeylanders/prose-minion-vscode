# Lightbox Slice 5A.1 visual evidence: board names and the writer's calls

Lightbox Slice 5A.1 builds the writer's four calls on saved boards (epic
decisions 33–36):
- a saved board may carry a **name**, shown first in its row with its date
  and time under it; every row names the **models** that read it; the
  Boards section's head names the board on screen, or says it is unnamed,
  with **Name** or **Rename**, and a name is edited in place;
- the **changed-file notice**, with **Read the current text**, also shows
  **above the board**, from the same shelf as the rail's;
- a **spark set aside saves at once**, rewriting the file that holds the
  board in place: no new file, no new row;
- stopped and partial runs keep saving (no change to show).

This folder shows the first three from real host output, at 1440, 1000 and
500 px. The harness is adapted from
[`../lightbox-slice-5a-visual/`](../lightbox-slice-5a-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: six states, scrolled to the Boards section, to the top of the board for `changed-board`, or to the Spark lane (under the sticky ribbon) for `spark` |
| `states/boards.json` | The host's messages and answers for each state: the board a mount gets, the shelf the rail's mount request gets, each board's shelf, the estimate, and the host's answer to the Open in `changed` (the opened board, then its shelf) |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, answers the tab's own requests with the host's recorded answers (echoing each request's id), acts as the writer would, takes each screenshot once two consecutive frames match, and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `facts.json` | What each state's page showed, read from the DOM: the Boards section's head (the board's name, its action and note), its rows as text, each row's model tooltip, which row is on screen, the rail's snapshot note, the notice above the board and whether it is first in the board's column, the name field (its label, value and focus), the Spark lane's set-aside line, the rail's requests, horizontal overflow, and whether any saved webview state named a board file or held a board's name |
| `errors.txt` | Every page error, console error, and failed expectation, one per line. It is empty for this run |
| `tools/build-boards.test.ts` | How `states/` was made |

### States

The names are made up for this evidence: "3.2.1 - after the cut - model B"
and "3.2.1 - before the cut - model A".

- **`named`** (decision 33). The chapter boarded (2:05 PM, measured only),
  read with groups A and B's lenses by `model-v1` (2:06 PM), then read for
  the rest by `model-b` (2:07 PM). The writer named the board on screen
  from the head, and the 2:06 PM row by its Rename: both files were
  rewritten in place, so the folder still holds three files. The head
  says "3.2.1 - after the cut - model B" with **Rename**. The rows: "3.2.1
  - after the cut - model B", "Oct 22, 2026, 2:07 PM", "Every lens read ·
  ≈ $0.07", "Read by model-v1 and model-b", On screen; "3.2.1 - before the
  cut - model A", "2:06 PM", "8 lenses read · ≈ $0.02", "Read by
  model-v1"; and "2:05 PM", "Measured only", with no model line, as 5A
  showed it.
- **`rename-open`.** The 2:06 PM row's Rename pressed: its name gives way to
  a field labelled "Name for the board saved Oct 22, 2026, 2:06 PM",
  focused, holding the row's name; the writer has typed "3.2.2 - before
  the cut - model A". Its actions step aside while the field is open, and
  nothing is sent until Enter.
- **`changed-board`** and **`changed-rail`** (decision 34). The chapter
  changed on disk (one closing line added), then the 2:06 PM board opened.
  The amber notice, "Opened from the board saved Oct 22, 2026, 2:06 PM.
  The file has changed since. …", with **Read the current text**, is the
  first thing in the board's column (`changed-board`) and at the head of
  the rail's Boards section (`changed-rail`), in the same words. The head
  names the opened board "3.2.1 - before the cut - model A".
- **`spark`** (decision 35). A spark set aside on the 2:07 PM board: the
  file that holds it was rewritten, still three files. A reload (a new host
  over the same files and memento) restored the board: the Spark lane says
  "1 spark set aside. Undo Brings back “The empty jar”.", the rail still
  lists three boards, and the restored board keeps its name.
- **`session-named`.** The chapter boarded, read and named in a window with
  no folder open. The head names it, and says "A name lasts as long as this
  session, as the board does."; no rows.

### How the states were made

`tools/build-boards.test.ts` drives the production pieces through
`lightboxBoardsHarness`:
- `LightboxHandler`, boarding the file;
- `LightboxReadingHandler` and `LightboxReadingRunner`, pricing and running
  the presses, and setting the spark aside;
- `LightboxBoardsHandler` and `LightboxBoardLibrary`, answering the rail,
  naming (`LIGHTBOX_RENAME_BOARD`), opening and saving;
- `LightboxBoardStore` over a memory file system that holds the chapter and
  the boards folder, so changing the chapter on disk is writing it.

What it checks along the way:
- **The files.** Three files after the two presses, by name, in
  `drafts-alice-1-md-9b099095/`, and still three after both renames and
  the spark; the 2:07 PM file holds the spark set aside; none in the
  session-only window.
- **The shelf.** The names and models each row carries, and the head's name.
- **The log.** No log line carries the chapter's words (each paragraph's
  first 40 characters are absent from `log.txt`) or a board's name.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain: the worked examples'
excerpt. The added closing line was written for this evidence.

**The models are stubs:** each group answers with its worked example, and
group F with the test harness's stand-in Opinion; the provider-reported
model is the placeholder `provider/model-v1` for the first press and
`provider/model-b` after. Each recorded call costs $0.01. No provider was
called.

**Times** are shown in UTC: the harness pins the page's zone, and the store
saved at 14:05:09.123Z and one minute apart after that.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The rail's requests are answered from recordings, so a state shows the
  host's answers as they were made, not a live host. No rename is sent from
  the page: the names were given through the host route when the states
  were built; the page shows them, and opens the field.
- Concurrency (two windows, a delete racing a rename) has no visual state;
  `LightboxBoardStoreRewrite.test.ts` and `LightboxBoardRenames.test.ts`
  cover it.

## Results

From the committed `facts.json`, rendered from the bundle a clean
`npm run build` writes at this branch's code (`webview.js` SHA-256
`427e81f8e4de8786eafca652702bbf378e8ea86c0109e30f7f2a38d30256ffaa`).

| State | What the page shows (the same at 1440, 1000 and 500 px) |
|---|---|
| `named` | "3 saved"; head "3.2.1 - after the cut - model B" with Rename; rows named, with "Read by model-v1 and model-b" and "Read by model-v1"; the measured row unnamed with no model line |
| `rename-open` | The 2:06 PM row's field, focused, labelled for its board, holding the typed name; no rename posted |
| `changed-board` | The amber notice first in the board's column, with Read the current text; the rail's note in the same words |
| `changed-rail` | The same, at the rail: 2:06 PM On screen; head "3.2.1 - before the cut - model A" |
| `spark` | "1 spark set aside. Undo Brings back “The empty jar”."; still "3 saved"; the quiet note of a restored board; its name in the head |
| `session-named` | "this session"; head named, "A name lasts as long as this session, as the board does."; no rows |

Across all 18 captures:
- no horizontal overflow;
- no saved webview state named a board file or held a board's name (8 to
  10 states saved per capture);
- no page error;
- `errors.txt` is empty.

A second render gave all 18 PNGs byte-identical.

**The harness fails rather than skips.** Against the base bundle
(`epic/lightbox` at `3e5c3a1`, built from an export of that commit whose
`node_modules` is a link to this worktree's; `71fc8bdb…04c2`), it wrote 51
errors and exited 1: the head was missing in all six states, every row
read as unnamed with no model line in the five with rows, the rename field
could not be opened (`rename-open`), and there was no notice above the
board (`changed-board`, `changed-rail`).

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
`lightbox/`, and `facts.json` and `errors.txt` here.

To rebuild `states/`:
1. Copy `tools/build-boards.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-boards.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

`$DIR` defaults to `/tmp/lightbox-5a1`; keep it outside the repository. No
fixture file is needed: the text is the worked examples'.
