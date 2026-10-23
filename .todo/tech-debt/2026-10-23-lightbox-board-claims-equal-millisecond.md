# Equal-Millisecond Board Claims Can Recover Older Metadata After a Failed Rollback

**Date Identified**: 2026-10-23 (PR #164 second correction re-review, N-03)
**Reviewed**: 2026-10-23
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (an ordering rule and one regression test)

## Problem

A saved Lightbox board is rewritten in place under a *claim*: the file is
renamed, never over anything, to a name private to the write that records
when the claim was taken (`LightboxBoardClaims`, PR #164 F-01, F-02). When
abandoned claims are settled, the newest claim of a name is put back.

PR #164's re-review found one narrow path that recovers an older version
(N-03, Low / P3, nonblocking): see
[the review](../../docs/pr-reviews/pr-164-lightbox-board-names-review.md#n-03--equal-millisecond-claims-can-recover-older-metadata-after-failed-rollback).

1. A store commits an in-place rename (`Original` to `Renamed`), but
   removing its predecessor claim fails, and keeps failing.
2. A second store tries Delete, takes its own claim holding the latest
   bytes, cannot retire the predecessor, and correctly answers `failed`;
   the rename that would put its claim back fails too.
3. The two claims carry the **same millisecond**, and the older claim's
   random id sorts later.
4. Once the faults clear and the lease passes, recovery picks the older
   claim by the ids' lexical order: the board comes back named `Original`,
   and the newer claim is removed.

What can be lost is in-place metadata (a name; the same shape could lose a
newer spark mark), never the manuscript, and never a board after a Delete
that succeeded. It needs persistent predecessor-removal failure, a further
rollback failure, a tied clock and an unfavourable id order.

## Recommendation

Do not treat a UUID's lexical order as evidence of recency when two claims'
times tie. Either:
- keep both equal-time versions (preserve the ambiguity: put one back and
  leave the other claimed, or under a recovery name) rather than deleting
  the one not chosen; or
- record ordering evidence that settles it, such as a per-store sequence
  number in the claim's name beside its time.

## Related Files

- `packages/core/src/infrastructure/storage/LightboxBoardClaims.ts`
  (settling abandoned claims; lines 151–166 at `263450c`)
- `packages/core/src/infrastructure/storage/LightboxBoardStore.ts`
  (the failed-retirement rollback; lines 326–329 at `263450c`)
- `packages/core/src/__tests__/infrastructure/storage/LightboxBoardClaimFailures.test.ts`
- [PR #164 review, N-03](../../docs/pr-reviews/pr-164-lightbox-board-names-review.md)

## Completion Criteria

- Two claims of one name taken in the same millisecond are never settled by
  their ids' order: the reviewer's tied-clock witness recovers the newer
  version, or keeps both.
- The genuinely newer-timestamp rollback and recovery control still passes.
