# Unify Workshop bounded turn packing

**Date Identified**: 2026-07-14
**Reviewed**: 2026-07-14
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: 0.5 day
**Source**: PR #76 review, finding #11 (Marcus 🏛️)

## Problem

`WorkshopPromptBuilder` independently implements the same newest-first,
turn-windowed, character-bounded packing policy for direct-tool handoffs and
guest transcript/catch-up/handoff frames. The copies already differ in how
they accumulate delivered turn ids (`push` versus `unshift`), even though the
current cursor commit logic makes that difference harmless.

This was deferred from PR #76 because the review fixes change security,
routing, and guest lifecycle behavior; extracting the packer beside those
changes would add structural churn without closing another correctness gap.

## Recommendation

Extract one host-agnostic bounded turn packer whose caller supplies turn
formatting, budgets, and truncation copy. Keep envelope framing and participant
eligibility in the existing domain-specific builders.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/__tests__/application/services/workshop/WorkshopPromptBuilder.test.ts`

## Completion Criteria

- Direct-tool and guest transcript builders use one newest-first packing
  implementation.
- Delivered turn ids are returned in a documented, consistent order.
- Existing window, character-budget, truncation-marker, attribution, and
  cursor-commit tests remain green.
- No prompt envelope or safety instruction changes as part of the extraction.
