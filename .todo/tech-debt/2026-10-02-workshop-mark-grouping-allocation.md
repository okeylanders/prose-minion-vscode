# Group retained-history marks without repeated array copying

**Date identified:** 2026-10-02
**Status:** Identified — follow-up; does not block the current release
**Priority:** Low
**Found by:** Main release review at `7f9823be`, Tim's performance pass

## Problem

`findUnverifiableRetainedHistoryMarkKeys` builds each participant bucket by
spreading its previous array for every new mark. For N marks belonging to one
participant, grouping copies O(N²) references. The helper runs during checkpoint
decoding and twice during the pure rewind transform. There is no evidence of
current user-visible latency; the concern is avoidable allocation in long rooms.

## Smallest change

Initialize a bucket once and append marks with `push`. These arrays are local
to the helper, so this preserves the input's immutability and mark ordering.

## Related files

- `packages/core/src/application/services/workshop/session/WorkshopRetainedHistoryMarks.ts:313`
- `packages/core/src/application/services/workshop/WorkshopPersistedSession.ts`
- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts`
- [Release review](../../docs/pr-reviews/main-7f9823b-review-v2.md), F-02

## Completion criteria

- Grouping is linear in the number of marks and preserves input/order.
- Existing retained-history persistence and rewind tests pass unchanged.
- No extra test that merely asserts the choice of array implementation.
