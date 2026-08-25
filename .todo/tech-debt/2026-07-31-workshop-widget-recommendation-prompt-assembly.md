# Workshop Widget Recommendation Prompt Assembly

**Date Identified**: 2026-07-31
**Reviewed**: 2026-07-31
**Status**: Complete — registry-owned prompt fragments, per-widget response ceilings, and exact prompt-size pin landed
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

## Phase 6 progress (2026-08-06)

- Gesture Playground and Lexical Gravity now own their prompt fragments,
  marker grammar, and field validation in named feature modules.
- `WorkshopWidgetRecommendationOperations.ts` owns the live-id gate, exact
  two-arm registry, dispatch, aggregate ceiling, and prompt assembly. The pure
  protocol module owns only common markers, frame helpers, and cleanup.
- Prompt membership is derived once from live registry values; separate
  feature-owned order metadata preserves catalog and instruction order without
  duplicate family lists or a hardcoded widget count.
- The inverse architecture witness permits that generic module as the one
  closed recommendation registry and rejects feature vocabulary in unapproved
  generic paths.
- The prompt-budget suite pins the assembled recurring contract at 4,811
  characters so any later widget makes its standing cost explicit in review.
- The existing 15,300-character absolute pre-ID ceiling remains unchanged to
  keep this normalization behavior-preserving. Selecting a smaller ceiling by
  parsed widget id is the only remaining completion item and stays required
  before a third live widget.

## Completion (2026-08-14)

Creative Variations became the third live recommendation member and closed the
remaining work instead of extending the old shared ceiling:

- every compiler-required recommendation registry entry now owns an exact
  `frameCharacters` ceiling beside its prompt fragment and parser;
- the generic parser derives its coarse pre-id envelope from those entries,
  then rechecks the selected feature's smaller ceiling after extracting and
  admitting the widget id;
- a maximal legal Creative frame is proven to fit, while a Gesture frame that
  fits the coarse envelope but exceeds Gesture's own ceiling is rejected;
- the recurring assembled instruction is pinned at 7,823 characters, so later
  prompt growth must be an explicit test change; and
- prompt membership remains derived from the live availability policy and the
  closed registry.

The completion preserves the required explicit-request behavior: availability,
not the proactive-assistance switch, controls whether a live widget grammar is
present.

## Recommendation (completed)

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

- `packages/core/src/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts`
- `packages/core/src/utils/workshopWidgetRecommendationProtocol.ts`
- `packages/core/src/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation.ts`
- `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/shared/constants/workshopWidgets.ts`
- `packages/core/src/shared/constants/promptBudgets.ts`
- `packages/core/src/__tests__/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.test.ts`
- `packages/core/src/__tests__/architecture/promptBudgets.test.ts`
- `docs/pr-reviews/pr-98-lexical-gravity-standing-rail-2a02727-review-v2.md`

## Completion Criteria

- Only live registry entries contribute recommendation prompt fragments.
- Each widget owns its instruction fragment and response-section ceiling.
- Gesture and Lexical Gravity parsing behavior remains fail-closed.
- Explicit widget requests work with Use Tools & Widgets both on and off.
- Prompt-budget tests expose the recurring assembled instruction size.
