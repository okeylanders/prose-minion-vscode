# Lightbox: a reading in flight when the chapter changes is dropped

**Date Identified**: 2026-10-19 (Lightbox Slice 3)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to medium (service bookkeeping, a forwarding path, tests)

## Problem

Slice 3 carries a board's readings onto the board built from a changed
chapter, stale and re-checked (ADR 2026-10-19 D4,
[resolved debt](../archive/tech-debt/2026-10-19-lightbox-stale-readings.md)).
A group still being read at that moment is carried as `cancelled`, with
"The chapter changed while this group was being read, so that reading was
set aside." Its run keeps going against the old board's id, and when its
group settles, `LightboxService.updateReadings` finds no retained board with
that id and the handler drops it ("its board is gone"). The provider has
already billed the call, so a writer who re-reads the file mid-run pays for a
reading they never see.

The old run also stays active in the runner under the old board's id, so the
new board shows no Stop for it, and a new press on the new board is accepted
while the old call is still out.

## Recommendation

Keep a small record of each board replaced by changed text (its successor's
id and its readings at that moment). When a group settles for a replaced
board, apply the settle to the recorded readings, carry that group onto the
live successor with `carryLightboxReadings` (stale against the old hash), and
publish it, but only if the successor's group is still the carried
`cancelled` object (compare by reference), so a newer run's result is never
overwritten. Consider offering Stop for the old run from the new board.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxService.ts` (`buildBoard`, `updateReadings`)
- `packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts`
- `packages/core/src/application/handlers/domain/LightboxReadingHandler.ts` (`onGroup`)

## Completion Criteria

- A group that settles after its board's text changed lands on the new board,
  marked stale against the text it read, with its quotes re-checked.
- A newer run on the new board is never overwritten by the old run's result.
- Tests cover a change mid-run, a stop after the change, and a newer run.
