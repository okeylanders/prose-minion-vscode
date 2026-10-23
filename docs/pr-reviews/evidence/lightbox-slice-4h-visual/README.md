# Lightbox Slice 4H visual evidence: reading tolerance

Lightbox Slice 4H changes what the host does with a reply (epic decisions
37–40):
- a field longer than its prompt asks for, and a list with more items than
  asked, are **shown**, never withheld; one safety ceiling clips a runaway
  field with an ellipsis;
- a reply cut off at the output ceiling is **salvaged**: the blocks it
  finished are read, and the block it was cut inside is withheld with the
  host's reason and where the paid reply was saved.

This folder shows the board those replies make, from real host output, at
1440, 1000 and 500 px, and checks that the webview lays out every overrun
whole, with no horizontal overflow, no clipped button and no reading text
cut or run past its box. The harness is adapted from
[`../lightbox-slice-5a1-visual/`](../lightbox-slice-5a1-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: five states, each scrolled to the part of the board it is about, under the sticky ribbon |
| `states/tolerance.json` | The host's messages and answers for the two boards: the board a mount gets, the shelf the rail's requests get, and the estimate |
| `states/log.txt` | Every line the host logged while the boards were read, including `Group A clipped 1 field at the safety ceiling`, `Group E repaired: …` and `Group E reached the output ceiling: 3 blocks finished, cut inside summary` |
| `states/before-a57a5cd.txt` | The same replies read through `epic/lightbox`'s codec at `a57a5cd`, the base of this slice: what each group withheld there |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, answers the rail's and estimate's requests with the host's recorded answers, pins a motif as the writer would, takes each screenshot once two consecutive frames match, and writes `facts.json` and `errors.txt`. It exits 1 when any state is wrong |
| `facts.json` | What each capture measured, from the DOM: the width of the part of the board the state is about, the cards and quotes it drew, how much text it showed and how many of the board's texts it showed whole, the ribbon's lane notes, the withheld block's words, any text cut by its own box or past the part's right edge, horizontal overflow, and clipped buttons. The board's own text stays in `states/` |
| `errors.txt` | Every page error, console error and failed expectation, one per line. It is empty for this run |
| `errors-a57a5cd.txt` | The same harness against the base bundle (see Results) |
| `tools/build-tolerance.test.ts` | How `states/` was made |

### The two boards

- **`overrun`** (decision 37). Every group answers with its worked example,
  edited past its asks with sentences written for this evidence:
  - six motifs where four are asked; the first with a 102-character title
    (asked 80), a 414-character gist (asked 160), a 1,022-character claim
    (asked 400) and six quotes (asked 3);
  - one runaway gist, past eight times its ask, clipped by the safety
    ceiling at 1,279 characters with an ellipsis (the motif "Pictures and
    conversations");
  - a 346-character headline sentence (asked 160);
  - the template's description at 664 characters (asked 400) and, the
    writer's case, its freshness note at 529 (asked 160, and 120 before
    this slice); eight beats (asked 6), eight threads (asked 6);
  - five sparks (asked 4), one question at 675 characters (asked 300);
  - more subtext pairs, genre neighbours, echoes and handoffs than asked.

  Nothing is withheld for any of it. The board withholds exactly what the
  worked examples' own replies withhold on it (two numbers readings whose
  figures the board did not measure as standing out), which the builder
  checks against a third, unedited run.
- **`salvaged`** (decision 40). Group E's reply is cut off at the output
  ceiling 120 characters into its summary block (`finishReason:
  "length"`); every other group answers with its worked example. Template,
  pressure and artifacts are read; Summary & movements is withheld with
  "The reply reached the output ceiling before this block finished.
  Complete response saved for recovery at /workspace/prose-minion/recovery/
  model-responses/…response.txt.", the real recovery store's file over the
  memory file system. Engagement, which sits on the movements, is withheld
  by its existing rule.

### States

| State | Board | What the page must show, read from the host's board |
|---|---|---|
| `overrun-motifs` | `overrun` | The Motifs section: six cards, every title and gist whole, the clipped gist ending in its ellipsis |
| `overrun-pinned` | `overrun` | The six-quote motif pinned: the inspector shows its title, its claim and all six quotes whole |
| `overrun-template` | `overrun` | Template & freshness: the name, the description, the freshness note and all eight beats whole |
| `overrun-sparks` | `overrun` | The Spark lane: five sparks, every title and question whole |
| `salvaged-summary` | `salvaged` | Summary & movements: one withheld block, its words exactly the host's reason; the ribbon's Movements lane says "The movements were withheld: Summary & movements says why."; Template & freshness still drawn |

### How the states were made

`tools/build-tolerance.test.ts` drives the production pieces through
`lightboxBoardsHarness`, which this slice lets take a recovery store:
- `LightboxHandler`, boarding the file;
- `LightboxReadingHandler` and `LightboxReadingRunner`, pricing and
  running the press, through the reading codec, the shared model-JSON
  parser (`@parsers/ModelJsonRepair`), the quote verifier and the term
  counter;
- `LightboxBoardsHandler` and `LightboxBoardLibrary`, answering the rail;
- `LightboxBoardStore` and `RejectedModelResponseRecoveryStore` over a
  memory file system.

What it checks along the way: every group reads; six motifs, one clipped at
the ceiling and none past it; six quotes on one motif; eight beats; more
threads and sparks than asked; the clip and the salvage logged; group E's
cut block withheld with the host's reason and the recovery file on disk;
and no log line carrying the chapter's words or the evidence's sentences.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain: the worked examples'
excerpt. The lengthening sentences were written for this evidence.

**The models are stubs:** each group answers with its worked example,
edited as above, and group F with the test harness's stand-in Opinion; the
provider-reported model is the placeholder `provider/model-v1`. No provider
was called.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The recovery file's name carries a random id, so a rebuild of `states/`
  changes it and nothing else.
- Designed single-line labels (the ribbon's lane captions) end in an
  ellipsis by design; they are outside the parts of the board measured
  here, and the full text is in the inspector.

## Results

From the committed `facts.json`, rendered from the bundle a clean
`npm run build` writes at this branch's code (`webview.js` SHA-256
`405f6cd140d856df49e48f46608b20dbe86bbce75c48b84fa3e0db9b327fbf5d`).

| State | What the page shows (the same at 1440, 1000 and 500 px) |
|---|---|
| `overrun-motifs` | Six motif cards, all twelve titles and gists whole, the clipped gist ending "…" |
| `overrun-pinned` | The inspector: the 102-character title, the 1,022-character claim and six quotes, each "found verbatim" |
| `overrun-template` | The template, its 664-character description, the 529-character freshness note and eight beats |
| `overrun-sparks` | Five sparks, the 675-character question whole, each with its Bring and Not for me |
| `salvaged-summary` | The withheld block with the host's reason and the recovery path, wrapped inside its box at 500 px; the ribbon's note; the template drawn below |

Across all 15 captures:
- every text the state is about is shown whole;
- no text is cut by its own box, and none runs past the part of the board
  it belongs to;
- no horizontal overflow, and no button runs past the box that clips it;
- no page error;
- `errors.txt` is empty.

Two renders gave byte-identical screenshots and `facts.json`.

**The checks are not vacuous.** With a two-line clamp injected on a motif's
gist and `white-space: nowrap` on the withheld block, the same harness wrote
6 errors and exited 1: the gists "cut by its box" in `overrun-motifs`, and
the withheld block "past its box" in `salvaged-summary`, at every width.

**The webview needed no layout change** for the longer text: it already
wraps every reading field. The one webview change is the ribbon's Movements
lane, which said "The movements were withheld: they did not tile the
chapter." whenever no movements were drawn. With the summary block withheld
by a cut-off (or a format fault), that named the wrong cause; it now says
"The movements were withheld: Summary & movements says why.", and keeps the
tiling wording for a tiling fault (`lightboxPlot.test.ts`).

**The harness fails rather than skips.** Against the base bundle
(`epic/lightbox` at `a57a5cd`, built from an export of that commit whose
`node_modules` is a link to this worktree's; `webview.js`
`9b6fe44e987199f13b6e4de2239caddde3241629511af22073eab4c1846d3085`), it
wrote 3 errors and exited 1 (`errors-a57a5cd.txt`): in `salvaged-summary`,
at each width, the ribbon said the movements "did not tile the chapter".
The overrun states lay out the same there, since a board's layout is the
webview's and the tolerance is the host's.

**Before: the same replies at `a57a5cd`'s host** (`states/before-a57a5cd.txt`,
read through that commit's codec). Ten blocks were withheld across groups
A–E for lengths and counts alone: headline and motifs (A), voice and
subtext (B), genre and spark (C), stock and rhythm (D), template and
pressure (E), each "broke the format: … must be a string of at most N
characters" or "an array of at most N …". The cut reply failed group E
whole: "The group E response must contain exactly one
===END_LIGHTBOX_GROUP_E_V1===".

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
1. Copy `tools/build-tolerance.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-tolerance.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here. `$DIR/replies.json` holds the edited replies,
   for reading them through another commit's codec; it is not committed.

`$DIR` defaults to `/tmp/lightbox-4h`; keep it outside the repository. No
fixture file is needed: the text is the worked examples'.
