# Workshop Widget Recommendation Prompt Assembly

**Date Identified**: 2026-07-31
**Reviewed**: 2026-07-31
**Status**: Deferred — address before a third live widget
**Priority**: Medium
**Estimated Effort**: Small-Medium
**Origin**: PR #98 review finding F-19

## Problem

`WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION` is one monolithic instruction
appended to every retained persona system prompt. Its current two live widgets
cost roughly 1,024 input tokens per persona conversation, and adding a widget by
appending another block makes recurring prompt size grow without an ownership
seam. The parser also applies Gesture Playground's much larger section ceiling
before it knows whether the response is the compact Lexical Gravity shape.

The Sprint 02B-A Use Tools & Widgets switch does not make this contract
conditional. Explicit writer requests for a widget must still work when
proactive assistance is disabled, so hiding the grammar behind that switch
would be a false optimization.

## Recommendation

- Give each live widget a local recommendation-instruction fragment beside its
  recommendation codec/seed grammar.
- Assemble the shared system instruction from registry entries marked `live`,
  with an architecture witness that unavailable concepts add no prompt text.
- Select a response-section ceiling by parsed widget id; keep a small absolute
  envelope cap before id extraction.
- Measure the assembled recurring prompt in the prompt-budget test so later
  widgets make their standing cost visible at review time.

Do this before Prose Controller or any other third live widget extends the
recommendation grammar. It is not part of optional Sprint 02C, whose contract
is a pure handler move.

## Related Files

- `packages/core/src/utils/workshopWidgetRecommendation.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/shared/constants/workshopWidgets.ts`
- `packages/core/src/shared/constants/promptBudgets.ts`
- `packages/core/src/__tests__/utils/workshopWidgetRecommendation.test.ts`
- `packages/core/src/__tests__/architecture/promptBudgets.test.ts`
- `docs/pr-reviews/pr-98-lexical-gravity-standing-rail-2a02727-review-v2.md`

## Completion Criteria

- Only live registry entries contribute recommendation prompt fragments.
- Each widget owns its instruction fragment and response-section ceiling.
- Gesture and Lexical Gravity parsing behavior remains fail-closed.
- Explicit widget requests work with Use Tools & Widgets both on and off.
- Prompt-budget tests expose the recurring assembled instruction size.
