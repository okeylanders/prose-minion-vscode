# Draft Edit Slice 3b, part 1: four categories and the narration baseline

**Date:** 2026-10-26 17:00 UTC
**Branch:** `claude/upbeat-galileo-y1l4yf`, fast-forwarded to `epic/lightbox`
at `611bebd6` (the PR #173 merge), into `epic/lightbox`
**Decision record:** [ADR 2026-10-21](../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md),
"Amendment 2026-10-26: Slice 3b, Proofread coverage" (it decides all three
parts)
**Slice doc:** [slice-3b-proofread-coverage.md](../.todo/epics/epic-draft-edit-2026-10-25/slice-3b-proofread-coverage.md)

## What changed

- `PROOFREAD_CATEGORIES` gains `wrong-word`, `missing-word`, `extra-word`
  and `person`, all flag-only. The prompt and the worked example teach
  them.
- `utils/proofread/narrationBaseline.ts` measures the whole document's tense
  and person.
  - `DraftEditUseCase.narrationOf` calls it, failing closed and logged.
  - `buildUserMessage` sends it as `narration`.
- The summary reads "(N need your judgment)".

## Decisions

- Every new category starts flag-only. A recorded fixture run decides
  which may write, each with its own guard rule.
- The baseline leaves out every sentence holding a quotation mark, beyond
  the shared dialogue matcher. The Gutenberg *Alice* writes speech in single
  quotation marks; counted as narration, its present tense would have named
  a past-tense book "present" and drawn false tense flags.

## Context worth keeping

- The tagger read *Alice* adaptations:
  - past narration was 87–90% past among finite verbs, present narration
    100% present;
  - first-person pronouns were 8% of first-person narration's words and 0%
    of third.
- Tagging 12,500 words took 77 ms.
  - The tagger reads at most 20,000 words (`sampleWords`), chosen evenly by
    word position, with long sentences cut into pieces (PR #174 F-02), so
    a single-file novel never stalls the extension host.
  - Single-quoted speech is left out whole by a narration-only detector
    (PR #174 F-01); the shared dialogue rule reads double quotation marks
    only. Speech closes only at a mark after closing punctuation, so a
    possessive ("sisters'") or elision ("sittin'") inside it never ends it
    early (F-01's re-review).
  - The thresholds are in `NARRATION_BASELINE`.

## Follow-ups

- Part 2 (the word list and name consistency) and part 3 (quotation marks
  and consistency), as the ADR amendment decides.
- The fixture run.
