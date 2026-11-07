# Workshop Route-Owner Count in the Agents Guide Is Stale

**Date Identified**: 2026-11-07
**Reviewed**: 2026-11-07
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Under an hour

## Problem

`AGENTS.md` (`.ai/central-agent-setup.md`) says the Workshop family is a
"Room owner + 16 composed route owners", and that Tier 2 tests cover
"Workshop's sixteen composed route owners". The composition's own guard
(`WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES` in `boundaries.test.ts`) lists 21
since Message Reactions Slice 1 added `WorkshopReactionHandler` (20 before
it). Found while keeping that slice's counts honest; out of its scope.

## Recommendation

Correct the number, or drop it and point at the guard's list. Optionally
hold the guide's number to the list in `boundaries.test.ts`, as the guide's
message-module tree already is.

## Related Files

- `.ai/central-agent-setup.md` (around lines 72 and 858)
- `packages/core/src/__tests__/architecture/boundaries.test.ts`

## Completion Criteria

- The guide's count matches the guard's list, or the guide names no count.
