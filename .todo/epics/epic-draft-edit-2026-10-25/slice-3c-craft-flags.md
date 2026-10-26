# Slice 3c: Craft flags

**Epic:** [Draft Edit](README.md)
**Status:** In progress (2026-10-26): part 1, the pass and cliché. After
Slice 3b, before the Workshop slices, at the writer's request. The pass, its
name, each category's approach and the six recommendations under "Decide in
the ADR" are decided (the writer, 2026-10-26; see "Decided").
**Priority:** High
**Decision record:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md),
"Amendment 2026-10-26: Slice 3c, Craft Flags".

## Decided (the writer, 2026-10-26)

- **A second pass, Craft Flags,** beside Proofread on the Draft Edit
  engine, with its own command in the **Prose Minion** editor menu. Not
  Proofread categories. (Question 1 below.)
- **Each category's approach as this doc describes it** under "The four
  categories": what it flags, what it leaves alone, how it reads the whole
  chapter, and what its recommendation says.
- **All six recommendations under "Decide in the ADR"** (2–7 below):
  whole-chapter calls per category under a ceiling, the recommendation as a
  note with no quick fix, options never orders, `info` under its own source,
  an own model scope following the Workshop's, and the price in the
  confirmation.
- **Cliché first.**

## Problem

Proofread catches mechanical errors. The writer also wants the notes a
line editor leaves in a fiction draft. These are qualitative, and that is
fine. All of them are flags with a recommendation: nothing here ever
changes the text. Most need the whole chapter, not the 1,200-word chunk
Proofread reads.

The four categories, as the writer asked for them (2026-10-26):

1. **Cliché**: a stock phrase, flagged with a recommendation.
2. **Gesture strain**: a gesture that is complicated, thin, impossible, and
   the like.
3. **Continuity**: a contradiction within the chapter, such as red hair
   that turns brown.
4. **Register shift**: a hard shift in register in narration, outside
   dialogue.

## The four categories

### 1. Cliché (`cliche`)

- **What it flags:** a phrase worn smooth by use, standing in for something
  this scene could name exactly. Examples: "a chill ran down her spine",
  "time stood still", "let out a breath she didn't know she was holding".
- **What it leaves alone:**
  - Dialogue. A character's idiom is their voice (the Lightbox's rule,
    epic decision 26).
  - A cliché the text turns or mocks on purpose.
  - Idioms that carry no image ("in the end").
- **Whole chapter:** a phrase the chapter leans on is its own finding, and
  one chunk cannot see it. Host code counts repeats of each flagged phrase
  across the chapter, normalized for case and inflection. The message says
  so: "4 times in this chapter".
- **Recommendation:** what the phrase is standing in for here, and one way
  it could go that is this scene's own.
- **What exists:**
  - Style Flags' cliché check (`tools/measure/styleFlags`) is ten business
    phrases matched with `includes`. It is no use for fiction.
  - The Lightbox's familiar-phrase tile (group D) sorts phrases into
    `idiom | cliche | stock | weighted` and says "familiar is not a fault".
    The two surfaces must not disagree about what a cliché is, so share its
    definitions. Do not make a second vocabulary.

### 2. Gesture strain (`gesture`)

A gesture a reader stumbles on. Sub-kinds, carried on the issue:

- **Impossible:** the body cannot do it as written. "His eyes flew across
  the room." "She shrugged her eyebrows." Accepted figures of speech ("her
  eyes dropped") are not strain. The prompt has to draw that line with
  examples, or this sub-kind will be noise.
- **Complicated:** choreography the reader has to stop and assemble ("She
  turned, half-rising, her left hand flat on the table while her right
  reached behind her for…").
- **Thin:** a stock beat that carries nothing: a nod, a smile, a sigh, a
  shrug.
  - This is the noisiest sub-kind: every book has nods. Flag it only when
    the chapter repeats it, or when it is the beat's only carrier of
    feeling at a turn in the scene.
  - The repetition half is mechanical. Host code counts stock beats by
    lemma across the chapter with the word-frequency tagger's lemmas, and
    flags past a density threshold measured on the fixtures.
- **Redundant:** the gesture names its own body part ("nodded his head",
  "shrugged her shoulders").
- **Not in this slice:** a gesture that contradicts its line (a laugh on a
  grim line). It is too often deliberate. Revisit after the fixture run.
- **Dialogue:** a gesture is narration even inside a dialogue beat, so it
  is read there.
- **Recommendation:** what the gesture is doing in the scene, and one way
  the body could carry it.
- **What exists:** the gesture dictionary prompts
  (`system-prompts/gesture-dictionary/`) and the Workshop's Gesture
  Playground. After the Workshop seam (Slice 4), a code action could hand a
  flagged gesture to the Playground. Note it there; it is not in this
  slice.

### 3. Continuity (`continuity`)

Two places in the chapter that cannot both be true:

- **Bodies:** hair, eyes, height, scars, an injury that changes sides.
- **Things:** a cup still in a hand that was empty; a coat taken off twice.
- **Places and positions:** sitting, then standing with no rise; the
  kitchen, then the hall with no move.
- **Time:** the light, the weather, or the hour changing with no time
  passing.
- **People:** who is in the room; someone speaking after they left; a count
  that changes (three guards, then four); a relationship that changes (a
  sister, then a cousin).

Leaves alone:

- A change the text explains (she dyed her hair; time passes).
- Anything across a scene break. Host code finds the breaks and sends them.
  The Lightbox's Sections detector (`detectLightboxSections`) already
  measures them. Move it to a shared home rather than importing Lightbox
  infrastructure into Draft Edit.
- Facts stated only in dialogue, by default. Characters lie and misremember.
  Dialogue is read as context, and a narration fact is never flagged
  against a spoken one.

How it works:

- **It needs the whole chapter by definition.** The two halves can be
  thousands of words apart.
- **Both quotes are anchored by the host,** each with its context, as every
  other quote is. A pair is dropped when either side fails to anchor, the
  two overlap, or the later side comes first.
- **The flag sits on the later quote.** The earlier one is linked as
  related information ("hair is red here"), which VS Code shows in the
  Problems panel and the hover.
- **This changes the port.** `DocumentAnnotation` gains
  `related?: readonly { start; end; message }[]`, in the same document. The
  VS Code adapter maps it to `DiagnosticRelatedInformation`, and tracks the
  related ranges through the writer's edits as it tracks the flag's own.
  An edit touching either side makes the flag stale. This is the live-text
  rule of D4 step 1 (PR #171 F-03), extended to the related range.
- **Recommendation:** the two facts side by side, and which one the rest of
  the chapter holds when it holds one. Never which is right.
- **Out of scope:** continuity across chapters. That needs a story bible, a
  project resource of facts. Slice 3b's word list is the first piece of
  one. Queue it separately.

### 4. Register shift (`register`)

Narration that leaves the register the chapter keeps. Examples:

- A modern or technical word in period narration ("okay"; "impact" as a
  verb).
- Slang dropped into formal narration.
- A legal or corporate phrase in an intimate close third.
- A sudden purple passage in plain prose.

Leaves alone:

- **Dialogue** (voice).
- **Free indirect discourse.** In close third, a character's idiom bleeding
  into narration is often the point. The prompt allows it where the text
  marks the character's thought, and the recommendation names the
  possibility.

How it works:

- **Whole chapter:** a shift is a shift *from* something. Measure the
  chapter's narration register once per run, as Slice 3b measures tense and
  person, and send it beside each call. It is model-read (a short register
  note) or a host measure. Decide in the ADR.
- **Anachronism** is a register shift only against a period the chapter's
  own narration sets. Without one, it is not flagged. A project setting
  (period, place) could supply it later.
- **Recommendation:** the register the chapter keeps, the one the phrase
  brings, and one way it could go in the chapter's own.

## Decide in the ADR

1. **One pass or Proofread categories.** *Decided: a second pass, Craft
   Flags.*
   - **Recommended: a second pass** on the Draft Edit engine, named *Craft
     Flags* (the writer's choice, 2026-10-26). It gets its own
     `DraftEditPass` member, policy row, prompts, codec and guard (D1).
   - It shares the anchoring, the issue ledger, the Problems panel,
     Dismiss, Clear, live-text following, and selection runs replacing
     only their own flags.
   - **Why not fold these into Proofread:**
     - Proofread is cheap, runs at temperature 0, reads chunk by chunk, and
       can write. Its precision matters.
     - Qualitative flags would raise the noise of every Proofread run, and
       its cost.
     - They need a stronger model than Proofread's inexpensive default.
     - A separate command lets the writer ask for line notes once a draft
       has settled, and ask for proofreading on its own.
   - **The cost of the split:** another menu item and model scope. With
     Proofread categories instead, the writer gets everything in one run,
     at Proofread's price and noise.
2. **How the whole chapter is read.** Per-category calls over the whole
   chapter, run in parallel, each with its own prompt, worked example and
   budget. Recommended, because:
   - a cut-off reply loses one category, not all four
     (`salvageModelJson`);
   - the writer can choose categories;
   - each worked example stays small enough to pin.
   - Set a word ceiling. Above it, confirm the run as Proofread's long-file
     confirm does, or split at scene breaks. Continuity cannot split
     without losing pairs across the split.
   - A selection run reads the chapter for context and reports only inside
     the selection.
3. **What a recommendation is.**
   - **Recommended:** a note in the diagnostic's message, with no quick
     fix: a short "why", then "One way it could go: …", the Lightbox
     steering's form. Dismiss stays.
   - The alternative is a non-preferred *Replace with*. It fits a cliché or
     a register slip, which are like-for-like swaps. It does not fit a
     continuity pair or a gesture's choreography. And it puts model prose
     one click from the writer's text.
4. **Phrasing.** Recommendations read as options, never orders: no
   "should", "must", "fix" or "wrong". `LightboxSteeringPhrasing` is the
   precedent. Share it from a common home, or write the pass's own rule.
5. **Severity and source.** All four at `info`, under their own diagnostic
   source (for example "Prose Minion Craft"), so the Problems panel filters
   them apart from Proofread. Proofread's fixable issues are `info` too, so
   the source is what separates them.
6. **Model scope.** An own scope (`craftModel`, say) that follows the
   Workshop's model until picked, as `lightboxModel` follows
   `assistantModel` (Lightbox Slice 4L). Or reuse `assistantModel`
   outright.
7. **Cost before a run.** An estimate in the confirm, as the Lightbox
   prices its calls ("≈ $…", never a cap).

## Order

1. The ADR amendment.
2. The pass and **cliché**. It is closest to what exists (the Lightbox's
   familiar-phrase definitions) and proves the pass end to end.
3. **Register shift**, with the chapter's register measure.
4. **Gesture strain**, with the host's stock-beat counts.
5. **Continuity**, with the port's related information and the shared
   section detector.

It may ship as two or three PRs into `epic/lightbox`.

## The fixture run decides what ships on by default

Nothing here writes, so no category waits on a fixture run to become
fixable. Each category still needs a recorded run before it is on by
default:

- seeded public-domain fixtures (*Alice* adaptations: a planted cliché, an
  impossible gesture, the White Rabbit's pink eyes turned blue, a slang
  drop in narration);
- hits and false positives per category, recorded in this doc.

A category the run finds too noisy ships off, behind a setting.

## Related files

- `packages/core/src/domain/models/DraftEdit.ts`: `DraftEditPass`,
  `DRAFT_EDIT_PASS_POLICIES`.
- `packages/core/src/platform/IssueAnnotator.ts`: `DocumentAnnotation`,
  which gains `related` for continuity.
- `apps/vscode-extension/src/platform/vscode/`: `VsCodeIssueAnnotator`,
  which maps `related` and tracks it through edits.
- `packages/core/src/application/services/draftEdit/`: the use case,
  placement, and the issue ledger.
- `packages/core/src/utils/proofread/narrationBaseline.ts`: the pattern for
  a whole-chapter measure sent beside each call.
- `packages/core/src/infrastructure/lightbox/LightboxSections.ts`: scene
  breaks, to move to a shared home.
- `packages/core/src/shared/types/messages/lightboxCraftTiles.ts` and the
  Lightbox's group D prompts: the familiar-phrase vocabulary.
- `packages/core/src/infrastructure/lightbox/` (`LightboxSteeringPhrasing`):
  the phrasing rule.
- `packages/core/resources/system-prompts/gesture-dictionary/`: gesture
  vocabulary.
- `packages/core/src/tools/measure/wordFrequency`: lemmas for stock-beat
  counts.

## Completion criteria

- Each category has:
  - its prompt and worked example, read through the production codec,
    anchoring and guard in a test;
  - its leaves-alone rules as tests;
  - a row in the ADR.
- No category ever offers an edit the applier would make. The pass's guard
  refuses one, and a test pins it.
- Continuity's related range is tracked through edits. An edit touching
  either side makes the flag stale.
- Dialogue is left alone where each category says so, by the shared
  dialogue rule and Slice 3b's single-quoted speech rule.
- The fixture run's per-category hits and false positives are recorded
  here before a category is on by default.
- No live or billable provider calls in tests. Public-domain fixtures only.
