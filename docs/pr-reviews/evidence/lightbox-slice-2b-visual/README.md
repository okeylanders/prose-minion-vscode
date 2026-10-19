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
| `states/chapter.json` | The host's messages for Chapter I: `idle`, then what `running` adds, then what `done` adds; and `estimates`, the host's estimate answers with every lens on and with the motif lens off |
| `states/withheld.json` | The host's messages for Chapter I read with group A's headline quoting nowhere in the chapter (`headline-withheld`), and its estimate answer |
| `states/book.json` | The host's messages for the whole book against a 32,768-token window (`too-large`), and its estimate answer |
| `harness.js` | Renders a built `webview.js` as the Lightbox surface behind a stubbed VS Code API, replays each state's messages, answers the tab's own estimate requests, screenshots each state once two consecutive frames match, and writes `facts.json` (run line, press, reason, skeletons, headline and its withheld state, tension cells, inspector evidence and re-read, layout boxes, horizontal overflow, what the tab posted) |
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
- `headline-withheld` (PR #149 F-04): Chapter I read with group A's headline
  citing words that stand nowhere in the chapter, **Read** filter. The
  board keeps its plain heading, and the withheld headline sits under it
  with its reason and its quote's reason; the motifs and the tension arc
  from the same reply still land.
- `reread-off` (PR #149 F-08): the `done` board with "Going down" pinned,
  then the Theme & motif lens turned off in the rail. The tile's "Re-read"
  is disabled and says why; the inspector is scrolled into view.

**How the states were made.** `tools/build-readings.test.ts` drives the
production `LightboxService`, `LightboxReadingHandler`,
`LightboxReadingRunner`, prompt builder, codec, quote verifier, term counter
and context shelf, and records every message the host posted. The real prompt
bundle is loaded from `packages/core/resources/system-prompts/lightbox/`, so
the token estimates are the host's own. Only the provider is played: a
stubbed engine holds each group's call open and answers it on cue. No
provider was called.

Since the PR #149 review fixes, the builder speaks the tab's side of the
protocol: each estimate request carries a request id, the tab asks again
after its context list changes (the host no longer posts an estimate
unasked), and the press names the key of the estimate it was shown. The
estimate is therefore not replayed: `harness.js` answers every
`lightbox_set_lenses` the tab posts with the recorded answer for those
lenses, echoing the request's id, as the host would.

- **Groups B and C** answer with the prompt bundle's worked examples,
  verbatim. They read ¶1–¶8 of this same chapter, so every quote they cite is
  checked against the real chapter's paragraphs.
- **Group A** answers with its worked example, changed in three ways, all
  hand-written for this evidence: the tension arc scores all 31 columns (the
  example scores eight; ¶9–¶31 are scored by hand), the tension claim is
  rewritten for the whole chapter with a third peak at ¶24, and one quote of
  the "Going down" motif is paraphrased on purpose ("and then it dropped
  straight down", cited as ¶6) so the verifier has something to withhold.
  For `headline-withheld`, its headline also cites ¶3 with words the
  chapter does not contain ("she followed the rabbit across the moonlit
  lawn"), so the verifier withholds the headline by its title.
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
| `headline-withheld` | heading "One chapter, held up to the light."; under it "Withheld · A bored girl follows a hurried white rabbit down a hole and keeps on falling." with "No quote it gave was found in the paragraph it named." and "¶3: Not found in the chapter: …"; "24 quotes checked · 2 withheld · 3 calls"; 3 motifs and the 31-cell tension lane drawn | same | same |
| `reread-off` | Theme & motif off; Lenses "3 calls · est. $0.10"; inspector "Going down" with its evidence; "Re-read this tile" disabled: "The Theme & motif lens is off. Turn it on in the rail to re-read this tile." | same | same |
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
  `lightbox_set_lenses` four times: on mount, when the board arrived, when
  the model list arrived and when the context list arrived (each asks the
  host for a fresh estimate under its own request id; none calls a
  provider).
- Two runs of the harness against the same bundle: 11 of 14 shots
  pixel-identical; the other three differ in at most 28 pixels by 1/255
  (anti-aliasing).
- At 1440, `done` and its inspector shot were byte-identical, so only the
  stacked widths keep a `done-inspector` shot.

## PR #149 review fixes (2026-10-19)

Re-rendered from the fix head's bundle (`webview.js` SHA-256
`1894febb83bca93f49cc95baaa18c00759c0af28fc7157e18ce28bb0bc61f85b`), with
`states/` rebuilt by the fixed host from freshly cut fixtures.

- The rebuilt states match the earlier ones apart from the protocol
  changes: the same board, groups and estimate figures; estimates now carry
  their `key` and answer a request id; groups carry `quoteChecks`; the host
  posts no estimate after the run; the tab asks for one after the context
  list arrives.
- The 14 earlier shots re-render pixel-identical, except `idle-1440` (6 px)
  and `running-1000` (19 px), each by 1/255 (anti-aliasing), so the
  committed images stand. The run line's tally is unchanged: "25 quotes
  checked · 1 withheld", now summed from the host's per-lens counts.
- New: `headline-withheld` and `reread-off` at 1440, 1000 and 500 px. Two
  runs differ in at most 20 pixels by 1/255. No page errors and no
  horizontal overflow in any state or width.

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

To rebuild `states/` (`chapter.json`, `withheld.json`, `book.json`): make
`$DIR/fixtures/alice-chapter-<n>.md` (n = 1–12) with
`../lightbox-slice-2a-visual/tools/alice_chapter.py` as that README
describes (`examples/alice.txt` from the `wordcloud` 1.9.3 sdist on PyPI),
copy `tools/build-readings.test.ts` into
`packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-readings.test.ts`,
delete the copy, and copy `$DIR/states/*.json` here. `$DIR` defaults to
`/tmp/lightbox-2b`; keep it outside the repository.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
