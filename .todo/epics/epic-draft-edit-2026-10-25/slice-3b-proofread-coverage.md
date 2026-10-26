# Slice 3b: Proofread coverage

**Epic:** [Draft Edit](README.md)
**Status:** Part 1 built; in review (2026-10-26). Parts 2 and 3 follow, in
the order below. The immediate follow-up to Slice 3 (the writer's call,
2026-10-26), before the Workshop slices.
**Priority:** High
**Needs first:** an ADR amendment. Several items extend D6's closed
category list, the guard, and the reply format, and two add deterministic
checks beside the model.

## Problem

Proofread reports seven kinds of mechanical error today: spelling,
homophone, punctuation, capitalization, spacing, agreement and tense. The
writer wants it to catch more of what a careful copyeditor catches in a
fiction draft:

- misspelled character and place names;
- the wrong word ("form" for "from");
- missing words;
- tense slips it misses now.

They also asked what else belongs on the list; the extras below are the
answer.

Several of these need the whole document. A name is misspelled only
against its other uses, and a chunk of 1,200 words may hold one use or
none. So they belong to deterministic host code that reads the whole
document, not to a model that reads one chunk. This is the user CLAUDE.md's
hybrid rule: deterministic code for extraction, indexing and mechanical
checks, the model for judgment.

## Scope

### The model's side: categories, prompt, codec, guard

Each new category joins `PROOFREAD_CATEGORIES`, with a disposition, a
severity, a diagnostic code (`proofread.<category>`), codec and guard cases,
and lines in the prompt's worked example.

1. **Wrong word.** A real word in place of the one meant, not only a
   sound-alike: "form" for "from", "loose" for "lose", "causal" for
   "casual".
   - Decide in the ADR: broaden `homophone`, or add `wrong-word` beside it.
   - Its disposition is fix when the guard's edit size allows it, else
     flag, as `homophone` is today.
2. **Missing word.** "She went the store." The quote spans the words
   either side of the gap, and the replacement inserts the word.
   - Flag only at first.
   - After the fixture run, consider a fix for one inserted function word
     from a closed list (a, an, the, to, of, in, on, at, and, was, had).
     That needs its own guard rule: the replacement is the original plus
     exactly one listed word.
3. **Extra word.** A word left behind by a revision ("she had went had
   gone").
   - Flag, except an exact repeated word, which `spelling` already fixes as
     a doubled word.
   - Decide whether the doubled word moves to this category.
4. **Point of view and person.** A first-person "I" in a third-person
   narration, or the reverse, outside dialogue. Flag only. It reads the
   baseline in item 5.
5. **Tense: a narrative baseline.** Tense stays flag-only.
   - New: a deterministic baseline from the part-of-speech tagger
     (`tagTextTokens`, `tools/measure/wordFrequency`) over the whole
     document. It counts past and present finite verbs in narration, with
     dialogue left out by `findDialogueSpans` (`utils/dialogueSpans.ts`).
   - Each chunk's request names it (`"narrativeTense": "past"`), so a
     chunk that is mostly dialogue, or a short selection, still knows the
     book's tense.
   - A document with no clear majority names none, and the prompt keeps
     today's rule. Item 4 reads the person (first or third) the same way.
   - This was out of scope in the ADR's follow-ups; it is queued here.

### The host's side: whole-document checks, no model

6. **Name consistency.**
   - Gather capitalized words that do not start a sentence, with their
     occurrences.
   - Group forms within a small edit distance, after setting case and a
     possessive "'s" aside.
   - Within a group, flag the rare form where a common form dominates (for
     example one use against three or more), with *Replace with* the
     common form.
   - Never preferred, never a fix: two characters may have similar names.
7. **A project word list.** Names and invented words the writer accepts,
   in a setting or a project file (decide in the ADR).
   - It is sent to the model as accepted spellings.
   - Name consistency never flags a form in it.
   - This was out of scope in the ADR's follow-ups; it is queued here.
8. **Quotation marks.** An unclosed or mismatched quotation mark in a
   paragraph, straight or curly.
   - The multi-paragraph speech convention is not an error: a paragraph of
     speech left open when the next opens with a quotation mark.
   - Flag only.
9. **Consistency across the document.** A variant used both ways in one
   document: grey and gray, toward and towards, OK and okay, e-mail and
   email, all right and alright, "the Rabbit" and "the rabbit".
   - Flag the less used form.
   - With a spelling convention named (Slice 3), the convention's form
     wins, whichever is more frequent.
   - Flag only.

## Order

1. The ADR amendment.
2. The tense and person baseline (item 5, then 4). It costs least, and it
   improves a category the writer already sees.
3. Wrong word and missing word (items 1 and 2), then extra word (item 3).
4. Name consistency and the word list (items 6 and 7).
5. Quotation marks and consistency (items 8 and 9).

It may ship as two or three PRs into `epic/lightbox`.

## The fixture run decides what may write

Every new category starts as a flag. Before any of them becomes a fix, the
writer runs seeded public-domain fixtures in the Extension Development Host
and records false positives per category in this doc. Slice 3 changed no
threshold because no such run was recorded; this slice needs one.

## Related files

- `packages/core/src/domain/models/ProofreadIssue.ts`: categories and
  dispositions.
- `packages/core/resources/system-prompts/proofread/`: the prompt and its
  worked example.
- `packages/core/src/infrastructure/api/services/proofread/ProofreadResponseCodec.ts`
  and `ProofreadService.ts` (the request's fields, as `spelling` in Slice 3).
- `packages/core/src/utils/proofread/proofreadGuard.ts`: what a fix may
  change.
- `packages/core/src/application/services/draftEdit/draftEditPlacement.ts`
  and `DraftEditUseCase.ts`: where deterministic findings would join the
  placed ones.
- `packages/core/src/tools/measure/wordFrequency` (`tagTextTokens`) and
  `packages/core/src/utils/dialogueSpans.ts` (`findDialogueSpans`): the
  baseline.
- `packages/core/src/__tests__/utils/draftEdit/proofreadFixtures.ts`: the
  seeded fixtures.

## Completion criteria

- Each new category or check has:
  - its prompt text and worked-example lines (model), or a pure detector
    with focused tests (host);
  - a disposition and severity;
  - codec and guard cases;
  - a row in the ADR.
- Name consistency never flags a word-list form, and never offers a
  preferred quick fix.
- The fixture run's per-category false-positive rates are recorded here
  before any new category may write.
- No live or billable provider calls in tests. Public-domain fixtures only.

## Part 1: as built

The decisions are in the ADR's
[Amendment 2026-10-26: Slice 3b](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md#amendment-2026-10-26-slice-3b-proofread-coverage).

- **Four categories** (items 1 to 4): `wrong-word`, `missing-word`,
  `extra-word` and `person`.
  - All four are flag-only, their suggestions a *Replace with* that is
    never preferred.
  - A doubled word stays `spelling`, fixable as before.
  - The prompt describes each and how to quote it, and the worked example
    shows each once.
  - `proofreadPrompt.test.ts` holds the prompt's list to
    `PROOFREAD_CATEGORIES`. It reads the example's response through the
    production frame reader, codec, anchoring and guard.
- **The narration baseline** (item 5, `utils/proofread/narrationBaseline.ts`).
  - It is measured over the whole document from the sentences no one
    speaks.
  - **Beyond the plan:** a sentence holding any quotation mark is left out
    too. The dialogue matcher reads double quotation marks only, so
    single-quoted speech would otherwise lend its present tense and its "I"
    to the narration, and a past-tense book could read as present.
  - **Also beyond the plan:** it runs on the extension host at about 6 µs a
    word, so a long book is sampled evenly, every k-th narration sentence,
    up to 20,000 words. A test with a present-tense prologue failed when the
    sample was taken from the start.
  - It is sent beside each chunk as `narration`. The prompt reports `person`
    only against a named third person.
  - **Tests:** *Alice* in three voices, the Caterpillar's single-quoted
    exchange alone and added to the opening, a fenced block, and too little
    text. Two mutations failed their tests: dropping the quotation-mark rule,
    and dropping the protected regions.
- **The summary** counts every flag-only issue as needing the writer's
  judgment ("(4 need your judgment)").
- **Astra's PR #173 nit:** TOOLS.md says "Proofread and Flag never changes
  the text".
- **Not yet:** the fixture run that would let any new category write.
