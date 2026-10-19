# Lightbox Slice 2B visual evidence: first readings

Lightbox Slice 2B adds the first readings: the three grouped calls, the run
line, the reading tiles, the tension lane and the inspector's evidence. This
folder shows the reading states from real host output. The harness is adapted
from [`../lightbox-slice-2a-visual/`](../lightbox-slice-2a-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's messages for Chapter I: `idle`, then what `running` adds, then what `done` adds |
| `states/book.json` | The host's messages for the whole book against a 32,768-token window (`too-large`) |
| `harness.js` | Renders a built `webview.js` as the Lightbox surface behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, and writes `facts.json` (run line, press, reason, skeletons, tension cells, inspector evidence, layout boxes, horizontal overflow, what the tab posted) |
| `tools/build-readings.test.ts` | How `states/` was made |

**States:**
- `idle`: Chapter I on the board, lenses synced, the estimate on the press,
  and one context file (`Notes/cast.md`, 30 words) added from the rail.
- `running`: Read pressed. Group A (headline, motifs, tension) is back; the
  characters, voice and genre tiles are still skeletons; Stop is offered.
  Shown with the board's own **Read** filter, so the readings sit under the
  ribbon instead of below the counted tiles.
- `done`: every group back, **Read** filter, the motif "Going down" pinned.
  At 1440 the inspector sits beside the board. At 1000 and 500 it stacks
  under the rail or the board, so `done-inspector` scrolls it into view.
- `too-large`: the whole book (26,448 words, 815 paragraphs) against a
  32,768-token window. The press is disabled with its reason.

**How the states were made.** `tools/build-readings.test.ts` drives the
production `LightboxService`, `LightboxReadingHandler`,
`LightboxReadingRunner`, prompt builder, codec, quote verifier, term counter
and context shelf, and records every message the host posted. The real prompt
bundle is loaded from `packages/core/resources/system-prompts/lightbox/`, so
the token estimates are the host's own. Only the provider is played: a
stubbed engine holds each group's call open and answers it on cue. No
provider was called.

- **Groups B and C** answer with the prompt bundle's worked examples,
  verbatim. They read ¶1–¶8 of this same chapter, so every quote they cite is
  checked against the real chapter's paragraphs.
- **Group A** answers with its worked example, changed in three ways, all
  hand-written for this evidence: the tension arc scores all 31 columns (the
  example scores eight; ¶9–¶31 are scored by hand), the tension claim is
  rewritten for the whole chapter with a third peak at ¶24, and one quote of
  the "Going down" motif is paraphrased on purpose ("and then it dropped
  straight down", cited as ¶6) so the verifier has something to withhold.
- **The model is a stub.** It is named `provider/reader-model`, with a
  200,000-token window (32,768 for `too-large`) and stub prices of $3 and $15
  per million input and output tokens. The costs on screen come from those
  prices, not from any real model.

**Source text.** Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), public domain, prepared exactly as for Slice 2A (see that
README for where the text came from and why its dialogue is set in curly
double quotes). Boards use the Middle Grade publishing-standards preset.

**Limitation:** this is headless Chromium, not the VS Code webview host.
Theme variables are stubbed, and fonts come from the system.

## Results

From `facts.json` of the final run:

| State | 1440 | 1000 | 500 |
|---|---|---|---|
| Layout | rail 300 · main 800 · inspector 307 | rail and inspector share a 280 px left column; main 720 | everything stacks |
| `idle` | press "Read the chapter", enabled, "3 calls · est. $0.12"; 4 "Not read yet" placeholders; context list shows `Notes/cast.md` | same | same |
| `running` | "Reading… 1 of 3 lens groups back" with Stop; headline, 3 motifs and a 31-cell tension lane drawn; 3 skeletons (characters, voice, genre) | same | same |
| `done` | "25 quotes checked · 1 withheld · 3 calls", "Re-read · 3 calls · est. $0.12"; no skeletons; inspector "Going down": 2 quotes found verbatim (¶5, ¶8), 1 withheld (¶6), friction, "Re-read this tile · 1 call · est. $0.03" | same, inspector in `done-inspector` | same, inspector in `done-inspector` |
| `too-large` | "Read the chapter" disabled, `aria-describedby="pm-lb-run-reason"`; warning "Book-sized: 26,448 words"; reason "Group A would send about 45,210 tokens and reserve 8,000 for the reply, more than provider/reader-model's 32,768-token window allows. With these lenses, about 12,100 words of chapter would fit. …" | same | same |
| Horizontal overflow | none | none | none |

- No page errors in any state or width.
- The withheld quote is shown by its reason only ("Not found in the chapter:
  a paraphrase, or words from somewhere else. Only the chapter can be
  quoted."), never with the paraphrase itself.
- The estimate with the context file is A 7,293, B 7,020 and C 6,627 input
  tokens, each reserving 8,000 for its reply; without it, 82–83 tokens less per
  call. Context words count toward the estimate and never toward evidence.
- On mount the tab posted `request_account_balance`, `request_model_data`,
  `request_api_key` and `lightbox_request_board` as before, then
  `lightbox_set_lenses` three times: on mount, when the board arrived and
  when the model list arrived (each asks the host for a fresh estimate; none
  calls a provider).
- Two runs of the harness against the same bundle: 11 of 14 shots
  pixel-identical; the other three differ in at most 28 pixels by 1/255
  (anti-aliasing).
- At 1440, `done` and its inspector shot were byte-identical, so only the
  stacked widths keep a `done-inspector` shot.

## Rerunning it

Build the bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/lightbox-2b/head-webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js /tmp/lightbox-2b/head-webview.js /tmp/lightbox-2b/visual
```

To rebuild `states/`: make `$DIR/fixtures/alice-chapter-<n>.md` (n = 1–12)
with `../lightbox-slice-2a-visual/tools/alice_chapter.py` as that README
describes, copy `tools/build-readings.test.ts` into
`packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-readings.test.ts`,
delete the copy, and copy `$DIR/states/*.json` here. `$DIR` defaults to
`/tmp/lightbox-2b`; keep it outside the repository.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
