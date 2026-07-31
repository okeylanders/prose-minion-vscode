# Widget-config counter integrity validation

**Date Identified**: 2026-07-31
**Reviewed**: 2026-07-31
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small

## Problem

`WorkshopSessionStateV1Integrity` applies the shared non-negative-safe-integer
check to the attachment, thread-artifact, turn, and task counters, but not to
the optional `counters.widgetConfig`. Shape validation only proves it is a
finite number. A checkpoint with a negative or fractional widget counter and
no higher existing `wc-N` id can therefore pass current validation and make the
next minted config id invalid or reusable.

Sprint 02A deliberately preserves existing codec behavior, so the ledger
extraction does not tighten this persisted-input contract invisibly.

## Recommendation

When making the next behavior-bearing Workshop codec correction, apply
`requireCounter` to `counters.widgetConfig` when present. Add boundaries for
negative, fractional, unsafe, zero, and missing pre-widget counters, plus a
hydration test proving rejection occurs before aggregate state replacement.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts`
- `packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts`
- `packages/core/src/__tests__/application/services/workshop/WorkshopWidgetConfigs.test.ts`

## Completion Criteria

- Present widget counters must be non-negative safe integers.
- Missing pre-widget counters continue to hydrate as zero.
- Invalid persisted counters fail before any live session state is replaced.
