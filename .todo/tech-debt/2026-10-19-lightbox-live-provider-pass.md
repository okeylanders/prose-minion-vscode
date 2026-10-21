# Lightbox Readings Have Not Met a Live Provider

**Date Identified**: 2026-10-19 (Lightbox Slice 2B)
**Reviewed**: 2026-10-19
**Status**: Deferred (to Lightbox Slice 6)
**Priority**: Medium
**Estimated Effort**: Medium (one paid session on public-domain chapters, then small constant and prompt changes)

## Problem

Slice 2B was built without an API key and made no live or billable calls.
Every reading test plays the provider with the prompt bundle's worked
examples. Four things therefore rest on assumptions:

1. **Prime then fan out (ADR open question 1).** Whether starting groups B
   and C after group A's first token earns cache reads was not measured.
   Each group's system prompt carries its own lens files, so the three calls
   share no leading prefix today; only a re-read of the same group repeats a
   prefix.
2. **The estimate against the processed chip.** The slice's "Done when" asks
   for the observed ratio. Expected output per lens is a fixed typical figure
   (`LIGHTBOX_TYPICAL_OUTPUT_TOKENS`), not a measurement.
3. **Whether models keep the contract.** How often a real reply quotes
   verbatim, scores exactly one tension value per column, draws a near miss,
   and stays inside 32,000 characters is unknown, as is how often a group is
   quarantined.
4. **Timeout and concurrency.** Five minutes per group and three at once are
   defaults, not measured.
5. **Craft steering (group G, Slice 4F).** Its typical output (1,600
   tokens) is a guess from the worked example's length. How often a real
   reply's notes are withheld (a quote with no instance, a nudge that gives
   an order, an example not anchored in its quote) is unknown.

## Recommendation

In Slice 6, run the three groups on two or three public-domain chapters
(Alice Chapter I among them) with the assistant model, in parallel and
primed:

- record cache reads per call, then settle open question 1 in the ADR;
- record the estimate shown before the press against the processed chip
  after it, and adjust `LIGHTBOX_TYPICAL_OUTPUT_TOKENS` if the ratio is far
  from 1;
- record the verified and withheld quote counts, withheld blocks, and any
  quarantine, and tighten the prompt where a rule is missed;
- for group G, record withheld notes and examples by reason, and the
  writer's view of whether the stances and nudges read as steering, not
  grading.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts`
- `packages/core/src/infrastructure/lightbox/LightboxRunEstimate.ts`
- `packages/core/src/infrastructure/lightbox/LightboxReadingPrompts.ts`
- `packages/core/resources/system-prompts/lightbox/`
- `docs/adr/2026-10-19-lightbox-inspiration-board.md` (open question 1)

## Completion Criteria

- Cache reads recorded for parallel and primed runs, and open question 1
  closed in the ADR.
- The estimate-to-processed ratio recorded in the epic's progress notes.
- Any constant or prompt change that follows is covered by the existing
  prompt, codec and estimate tests.
