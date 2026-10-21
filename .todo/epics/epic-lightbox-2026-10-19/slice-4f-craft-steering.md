# Slice 4F: Craft Steering (Group G)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3, D4, D6, D7 and its **second addendum (2026-10-21)**, D11
**Writer decisions:** 13 (amended), 20–24 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Planned on `epic/lightbox-slice-4f-steering`, from `epic/lightbox` at `20775cf`. Slice 4E (reading aids in the inspector) is built in parallel on `epic/lightbox-slice-4e-inspector`; it will probably merge first, and this slice merges it in afterwards.
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
  seven grouped calls").

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
  string of at most `steeringNudgeCharacters` (160) when the stance leans or
  compensates, and `null` when it earns. A note that breaks a rule is
  withheld by its host title ("Adverbs (-ly) · note 2"), never its words.
- `example` (decision 23, the writer's choice): `null`, or one `{before,
  after}`. It is the nudge applied to the quoted instance, an illustration,
  never a replacement for the writer's text. A fault in it withholds **the
  example alone**, with a host reason the note shows; the note stands:
  - an example on a note that earns;
  - more than one (a list of two or more: none is shown);
  - `before` not a run of whole words of the note's **checked quote**, or a
    run that holds no instance of the figure (checked by code, with the
    figure's instance filter, on the quote's own span), or longer than
    `steeringExampleBeforeWords` (8) words;
  - `after` empty, longer than `steeringExampleAfterWords` (6) words or
    `steeringExampleCharacters` (60) characters, the same as `before`
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

Titles are the host's: the figure's label, and "<label> · note n".

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
| `steering-reading` | its quotes, re-checked with the instance filter | "Figure": the host's total, rate, narration and dialogue |
| `steering-note` | its quote, re-checked with the instance filter, or refused | "Stance"; "Nudge" (leans or compensates); "One way it could go (an example)": `before → after`, only while its `before` still lies in the re-checked quote and holds an instance; "Figure": the figure's label |

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
  steering" where a reading would be.
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
