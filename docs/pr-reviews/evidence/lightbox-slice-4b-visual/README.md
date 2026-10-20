# Lightbox Slice 4B visual evidence: the craft lenses

Lightbox Slice 4B adds group D: stock and signature, rhythm and handoffs, and
what stands out in the numbers (ADR 2026-10-19 D7 and its 2026-10-20
addendum). This folder shows those tiles, the ribbon's Endings lane, the
inspector on a handoff, a stale board and a handoff brought to the Workshop,
from real host output. The harness is adapted from
[`../lightbox-slice-4-visual/`](../lightbox-slice-4-visual/README.md), which
is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px |
| `workshop/workshop-composer-<width>.png` | The Workshop with the handoff staged above its composer, at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's Lightbox messages: `idle` (the board, measured, before any reading), `done` (group D read), `bound` (the tray, then the answer, for the handoff brought), `stale` (the board rebuilt after the chapter changed on disk). `lensesOff` holds groups A–C's lenses, off for this evidence; `estimates` and `estimatesStale` are the host's estimate answers before and after the change, which the harness answers the tab's own estimate requests with, echoing each request's id (PR #149 F-03) |
| `states/workshop.json` | `composer`: the Workshop session state after the handoff was staged, as its real session snapshots it; `handoff`: everything the Workshop's tile handler and the seed delivery posted to the Workshop webview |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox and the Workshop surfaces behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, and writes `facts.json` |
| `tools/build-story.test.ts` | How `states/` was made |

**States:**
- `numbers-measured`: before any reading. "What stands out in the numbers"
  shows every measured figure on a bar with the MG preset's band and the
  writer's average, and marks three as standing out; "Sentence lengths by
  paragraph" is drawn too. Both are measured by code at no cost; the read
  parts wait for a press.
- `stock`: the cognitive economy (a tier bar counted by code from the 16
  beats it found), two signature phrases, familiar phrasing with each
  phrase's count and paragraphs, an air-lock, and the echo with its accuracy
  callout.
- `rhythm`: measured sentence lengths per paragraph; how each paragraph
  ends (Lands 2, Holds 1, Opens 5); the movement claim; three handoffs, each
  two adjacent sentences code found, with what is carried, what changes and
  the effect.
- `numbers`: each standout with its reading under it ("Reads as
  deliberate", "Reads as mixed"), each quote holding an instance of its
  figure.
- `ribbon`: the top of the tab: the ribbon's Endings lane, a read lane, under
  the measured rhythm and dialogue lanes.
- `inspector`: the ¶4 handoff pinned: its two sentences found verbatim, the
  reading's fields, where the reading strains, and **Bring to Workshop →**.
- `bound`: Bring pressed. The webview posted `lightbox_hand_off` naming only
  the board and the tile. The Workshop's tile handler staged it after the
  delivery granted the claim; the host's tray message and its answer are
  replayed.
- `stale`, `stale-ribbon`: ¶7 edited on disk ("too dark" → "hard") and the
  file re-read. The board is rebuilt from the new text and group D's
  readings carried over: each tile says "Stale", the run line says "3
  lenses stale", ¶7's ending is blank in the tile and in the Endings lane
  (labeled "stale"), and every other ending follows its unchanged
  paragraph.
- `workshop-composer`: the Workshop with the handoff waiting above the
  composer: "Lightbox Handoff: Handoff in ¶4 · from the Lightbox · 2
  quotes", removable, "rides the next message only". Nothing was sent.

**How the states were made.** `tools/build-story.test.ts` drives the
production `LightboxService` (measuring the numbers against the MG preset
through the real `StandardsService`), `LightboxHandler` (with its handoff
route and the Workshop tray port over the real session),
`LightboxReadingHandler`, `LightboxReadingRunner`, prompt builder, codec,
quote verifier and term counter, and the Workshop's own
`WorkshopLightboxTileHandler` over a real `WorkshopSessionService` behind the
real `WorkshopSeedDelivery`, as the Slice 4 builder does. Only the provider is
played.

- **Group D** answers with the prompt bundle's worked example, verbatim; every
  quote is the chapter's own and the host checks each one (39 checked, none
  withheld).
- **Groups A, B and C are off**, so this evidence spends one call.
- **The writer's average is a stub**: the test fixture's synthetic counts
  (`WRITER_AVERAGES`: 11 files, 20,000 words), since the evidence has no
  project folders. The real `LightboxWriterBaseline` over the project catalog
  is exercised by `LightboxWriterBaseline.test.ts` and
  `LightboxCraftRun.test.ts`.
- **The model is a stub**, `provider/reader-model`, with a 200,000-token
  window and stub prices of $3 and $15 per million input and output tokens.
  No provider was called.
- The builder also asserts that the handoff port received a tile only, and
  that no log line carries the chapter's or a reading's words.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), public domain: the worked example's own excerpt, as its
request block holds it. Boards use the Middle Grade publishing-standards
preset.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The Workshop does not reflow at 500 px (tech debt
  `.todo/tech-debt/2026-10-19-workshop-narrow-width-reflow.md`), so
  `workshop-composer-500` shows the pill's left half; `facts.json` records
  it.

## Results

From `facts.json` of the final run, against the bundle built at this
slice's head (`webview.js` SHA-256
`caaa2e3333222f4bba6e72d592c3c74e3dccf3a5812de242da4e0b7dbe03bf39`):

| State | What the page shows (1440, 1000 and 500 alike) |
|---|---|
| `numbers-measured` | "Against your other chapters (11 files, 20,000 words) and your publishing preset's ranges."; Sentence length 29.9 words per sentence · 2.09× your average of 14.3 · above the preset's 10–14, **Stands out above the preset and your average**; Dialogue 12.2 % of words · 0.41× your average of 30 · below the preset's 50–65, **Stands out below the preset and your average**; Passive voice 3.9 (2.6×, two instances: not a standout); Being verbs 33.5 (1.34×); Adverbs 13.8 (1.38×); Intensifiers and fillers 21.7 · 7.23× your average of 3, **Stands out above your average**; run line "1 call · est. $0.07" |
| `stock` | Tier bar "16 beats classified and found: 6 functional stock, 1 decorated, 1 stock carrying weight, 8 signature"; Manners in free fall (¶7), The narrator's aside (¶8); In another moment ×1 · ¶5, burning with curiosity ×1 · ¶4, how in the world ×1 · ¶5, Oh dear ×2 · ¶4; an air-lock, ¶7 "Either the well was very deep, or she fell very slowly"; echo ¶2 "what is the use of a book", with "Accuracy: The quote is checked against your chapter; the resemblance is not. …" |
| `rhythm` | "Mean 29.9 words · longest 107 (¶4) · 3 sentences under 6 words."; "Lands 2 · Holds 1 · Opens 5 · ¶1, ¶3, ¶4, ¶5, ¶6"; handoffs ¶4 "Oh dear" → "I shall be late" (Continues), ¶7 (Continues), ¶8 (Earns closure) |
| `numbers` | Readings under sentence length (deliberate), dialogue (mixed) and intensifiers (deliberate), each with its quotes; nothing withheld |
| `ribbon` | Endings lane: opens, holds, opens, opens, opens, opens, lands, lands |
| `inspector` | "Handoff in ¶4", both quotes "found verbatim", Sentences "¶4: two adjacent sentences, checked by code", Carried, Effect, the friction, **Bring to Workshop →** enabled |
| `bound` | Posted `lightbox_hand_off {"kind":"tile","boardId":"board-alice-1","tileId":"lbt-run-1-ev-D-11"}` and nothing else about the tile; **Bound for Workshop** disabled, **Open Workshop →**; header "1 tile bound for Workshop · Open Workshop →" |
| `stale`, `stale-ribbon` | Run line "39 quotes checked · 0 withheld · 1 call · 3 lenses stale"; three "Stale" notes; "Lands 1 · Holds 1 · Opens 5"; Endings lane labeled stale, ¶7 blank; figures re-measured (sentence length 29.8) |
| `workshop-composer` | One pill, "Lightbox Handoff: Handoff in ¶4", "from the Lightbox · 2 quotes", tooltip "Handoff from the Lightbox's reading of Drafts/alice-chapter-1-opening.md: the claim and the quotes found in the chapter", "Remove … from this message", hint "rides the next message only" |
| Horizontal overflow (document) | none, in any state or width |

- No page errors in any state or width.
- `states/log.txt` names paths, counts, attachment ids and outcomes only.

**Fixed while making it.** The first run showed the familiar phrase's
"Stock carrying weight" tag painted with the tier bar's swatch color
(unreadable), because the tier and ending colors were set on bare `.is-*`
classes. They are now scoped to the tier bar, its key and the ending marks;
and the handoff's Effect tag no longer stretches across its row.

## Rerunning it

Build the bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/lightbox-4b/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js /tmp/lightbox-4b/webview.js /tmp/lightbox-4b/visual
```

To rebuild `states/`: copy `tools/build-story.test.ts` into
`packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-story.test.ts`,
delete the copy, and copy `$DIR/states/*` here. `$DIR` defaults to
`/tmp/lightbox-4b`; keep it outside the repository. No fixture file is
needed: the text is the worked example's.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
