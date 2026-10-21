# Lightbox Slice 4E visual evidence: reading aids in the inspector

Lightbox Slice 4E adds three reading aids, all measured by code with no
model call:
- a pinned paragraph's whole text;
- the sentences a counted item stands in;
- the hapax list under the Top Words cloud.

The inspector asks the host for the text by board id and content hash
(`LIGHTBOX_REQUEST_PASSAGE`, `LIGHTBOX_PASSAGE`). Each instance is found by
the rule that made the figure it shows, so the number lit is the number the
board counts.

This folder shows each aid from real host output, at 1440, 1000 and 500 px.
The harness is adapted from
[`../lightbox-slice-4d-visual/`](../lightbox-slice-4d-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: nine states |
| `states/chapter.json` | The host's messages and answers. `idle` is Chapter I's board, `changed` its board after an edit, and `book` the whole book's board. `estimates` holds the host's estimate answers, which the harness gives the tab's own estimate requests, echoing each request's id (PR #149 F-03). `passages` holds the host's answers to each passage the states ask for, keyed by board id and item, without the request id the harness echoes. `items` holds what the states pin |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox behind a stubbed VS Code API, replays each state's messages, and acts as the writer would. It answers each passage request from `passages`, takes each screenshot once two consecutive frames match, and writes `facts.json` and `errors.txt` |
| `facts.json` | What each state's page showed, read from the DOM by `harness.js`. This covers the inspector, the well, the hapax list, the two word panels' boxes, the style flags, the run line, the passage requests, horizontal overflow, and whether any saved webview state held a well's text |
| `errors.txt` | Every page error, console error, and failed expectation, one per line. It is empty for this run |
| `tools/build-passages.test.ts` | How `states/` was made |

### States

- **`paragraph`.** ¶11, the chapter's longest paragraph (980 characters),
  pinned on the ribbon. "The text · as counted" shows the whole
  paragraph in a well that scrolls inside the inspector. Nothing is lit,
  since nothing brought the writer there but the paragraph. The claim
  reads "191 words in 17 sentences · 11.2 words per sentence · 44%
  dialogue."
- **`word`.** The top word "alice" pinned from the cloud. At the bottom of
  the inspector: "Sentences · 27 instances in 26 sentences", with 26 rows,
  each with its ¶ address. All 27 instances are lit. The board counts
  "alice ×27".
- **`paragraph-lit`.** The first row's address, ¶2, pressed from that well.
  The paragraph opens with both of its "Alice"s lit, "Lit: “alice”, 2
  instances here.", and "← Back to “alice”".
- **`pos`.** The verb "was" (×53, from the tagger): 53 instances lit in 32
  sentences.
- **`phrase`.** The repeated phrase "she had" (×8): 8 instances lit in 6
  sentences.
- **`flag`.** The style flag Weak Verbs (119): 119 instances lit in 48
  sentences.
  - Weak Verbs, Filler Words, Adverbs (-ly words) and Passive Voice are
    buttons.
  - Repetitive Words stays a plain count: it counts the words that repeat,
    not instances.
- **`hapax`.**
  - **The list.** It sits under the cloud: "Used once · 340 words, in
    order of appearance". The stats row says "340 hapax · 15.9%". The
    first page holds 300 words, then "Show 40 more · 40 not shown yet".
  - **Its size.** At 1440 px the well fills the panel's spare height
    beside Parts of speech: the two panels are 826 px each, and the well
    is 495 px. Stacked, at 1000 and 500 px, it keeps its own 174 px.
  - **One word pinned.** "MARMALADE" is pinned, as the text writes it, and
    its one sentence is lit.
- **`changed`.** ¶11 pinned, then the chapter edited ("soon began talking
  again" became "soon began counting stars") and re-read, so the tab gets
  a new board. The harness holds the host's answer for the new board.
  - The well says "The text changed since this was shown. Reading it
    again from the board as it stands…".
  - None of the older text is shown.
  - The new board's request was posted (`held` in `facts.json`).
- **`bounded`.** The whole book (26,448 words, 815 paragraphs) with "alice"
  (×385) pinned.
  - Header: "385 instances in 378 sentences".
  - The well lists its 50-row bound, with 51 instances lit (one row holds
    two).
  - "The well lists up to 50 rows: 328 more sentences with 334 instances
    are not listed." 51 + 334 = 385.

### How the states were made

`tools/build-passages.test.ts` drives the production pieces:
- `LightboxService`, over the real measurement services;
- `LightboxHandler`, boarding each file and re-reading it;
- `LightboxReadingHandler` and `LightboxReadingRunner`, for the estimate
  only. Nothing is read: the engine is never asked;
- `LightboxPassageHandler`, answering each passage.

What it checks along the way:
- **The cost line.** Passage requests leave the press's estimate key
  unchanged. The run line reads "6 calls · est. $0.44 · the Opinion up to
  its digest bound" in every state.
- **The log.** No log line carries the chapter's words. File names are
  allowed: "chapter" is in `alice-chapter-1.md`.

**Source text.** Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), and the whole book, are public domain.
- They come from the Project Gutenberg text (EBook #11, SHA-256
  `f00b287e…0752`), taken from the `wordcloud` 1.9.3 sdist as the Slice 2A
  evidence took it.
- They were cut by `../lightbox-slice-2a-visual/tools/alice_chapter.py`.
  Chapter I came out byte-identical to the Slice 2A fixture (SHA-256
  `52801900…1088`).
- The three words of the edit were written for this evidence.

**The model is a stub,** `provider/reader-model`, with a 200,000-token
window and stub prices of $3 and $15 per million input and output tokens.
No provider was called.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- At 1000 and 500 px the inspector is not beside the board: it is in the
  left column at 1000 and stacked at 500. So the inspector states are
  scrolled to the inspector, and the `hapax` state to the Top Words panel.
- **The board's sentence rule.** A sentence ends at its `.`, `!` or `?`. A
  closing quotation mark after that ender starts the next sentence. So a
  row can begin with "”" (the third row of `word`), and ¶2 reads "2
  sentences". The well uses this rule on purpose, so its sentences are the
  ones the board counts. This is recorded as
  [tech debt](../../../../.todo/tech-debt/2026-10-21-prose-sentences-closing-quote.md).

## Results

From the committed `facts.json`, rendered from the bundle a clean
`npm run build` writes at this branch's head (`webview.js` SHA-256
`8d0545decad8bf1e8dac296798ff57343abbb502b6228b5f1148db4c03262a61`).

**Bundle provenance.** The bundle was built from an empty `dist/`, after
`npm ci` into the worktree's own `node_modules`. That is a real directory,
not a symlink: webpack's production module ids come from file paths.
Building twice gave the same hash. The base, `20775cf`, rebuilt the same
way, gives `0f6624f4…`, the hash Slice 4D recorded.

| State | What the page shows (1440 px; the same at 1000 and 500) |
|---|---|
| `paragraph` | Well "Text of ¶11", `role=region`, `tabindex=0`, `aria-live=off`. 318 px tall and scrolling. 0 lit |
| `word` | "Sentences · 27 instances in 26 sentences". 26 rows, 27 lit, matching the board's "alice ×27". 378 px tall and scrolling |
| `paragraph-lit` | "Text of ¶2", 2 lit, "Lit: “alice”, 2 instances here.", "← Back to “alice”" |
| `pos` | "Sentences · 53 instances in 32 sentences". 53 lit, matching "was 53" |
| `phrase` | "Sentences · 8 instances in 6 sentences". 8 lit, matching "she had ×8" |
| `flag` | "Sentences · 119 instances in 48 sentences". 119 lit, matching "Weak Verbs 119". Flags: four buttons, and Repetitive Words a span |
| `hapax` | Hapax list: 300 of 340 words shown, matching "340 hapax · 15.9%". "Sentences · 1 instance in 1 sentence" for "MARMALADE" |
| `changed` | The "text changed" note, no well, and the new board's request held |
| `bounded` | "385 instances in 378 sentences". 50 rows and 51 lit, with 334 past the bound stated |

Across all 27 captures:
- no horizontal overflow;
- no saved webview state held a well's text: 10 to 16 states saved per
  capture, none with any well's text;
- no page error;
- every recorded answer was found;
- `errors.txt` is empty.

**The harness fails rather than skips.** Run against the base bundle
(`0f6624f4…`), it wrote 120 errors and exited 1. Every state reported its
missing well and hapax list.

## Rerunning it

Build the bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js $DIR/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js $DIR/webview.js $DIR/visual
```

Then copy `$DIR/visual/lightbox-*.png` into `lightbox/`, and `facts.json`
and `errors.txt` here. The process exits 1 if `errors.txt` is not empty.

To rebuild `states/`:
1. Extract `examples/alice.txt` from the `wordcloud` 1.9.3 sdist into
   `$DIR/download/alice/`.
2. For each chapter `n` from 1 to 12, run
   `python3 -I ../lightbox-slice-2a-visual/tools/alice_chapter.py $DIR/download/alice/alice.txt $DIR/fixtures/alice-chapter-$n.md $n`.
3. Copy `tools/build-passages.test.ts` into `packages/core/src/__tests__/`.
4. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-passages.test.ts`.
5. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
6. Copy `$DIR/states/*` here.

Keep `$DIR` outside the repository.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
