# Lightbox Slice 5A visual evidence: saved boards

Lightbox Slice 5A saves boards as files and brings them back:
- a board saves itself when it is first measured and after each reading
  run, one file per save, under `prose-minion/boards/`, in a folder of its
  source's own (`<source-slug>-<source-hash>/`);
- the rail's **Boards** section lists the boards saved from the source on
  screen, newest first, and opens or deletes one; past twenty it shows the
  newest twenty, says how many there are, and offers **Show older**;
- a board opened from a file says whether the file still holds its text,
  and offers **Read the current text** when it does not;
- with no folder open, or several, boards are kept for the session only,
  and the rail says so;
- a board saved under another citation rule opens whole: only its Opinion
  loses standing (the writer-data rule).

This folder shows each of those from real host output, at 1440, 1000 and
500 px. The harness is adapted from
[`../lightbox-slice-4f-visual/`](../lightbox-slice-4f-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: nine states, scrolled to the Boards section (to its end for `history` and `history-older`), or to the Opinion for `earlier-rule` |
| `states/boards.json` | The host's messages and answers for each state: the board a mount gets, the shelf the rail's mount request gets, each board's shelf, the estimate, the host's answer to each Open (the opened board, then its shelf), and to Read the current text (the re-read board, then the save it pushed) |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, answers the tab's own requests with the host's recorded answers (echoing each request's id), acts as the writer would, takes each screenshot once two consecutive frames match, and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `facts.json` | What each state's page showed, read from the DOM: the Boards section's head, its rows as text, which row is marked on screen, the snapshot note, the page note and its Show older button, the confirm step and where focus is, the source line in the header, stale notes on the board, the Opinion's stale note and its Bring, the rail's requests, horizontal overflow, and whether any saved webview state named a board file |
| `errors.txt` | Every page error, console error, and failed expectation, one per line. It is empty for this run |
| `tools/build-boards.test.ts` | How `states/` was made |

### States

- **`rail`.** The chapter boarded, read with groups A and B's lenses only,
  then read for the rest. Three files: "Oct 22, 2026, 2:07 PM · Every lens
  read · ≈ $0.07", marked **On screen**; "2:06 PM · 8 lenses read · ≈
  $0.02"; "2:05 PM · Measured only". The head says "3 saved". The caption
  says where they are and that nothing is deleted unless the writer deletes
  it.
- **`opened`.** **Open** pressed on the oldest. The board on screen is the
  measured board, exactly as saved: no readings. The 2:05 PM row is marked
  On screen, and the note says "Opened from the board saved Oct 22, 2026,
  2:05 PM. The file still holds the text it was read from."
- **`changed`.** The chapter changed on disk (one closing line added), then
  the 2:06 PM board opened. The note turns amber: "The file has changed
  since. This board shows the text as it was saved, and holds back Bring
  until you read the current text.", with **Read the current text**.
- **`read-current`.** That button pressed. The header says 519 words; the
  board's eight read lenses came along marked stale (seven stale notes on
  the board, "8 lenses stale" on the run line). The new text saved itself:
  "2:08 PM · 8 lenses read · 8 stale · ≈ $0.02", On screen, at the top of
  four.
- **`delete-confirm`.** The oldest row's delete pressed. The row asks
  "Delete this file?" with **Delete** and **Keep**, and focus is on Keep.
  The group is labelled "Delete the board saved Oct 22, 2026, 2:05 PM?".
- **`session-only`.** The same chapter boarded and read in a window with no
  folder open. The head says "this session", and the section says "Boards
  are kept for this session only: no folder is open. Open one folder to save
  them." No list, no caption.
- **`earlier-rule`.** The writer-data rule: a saved board only ever loses
  standing, never the board. A third workspace boarded and read the
  chapter; its read file was then rewritten as a build with another
  citation rule would have saved it (`rules.opinionBasis` set to a
  synthetic id, `rendered-text-2026-10-21`), and a reload restored it. The
  board opens whole: "2 saved", the 2:06 PM row On screen, the quiet note.
  The Opinion says "Stale Saved under an earlier citation rule; read the
  Opinion again to bring it current.", and its Bring is held with the same
  words. Every other tile is as saved.
- **`history`** (PR #163 F-04). A fourth workspace boarded the chapter
  and read it 22 times: 23 files of one source. The head says "23 saved";
  the rail shows the newest twenty, 2:27 PM (On screen) back to 2:08 PM,
  then "Showing the newest 20 of 23." and **Show 3 older**. Each read of
  every lens records $0.07, and a board's cost is what its readings
  recorded, so the rows run from "≈ $1.54" down to "≈ $0.21".
- **`history-older`.** **Show 3 older** pressed: all 23 rows, down to
  2:05 PM "Measured only", and no page note.

### How the states were made

`tools/build-boards.test.ts` drives the production pieces through
`lightboxBoardsHarness`:
- `LightboxHandler`, boarding the file and re-reading it;
- `LightboxReadingHandler` and `LightboxReadingRunner`, pricing and running
  the two presses;
- `LightboxBoardsHandler` and `LightboxBoardLibrary`, answering the rail,
  opening and saving;
- `LightboxBoardStore` over a memory file system that holds the chapter and
  the boards folder, so changing the chapter on disk is writing it.

What it checks along the way:
- **The files.** Three files after the two presses, then a fourth after
  Read the current text, by name, in
  `drafts-alice-1-md-9b099095/` (the slug, then the first eight hex digits
  of the SHA-256 of `file:Drafts/alice-1.md`); none in the session-only
  window; 23 in the `history` workspace, every one in its shelf.
- **The restore.** The reloaded workspace's board carries the synthetic
  basis id.
- **The log.** No log line carries the chapter's words: each paragraph's
  first 40 characters are absent from `log.txt`. File ids, counts and
  paths are allowed.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain: the worked examples'
excerpt. The added closing line was written for this evidence.

**The model is a stub,** `provider/model-v1`, with a 200,000-token window
and stub prices of $3 and $15 per million input and output tokens. Each
group answers with its worked example, and group F with the test harness's
stand-in Opinion. Each recorded call costs $0.01. No provider was called.

**Times** are shown in UTC: the harness pins the page's zone, and the store
saved at 14:05:09.123Z and one minute apart after that.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- Each state is scrolled to the Boards section, so the source card above it
  is out of view at every width.
- The rail's requests are answered from recordings, so a state shows the
  host's answers as they were made, not a live host.

## Results

From the committed `facts.json`, rendered from the bundle a clean
`npm run build` writes at this branch's head (`webview.js` SHA-256
`acfc8891e8225b5a8f96b4411d24fda3819c598e41b03610b15ca3c490321423`).

**Re-rendered for the re-review's F-05 and N-03 (2026-10-22).** Each shelf
now also names its observation; with that removed, `states/boards.json`
holds exactly what it held at `f3808b4`, and `log.txt` is unchanged. From
`webview.js` `acfc8891…`: 27 captures, `errors.txt` empty, DOM facts the
same apart from request-id prefixes, and every PNG the same in pixels as
the committed one (26 byte-identical, one differing in encoded bytes
only), so the committed PNGs stand. No state here exercises F-05 or N-03:
their tests do (`LightboxBoardAdoptions`, `useLightboxBoards`,
`LightboxBoardsPanel`).

**Re-rendered for PR #163's corrections (2026-10-22),** at `f3808b4`, from
`webview.js` `59b1f612…`. The host states were rebuilt: file ids now name
the source's hashed folder, and each shelf names its board's adoption.
With those two mapped back, the five earlier states' messages, estimates
included, are identical to the ones built at `bc1fdda`. At that head the
21 earlier captures are byte-identical to the
ones rendered from `c7e47504…`, and their DOM facts are the same apart
from the webview's random request-id prefixes and the folder names in the
rail's Open requests. A second render gave the same pixels in all 27 (two
PNGs differ in their encoded bytes only). `history` and `history-older`
are new.

**Re-rendered for the writer-data rule (2026-10-22).** The first render
used the bundle at `dc9280c` (`b2d0afec…`). At `bc1fdda`, the six earlier
states give the same DOM facts, apart from the webview's random request-id
prefixes. Fifteen of their 18 PNGs are byte-identical; three differ in 15
to 59 pixels, no channel by more than two levels: rendering noise.
`earlier-rule` is new.

**Bundle provenance.** `npm ci` into the worktree's own `node_modules`, a
real directory, not a symlink: webpack's production module ids come from
file paths. Then `npm run build`, which empties `dist/` first and runs
`verify:bundle`. Building again at the head gave the same hash.

| State | What the page shows (the same at 1440, 1000 and 500 px) |
|---|---|
| `rail` | "3 saved"; rows 2:07 PM (On screen), 2:06 PM, 2:05 PM; no note |
| `opened` | 2:05 PM On screen; the quiet note, "The file still holds the text it was read from." |
| `changed` | 2:06 PM On screen; the amber note with Read the current text |
| `read-current` | "4 saved"; 2:08 PM "8 lenses read · 8 stale · ≈ $0.02" On screen; header "Drafts/alice-1.md · 519 words"; 7 stale notes |
| `delete-confirm` | The confirm group on the 2:05 PM row; focus on Keep |
| `session-only` | "this session"; the session-only sentence; no rows |
| `earlier-rule` | "2 saved"; 2:06 PM On screen; the quiet note; the Opinion "Stale Saved under an earlier citation rule; read the Opinion again to bring it current."; its Bring disabled with the same words |
| `history` | "23 saved"; 20 rows, 2:27 PM (On screen) to 2:08 PM; "Showing the newest 20 of 23." and Show 3 older |
| `history-older` | "23 saved"; all 23 rows, to 2:05 PM "Measured only"; no page note |

Across all 27 captures:
- no horizontal overflow;
- no saved webview state named a board file (8 to 14 states saved per
  capture);
- the rail asked for its shelf once on mount, naming no board, and not
  again when that board arrived; Open and Read the current text each
  posted once;
- no page error;
- `errors.txt` is empty.

**The harness fails rather than skips.**
- Against the base bundle (`epic/lightbox` at `3e6a156`, built from an
  export of that commit whose `node_modules` is a link to this worktree's;
  `376221326996…577f`), it wrote 129 errors and exited 1: every state
  reported its missing Boards section, and every Open or Read the current
  text could not be pressed.
- Against the bundle at `dc9280c` (`b2d0afec…`), before the writer-data
  rule, it wrote 3 errors and exited 1, one per width, all `earlier-rule`:
  the Opinion showed no stale note, and its Bring said only that it cites
  no quote. Every other state passed.
- Against the bundle at `bc1fdda`, before PR #163's corrections (built
  from an export of that commit, as for the base; `6a1db797…`), it wrote 9
  errors and exited 1, three per width, all `history`: the rail showed all
  23 rows with no page note, and had no Show older to press. Every other
  state passed.

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

Then copy `$DIR/visual/lightbox-*.png` into `lightbox/`, and `facts.json`
and `errors.txt` here.

To rebuild `states/`:
1. Copy `tools/build-boards.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-boards.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

`$DIR` defaults to `/tmp/lightbox-5a`; keep it outside the repository. No
fixture file is needed: the text is the worked examples'.
