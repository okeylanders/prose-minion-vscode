# Slice 4G: Being-verb contractions, and dialogue as voice

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D7 and its **third addendum (2026-10-21)**
**Writer decisions:** 26 (with 13, 20–24) in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Implemented on `epic/lightbox-being-contractions`, stacked on Slice 4F at `27b646a`, and merged with `epic/lightbox` twice: at `2f040ab` (PR #160) and at `1cb417c` (PR #161, the sentence rule). Awaiting review.
**Follows:** [Slice 4F](slice-4f-craft-steering.md), whose being-verbs investigation this revisits.

## Why

Slice 4F found the writer's withheld being-verbs reading was withheld
correctly: the model quoted "it's" and "I'm", and the detector counted only
whole-word forms of be. The writer's answer: **"Yes, count them."** In a
dialogue-heavy chapter, being verbs mostly appear as contractions, so a
whole-word count undercounts the figure the chapter actually has.

Being verbs are a craft signal in **narration**. In **dialogue** they are
the character's **voice**. The coordinator's default is that this holds for
all three steering figures (being verbs, adverbs, intensifiers); the writer
can narrow it to being verbs only.

## The rule, as implemented (`tools/measure/beingVerbs`)

One detector, `findBeingVerbs`, feeds every reader: the numbers row and its
standout, the writer's average (`LightboxWriterBaseline`), craft steering's
totals, rate and constructions, and the quote check
(`lightboxPatternInstanceFilter`). Each match spans the form of be as
written, so a quote holds an instance exactly when it holds that span.

**Counted:**
- the whole words am, is, are, was, were, be, been, being;
- `'m` after the word I ("I'm"; the span is `'m`);
- `'re` after any word ("you're", "we're", "they're"; the span is `'re`);
- `'s` after a word ("it's", "she's", "that's", "there's"; the span is
  `'s`) only when the word-frequency tagger (wink, `tagTextTokens`) reads it
  as a verb (`VB*`), not a possessive (`POS`), and it is not *has*: not
  followed by been, got or gotten, looking past adverbs (`RB*`: not, never,
  always, just) and emphasis marks;
- the negated forms isn't, aren't, wasn't, weren't and ain't (the span is
  the whole word). **Were they counted before? No.** A whole-word
  `\bwas\b` does not match inside "wasn't" ("was" runs on into "n"), and
  4F's agreement test pinned isn't, wasn't and ain't at 0;
- **ain't, decided explicitly:** counted as a being verb (am not, is not,
  are not), except before been, got or gotten, where it means *has not*
  ("I ain't got none"), by the same rule as `'s`.

Straight and curly apostrophes are the same. The tagger splits "it's" only
when the mark is straight, so it reads the text with curly apostrophes
straightened (`withStraightApostrophes`, the same length, so every offset
stands); craft steering's constructions tag the same text.

**Never counted:** `'s` as a possessive ("the Rabbit's watch") or as *has*
("he's been", "she's got", "he's gotten"), "let's" (let us; by rule, not by
the tagger), `'d`, `'ll` and `'ve`, a linking verb (seem, become), and a
form joined to an underscore (`_was_`). A word is now letters joined by
apostrophes, so "am" inside "ma'am" and "being" inside "being's" are not
forms (the old pattern counted "Ma'am" as "am"); `'m` stands only after I,
so "ma'm" and "M'm" are not forms.

**Known limits, stated in the module and pinned by tests:**
- an ambiguous `'s` before a participle counts as *is*: "he's gone" counts,
  though it may mean *has gone*, and so does "it's had its day" (had is not
  on the has list);
- the tagger reads `'s` after a noun as a possessive more often than not,
  even where it is *is* ("the dog's barking", "everyone's here"), and after
  how or where; those are not counted;
- "'tis" and "'twas" are not counted (the apostrophe opens the word);
- when the tagger cannot load, no `'s` is counted, and "ain't" is read as
  *has not* only when the next word is been, got or gotten. Every reader
  shares the outcome, so the figures still agree.

**Work.** The tagger runs only on a paragraph holding an `'s` or an ain't
to decide, once per paragraph; the token lookup and the has check are one
map and one backward sweep, so a 33,332-word paragraph of contractions is
decided in one tagging (a test holds it to a coarse bound).

## Dialogue is voice (`LightboxSteeringVoice`)

A host rule, not only a prompt instruction:

- **Where the instance stands.** The note's checked quote is found again
  through the figure's instance filter, as the quote check found it. It is
  in dialogue when every instance of the figure its span holds lies inside a
  `findDialogueSpans` span, the split the steering measure counts. That
  matcher's limit applies: single-quoted speech (‘…’, or Gutenberg's '…')
  reads as narration. A quote holding an instance in narration is a
  narration note.
- **In dialogue,** a note that leans or compensates keeps its stance and
  may name a pattern, but any nudge or example the reading gave is withheld,
  with the host's reason in `voice` ("In dialogue"). A note that gave none,
  as the prompt asks, shows the board's own line. A note that earns has
  nothing to withhold.
- **Fresh** at assembly (`LightboxSteeringTiles`, through the claim
  assembler), **on carry** (`LightboxCarryQuotes`, `LightboxStaleReadings`:
  an instance moved into dialogue loses its nudge; one moved out of
  dialogue with no nudge is withheld) and **at Bring**
  (`LightboxSteeringHandoff`: the quote as it travels is placed again; a
  note in dialogue brings its stance and the "In dialogue" line, never a
  nudge or example).
- **The codec** reads `"nudge": null` on a note that leans or compensates
  (the shape for dialogue). Where the instance stands is the chapter's
  question, so **the gate** withholds such a note in narration, fresh and
  carried (`LightboxTileGates`, `steeringNoNudge`).
- **The example** anchors only on an instance in narration: on a narration
  note whose quote also holds speech, an example whose first part holds
  only the spoken instance is withheld alone, with its own reason.
- **The Opinion's digest** marks a note in dialogue ("in dialogue: the
  character's voice, read but not steered") beside its stance; it still
  never holds a nudge or an example.
- **A nudge that breaks the text rules** still withholds its note, in
  dialogue too: the fence is checked when the reading is decoded, before
  the chapter says where the instance stands.

## Prompts

- `58-steering.md` teaches what a being-verb instance is, contractions
  included, and that dialogue is voice: a note on an instance in dialogue
  may read the pattern, with any stance, but gives `"nudge": null` and
  `"example": null`; dialogue means double quotation marks. The sync test
  pins those sentences.
- The being-verbs task line (`lightboxPatternInstancePhrase`) lists the
  contracted forms and the exclusions.
- `52-numbers.md` names being verbs only to say craft steering reads them;
  unchanged. `promptBudgets` is unchanged and its sync tests pass.

## Worked examples

- **Group G** (`46-example-group-g.md`): its request moved (the being-verbs
  task line) and was regenerated by the production builder. Its response
  is unchanged and still decodes with every quote exact and nothing
  withheld: its notes are all in narration.
- **Groups A–E** and **F**: unchanged. Chapter I's opening holds no
  contraction of be, so no count, standout or digest line moves.
- **After merging PR #161** (`1cb417c`), regenerated from the builders
  again: group D's request, group G's and group F's digest (its steering
  items included) all match, with no change; F keeps #161's sentence
  figures (15 sentences, 33.9 words per sentence). No response figure
  needed fixing.

## Elsewhere

- **The Metrics tab** does not read `findBeingVerbs` or any being-verb
  figure. Style Flags' "Weak Verbs" mixes whole-word be forms with
  has/have/do/make/get and is unchanged.
- **Publishing standards** hold no range for being verbs (the numbers
  compare only sentence length and dialogue with a preset), so nothing
  there needs a new basis.
- **The writer's average** counts contractions in their other chapters too,
  so a being-verb standout compares like with like. The tagger adds work on
  first measure (it caches per file): about 2 µs a word on paragraphs that
  hold an `'s`.

## Tests

Each fails before the change and passes here, with literal values: 34
failing tests in six files, both at Slice 4F's head `27b646a` and at
`epic/lightbox` `1cb417c`, run against an export of each:
- `LightboxBeingVerbsAgreement` (rate, steering total and quote check agree
  line for line): I'm, I’m, you’re, we're, they’re, it’s, she's, that’s,
  there's, isn’t, aren't, wasn’t, weren't, ain’t, he’s gone; controls the
  Rabbit’s watch (curly and straight), let’s, she’s got, he’s gotten, ain’t
  got, she’d, we’ll, they’ve, ma’am, a linking verb, `_was_`; he’s been and
  he’s never been (the whole word "been" is the one instance); she’d been,
  was being, `*was*`, would-be; public-domain *Alice* dialogue paragraph by
  paragraph; and a board's numbers row equal to steering's count.
- `LightboxSteeringVoiceRule`: fresh (all three figures, a nudge given and
  none given, narration beside them, the gate in narration, single quotes,
  an example on a mixed quote), carried (into dialogue, out of dialogue,
  unchanged), at Bring (in dialogue, narration, and a quote that now stands
  in dialogue) and the digest line.
- `LightboxSteeringMeasure`: contractions split into dialogue, and sorted
  by construction, curly and straight alike.
- `LightboxAppSteering`: a note in dialogue drawn with its stance and the
  "In dialogue" line beside a narration note's nudge and example, and in
  the inspector.
- `lightboxPromptBudgetsSync`: the prompt teaches both rules.
- Also new: `beingVerbs/index.test.ts` (each form, each control, the
  tagger-less fallback, tagging only when needed, a large paragraph) and
  `LightboxSteeringVoice.test.ts` (where an instance stands, the host's
  words, the field rule).

**Expectations changed, and why:**
- `beingVerbs/index.test.ts`: "does not count contractions (the stated
  limit)" is now the opposite, by decision 26.
- `LightboxBeingVerbsAgreement`: contractions and negated forms move from
  0 to counted; `ma’am` is a new control.
- `LightboxSteeringReadings`:
  - "being verbs, a contraction" now keeps "She’s gone" as an instance and
    withholds "She stopped";
  - the withheld-note case quotes "She stopped", which holds none, since
    "She’s gone" now does;
  - a leaning note with a null nudge in narration is withheld by the gate
    at assembly, after the codec's own refusals, with the reason "It leans
    or compensates in narration, so it names the craft move worth a look,
    and this one names none." The codec used to refuse it.
  - The task line pins the new wording.

## Measured on *Alice*

Full table in the
[evidence](../../../docs/pr-reviews/evidence/being-contractions/README.md#before-and-after-on-the-alice-fixtures).

| Fixture | Being verbs | Rate per 1,000 | Narration · dialogue | Short runs | Standout |
|---|---|---|---|---|---|
| Ch. I ¶1–¶8 (worked examples) | 17 → 17 | 33.5 → 33.5 | 15 · 2 → 15 · 2 | 0 → 0 | none (1.34×) |
| Ch. VII opening, curly (PR #161's `TEA_PARTY_CURLY`) | 17 → 26 | 39.1 → 59.8 | 11 · 6 → 11 · 15 | 0 → 0 | above your average, 1.56× → 2.39×, no flip |

Before is `epic/lightbox` at `1cb417c`. Adverbs and intensifiers keep every
count on every fixture. Under the old sentence rule (`27b646a`) one new
instance sat in a run of short sentences (0 → 1); the merged rule, which
keeps closing marks and joins lower-case speech tags, puts none there.

## Verification

| Check | Slice 4F `27b646a` | Before the 161 merge (`24a364f`) | `epic/lightbox` `1cb417c` | This branch, merged |
|---|---|---|---|---|
| `npx jest` | 451 suites / 6,167 tests / 59 snapshots | 453 / 6,220 / 59 | 456 / 6,259 / 59 | 458 suites / 6,312 tests / 59 snapshots |
| `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule | 0 errors / 1,133 warnings | Identical per file and rule to both bases |
| `npm run typecheck` | Passes | Passes | Passes | Passes |
| `npm run build` (with `verify:bundle`) | Passes (3 size warnings) | Passes | Passes | Passes (the same 3) |
| `git diff --check` | | | | Clean against both bases |

- Built after `npm ci` into a real `node_modules`. At the merged head
  `webview.js` SHA-256 is
  `20d3aed38676380185d8e6c680c37a75f33e7be6599038838d709bb95a0472aa`
  and `extension.js` `6b8a10c3…`, each reproduced by a second build. (Before
  the 161 merge: `c25e16f0…`; the epic recorded `cb08d7b9…` at
  `1cb417c`. Webpack's production ids come from file paths, so a build of
  an export elsewhere gives other hashes and is not compared.)
- The new and changed tests fail at both bases (34 tests in six files) and
  pass here.
- No live or billable call.

## Evidence

[`docs/pr-reviews/evidence/being-contractions/`](../../../docs/pr-reviews/evidence/being-contractions/README.md):
the numbers row before and after, craft steering before and after (a note
in dialogue without a nudge beside a narration note with one), and the
inspector, at 1440 and 500 px; `facts.json` and an empty `errors.txt`.

## For the writer

- **Dialogue is voice for all three figures**, the coordinator's default.
  Narrow it to being verbs only if adverbs and intensifiers in speech should
  still get nudges.
- **The tagger's `'s`.** After a noun, or after here, how or where, the
  tagger often reads `'s` as a possessive, so "the dog's barking" and
  "everyone's here" are not counted. A short word list could add them, at
  the cost of a rule that is no longer the tagger's.
- **Has.** Only been, got and gotten make `'s` *has*; "it's had its day"
  counts as *is*. Add had?
- **'tis and 'twas** are not counted.
- **Single-quoted dialogue** (British style, or Gutenberg's) reads as
  narration, so notes there get nudges, and a leaning note with none there
  is withheld.
- **Group G's worked example** has no note in dialogue. Adding one would
  teach the null-nudge shape by example; it would also move group F's
  example, which cites G's tiles.
