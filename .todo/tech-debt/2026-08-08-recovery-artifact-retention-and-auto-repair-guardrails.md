# Recovery artifact retention and automatic-repair guardrails

**Status:** Deferred
**Priority:** Medium
**Source:** Rejected model response recovery review (`b0003d80`), F-10, F-16, F-18, F-21

## Problem

Rejected model responses preserve unpublished prose under the workspace so a
paid malformed completion can be repaired. The failure path is intentionally
durable, but it currently has no rotation policy and no content hash or bounded
retransmission contract for a future "attempt auto recovery" action.

## Recommendation

Before exposing automatic repair:

- add an explicit count/age/byte retention policy with a visible cleanup path;
- persist a content hash and verify it before any automatic provider resend;
- bound the body supplied to the repair model and show its estimated cost;
- keep persistence asynchronous only if profiling shows it materially delays the
  original failure surface.

## Related files

- `packages/core/src/infrastructure/storage/RejectedModelResponseRecoveryStore.ts`
- `docs/adr/2026-08-08-rejected-model-response-recovery.md`
- `docs/pr-reviews/commit-b0003d80-rejected-model-response-recovery-review.md`

## Completion criteria

- Artifact retention is bounded and user-visible.
- A repair request verifies the saved body against a persisted hash.
- Repair input has a documented size/token/cost guard.
- Tests cover expiry/pruning and changed-on-disk artifact rejection.
