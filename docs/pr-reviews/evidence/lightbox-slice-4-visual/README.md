# Lightbox Slice 4 visual evidence: lineage, subtext, the Spark lane and Bring to Workshop

Lightbox Slice 4 adds three readings (subtext in group B; lineage and spark
in group C), gives sparks a lane of their own with "Not for me" and Undo,
and brings a reading to the Workshop, where it waits above the composer
until the writer sends it or removes it (ADR D7, D11). This folder shows
those states from real host output. The harness is adapted from
[`../lightbox-slice-3-visual/`](../lightbox-slice-3-visual/README.md), which
is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px |
| `workshop/workshop-composer-<width>.png` | The Workshop with two tiles staged above its composer, at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's Lightbox messages for Chapter I: `idle`, then what `done` adds; `dismissed` and `undone` (the spark lane's two answers); `bound` and `sparkBound` (the tray, then the answer, for each tile brought); `refused` (a tile brought while a Workshop response runs). `lensesOff` holds group A's lenses, off for this evidence, and `estimates` the host's estimate answer for them; the harness answers the tab's own estimate requests with it, echoing each request's id (PR #149 F-03) |
| `states/workshop.json` | `composer`: the Workshop session state after both tiles were staged, as its real session snapshots it; `handoff`: everything the Workshop's tile handler and the seed delivery posted to the Workshop webview |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox and the Workshop surfaces behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, and writes `facts.json` |
| `tools/build-story.test.ts` | How `states/` was made |

**States:**
- `lineage`: the **Read** filter, scrolled to Lineage: two adjacent stories,
  each with its stances (Matches, Departs, Subverts), and "Checked and set
  aside" naming Persephone and Orpheus with the reading's reasons.
- `subtext`: the said/meant pairs. Each said line is quoted as the chapter
  has it, inside its dialogue; "reads as" labels the meant side a reading.
- `spark-lane`: three sparks in their own lane under the grid, each a
  question with its counted support and its paragraphs, **Bring as a
  question** and **Not for me**.
- `spark-dismissed`: "Not for me" on The empty jar. The webview posted
  `lightbox_set_spark_dismissed`; the host's board, replayed, sets it aside:
  "1 spark set aside. Undo Brings back “The empty jar”."
- `spark-undone`: Undo pressed; the host's answer brings it back.
- `bring`: the White Rabbit's pair pinned. The inspector offers **Bring to
  Workshop →** with what it does.
- `bound`: Bring pressed. The webview posted `lightbox_hand_off` naming only
  the board and the tile. The Workshop's tile handler staged it after the
  delivery granted the claim; the host's tray message and its answer are
  replayed. The inspector shows **Bound for Workshop**, the note "Waiting
  above the Workshop composer. Send it with a message or remove it there."
  and **Open Workshop →**; the header shows "1 tile bound for Workshop ·
  Open Workshop →".
- `tray`: the top of the tab after The empty jar was brought as a question
  too: "2 tiles bound for Workshop".
- `spark-bound`: the lane with The empty jar **Bound for Workshop** (pressed).
- `refused`: The white hart brought while a Workshop response runs. The
  Workshop refused it as busy; the inspector shows its reason, and Bring
  stays available. Nothing was staged.
- `workshop-composer`: the Workshop with both tiles waiting above the
  composer: "Lightbox Said / meant: White Rabbit · from the Lightbox · 2
  quotes" and "Lightbox Open door: The empty jar · from the Lightbox · 1
  quote", each removable, "rides the next message only". Nothing was sent.

**How the states were made.** `tools/build-story.test.ts` drives the
production `LightboxService`, `LightboxHandler` (with its handoff route and
the Workshop tray port over the real session), `LightboxReadingHandler`,
`LightboxReadingRunner`, prompt builder, codec, quote verifier and term
counter, and the Workshop's own `WorkshopLightboxTileHandler` over a real
`WorkshopSessionService`, and records every message they posted. The
handoff port does what `extension.ts` and
`WorkshopPanelProvider.stageLightboxTile` do: it offers the tile through the
real `WorkshopSeedDelivery` (kind `lightbox-tile`), which routes a synthetic
`WORKSHOP_STAGE_LIGHTBOX_TILE`, with its delivery id, through the tile
handler. The builder then plays the Workshop webview's side as
`useWorkshopLightboxTiles` does: it claims the offer under its receiver id
(PR #150 F-08), and after the grant asks the handler to stage it, naming
that receiver, once the delivery says the grant holds, as the provider
checks (PR #151 F-06), and answers the delivery with the handler's word.
Only the provider is played.

- **Groups B and C** answer with the prompt bundle's worked examples,
  verbatim; every quote is the chapter's own and the host checks each one.
- **Group A's lenses are off**, so this evidence spends no call on them.
- **The model is a stub**, `provider/reader-model`, with a 200,000-token
  window and stub prices of $3 and $15 per million input and output tokens.
  No provider was called.
- The builder also asserts that the handoff port received tiles only, and
  that no log line carries a tile's or the chapter's words.

**Source text.** Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), public domain, prepared exactly as for Slice 2A (see that
README). Boards use the Middle Grade publishing-standards preset.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system. The harness confirms the stub
  model for the assistant and widget scopes, so the pickers show "Reader
  model (stub)"; neither is called.
- The Workshop does not reflow at 500 px: its main column runs past the
  window's right edge, as in the PR #147 evidence, so
  `workshop-composer-500` shows the pills' left half. `facts.json` records
  both pills there. This is recorded as tech debt
  (`.todo/tech-debt/2026-10-19-workshop-narrow-width-reflow.md`).

## Results

From `facts.json` of the final run, against the bundle built at this
slice's head (`webview.js` SHA-256
`237331b625ee99c7e63f658246daaac518205825e097179cebee164bab3f831e`):

| State | What the page shows (1440, 1000 and 500 alike) |
|---|---|
| all | Run line "26 quotes checked · 0 withheld · 2 calls", "Re-read · 2 calls · est. $0.11" |
| `lineage` | The white hart (Arthurian and Celtic legend: Matches, Departs), The descent to the underworld (Greek myth: Matches, Subverts); set aside: Persephone, Orpheus |
| `subtext` | ¶4 White Rabbit, ¶8 Alice, ¶2 Alice, each said line verbatim and "reads as" its meant side |
| `spark-lane` | The empty jar (jar ×2 · empty ×1, ¶7), Late for what? (late ×2 · watch ×2, ¶4 ¶12), Nobody at home (home ×1 · sister ×2, ¶2 ¶8) |
| `spark-dismissed` | Posted `lightbox_set_spark_dismissed {"boardId":"board-alice-1","tileId":"lbt-run-1-ev-C-8","dismissed":true}`; two sparks shown; "1 spark set aside. Undo Brings back “The empty jar”." |
| `spark-undone` | Posted the same with `"dismissed":false`; three sparks shown |
| `bring` | **Bring to Workshop →** enabled, note "Stages its claim and the quotes found in the chapter above the Workshop composer. Nothing is sent until you send it there." |
| `bound` | Posted `lightbox_hand_off {"kind":"tile","boardId":"board-alice-1","tileId":"lbt-run-1-ev-B-5"}` and nothing else about the tile; **Bound for Workshop** disabled, its note a status, **Open Workshop →** shown; header "1 tile bound for Workshop · Open Workshop →" |
| `tray`, `spark-bound` | Header "2 tiles bound for Workshop · Open Workshop →"; The empty jar "Bound for Workshop" (disabled, pressed), the other sparks "Bring as a question" |
| `refused` | Posted `lightbox_hand_off {"kind":"tile","boardId":"board-alice-1","tileId":"lbt-run-1-ev-C-6"}`; note (a status) "The Workshop is busy: a response is running, or the session is being saved or replaced. Bring the tile again when it finishes."; Bring enabled again; the tray still says 2 |
| `workshop-composer` | Two pills, labels and sizes as above; tooltips "Said / meant from the Lightbox's reading of Drafts/alice-chapter-1.md: the claim and the quotes found in the chapter" and the same for Open door; remove buttons "Remove … from this message"; hint "rides the next message only". The page posted `workshop_seed_receiver` on mount and nothing about the tiles |
| Horizontal overflow (document) | none, in any state or width |

- No page errors in any state or width.
- `states/log.txt` names paths, counts, attachment ids and refusal reasons
  only; the builder asserts that no tile or chapter words appear in it.

## After the PR #151 review (2026-10-20)

The review fixes were rerun through this folder at the new head:

- `states/chapter.json` was rebuilt. The Spark prompt gained one sentence
  (F-03), so each group's estimate moved by 21 input tokens; the shown
  estimate is still "est. $0.11". `states/workshop.json` and
  `states/log.txt` came out byte-identical.
- The harness reads the lineage foot by its real class
  (`.pm-lb-lineage-set-aside`); before, `facts.json` recorded it as null.
  It now reads "Checked and set aside: Persephone. No one takes her below:
  she jumps in after the Rabbit herself. Orpheus. Nobody has been lost
  below, so there is no one to bring back."
- All 33 screenshots rendered pixel-identical to the ones here (bundle
  SHA-256 `dc53b9eaaf02eec6c7ac6e9225c9a6b5abb94445956745c130d68ef1d2b691a4`), so they were not replaced. No page errors.

## Rerunning it

Build the bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/lightbox-4/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js /tmp/lightbox-4/webview.js /tmp/lightbox-4/visual
```

To rebuild `states/`: make `$DIR/fixtures/alice-chapter-1.md` with
`../lightbox-slice-2a-visual/tools/alice_chapter.py` as that README
describes, copy `tools/build-story.test.ts` into
`packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-story.test.ts`,
delete the copy, and copy `$DIR/states/*` here. `$DIR` defaults to
`/tmp/lightbox-4`; keep it outside the repository.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
