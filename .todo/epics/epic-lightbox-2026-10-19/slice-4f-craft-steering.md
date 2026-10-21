# Slice 4F: Craft Steering (Group G)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3, D4, D6, D7 and its **second addendum (2026-10-21)**, D11
**Writer decisions:** 13 (amended), 20–24 (and 25, recorded for Slice 5) in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Implemented on `epic/lightbox-slice-4f-steering`, from `epic/lightbox` at `20775cf` (see [Implementation notes](#implementation-notes-2026-10-21)). PR #160's review fixes are in, and `epic/lightbox` is merged in at `1fe931a` (PR #158's VS Code 1.82 floor and PR #159's Slice 4E). The shared sentence-rule fix (PR #161) merges in next.
**Before:** Slice 5. The saved-board format must hold these kinds and the measured breakdown.

## Why

The writer asked, in their own words: "I think we need analysis on Being
Verbs, Adverbs, Intensifiers. That can really help. For instance, Adverbs
might need stronger verbs instead of relying on modification. Intensifiers
are ok for rhythm and swelling but if they are compensating for poor nouns or
droning primitive sentences a nudge might be appropriate. Same thing for
Being Verbs. Think steering the craft."

Today the numbers lens (Slice 4B) reads only standouts. On the writer's real
pass:
- passive voice stood out and read as deliberate, which works well;
- being verbs stood out at 1.53× the writer's average, but its reading was
  withheld: one quote was not in the chapter, and two were "found, but it
  holds no instance of the measured figure";
- adverbs (-ly) and intensifiers and fillers were below the writer's
  average, so they got no reading at all.

A standout is the wrong gate for craft steering: an adverb leaning on a weak
verb matters whether or not the chapter holds more adverbs than usual.

## Outcome

A seventh call, **Group G · Craft steering**, reads the chapter's being
verbs, adverbs (-ly) and intensifiers and fillers, whatever their rates. For
each figure the board shows:

- **measured, by the host, free** (drawn solid): the total and the rate per
  1,000 words (the numbers tile's bar, the same detector, so the totals are
  equal), how many stand in narration and how many in dialogue, a breakdown
  by construction, and how many sit in runs of short sentences;
- **read** (drawn dashed): one reading of how the figure works in this
  chapter, with quotes that each hold an instance; and up to four **instance
  notes**, each one checked quote holding an instance, a stance (**Earns**,
  **Leans** or **Compensates**), a why, and, only when it leans or
  compensates, a **nudge** that names the craft move as worth a look and may
  carry **one example**: a phrase from the checked quote and a few words
  showing one way the move could go ("walked slowly → shuffled"), labelled
  as an illustration.

Nudges are the second fenced exception to "describe, never grade" (ADR D7
addendum, 2026-10-21): they name a move and never say fix or cut. The writer
chose to allow the one example ("feel free to give one example so the user
understands"); it supersedes "never supply the writer's words" for that
illustration alone. The Workshop is where rewriting happens: a note can be
brought there, with its example labelled as one.

## Groups and lenses

- `LightboxReadingGroupId` gains `'G'`, with one lens, `steering`, label
  "Craft steering", key `"steering"`, prompt `58-steering.md`, worked example
  `46-example-group-g.md` (the next free numbers after 57 and 45).
- **Board order** is A–E, G, F: `LIGHTBOX_READING_GROUPS` keeps the Opinion
  last. G reads the chapter, so the runner sends it beside A–E, and F starts
  only after G has settled, like every chapter group. The rail lists Craft
  steering after Summary & movements and before the Opinion.
- It can be turned off like any lens; with it off, G is not called.
- **The estimate** prices G's call like any group's: its exact messages and a
  typical output, a guess from the worked example's length, labelled as one
  until Slice 6 measures it. The run line and the lens card count it ("up to
  7 grouped calls", from the group list).

## Ownership (decision 20)

Craft steering owns **being verbs**, **adverbs (-ly)** and **intensifiers and
fillers** (`LIGHTBOX_STEERING_STATS`). The numbers lens stops reading them:
- its task lists only the other standouts (sentence length, dialogue, passive
  voice), and its prompt says the three are read by Craft steering;
- the codec withholds a numbers reading that names one of them, and the
  gate refuses a `number-usage` of one, fresh and carried;
- the numbers tile keeps their bars, ranges and standout flags, and under a
  standout of one of them says it is read under Craft steering.
Passive voice stays with the numbers lens.

## Measured per figure (host only, no model; decision 21)

`LightboxMeasuredSet` gains `steering` (`LightboxSteeringMeasure`), computed
by a new pure module, `LightboxSteeringMeasure`, with the board and never
stale (it recomputes with every board).

For each figure:
- **total** and **rate per 1,000 words**, counted paragraph by paragraph by
  the figure's own detector (`LIGHTBOX_NUMBER_PATTERNS`: `findBeingVerbs`,
  `findAdverbs`, `findFillerWords`), so they equal the numbers row's
  instances and value; a test pins both with literal values;
- **narration and dialogue**: an instance inside a `findDialogueSpans` span
  is dialogue (the single-quote limitation of that matcher applies);
- **in runs of short sentences**: instances inside a run of at least
  `LIGHTBOX_STEERING_SHORT_RUN` (3) consecutive sentences of at most
  `LIGHTBOX_STEERING_SHORT_SENTENCE_WORDS` (8) words each, within one
  paragraph, by `proseSentenceSpans` and the prose-stats word rule; a span
  with no letter (a closing quotation mark) is no sentence and neither
  extends nor breaks a run. This is the "droning primitive sentences"
  signal, measured for all three figures;
- **constructions**, a partition of the instances (the counts sum to the
  total), decided from the next word tokens by the word-frequency tool's
  tagger (wink), tagging each paragraph that holds an instance:
  - **Being verbs:** *there or it + be* (the word before is an existential
    *there*, tag `EX`, or *it*); else, skipping adverbs (`RB*`), *be +
    -ing* (`VBG`), *be + past participle* (`VBN`), *be + adjective*
    (`JJ*`); else *other* (identity, a noun, a place).
  - **Adverbs (-ly):** *in a dialogue tag* (the word before or after is one
    of `LIGHTBOX_STEERING_TAG_VERBS`: said, says, asked, asks); else
    *before an adjective* (next `JJ*`); else *with a verb* (next `VB*`, else
    the word before, skipping adverbs, is `VB*`), counting how many of those
    verbs are on Style Flags' weak-verbs list (`STYLE_FLAG_WEAK_VERBS`,
    exported unchanged); else *before an adverb* (next `RB*`); else *other*
    (an -ly adjective, a noun, a sentence adverb).
  - **Intensifiers and fillers:** looking past any other filler word, *before
    a generic word* (`LIGHTBOX_STEERING_GENERIC_WORDS`, named); else *before
    an adjective or adverb* (`JJ*`, `RB*`); else *other*.
  - Each list, and the false positives and negatives of each rule, is named
    in the module (for example: an adjectival participle, "was tired", is
    tagged as a participle and counts as *be + past participle*; a
    referential *it* counts as *there or it + be*).
- When the tagger cannot load, the totals, splits and runs stand and the
  constructions say they are unavailable, in host words.

## Wire format and codec (decision 22)

One frame, `===LIGHTBOX_GROUP_G_V1===`, `"version": 1`, key `"steering"`:

```
"steering": {
  "figures": [
    {"stat": "adverbs", "claim": "...", "evidence": [{"para": 6, "quote": "..."}],
     "notes": [
       {"para": 6, "quote": "...", "stance": "leans", "why": "...", "nudge": "...",
        "example": {"before": "...", "after": "..."}},
       {"para": 7, "quote": "...", "stance": "earns", "why": "...", "nudge": null, "example": null}
     ]}
  ],
  "friction": "..."
}
```

- `strictObject` everywhere, host-owned reasons, undefined fields counted,
  friction required, no counts from the model.
- `figures`: 0–3, `stat` one of the three steering ids, each at most once.
  A figure that breaks its shape is withheld whole, by its host label.
- `claim`: at most `claimCharacters`; `evidence`: 1–`quotesPerClaim` quotes,
  each holding an instance. A claim that breaks a text rule withholds the
  figure's reading by its label; its notes are decoded on their own.
- `notes`: 0–`steeringNotes` (4) per figure. A note is exactly `{para,
  quote, stance, why, nudge, example}`; `stance` is `earns`, `leans` or
  `compensates`; `why` at most `steeringWhyCharacters` (160); `nudge` is a
  string of at most `steeringNudgeCharacters` (120) when the stance leans or
  compensates, and `null` when it earns. A note that breaks a rule is
  withheld by its host title ("Adverbs (-ly) · note II"), never its words.
- `example` (decision 23, the writer's choice): `null`, or one `{before,
  after}`. It is the nudge applied to the quoted instance, an illustration,
  never a replacement for the writer's text. A fault in it withholds **the
  example alone**, with a host reason the note shows; the note stands:
  - an example on a note that earns;
  - more than one (a list: the first is read, and the rest are withheld
    with a host reason the note shows);
  - `before` not a run of whole words of the note's **checked quote**, or a
    run that holds no instance of the figure (checked by code, with the
    figure's instance filter, on the quote's own span), or longer than
    `steeringExampleBeforeWords` (8) words or `steeringExampleCharacters`
    (56) characters;
  - `after` empty, longer than `steeringExampleAfterWords` (6) words or
    `steeringExampleCharacters` (56) characters, the same as `before`
    (case and spacing folded), or breaking a text rule below.
  The anchoring is checked where the quote is: at assembly, on carry
  against the carried quote, and again at Bring. The example is never a
  quote: it is not evidence, the verifier never searches it, the Opinion
  never reads it, and the board never draws it as one.

### Text rules (`LightboxSteeringPhrasing`, decision 23)

Applied to every claim, why and nudge, and to an example's `after`, by the
codec:
- no word of `LIGHTBOX_STEERING_FORBIDDEN_WORDS` or its inflections: cut,
  delete, remove, fix, wrong, bad, should, must;
- no double quotation mark of any kind (`LIGHTBOX_DOUBLE_QUOTATION_MARKS`,
  the verifier's set): a note quotes the chapter only in its checked quote,
  and never supplies the writer's words;
- no figure: no digit outside a ¶ address, no `%` or "percent";
- a why or a nudge never opens a clause with an instruction (Spark's opener
  check, shared with the Opinion), so a nudge reads as a move worth a look,
  not an order. An example's `after` is a phrase, not a clause, and is not
  held to this check.

The limits are stated in the module and pinned by tests: word lists, not a
parse; a nudge that supplies words without quotation marks passes; a listed
word used to describe ("the cut of her coat", "a bad dream") withholds the
note, the safe failure; plain diagnosis without a listed word passes.

## Tile kinds

| Kind | Lens | Register | What it holds |
|---|---|---|---|
| `steering-reading` | steering | counted-read | A figure code measured, read for how it works here: `stat`, the claim, quotes each holding an instance |
| `steering-note` | steering | read | One instance: `stat`, one quote holding an instance, `stance`, the why (its claim), `nudge` and at most one `example` (leans or compensates only), or the host's reason its example was withheld, `ordinal` |

Titles are the host's: the figure's label, and "<label> · note n" with
its place as a Roman numeral ("Being verbs · note II"), so no host digit
reaches the Opinion as a figure it might state (PR #157 F-01).

## Gates and carry (`LightboxTileGates`, fresh and carried)

- Every quote of both kinds is verified with the figure's instance filter,
  the detector that counted it, through the verifier's span filter
  (`lightboxPatternInstanceFilter`, shared with the numbers lens). A quote
  found but holding no instance is withheld as `no-instance`.
- `steering-reading` stands on at least one such quote; `steering-note` on
  its one quote. Otherwise each is withheld by its title with the host's
  reason.
- **Carry** re-finds each quote on the changed text with the instance filter
  of the new text, follows its words to the nearest paragraph that holds
  them, and withholds a tile with no quote left holding an instance. The
  measured breakdown is recomputed with the board, never carried.

## Bring to Workshop

Both kinds can be brought (ids only, the existing tile handoff, no new
attachment shape):

| Kind | Quotes | Points |
|---|---|---|
| `steering-reading` | its quotes, re-checked with the instance filter | "Figure": the host's total, rate, narration and dialogue; "By construction"; "Short runs", with the run's stated threshold |
| `steering-note` | its quote, re-checked with the instance filter, or refused | "Stance", with the figure's label ("Leans · Being verbs"); "Nudge" (leans or compensates); "One way it could go": `before → after`, only while its `before` still lies in the re-checked quote and holds an instance |

The note's why is the item's claim. A stale tile, a lens being read again,
or a quote no longer holding an instance is refused in host words.

## The Opinion's digest (decision 24)

- **Measured items** `steering:<stat>`, one per figure, always present and
  always current: the total, rate, narration and dialogue, the
  constructions and the short-run count, written as evidence on purpose,
  since numbers the digest shows become citable (the Opinion's figure rule).
  No threshold or other host parameter is written in them.
- **Reading items**: a `steering-reading` shows its figure's measured lines;
  a `steering-note` shows its stance, its figure and its why. **The nudge
  and the example never enter the digest.**
- The worked example of group F is rebuilt: its board gains the measured
  items, and group D's tile ids shift (below).
- **The basis is unchanged here.** The writer chose a canonical data basis
  for saved boards (epic decision 25), which Slice 5 builds first. Until
  then bases hash the rendered item as today, so existing standing holds.
  Steering's items keep their label, lines, quotes, counts and figures as
  separate fields, like every other item, so the data basis can be derived
  without parsing rendered text.

## Prompts and the worked example

- `58-steering.md`: the frame, the fence, the stances, what a nudge may and
  may not say, and **what counts as an instance**, figure by figure (the
  being-verbs investigation below).
- `46-example-group-g.md`: *Alice* ch. I, ¶1–¶8, as every other example.
  Its request is the builder's byte for byte; its response decodes through
  the production codec and gates with every quote exact and nothing
  withheld.
- `00-lightbox-shared.md` names sentinel `G`.
- `52-numbers.md` and its task lines drop the three steering figures, so
  group D's worked example no longer reads intensifiers: its request and
  response change, its numbers tiles are renumbered, and group F's example
  cites them by their new ids.
- **The response ceiling.** A response with every field at its bound and
  every quote at 240 characters stays under the 32,000-character cap, pinned
  by a test that builds and decodes one. No third ceiling debt.

## The being-verbs investigation

Check, with tests that run both, that the detector behind the being-verbs
rate (`countLightboxFigures`) and the instance filter behind the quote gate
(`verifyLightboxInstance`) agree on contractions ('s, 'm, 're, 'd been,
ain't), on "being" in "was being", and on linking verbs (seem, become):
- if they disagree, fix it with a test that fails before the fix;
- if they agree, record why the withholding was correct, and make
  `58-steering.md` and the numbers task teach what counts as an instance, so
  readings stop missing.

## Webview

- **One tile, "Craft steering"**, full width, in the reading grid right after
  "What stands out in the numbers", with three sections, one per figure:
  - the measured block, solid, with its register chip: total, rate,
    narration and dialogue, the constructions as a bar and a key (each row
    hoverable, lighting its paragraphs), the short-run count;
  - the figure's reading, dashed, with its quotes;
  - the instance notes, dashed: a stance chip, the why, and the nudge under
    a "Worth a look" label (none for Earns), with its example, if any, under
    "One way it could go": the chapter's phrase, an arrow, the illustration,
    marked "an illustration, not your text", never drawn as a quote;
  - withheld readings and notes by their host titles, with reasons.
- **Hover and pin.** A measured row lights the paragraphs holding its
  instances (a new `steering` item ref, by figure and construction); a note
  lights its paragraph; every item pins to the inspector.
- **Inspector.** A note's stance, why, nudge, its example (or why it was
  withheld) and the instance check; a
  reading's figure and counts; a measured row's counts; evidence; Bring.
- **Numbers tile.** A standout among the three says "Read under Craft
  steering, below" where a reading would be.
- **Rail.** The Lenses card lists Craft steering; its caption says up to
  seven grouped calls.
- CSS stays on the Chromium 102 floor (`webviewCssFloor.test.ts`), with the
  existing `var(--pm-…)` tokens and no new `KNOWN` entries.

## Tests

- Measure: totals and rates equal to the numbers rows, with literal values;
  each construction rule and its named false positives; dialogue split;
  short runs at the threshold and one word over; tagger unavailable.
- The investigation's agreement tests.
- Codec: shape, vocabularies, bounds, duplicates, nudge presence, the text
  rules with their stated limits and plain-diagnosis controls; the numbers
  codec and gate refusing a steering figure.
- The example: kept when anchored; withheld alone (the note standing) on an
  earns note, as a second example, with a `before` outside the quote, cut
  mid-word or holding no instance, an `after` too long, the same as `before`,
  quoted or holding a forbidden word; re-checked on carry and at Bring;
  never in the digest, never a verified quote.
- Gates and carry: an instance quote, a found quote with no instance, a
  carried quote moved and one whose instance is gone; parity sweep and
  every-kind test.
- Prompts: the worked example (request byte-identical, response decoding
  with every quote exact), budgets pinned by the sync test, the maximal
  response under the cap.
- Digest: steering measured items, stances in, nudges out; the F example
  rebuilt.
- Bring: both kinds through the Workshop validator; a note refused when its
  instance is gone.
- Production root: a press through the real handler, runner and service
  (`LightboxSteeringRun`), with a stub engine: G sent beside A–E, F after it,
  the estimate pricing it, and a late or foreign reply never landing.
- Webview: the tile's measured block before any reading, notes with and
  without nudges, a note with an example, withheld notes, stale, hover
  lighting, the inspector and Bring.

## Evidence

Visual evidence in `docs/pr-reviews/evidence/lightbox-slice-4f-visual/`, the
4C/4D harness adapted, from real host output with a stub model, at 1440, 1000
and 500 px: each figure's section, a note with a nudge and its example, an
earns note without either, a withheld note, the stale state, the inspector,
and Bring. `facts.json` and `errors.txt` are committed; the harness fails
rather than skips. The bundle is built after `npm ci` into a real
`node_modules`, and its `webview.js` SHA-256 is recorded.

## Done when

On the *Alice* fixture, one press reads the chapter groups and Craft
steering beside them, then the Opinion. The steering tile shows each
figure's measured breakdown, equal to the numbers tile's bars, and the
reading's notes, each quote holding an instance by the figure's own
detector, with a nudge, and at most one anchored example, only where a note
leans or compensates. The numbers
lens no longer reads the three figures. Carried onto an edited chapter,
every note is held to the same rules a fresh read meets, and Bring carries a
note's quote, stance, why, nudge and its example, labelled as one.

## Implementation notes (2026-10-21)

This section records what landed and where it differs from the plan above.
The plan's own numbers were corrected in place where the budgets settled
them (a nudge's 120 characters, an example's 56); each is noted below.

### What landed

- **Contracts.** `LightboxReadingGroupId` gains `'G'` and `LightboxLensId`
  gains `'steering'`. The two kinds, `steering-reading` (counted-read) and
  `steering-note` (read), live in `shared/types/messages/lightboxSteering.ts`
  with the measure (`LightboxSteeringMeasure`, now required on
  `LightboxMeasuredSet`). The Opinion's measured refs gain
  `steering:<stat>`.
- **Host modules** (all in `LIGHTBOX_MODULES` and the boundary tests, each
  under 300 lines): `LightboxSteeringMeasure` (the counts), `…Wire` (decoded
  shapes, host titles), `…Phrasing` (the text rules), `…Codec` (the block),
  `…Tiles` (assembly, the example's anchor, the task lines) and `…Handoff`
  (Bring's quote check and points). `LightboxNumberInstances` exports the
  pattern instance filter both lenses use; the word-frequency tool exports
  `tagTextTokens` (offsets with tags; `tagPartsOfSpeech` is rebuilt on it,
  same output); Style Flags exports `STYLE_FLAG_WEAK_VERBS` (same list).
- **Shared constants.** `shared/constants/lightboxSteering.ts`: the stats,
  `LIGHTBOX_NUMBERS_READ_STATS` (sentence length, dialogue, passive voice),
  stance and construction labels, the example label, and the count lines
  the digest, Bring and the tile share.
- **Prompts.** `58-steering.md` and `46-example-group-g.md`; `52-numbers.md`
  reads 0–3 figures and names the three it leaves to steering;
  `00-lightbox-shared.md` names sentinel `G`. Examples 43 (group D) and 45
  (group F) are regenerated by the production builders: D's request no
  longer lists intensifiers and its intensifiers reading is gone; F's
  digest gains the steering items and cites D's renumbered tiles (D-11 →
  D-10, D-12 → D-11).
- **Webview.** `components/lightbox/LightboxSteering.tsx` (one full-width
  tile after the numbers), `hooks/domain/lightbox/lightboxSteering.ts`
  (sections, the `steering` item ref, inspector details) and
  `styles/lightbox/steering.css` (on the Chromium 102 floor; no `KNOWN`
  entry). Three measured-ramp colours the tier mix already used are now
  tokens (`--pm-lb-measured-ramp-2…4` in `tokens.css`).

### Where it differs from the plan

- **Budgets.** `steeringNudgeCharacters` is 120 (the plan said 160 in one
  place) and `steeringExampleCharacters` is 56 for both parts (the plan
  said 60 for `after`), so a brought nudge and a brought `before → after`
  each fit one Workshop point (120 characters). The prompt-budget test pins
  both relations. `numberReadings` drops from 6 to 3, one per figure the
  numbers lens still reads.
- **More than one example.** The first is read and the rest withheld with a
  host reason, as the coordinator's brief asked ("second example
  withheld"), not "none is shown".
- **Note titles** use Roman numerals ("Being verbs · note II"), the
  movement titles' rule, so the Opinion is never shown a host digit it
  might state (PR #157 F-01).
- **Bring points.** A reading carries Figure, By construction and Short
  runs (the run threshold stated: "0 in runs of 3 or more sentences of 8
  words or fewer"). A note carries Stance with the figure's label ("Leans ·
  Being verbs"), Nudge and "One way it could go", three points at most.
- **An example's `after`** is held to the word, quotation and figure rules
  but not to the instruction-opener check: it is a phrase, not a clause.
- **The numbers task** with nothing to read says so: "None of the figures
  this lens reads (sentence length, dialogue, passive voice) stands out in
  this chapter".
- **Withheld examples** say why, in the host's words: on a note that earns;
  one past the first; broken shape; a part too long; no change; a text rule
  (prefixed "Its example was withheld."); not anchored in the quote, fresh
  or carried.
- **The worked example's nudges** name the move and end "may be worth a
  look": two that opened "Worth a look:" read twice under the board's own
  label, found while making the evidence.
- **The lens card** caption counts the calls from the group list ("up to 7
  grouped calls").

### Found and fixed in review of my own tests

- The codec told a note's own refusals ("Its why was withheld. …") from a
  shape error by sniffing the message's first word, and "Its" did not match
  "It ", so those reasons gained "It broke the format:". A refusal is now
  its own error class (`SteeringNoteRefusal`), with literal tests for each
  reason.

### The being-verbs investigation

The rate (`countLightboxFigures`), craft steering's total and the quote
check all run `findBeingVerbs`, so they agree, line for line
(`LightboxBeingVerbsAgreement.test.ts`): contractions (she's, I'm, they're,
isn't, wasn't, ain't), linking verbs (seemed, became) and `_was_` count 0
and are no instance in all three; she'd been, was being (2), `*was*` and
would-be count and are instances in all three. The writer's readings were
withheld correctly: they quoted contractions and linking verbs (and one
quote was not in the chapter). Nothing was fixed in the detector. The task
line now says what an instance is, figure by figure, and names those
exclusions; `58-steering.md` says the same. The underscore case is tech
debt ([2026-10-21-lightbox-word-patterns-miss-underscore-emphasis](../../tech-debt/2026-10-21-lightbox-word-patterns-miss-underscore-emphasis.md)).

### Measured on the Alice opening (¶1–¶8, 508 words)

| Figure | Total · rate | Narration · dialogue | Constructions | Short runs |
|---|---|---|---|---|
| Being verbs | 17 · 33.5 | 15 · 2 | be + adjective 4, be + -ing 5, be + past participle 1, there or it + be 4, other 3 | 0 |
| Adverbs (-ly) | 7 · 13.8 | 7 · 0 | with a verb 4 (weak verbs 1), dialogue tag 0, before an adjective 1, before an adverb 0, other 2 | 0 |
| Intensifiers and fillers | 11 · 21.7 | 11 · 0 | before a generic word 4, before an adjective or adverb 4, other 3 | 0 |

Totals and rates equal the numbers rows, pinned with literal values. No
instance sits in a run of three short sentences under today's sentence
rule or under the coming fix that keeps a closing quotation mark with its
sentence (`epic/lightbox-sentence-rule`); the steering tests use fixtures
that hold under both rules.

### Prompts and the worked example

- Group G's request is the builder's byte for byte; its response decodes
  through the production codec with 3 readings, 7 notes, 3 anchored
  examples, 13 quotes exact and nothing withheld.
- The largest valid group G response (every field at its bound, every quote
  240 characters, 3 figures of 4 notes each, compact JSON, framed) is 12,586
  characters, under the 32,000 cap: no ceiling debt for G.
- Group F's digest on the example board: 45 items, 38 readings, 0 left out,
  about 4,020 tokens.
- Group G's typical output (1,600 tokens) is a guess, added to
  [the live-provider pass](../../tech-debt/2026-10-19-lightbox-live-provider-pass.md).

### Tests

New files: `LightboxSteeringMeasure`, `LightboxSteeringReadings` (codec,
text rules with the pinned list and its plain-diagnosis controls, the
example, the instance witnesses moved from the craft tests, gates, task
lines, the largest response), `LightboxSteeringCarry`,
`LightboxSteeringHandoff`, `LightboxBeingVerbsAgreement`,
`LightboxOpinionSteering`, the production-root `LightboxSteeringRun` (G sent
with A–E, F after G, the estimate, a re-read, a stop and a foreign frame),
`LightboxAppSteering` and `lightboxSteering` (webview). The prompt-budget
sync test pins the steering lens's ceilings, stances, forbidden list and
example label. Existing tests moved off the three figures onto sentence
length, dialogue and passive voice, and count seven calls.

Verification, base `20775cf` against this branch's head: 439 suites / 6,047 tests / 59 snapshots at the head, against 430 / 5,916 / 59 at base;
`npm run lint` 0 errors and the same 1,133 warnings, identical per file
and rule; typecheck clean; `npm run build` with `verify:bundle` OK (3
size warnings, as at base); `git diff --check` clean.

### Evidence

[`docs/pr-reviews/evidence/lightbox-slice-4f-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4f-visual/README.md):
eleven Lightbox states and the Workshop composer at 1440, 1000 and 500 px,
from real host output with a stub model; `errors.txt` empty. `webview.js`
SHA-256 `6c2963092fae2bf4c6565a2ade0aa01eb08a934a3acde099ab85979642f73468`
from a clean build after `npm ci`.

### Tech debt

- [Word patterns miss underscore emphasis](../../tech-debt/2026-10-21-lightbox-word-patterns-miss-underscore-emphasis.md) (Low)
- [Steering's construction breakdown is a heuristic](../../tech-debt/2026-10-21-lightbox-steering-construction-heuristics.md) (Low)
- [Lightbox modules near the size limit](../../tech-debt/2026-10-21-lightbox-modules-near-size-limit.md) (Medium)
- Group G's output guess, in [the live-provider pass](../../tech-debt/2026-10-19-lightbox-live-provider-pass.md) (Medium)
- [A steering example of one short form cannot anchor](../../tech-debt/2026-10-21-lightbox-steering-short-example-forms.md) (Low; PR #160 review)
- [Steering's counts do not open 4E's sentence well](../../tech-debt/2026-10-21-lightbox-steering-sentence-well.md) (Low; a follow-up from the 4E merge)

### For the writer

- Whether "be + past participle" should read adjectival participles ("she
  was tired") as *be + adjective*, which needs a word list (see the
  heuristics note).
- Whether a note should also be able to say a figure is the voice's own by
  design, beyond Earns (today that goes in the why or the friction).

### PR #160 review fixes and the 4E merge (2026-10-21)

Astra's review ([PR #160](../../../docs/pr-reviews/pr-160-lightbox-craft-steering-review.md))
found two P2 defects and one P3; each has a failing-before test on
`7bd016f`, and the author response there has the ledger.

- **F-01, a quadratic measure.** On one large paragraph, the measure
  rescanned per instance: tokens, dialogue spans, short-run sentences, and
  runs of fillers or adverbs. It runs with every board, lens on or off, so
  a valid 49,998-word paragraph blocked the board for about 5 s in Node
  and 80 to 100 s under Jest.
  - **Fix.** Tokens are read once and found by binary search. Each
    neighbour rule is one sweep. Short runs are one interval per run
    (`shortRunIntervals`, replacing `shortRunSpans`). Span membership is a
    binary search with the furthest end reached so far.
  - **Result.** The counts are unchanged, with literal values, across
    paragraph shapes. Work is counted through the tagger seam: 1,000
    sentences read 4,000 token slots, not about 2,000,000. That paragraph's
    board now builds in under a second.
- **F-02, an anchored example past its bounds.** Anchoring shows the
  chapter's text for the example's first part. A soft line break, a
  doubled space or a spaced dash made that longer than the reading's, or
  the same as its second part, and Bring then clipped the pair.
  - **Fix.** The pair as the chapter has it is held to the example's
    contract again, fresh, on carry and at Bring: each part's bounds, a
    change under the quote verifier's own fold, and one Workshop point.
  - **Result.** A pair that fails withholds the example alone, with a host
    reason. Bring carries the pair whole, or an "Example withheld" point.
- **N-01.** The numbers card no longer says nothing stands out when only a
  figure craft steering reads does.
- **The merge.** `epic/lightbox` at `1fe931a`: PR #158's Chromium 114
  floor, and PR #159's Slice 4E.
  - **Conflicts.** `styleFlags` (both exported the weak verbs),
    `wordFrequency` (4F's token stream now carries 4E's token length), the
    measured set, the messages barrel, `lightboxItems` and the shared docs.
    Each kept both sides.
  - **4E's passages test** now mocks `steering.css`.
  - **The CSS guard.** `steering.css` passes the new floor with nothing
    added to `KNOWN`.
  - **Not wired.** 4E's sentence well does not open steering's instances
    yet; that is recorded as tech debt.
- **Verification on the merged head:** 451 suites / 6,167 tests / 59 snapshots; lint 0 errors / 1,133 warnings, identical per file and rule; typecheck clean;
  `npm run build` with `verify:bundle` OK (3 size warnings, as before);
  `git diff --check` clean against `epic/lightbox`.
- **Evidence** was re-rendered from the merged bundle (`webview.js`
  SHA-256 `24658aba3f52180b878e3e08bb19cb03bf6ee07e1c432bdb11d4b9c590a71b59`).
  `facts.json` is identical; only 4E's board fields changed in the states.
