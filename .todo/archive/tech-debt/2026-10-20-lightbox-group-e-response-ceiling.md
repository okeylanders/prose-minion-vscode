# A Maximal Group E Response Can Exceed the Per-Group Response Cap

**Date Identified**: 2026-10-20 (Lightbox Slice 4C)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (measure, then lower bounds or split the group)

## Problem

Group E reads four lenses in one call (template and freshness, pressure,
artifacts, summary and movements), and its bounds in
`PROMPT_BUDGETS.lightbox` allow a response longer than the group cap the
codec enforces (`groupResponseCharacters`, 32,000 characters; a longer
response fails the whole group as "too long"). This is the same risk as
[group D's](2026-10-20-lightbox-group-d-response-ceiling.md).

Measured by building a response with every field at its bound and every
quote at 240 characters (compact JSON, framed):

| Block | At its bounds |
|---|---|
| template: name, description, 3 quotes, 6 beats of 3 quotes, freshness, 8 engagement entries | 7,776 characters |
| pressure: 6 threads, each a plant, 3 escalations and a resolution | 9,343 characters |
| artifacts: 8 objects, each 5 terms and 5 quoted arc steps | 17,043 characters |
| summary: synopsis with 3 quotes, 8 movements with boundaries | 5,574 characters |

That is 39,853 characters in all, against a cap of 32,000. The worked
example is 5,384 characters, and real quotes run far shorter than 240
characters, so the risk is low. The prompt states the cap, which is the
only guard today. The output reservation (`groupOutputTokens`, 8,000)
matches the cap, so raising one alone does not help. Artifacts is the
long block: 40 quoted arc steps at the bounds.

## Recommendation

Measure group E's real response lengths when Slice 6 measures typical
output tokens. Then either:

- lower the artifact bounds (8 objects of 5 steps is generous; 6 of 4 is
  likely enough), or
- move artifacts into a call of its own, if its reading is the long one.

Template and summary must stay in one call: engagement is keyed by the
movements the same response draws (Slice 4C's read-together rule).

## Related Files

- `packages/core/src/shared/constants/promptBudgets.ts` (`lightbox`:
  `templateBeats`, `pressureThreads`, `threadEscalations`, `artifacts`,
  `artifactSteps`, `movements`, `synopsisQuotes`, `groupResponseCharacters`,
  `groupOutputTokens`)
- `packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts` (the
  response cap)
- `packages/core/src/infrastructure/lightbox/LightboxRunEstimate.ts`
  (`LIGHTBOX_TYPICAL_OUTPUT_TOKENS`, guesses for group E)
- `packages/core/resources/system-prompts/lightbox/55-artifacts.md`
- [Slice 4C](../epics/epic-lightbox-2026-10-19/slice-4c-story-lenses.md)

## Completion Criteria

- Group E's bounds, at their maximum with quotes at their maximum length,
  fit within `groupResponseCharacters`, pinned by a test that builds such a
  response and decodes it; or artifacts runs in a call of its own.
- The typical output tokens for `template`, `pressure`, `artifacts` and
  `summary` are measured, not guessed.
