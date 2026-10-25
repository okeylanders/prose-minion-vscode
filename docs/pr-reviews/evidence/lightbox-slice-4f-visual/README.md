# Lightbox Slice 4F visual evidence: craft steering

Lightbox Slice 4F adds group G, **Craft steering**. One call, beside groups
A–E and before the Opinion, reads the chapter's being verbs, adverbs (-ly)
and intensifiers and fillers, whatever their rates. The host measures each
figure first, for free: its total and rate (the numbers' own count), its
narration and dialogue split, a breakdown by construction, and the
instances in runs of short sentences. The reading adds, per figure, how it
works here and a few instance notes. Each note has a stance (Earns, Leans,
Compensates), a why, and, only where it leans or compensates, a nudge
under "Worth a look" with at most one example under "One way it could go",
drawn as an illustration and never as a quote (ADR 2026-10-19 D7 second
addendum).

This folder shows from real host output:
- each figure's measured counts before any reading;
- each figure's reading and notes: a note with a nudge and its example, a
  note that earns with neither, and a note that leans with no example;
- a note hovered, lighting its paragraph;
- the note pinned in the inspector, and brought to the Workshop by its id;
- a note withheld for giving an order, and two examples withheld (one on a
  note that earns, one whose first part is not in its quote);
- the readings gone stale after the chapter changed, with the counts
  measured again.

The harness is adapted from
[`../lightbox-slice-4d-visual/`](../lightbox-slice-4d-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: eleven states |
| `workshop/workshop-composer-<width>.png` | The Workshop with the note staged above its composer, at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's Lightbox messages: `idle` (the board, measured), `done` (groups A, B, D, E and G read, then F), `bound` (the tray, then the answer, for the note brought), `withheld` (craft steering read again with an answer written for this evidence), `stale` (the chapter changed on disk and re-read). `lensesOff` holds the lenses group F's worked example was read without (craft steering is on); `estimates` and `estimatesStale` are the host's estimate answers, which the harness gives the tab's own estimate requests, echoing each request's id (PR #149 F-03) |
| `states/workshop.json` | `composer`: the Workshop session state after the note was staged, as its real session snapshots it; `handoff`: everything the Workshop's tile handler and the seed delivery posted to the Workshop webview; `brought`: the item the Workshop received |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox and the Workshop surfaces behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, and writes `facts.json` and `errors.txt` |
| `facts.json` | What each state's page showed, read from the DOM by `harness.js`: the steering tile figure by figure (head, construction rows, measured lines, reading, notes with stance, quote, why, nudge and example, withheld reasons), the computed border style of each measured part, reading, note and example, the inspector, the lit paragraphs, what was posted, whether the document overflows horizontally, and the ribbon's grid edges (`ribbonGrid`, measured as the 4C and 4D harnesses measure them) |
| `errors.txt` | Every page error, console error, ribbon misalignment and steering fault, one per line; empty for this run |
| `tools/build-steering.test.ts` | How `states/` was made |

A steering fault is a missing steering tile, fewer than three figure
sections, a measured part not drawn solid, a reading or a note not drawn
dashed, a note with other than its one quotation, or an example drawn
inside a quotation element. The harness writes each to `errors.txt`, so a
regression fails rather than skips.

### States

- **`measured`.** Before any press. The Craft steering tile, register
  `counted-read`, with "Counts · Measured" and "Readings and notes · Read"
  chips. Each figure's section shows its total and rate, its narration and
  dialogue, a bar and a key of its constructions (each row hoverable and
  pinnable), the weak verbs among the adverbs' verbs, and the instances in
  runs of short sentences with the threshold stated. Below them, "Not read
  yet. Runs with the next press."
- **`being-verbs`, `adverbs`, `intensifiers`.** After the press, each
  figure's section scrolled to the top: the measured block (solid), "How
  it works here" with its quotes (dashed), then the notes (dashed). A note
  that leans or compensates carries "Worth a look" and, where the reading
  gave one, "One way it could go" in a dotted box: the chapter's phrase, an
  arrow, the illustration, and "an illustration, not your text". A note
  that earns carries neither.
- **`note-hover`.** Being verbs · note II hovered: the ribbon's focus lane
  lights ¶7, and the ribbon's caption names the note.
- **`inspector`.** The same note pinned: stance, "Worth a look", "One way
  it could go" (marked an illustration), the figure with its measured count,
  the instance check, the quote found verbatim, where the reading strains,
  and **Bring to Workshop →**.
- **`bound`.** The note brought. The webview posted `lightbox_hand_off`
  naming the board and the tile, and nothing else; the Workshop's tile
  handler staged it after the delivery granted the claim; the host's tray
  message and its answer are replayed.
- **`withheld`.** Craft steering read again (one call, group G alone). The
  answer was written for this evidence from group G's worked example:
  - being verbs · note II's nudge opens with "Try", so code withholds the
    note, listed by its host title with the host's reason;
  - intensifiers and fillers · note I, which earns, offers an example: the
    note stands and says why the example is not shown;
  - adverbs (-ly) · note I offers an example whose first part, "went
    straight on", is not in its quote: the note stands, with its nudge, and
    says why the example is not shown.
- **`withheld-examples`.** The same board scrolled to the figures, showing
  both withheld examples in place.
- **`stale`, `stale-adverbs`.** The chapter changed on disk ("suddenly"
  taken out of ¶6's first clause) and was re-read. The counts are measured
  again with the board (adverbs 7 → 6, "with a verb" 4 → 3), the tile says
  "Stale" first, and the note whose quote held that adverb is withheld
  ("No quote of it still holds an instance of the figure it reads.", its
  quote "no longer in the chapter").
- **`workshop-composer`.** The Workshop with the note waiting above the
  composer: "Lightbox Instance note: Being verbs · note II", "from the
  Lightbox · 1 quote", removable, "rides the next message only". Nothing
  was sent.

### How the states were made

`tools/build-steering.test.ts` drives the production `LightboxService`,
`LightboxHandler` (with its handoff route and the Workshop tray port over
the real session), `LightboxReadingHandler` and `LightboxReadingRunner`.
It also uses the real prompt builder, codec, quote verifier, term counter,
craft steering's measure, codec, phrasing rules, anchoring and gates, and
the Opinion's digest. On the Workshop side it uses
`WorkshopLightboxTileHandler` over a real `WorkshopSessionService`, behind
the real `WorkshopSeedDelivery`, as the Slice 4C and 4D builders do. Only
the provider is played.

- **The press.** Groups A, B, D, E and G answer with the prompt bundle's
  worked examples, verbatim. The builder asserts that group G's request is
  its worked example's, byte for byte, that group F is asked only after
  all five have answered, and that F's request is its worked example's,
  byte for byte. Every steering reading and note is drawn, none withheld.
- **Lenses.** Group F's example's lenses are on, so the press is 6 calls;
  group C (and with it the Spark lane) is off.
- **The run token** of the first run is group F's worked example's
  (`5b1e09c4-…`), so the tile ids are the examples'.
- **One answer was written for this evidence**: the steering re-read
  described under `withheld`. The changed chapter is the opening with one
  word taken out.
- **The writer's average is a stub**: the test fixture's synthetic counts
  (`WRITER_AVERAGES`), since the evidence has no project folders. No
  publishing-standards preset is selected.
- **The model is a stub**, `provider/reader-model`, with a 200,000-token
  window and stub prices of $3 and $15 per million input and output
  tokens. No provider was called.
- **What else the builder asserts:**
  - the measured counts before and after the change (17, 7, 11; then 17,
    6, 11);
  - the brought item's points (Stance "Leans · Being verbs", Nudge, "One
    way it could go: it was too dark → the dark swallowed everything") and
    its one quote, ¶7 "it was too dark to see anything";
  - each withheld note and example, with its reason;
  - that the handoff port received a tile only;
  - that no log line carries the chapter's words, a reading's, a nudge or
    an example.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain. This is the worked
examples' own excerpt, as their request blocks hold it. The order and the
two examples in the re-read are phrases written for this evidence.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- At 1000 and 500 px the board is one column, so the three figures stack;
  at 1440 px they sit side by side.
- The Workshop does not reflow at 500 px (tech debt
  `.todo/tech-debt/2026-10-19-workshop-narrow-width-reflow.md`), so
  `workshop-composer-500` shows the pill's left half.
- At 1000 px the inspector opens over the rail, as before this slice.

## Results

From the committed `facts.json`, against the bundle a clean `npm run build`
writes at this branch's merge of `epic/lightbox` (`d9db6e5`: PR #160's
review fixes, with PR #158's VS Code 1.82 floor and PR #159's Slice 4E):
`webview.js` SHA-256
`24658aba3f52180b878e3e08bb19cb03bf6ee07e1c432bdb11d4b9c590a71b59`.
The bundle was built from an empty `dist/`, after `npm ci` into the
worktree's own `node_modules` (a real directory, not a symlink: webpack's
production module ids come from file paths). Every state reads the same at
1440, 1000 and 500 px.

**Rerenders.**
- **First run** (`0f75de0`, and again at `18d03d7`, which changes no
  webview code): `webview.js` SHA-256 `6c296309…`, the bundle PR #160
  reviewed.
- **After PR #160's fixes and the merge (2026-10-21).**
  - `states/chapter.json` changed only by what 4E adds to the board
    (the hapax list, style-flag paragraphs and ids). `workshop.json` and
    `log.txt` are byte-identical.
  - `facts.json` is identical, entry for entry, ribbon grid included. No
    state here changes under the fixes: the Alice opening has no paragraph
    large enough to matter (F-01), no example the anchor now withholds
    (F-02), and intensifiers stand out beside dialogue, which the numbers
    lens reads (N-01). The tests cover each.
  - Every 1000 and 500 px screenshot changed with 4E's board, and at
    1440 px the inspector and the Workshop composer did; `errors.txt` is
    still empty.

| State | What the page shows |
|---|---|
| `measured` | Being verbs "17 being verbs · 33.5 per 1,000 words", "15 in narration · 2 in dialogue", rows be + adjective 4, be + -ing 5, be + past participle 1, there or it + be 4, other 3. Adverbs (-ly) "7 -ly words · 13.8 per 1,000 words", with a verb 4, in a dialogue tag 0, before an adjective 1, before an adverb 0, other 2, "Weak verbs among them: 1". Intensifiers and fillers "11 intensifiers and fillers · 21.7 per 1,000 words", before a generic word 4, before an adjective or adverb 4, other 3. Each: "0 in runs of short sentences (3 or more in a row, each 8 words or fewer)". Measured parts `solid`; no reading or note. The lens card: "6 calls · est. $0.29 · the Opinion up to its digest bound" |
| `being-verbs`, `adverbs`, `intensifiers` | Readings and notes `dashed`, examples `dotted`, none inside a quotation. Notes: Being verbs Earns ¶3 (no nudge), Leans ¶7 (nudge; example "it was too dark → the dark swallowed everything"); Adverbs Leans ¶6 (nudge; "dipped suddenly down → plunged"), Earns ¶7; Intensifiers Earns ¶4, Compensates ¶6 (nudge; "a very deep well → a bottomless well"), Leans ¶2 (nudge, no example). The numbers tile says "Read under Craft steering, below" under intensifiers and fillers, which stands out |
| `note-hover` | Lit paragraphs: ¶7 |
| `inspector` | "Craft steering · Instance note", "Being verbs · note II". Details: Stance "Leans: The sentence leans on it where another choice could carry the meaning."; Worth a look; One way it could go "it was too dark → the dark swallowed everything (an illustration, not your text)"; Figure "17 · 33.5 per 1,000" Being verbs; Instances "Each quote holds one, checked by the detector that counted the figure". Bring ready |
| `bound` | Posted `lightbox_hand_off {"kind":"tile","boardId":"board-alice-1","tileId":"lbt-5b1e09c4-G-3"}` and nothing else. **Bound for Workshop** is disabled, with **Open Workshop →**. Header: "1 tile bound for Workshop · Open Workshop →" |
| `withheld` | "Withheld · Being verbs · note II: Its nudge was withheld. It gives an order: craft steering names a move worth a look, and the call is yours." |
| `withheld-examples` | Adverbs (-ly) · note I: "Example withheld: Its example's first part is not a run of whole words of its checked quote holding the instance, so it is not shown." Intensifiers and fillers · note I: "Example withheld: A note that earns its place shows no example, so this one is not shown." |
| `stale`, `stale-adverbs` | "Stale: Read against an earlier version of this chapter…". Adverbs "6 -ly words · 11.8 per 1,000 words", with a verb 3. Withheld: Being verbs · note II (from the re-read) and Adverbs (-ly) · note I, "No quote of it still holds an instance of the figure it reads." with "¶6: No longer in the chapter…" |
| `workshop-composer` | One pill, "Lightbox Instance note: Being verbs · note II", "from the Lightbox · 1 quote". Hint: "rides the next message only". `brought` holds the points Stance, Nudge and One way it could go, and the one quote |
| Horizontal overflow (document) | None, in any state or width (`horizontalOverflow: false` in every entry) |
| Ribbon grid (all 33 Lightbox captures) | Track and column edges 0 px apart; label blocks beside their tracks; no clipped label. The `measured` state draws no Pressure cells or movement bands, as expected before a press |

- No page errors, ribbon misalignments or steering faults in any state or
  width (`errors.txt` is empty).
- `states/log.txt` names paths, counts, digest key prefixes and outcomes
  only, for example "Group G read (steering): 10 tiles, 0 blocks withheld,
  0 claims withheld, 13 quotes checked (0 withheld)" and "group F digest:
  45 items, 38 readings, 0 left out, about 4,020 tokens".

**Changed while making it.** Two of the worked example's nudges opened with
"Worth a look:", which the board already prints as the nudge's label, so
they read twice. They now name the move and end "may be worth a look"
(`46-example-group-g.md`; the request and every other field are
unchanged).

**The sentence rule.** The short-run counts read the shared sentence rule
(`proseSentenceSpans`). A fix that keeps closing quotation marks with their
sentence is coming on `epic/lightbox-sentence-rule`; on this excerpt no
figure has an instance in a run of three short sentences under either
rule, so the counts above hold. The ribbon's sentence-length figures may
move; rerender after merging it.

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

Then copy `$DIR/visual/lightbox-*.png` into `lightbox/`,
`$DIR/visual/workshop-*.png` into `workshop/`, and `facts.json` and
`errors.txt` here.

To rebuild `states/`:
1. Copy `tools/build-steering.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-steering.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

`$DIR` defaults to `/tmp/lightbox-4f`; keep it outside the repository. No
fixture file is needed: the text is the worked examples'.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
