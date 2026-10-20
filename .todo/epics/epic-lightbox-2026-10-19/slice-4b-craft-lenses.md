# Slice 4B: Craft Lenses (Group D)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3 (kinds), D4 (stale carry), D6 (groups), D7 (and its 2026-10-20 addendum), D11
**Design:** [`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html) sections 2, 3 and 6 (draft, 2026-10-20)
**Writer decisions:** 10–14 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Implemented on `epic/lightbox-slice-4b-craft`, from `epic/lightbox` at `eca952a`; awaiting review. See [Implementation notes](#implementation-notes-2026-10-20)
**Before:** Slice 5. The saved-board format must hold these kinds (decision 14).

## Outcome

A fourth reading group, **Group D · Craft**, joins the press as one more
call on the assistant model. It reads three lenses:

- **Stock & signature.** Where the chapter spends the reader's attention:
  its signature phrases; its familiar phrasing (idiom, cliché, stock phrase,
  stock carrying weight), each phrase counted by code; the cognitive-economy
  tier mix, counted by code from the beats the reading classified; air-lock
  passages (closure-complete lines that could stand alone, a craft signal,
  not a risk); and **echoes**, aphoristic lines that "sound reminiscent of"
  something, always shown with an accuracy callout.
- **Rhythm & handoffs.** Measured: sentence lengths per paragraph (the
  prose-stats sentence splitter), the mean, the longest sentence and how many
  very short ones. Read: how each paragraph (ribbon column) ends, Lands,
  Holds or Opens; whether sentences move toward conclusion; and up to three
  handoff samples, each a pair of adjacent sentences with what is carried,
  what changes and the effect. **Code checks that both quotes are adjacent
  sentences in one paragraph.**
- **What stands out in the numbers.** Measured: each candidate figure,
  marked as a standout when it falls outside its publishing-standards range
  or far from the writer's own average. Read: for each standout, how it is
  used here, "reads as deliberate", "reads as mixed" or "reads as habit",
  with quotes. **Code checks that each quote holds an instance of the
  flagged pattern, with the detector that counted it.** Nothing says "fix"
  or "cut".

Every tile follows the board's rules: the host derives its register, quotes
are checked against the paragraph they name, withheld items are named, the
model gives no counts, every lens names its friction, and readings describe,
never grade.

## Groups and lenses

- `LightboxReadingGroupId` gains `'D'`; `LIGHTBOX_READING_GROUPS` is A–D, so
  every board carries four groups, the planner (`lightboxPlannedCalls`)
  plans D like any other, and a group with no lens on is not called.
- Lenses, in rail order, all in group D: `stock` ("Stock & signature"),
  `rhythm` ("Rhythm & handoffs"), `numbers` ("The numbers"). They join
  `LIGHTBOX_LENSES` (rail toggles, estimate key, re-read rows) and the
  estimate's group plan.
- The runner's default concurrency becomes the number of groups, so D runs
  beside A–C.
- Typical output tokens per lens (`LIGHTBOX_TYPICAL_OUTPUT_TOKENS`) are
  **guesses** from the worked example's length, labelled so in the code,
  until Slice 6 measures them: stock 2,000, rhythm 700 plus 3 tokens per
  ribbon column (one ending each), numbers 650.

## Prompts

- `50-stock-signature.md`, `51-rhythm-handoffs.md`, `52-numbers.md`, and a
  Group D worked example, `43-example-group-d.md`, read on the same eight
  paragraphs of *Alice's Adventures in Wonderland* ch. I as the other
  examples. The example's request is the production builder's output byte
  for byte, and its response decodes through the production codec and
  verifier with every quote exact (tests).
- The prompts adapt the **concepts** of the Writing Tools focus prompts
  (`stock-and-signature.md`, `cliche.md`, `fresh.md`, `craft-steering.md`),
  not their report formats: no ratios to hit, no revision priorities, no
  sample rewrites, no "action" lines.
- **Le Guin.** The rhythm lens keeps Craft Steering's rule: it is the
  board's own reading, inspired by *Steering the Craft*'s attention to sound
  and sentence handoffs; it never impersonates Ursula K. Le Guin, never
  quotes her or invents a page reference, and never presents its categories
  as her rubric. A prompt test pins the sentence.
- **Echoes, not provenance.** The stock lens never says a line is copied,
  plagiarized, from a source or "likely" anything, and gives no percentage.
  It says what a line sounds reminiscent of, as a lead worth a look.
- **Numbers.** The task section lists the board's measured standouts by id,
  each with what an instance looks like (for example "a run containing was,
  were, been or being followed by a word ending in -ed"). The lens reads only
  those, never restates a figure, and never tells the writer to fix, cut,
  trim, reduce or replace anything.
- The shared prompt's sentinel line names group D.
- Bounds join `PROMPT_BUDGETS.lightbox`, pinned to the prompt text by the
  sync test: `stockBeats` 40, `signaturePhrases` 4, `familiarPhrases` 6,
  `airLocks` 3, `echoes` 3, `handoffs` 3, `numberReadings` 6.

## The wire format

One frame, `===LIGHTBOX_GROUP_D_V1===`, with `"version": 1` and the keys the
task lists: `"stock"`, `"rhythm"`, `"numbers"`.

```
"stock": {
  "economy":  {"note": "...", "beats": [{"para": 2, "quote": "...", "tier": "functional"}]},
  "signature": [{"title": "...", "note": "...", "evidence": [{"para": 7, "quote": "..."}]}],
  "familiar":  [{"phrase": "...", "kind": "idiom", "note": "...", "evidence": [...]}],
  "airLocks":  [{"title": "...", "note": "...", "evidence": [...]}],
  "echoes":    [{"title": "...", "reminiscentOf": "...", "note": "...", "evidence": [...]}],
  "friction": "..."
}
"rhythm": {
  "endings":  ["lands", "holds", "opens", ...],   // exactly one per ribbon column
  "movement": "...",                              // do sentences move toward conclusion?
  "evidence": [{"para": 7, "quote": "..."}],
  "handoffs": [{"from": {"para": 8, "quote": "..."}, "to": {"para": 8, "quote": "..."},
                "carried": "...", "changes": "...", "effect": "continues"}],
  "friction": "..."
}
"numbers": {
  "items": [{"stat": "intensifiers", "usage": "deliberate", "claim": "...", "evidence": [...]}],
  "friction": "..."
}
```

Closed vocabularies: tiers `functional | decorated | weighted | signature`;
familiar kinds `idiom | cliche | stock | weighted`; endings
`lands | holds | opens`; handoff effects `continues | pause | closure | loses`;
usage `deliberate | mixed | habit`; stats are the host's ids (below).

## Tile kinds

| Kind | Lens | Register | What it holds |
|---|---|---|---|
| `stock-tiers` | stock | counted-read | The economy note (claim), the beats found with their tiers, and the **host's** count per tier and in all |
| `signature` | stock | read | A signature phrase, its note |
| `familiar-phrase` | stock | counted-read | The phrase, its kind, its note, and the host's count and paragraphs |
| `air-lock` | stock | read | A closure-complete line, its note |
| `echo` | stock | read | A line, what it sounds reminiscent of, its note |
| `rhythm-endings` | rhythm | read | One ending per ribbon column (`null` where a carried column changed), the column keys, the movement claim |
| `handoff` | rhythm | read | Two adjacent sentences (`from`, `to`), carried, changes, effect |
| `number-usage` | numbers | counted-read | The stat id, the usage, the claim |

Titles a withheld claim is named by are host-made where the reading has no
title of its own ("Cognitive economy", "Handoff in ¶8", a stat's label), so
no unchecked words are shown as a title.

## Codec rules

- `strictObject` on every object: a field the format does not define is
  counted, never named; every reason is host-owned.
- Friction is required of each block; a block without it is withheld.
- Each list is bounded; an item that breaks its own rules is withheld by its
  title while its siblings survive.
- **Stock.** A beat's tier and a phrase's kind must be in their vocabulary.
  An echo whose `title`, `reminiscentOf` or `note` holds a `%` or the word
  "percent" is withheld (no likelihoods). A digit alone is allowed: a
  source's name can hold one ("Nineteen Eighty-Four, chapter 1"). The
  `economy` object is required; its `beats` may be empty.
- **Rhythm.** `endings` has exactly one entry per ribbon column, each in the
  vocabulary, or the block is withheld (the tension rule). A handoff's
  effect must be in its vocabulary.
- **Numbers.** `stat` must be one of the host's ids; a stat given twice
  keeps its first reading. A claim holding a directive word from
  `LIGHTBOX_NUMBERS_DIRECTIVE_WORDS` (fix, cut, trim, remove, reduce,
  replace, rewrite, revise, delete, tighten, eliminate, should, must,
  consider, try) is withheld, and so is a claim that states a figure: a
  digit outside a ¶ address, a `%` or "percent" (the spark's bare-digit
  rule, shared). **The limit, stated:** word lists, not a parse; a
  directive phrased without a listed word passes, as does a figure in words
  ("twice as often"), and a listed word used descriptively ("the cut of her
  coat") is withheld, the safe failure. Tests pin each.
- The model never supplies a count: no field carries one.

## Measured parts (host only, no model)

- **Paragraph sentences.** Each `LightboxParagraphMetric` gains
  `sentenceWords`: the word count of each sentence in the paragraph, by
  `proseSentenceSpans` and the prose-stats word rule. The board's
  `measured.sentences` holds the longest sentence (words, paragraph) and the
  count of very short ones (under `LIGHTBOX_VERY_SHORT_SENTENCE_WORDS`, 6).
  The mean is the headline's `averageWordsPerSentence`, so the board shows
  one mean.
- **The numbers** (`measured.numbers`, `LightboxNumbers`). Six candidate
  figures, each with its detector, which is the detector that counts it:

  | Id | Figure | Detector | Ranges | Standout directions |
  |---|---|---|---|---|
  | `sentence-length` | words per sentence | the prose-stats sentence splitter | the preset's `avg_words_per_sentence` | above, below |
  | `dialogue` | % of words in dialogue | `findDialogueSpans` | the preset's `dialogue_percentage` | above, below |
  | `passive-voice` | per 1,000 words | Style Flags' passive pattern | none | above |
  | `being-verbs` | per 1,000 words | **new**, `tools/measure/beingVerbs` | none | above |
  | `adverbs` | -ly words per 1,000 words | Style Flags' adverb pattern | none | above |
  | `intensifiers` | intensifiers and fillers per 1,000 words | Style Flags' filler list | none | above |

  - **Style Flags' detectors** become exported functions the class calls
    (no change to Metrics output, pinned by its tests), so the board counts
    and checks with the same code.
  - **Being verbs** is the one missing detector: `am, is, are, was, were, be,
    been, being` as whole words, case-insensitive. Its limit: contractions
    (`she's`, `I'm`, `they're`) are not counted. It lives in
    `tools/measure/beingVerbs` with its own tests.
  - **A standout** is a figure outside its preset range (the board's
    existing standards comparison), or at least 1.5 times, or at most two
    thirds of, the writer's own average (`LIGHTBOX_STANDOUT_RATIO`), given
    enough material on both sides (at least 3 instances in the chapter for
    a pattern, and a baseline of at least 2,000 words). A pattern rarer than
    usual is shown but does not stand out: absence cannot be quoted.
  - **An instance**, per figure: a pattern match (passive, being verb,
    adverb, intensifier); for sentence length, a sentence beyond the
    standout's reference (the range bound it broke, else the writer's
    average); for dialogue, a run inside dialogue (above) or wholly outside
    it (below). Each row carries its instance count and the paragraphs
    holding one, so hovering a row lights them.
- **The writer's own average** (`LightboxWriterBaseline`), built at the
  composition root and given to `LightboxService`:
  - **Source.** The configured resources catalog (the one the project
    picker browses): the `chapters` group's Markdown and text files, or the
    `manuscript` group's when `chapters` is empty. The board's own file is
    left out, so the comparison is the chapter against the rest.
  - **Bounded.** At most `LIGHTBOX_BASELINE_FILES` (40) files, sorted by
    path, each at most 1 MB; reading stops at `LIGHTBOX_BASELINE_WORDS`
    (300,000) words. The board says how many files and words it used.
  - **Cached.** Each file's counts are cached by absolute path, size and
    modified time, so a rebuilt board reads only changed files.
  - **Measured.** The same detectors over each file; pooled rates.
  - **Absent.** With no such files, an unreadable catalog, or under 2,000
    words, the average is omitted and the tile says why in host words.
  - **When.** Measured as part of building the board, so the board's
    numbers are fixed with the board; Re-read file refreshes them.
- The press snapshot names the standouts, and the estimate key includes
  them, so a press never sends a numbers task its estimate did not price.

## Gates (`LightboxTileGates`, shared by fresh assembly and stale carry)

- Every reading: at least one found quote (as today).
- `familiar-phrase`: the host counts the phrase in the chapter at least once,
  and a found quote holds it.
- `stock-tiers`: at least `LIGHTBOX_STOCK_MINIMUM_BEATS` (4) beats found;
  only found beats are counted, so the mix is of the beats that stand.
- `handoff`: both sentences found in the one paragraph named, each quote
  inside a single sentence, the second sentence directly after the first
  (`LightboxSentencePairs`, which asks the verifier for every candidate span
  through its span filter, as the dialogue anchor does; no second matcher).
- `number-usage`: its stat stands out on the board it is drawn on. Each
  quote is verified with the stat's instance filter: a quote found but
  holding no instance is withheld as `no-instance`, a new quote failure.
- `signature`, `air-lock`, `echo`, `rhythm-endings`: the shared rule only.
- The parity sweep and the "every reading kind covered" test include group
  D's kinds.

## Stale carry (D4), per kind

| Kind | Quotes re-verified | Recounted | Withheld when |
|---|---|---|---|
| `signature`, `air-lock`, `echo` | each, moving with its words | nothing | no quote stands |
| `familiar-phrase` | each | the phrase's count and paragraphs | the phrase is gone, or no standing quote holds it |
| `stock-tiers` | each beat, keeping its tier | the tier counts, from the beats that stand | fewer than 4 beats stand |
| `rhythm-endings` | the movement claim's evidence | the Lands/Holds/Opens tally; endings follow their column's content key, and a changed column has none (never an old position on a new paragraph) | no evidence quote stands |
| `handoff` | both, re-found as a pair on the new text | nothing | the pair is gone or no longer adjacent |
| `number-usage` | each, with the instance filter of the **new** board's standout | instances come from the new text | the stat no longer stands out, or no quote holds an instance |

Measured parts recompute with the board: sentence lengths, the summary, and
every number row (against the writer's average as measured for the new
board).

## Bring to Workshop

Every new reading can be brought through the existing tile handoff: ids
only, the host resolves the tile, refuses a stale or re-reading one, checks
its quotes again and bounds the item (`WORKSHOP_LIGHTBOX_TILE_LIMITS`, no new
attachment shape). Per kind:

| Kind | Quotes | Points |
|---|---|---|
| `stock-tiers` | up to 4 beats, one per tier first | "Tiers": the host's counts; "Classified": how many beats |
| `signature`, `air-lock` | its quotes | none |
| `familiar-phrase` | its quotes | "Kind"; "Counted": the host's count and paragraphs |
| `echo` | its quotes | "Sounds like"; "Accuracy": the callout |
| `rhythm-endings` | the movement evidence | "Endings": the tally |
| `handoff` | both sentences, in order, or the handoff is refused (never half a pair) | "Carried", "Changes", "Effect" |
| `number-usage` | quotes re-checked with the instance filter | "Figure": the measured value and its reference; "Reads as" |

A craft tile may carry its own host counts as labelled points: the item is
meaningless without them. It never carries the board or another tile.

## Webview

- **Tiles** (`LightboxStock`, `LightboxRhythm`, `LightboxNumbers`), drawn in
  the reading grid, each in its lens's frame with register chips per part
  (measured, read, counted-read):
  - Stock: the tier bar and key, signature phrases, familiar phrasing with
    counts, air-lock passages ("craft signal, not risk"), and the echoes
    inset with its accuracy callout.
  - Rhythm: per-column sentence lengths (mean and longest), the endings row
    and its tally, the measured summary, handoff samples (pair, carried,
    changes, effect, and "code checks that both quotes are adjacent
    sentences in one paragraph"), the movement claim.
  - Numbers: one row per figure (the preset band, the chapter's dot, the
    figure, its ratio to the writer's average), the baseline's source or
    why it is absent, and under each standout its "reads as" reading.
    Measured rows show before any reading.
- **Hover and pin.** Every reading lights its paragraphs; a number row
  lights the paragraphs holding an instance (a new `standout` item ref); the
  longest sentence lights its paragraph.
- **Inspector.** Each new kind's details (tiers, kind and count, the echo's
  callout, the handoff's carried/changes/effect and its adjacency check, the
  figure and the instance check), with its evidence and Bring.
- **Ribbon.** A new read lane, **Endings**, below Tension: one mark per
  column (Lands filled, Holds half, Opens hollow), stale-labelled and blank
  on changed columns. The measured Rhythm lane is unchanged: a read mark is
  never drawn in a measured lane.
- **Stale notes** come from the reading frame, and the endings lane says
  what it shows.
- **Rail.** The Lenses card lists group D; its caption says up to four
  calls.
- **Filter.** As voice does today, these tiles are reading tiles: the
  Measured filter hides them, and a lens that is off is not drawn.

## Tests

- Codec: each block's shape, friction required, vocabularies, bounds, the
  echo percentage rule, the numbers directive list and its stated limits,
  undefined fields counted not named.
- Prompts: the Group D example decodes through the production codec and
  verifier, every quote exact; its request is the builder's output; prompt
  rules pinned (Le Guin, echoes, never fix or cut); budgets pinned by the
  sync test.
- Gates and carry: handoff adjacency (adjacent, two apart, across
  paragraphs, a quote spanning a sentence boundary, duplicate words in
  another sentence, carried after an insertion between them); instance
  checks per stat, including a quote found but holding no instance; tier
  recount; familiar recount; endings following column keys under reorder
  and same-count replacement; group D in the parity sweep and the
  every-kind test.
- Measured: `sentenceWords`, the summary, the standout rules, the writer's
  average (bounded, cached, the board's own file left out, absent with a
  note), the new detector, Style Flags unchanged.
- Production root: a press through the real handler, runner and service
  reads four groups with a stub engine; the estimate prices group D and its
  key moves with the standouts.
- Bring: each new kind's payload through the Workshop validator, a handoff
  refused rather than halved.
- Webview: the new tiles, the endings lane, the inspector's details, the
  layout placing every kind once.

## Implementation notes (2026-10-20)

What landed, and where it differs from the plan above:

- **Echoes allow a digit.** The plan withheld an echo with a digit; a
  source's name can hold one, so only `%` and "percent" withhold it, now in
  its title too. The withheld list still shows the reading's own title, as
  every lens's does.
- **Numbers claims state no figure.** Beyond the directive list, a numbers
  claim with a digit outside a ¶ address, a `%` or "percent" is withheld,
  and the prompt says so (pinned). The bare-digit rule moved to
  `LightboxReadingFields.LIGHTBOX_BARE_DIGIT`, shared with Spark.
- **A word pattern's instance is matched over the whole paragraph**, as the
  figure was counted, so a quote cut mid-word ("nly tired" of "only tired",
  "very" of "every") holds no instance. Found while writing the tests.
- **The tier mix's minimum** (four found beats) is stated in the stock
  prompt and pinned to `LIGHTBOX_STOCK_MINIMUM_BEATS` by the sync test.
- **Titles of malformed items** come from the shared decoder: an item with no
  `title` field is named by its noun and position ("Reading 1", "Familiar
  phrase 2", "Beat 3"); a familiar phrase withheld by a gate is named by its
  kind and position ("Idiom 3"), never its words.
- **Carry maps the groups it is given.** A board always carries four groups
  (boards live in host memory and are built with every group), so the
  carry does not add a missing group.
- **The numbers tile's empty answer** reads "The reading said nothing about
  how these figures are used." when figures stood out, and "Nothing in the
  numbers stands out…" only when none did.
- **Accessibility.** The rhythm tile's sentence-length bars are named
  "Sentence lengths in paragraph n", so they no longer share the ribbon
  columns' names.
- **Styles.** Tier and ending colors are scoped to the tier bar, its key and
  the ending marks; on bare `.is-*` classes they painted the familiar
  phrase's "weighted" tag unreadable (found in the visual evidence).
- **Limits, stated:** a whole-book manuscript file that also holds this
  chapter cannot be split, so with no `chapters` group the chapter counts
  once inside the writer's own average; being verbs do not count
  contractions; a pattern rarer than usual is shown, never read. A maximal
  group D response can exceed the per-group response cap
  ([tech debt](../../tech-debt/2026-10-20-lightbox-group-d-response-ceiling.md)).

**Verification.** `npm run typecheck`; full `npx jest`, 407 suites / 5,693
tests / 59 snapshots (from 397 / 5,597 / 59 at `eca952a`); `npm run lint`
0 errors and 1,133 warnings, identical per file and rule to `eca952a`;
`npm run build` with `verify:bundle`; `git diff --check`. Visual evidence:
[`lightbox-slice-4b-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4b-visual/README.md).
No live or billable call.

**After the PR #155 review (2026-10-20).** The four findings and the
recommended note are fixed in `fc4c564`; the
[review's author response](../../../docs/pr-reviews/pr-155-lightbox-craft-lenses-review.md#author-response-2026-10-20)
gives root cause, fix and tests for each.

- **Numbers readings belong to a measurement (F-01).** A usage stays only
  while its figure stands out the same way (direction, bases, reference),
  checked by `holdLightboxNumberUsages` on a same-text rebuild and when a
  group lands (the press's figures against the board's now). Otherwise it is
  withheld: `numberNotStandout.carried` when the figure no longer stands out,
  `numberRemeasured` when it stands out differently. Bring refuses a usage
  with no standout, and the numbers tile draws a usage only under a figure
  that stands out.
- **Witnesses (F-02, F-03, N-01).** Bring prepares a handoff through the pair
  verifier and keeps both ordered roles, so two sentences with the same words
  travel as two quotes. A familiar phrase is witnessed only by a quote whose
  source span holds a whole occurrence, found over the full paragraph with
  the term counter's own tokens (`lightboxTermSpans`, `lightboxPhraseHeld`),
  fresh, carried and brought. A carried handoff searches every other
  paragraph holding its first sentence, and a pair whose words still stand is
  "no longer adjacent", never "gone".
- **Numbers never decided from a rounded figure (F-04).** Standouts and
  ratios are decided from the counts, cross-multiplied, and "none" from a
  zero count. `LightboxNumberRow.value` and the writer's `average` and
  `ratio` stay unrounded; the webview rounds them for display only
  (`formatLightboxFigure`, `formatLightboxRatio`, "<0.1" and "<0.01" for a
  nonzero figure below the shown precision).
- **Nonblocking notes, taken.** A below-dialogue witness must come from a
  paragraph with no dialogue, as the row counts and lights (task line, prompt
  and worked example updated). The writer's baseline says `capped` whenever a
  bound limited the reading, including whole files that carried the words
  past the word bound. The numbers tile warns it is stale before its first
  figure.

Verification after the fixes: full `npx jest` 411 suites / 5,712 tests / 59
snapshots; `npm run lint` identical per file and rule (0 errors / 1,133
warnings); `npm run typecheck`, `npm run build` with `verify:bundle` and
`git diff --check` pass. The evidence was regenerated. Every new regression
test fails against `8b930fb`'s sources at its assertion (the term-span
helper's two tests fail there because the helper is new).

## Done when

On the *Alice* fixture, one press reads four groups. The board shows a tier
mix counted from found beats, signature and familiar phrasing with counts,
an echo with its accuracy callout, measured sentence lengths with read
endings and a handoff whose sentences code found adjacent, and the numbers
that stand out with how each is used, each quote holding an instance.
Carried onto an edited chapter, every new kind is held to the same rules a
fresh read meets.
