# Slice 4G: Being-verb contractions, and dialogue as voice

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D7 and its **third addendum (2026-10-21)**
**Writer decisions:** 26 (with 13, 20–24) in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** PR #162 on `epic/lightbox-being-contractions`, stacked on Slice 4F at `27b646a`, and merged with `epic/lightbox` twice: at `2f040ab` (PR #160) and at `1cb417c` (PR #161, the sentence rule). Reviewed at `2295f9d` (request changes: F-01, F-02, N-01); all three fixed, awaiting re-review.
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
- `'s` after a word (the span is `'s`), decided by the word-frequency tagger
  (wink, `tagTextTokens`), in this order:
  1. **has first, never counted:** been, got, gotten or **had** comes next,
     looking past adverbs (`RB*`: not, never, always, just) and emphasis
     marks ("he's been", "she's got", "it's had");
  2. **is where the tagger reads a verb** (`VB*`): "it's", "she's",
     "that's", "there's";
  3. **the next-word rule, where it reads a possessive** (`POS`; the
     writer's addition, for names and nouns): *is* before an adjective or a
     participle the tagger tags `VBN` ("Tobin's late", "Ivy's tired",
     "the door's shut"), an -ing word ("the dog's barking"), an adverb or
     not ("everyone's here", "Tobin's not coming"), a preposition or "to"
     ("Tobin's in the garden", "Tobin's to blame"), or a determiner (a, an,
     the, no; my, our: "Dinah's our cat"). It stays a possessive before a
     noun or a name ("the Rabbit's watch", "Alice's sister", "the Queen's
     croquet"), before a pronoun ("how's she?"), before "own" ("Alice's own
     sister"), before adjectives that a noun follows ("the Rabbit's white
     gloves", "Tobin's tired eyes"), and before anything else (a number, a
     mark, the end: "That one's Tobin's.");
- the negated forms isn't, aren't, wasn't, weren't and ain't (the span is
  the whole word). **Were they counted before? No.** A whole-word
  `\bwas\b` does not match inside "wasn't" ("was" runs on into "n"), and
  4F's agreement test pinned isn't, wasn't and ain't at 0;
- **ain't, decided explicitly:** counted as a being verb (am not, is not,
  are not), except before been, got, gotten or had, where it means *has
  not* ("I ain't got none", "I ain't had a cup"), by the same rule as `'s`;
- **'tis, 'twas and 'twere** (the writer's addition), one being verb each
  (*it is*, *it was*, *it were*), with a straight or curly apostrophe, or
  the ‘ a word processor puts there. The span is the word after the mark
  ("Tis"). The apostrophe opens the word, so it may follow a space or a
  quotation mark but not a letter; the word-joining rule never sees "is"
  inside "'tis", so nothing counts twice; "'twill" and "'tisket" are not
  forms.

Straight and curly apostrophes are the same. The tagger splits "it's" only
when the mark is straight, so it reads the text with curly apostrophes
straightened (`withStraightApostrophes`, the same length, so every offset
stands); craft steering's constructions tag the same text.

**Never counted:** `'s` as a possessive or as *has*, "let's" (let us; by
rule, not by the tagger), `'d`, `'ll` and `'ve`, a linking verb (seem,
become), and a form joined to an underscore (`_was_`). A word is letters
joined by apostrophes, so "am" inside "ma'am" and "being" inside "being's"
are not forms (the old pattern counted "Ma'am" as "am"); `'m` stands only
after I, so "ma'm" and "M'm" are not forms.

**Known limits, stated in the module and pinned by tests:**
- a participle other than been, got, gotten or had reads as *is*: "he's
  gone" and "Tobin's gone" count, though either may mean *has gone*;
- **an -ing word reads as *is*, the chosen reading of the ambiguity:** "the
  dog's barking" counts as *the dog is barking*, not *the barking of the
  dog*, and so "Tobin's sewing basket" counts, wrongly;
- an adverb reads as *is* wherever it stands, so "the Rabbit's very white
  gloves" counts; a pronoun keeps a possessive, so "how's she?" and
  "where's he?" are not counted;
- the next-word rule stands only where the tagger reads a possessive; where
  it reads a verb it is trusted, so "Tobin's every word" counts;
- when the tagger cannot load, no `'s` is counted, and "ain't" is read as
  *has not* only when the next word is been, got, gotten or had. Every
  reader shares the outcome, so the figures still agree.

**Work.** The tagger runs only on a paragraph holding an `'s` or an ain't
to decide, once per paragraph; the token lookup, the has check and the
next-word rule read one map and one backward sweep each, so a 33,332-word
paragraph of contractions is decided in one tagging (a test holds it to a
coarse bound).

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
  nothing to withhold, but carries a line all the same ("Its instance is in
  dialogue, the character's voice."), so the digest, the board, the
  inspector and Bring mark it as the character's voice for every stance
  (PR #162 N-01). In narration no line stands; one drawn before is dropped
  on carry.
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
- **The example** anchors only on an instance in narration, on a span that
  takes in no speech at all (no character of a `findDialogueSpans` span,
  its quotation marks included). On a narration note whose quote also
  holds speech, the note keeps its nudge, and an example whose first part
  holds only the spoken instance is withheld alone as voice; one that holds
  narration but crosses into a character's words, either way ("I’m cold,”
  she was crying", "She was shaking, “I’m so cold"), is withheld alone as
  speech: "Its example's first part takes in words a character speaks, the
  character's voice, so it is not shown." (PR #162 F-02). Fresh, on carry
  and at Bring.
- **Work grows with the text** (PR #162 F-01, `LightboxSpanIndex`). The
  quote check, the voice and the example's anchor ask one paragraph the
  same questions, so each paragraph is run through each figure's detector
  (tagging included) and the dialogue matcher once per text, keyed by the
  paragraphs array a verifier checks against and by each paragraph's
  string; each question is a binary search (instances sorted with the least
  end from each on; dialogue spans with the furthest end so far, the
  steering measure's own index, now shared).
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
  `"example": null`; dialogue means double quotation marks. Since the
  review (PR #162 F-02) its example line also says `before` holds "none of
  a character's spoken words (an example that takes in speech is
  withheld)". The sync test pins those sentences.
- The being-verbs task line (`lightboxPatternInstancePhrase`) lists the
  contracted forms and the exclusions. With the writer's three additions,
  both name the next-word rule ("the Hatter's late, everyone's here"),
  "it's had" as *has*, and 'tis and 'twas.
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
- **With the writer's three additions**, group G's request moved again
  (the task line) and was regenerated by its builder; every other request,
  F's digest included, still matches, and no response figure moved.

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

**The writer's three additions** fail at the first pushed head `ab22ebd`
and pass here (12 tests in four files, run against an export of it):
- `LightboxBeingVerbsAgreement`, with made-up names: Tobin’s late,
  everyone’s here, Ivy's not coming, the Hatter’s in the garden, the dog’s
  barking (pinned as *is*), ’Tis, 'Twas, ’twere, it’s had and ain’t had (now
  *has*). New controls that already held there and must keep holding:
  Alice’s sister, the Queen’s croquet, the Rabbit’s white gloves (adjectives
  before a noun), Alice’s own.
- `beingVerbs/index.test.ts`: the next-word rule (is: Tobin’s late, not,
  in, to, Ivy’s tired, very, our, the door’s shut; possessive: the Rabbit’s
  watch, Alice’s sister, the Queen’s croquet, the Hatter’s tea, Tobin’s Ivy,
  own, white gloves, tired eyes, That one’s Tobin’s), its pinned ambiguities
  (the dog’s barking and Tobin’s sewing basket as *is*; how’s she and
  where’s he as possessives), had, 'tis/'twas/'twere with their spans, and
  "don'tis", "'tisket", "'twill", "'twasn" as no forms. The file does not
  compile at `ab22ebd` (it imports `BEING_VERB_ELIDED_FORMS`).
- `LightboxSteeringReadings` (the task line) and `lightboxPromptBudgetsSync`
  (the prompt's sentences).
The controls let’s, he’s been, she’s got and ma’am are unchanged.

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
- With the writer's three additions:
  - `beingVerbs/index.test.ts`: the has words are been, got, gotten and
    had; "It's had its day" moved out of the "he's gone" limit (it is *has*
    now, 0), replaced there by "Tobin’s gone".
  - The task line and the prompt's sentences pin the new wording.

**The review fixes** ([PR #162 review](../../../docs/pr-reviews/pr-162-lightbox-being-contractions-review.md),
Astra at `2295f9d`: F-01, F-02, N-01) fail on an export of `2295f9d` and
pass here: 19 tests in five files, and two files that do not compile there.
- `LightboxSteeringNoteScale` (new, F-01, 7, all failing there): detector
  and dialogue-matcher calls and dialogue-span `start` reads counted
  through fresh assembly, carry and Bring. Four notes on one paragraph:
  13 detections and 8 matches there, 1 and 1 here; reads at 250 / 500 /
  1,000 spans 376,500 / 1,503,000 / 6,006,000 there, 748 / 1,498 / 2,998
  here; a 100-paragraph control (4 and 4 here); 50,000 words under a
  coarse 2 s bound (16 s there, about 0.5 s here, under Jest).
- `LightboxSpanIndex` (new, F-01, 6; does not compile there): every answer
  equals the plain scan for every span of three mixed paragraphs, all
  three figures; once per text; a paragraph changed in place is indexed
  afresh.
- `LightboxSteeringSpokenExamples` (new, F-02, 7; 5 failing there, 2
  controls passing): the review's witness and its mirror, in straight
  typography against curly, fresh; carried when a stray closing mark
  becomes a pair, and with relocation for a crossing example held before
  the fix, both ways; Bring for both.
- `LightboxSteeringVoiceRule` (N-01, 4 new and 1 changed, all failing
  there): an Earns note in dialogue for all three figures, fresh, on carry
  (in and out), in the digest and at Bring.
- `LightboxAppSteering` (N-01, 1 new): the tile and the inspector.
- `lightboxPromptBudgetsSync`: the prompt's new example clause.
- `LightboxSteeringVoice` (does not compile there): the `earns` line and
  the field rule.

Changed by the review fixes: the fresh `LightboxSteeringVoiceRule` test's
Earns note in dialogue now shows "Its instance is in dialogue, the
character's voice." (N-01), and `holdLightboxSteeringVoice` returns an Earns
note in dialogue with that line rather than the same object.

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

**The writer's three additions move none of the *Alice* fixtures** (Tea-Party
in both settings and Chapter I): their forms are identical at `ab22ebd` and
at the head, and no standout flips. On four lines written for the evidence
with made-up names (56 words), being verbs go 1 (`1cb417c`) → 3 (`ab22ebd`)
→ 7 (head): Tobin’s late, everyone’s here, the kettle’s boiling, ’Tis, ’Twas
and the cat’s asleep counted; It’s had and ain’t had now *has*; Ivy’s
sister, the Hatter’s watch and Tobin’s own stay possessives.

## Verification

| Check | Slice 4F `27b646a` | Before the 161 merge (`24a364f`) | `epic/lightbox` `1cb417c` | This branch, merged (`ab22ebd`) | With the writer's three additions (`4a3ecf6`) | Review fixes (`2a1ac93`) |
|---|---|---|---|---|---|---|
| `npx jest` | 451 suites / 6,167 tests / 59 snapshots | 453 / 6,220 / 59 | 456 / 6,259 / 59 | 458 suites / 6,312 tests / 59 snapshots | 458 suites / 6,329 tests / 59 snapshots | 461 suites / 6,354 tests / 59 snapshots |
| `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule | 0 errors / 1,133 warnings | Identical per file and rule to both bases | Identical per file and rule to `1cb417c` | Identical per file and rule to `1cb417c` |
| `npm run typecheck` | Passes | Passes | Passes | Passes | Passes | Passes |
| `npm run build` (with `verify:bundle`) | Passes (3 size warnings) | Passes | Passes | Passes (the same 3) | Passes (the same 3) | Passes (the same 3) |
| `git diff --check` | | | | Clean against both bases | Clean against `1cb417c` | Clean against `1cb417c` |

- Built after `npm ci` into a real `node_modules`. At the merged head
  `webview.js` SHA-256 is
  `20d3aed38676380185d8e6c680c37a75f33e7be6599038838d709bb95a0472aa`
  and `extension.js` `6b8a10c3…`, each reproduced by a second build. With
  the three additions, after a fresh `npm ci`, `webview.js` is the same
  `20d3aed3…` (the additions are host-side) and `extension.js` is
  `cc95e6df683f4c218c69e7236a9b9cc0ec016a9fdcc9980ba33967d6be3380ea`. With
  the review fixes, after a fresh `npm ci`, `webview.js` is still
  `20d3aed3…` and `extension.js` is
  `6fffedac89ad2e544aca8695353567e0461e6d7cb366bcd04c7ea8a6bd4f069d`. (Before
  the 161 merge: `c25e16f0…`; the epic recorded `cb08d7b9…` at
  `1cb417c`. Webpack's production ids come from file paths, so a build of
  an export elsewhere gives other hashes and is not compared.)
- The new and changed tests fail at both bases (34 tests in six files) and
  pass here; the additions' tests fail at `ab22ebd` (12 tests in four
  files) and pass here; the review fixes' tests fail at `2295f9d` (19 tests
  in five files, two more files not compiling) and pass here.
- The evidence does not move with the review fixes: the builder writes
  `states/after.json` and `figures-after.json` byte-identical, and
  `webview.js` is unchanged, so the PNGs stand.
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
- **Decided (the writer's three additions):** the next-word rule for `'s`
  after names and nouns, *has* before had, and 'tis, 'twas and 'twere.
- **Still ambiguous, by the next-word rule:** an -ing word reads as *is*
  ("the dog's barking", and wrongly "Tobin's sewing basket"); a participle
  reads as *is* ("Tobin's gone"); an adverb reads as *is* even before
  adjectives and a noun ("the Rabbit's very white gloves"); a pronoun keeps
  a possessive ("how's she?"). Change any of these readings?
- **Single-quoted dialogue** (British style, or Gutenberg's) reads as
  narration, so notes there get nudges, and a leaning note with none there
  is withheld.
- **Group G's worked example** has no note in dialogue. Adding one would
  teach the null-nudge shape by example; it would also move group F's
  example, which cites G's tiles.
