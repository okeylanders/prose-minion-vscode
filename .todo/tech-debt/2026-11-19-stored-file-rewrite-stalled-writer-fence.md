# The shared stored-file rewrite may not fence a stalled writer

**Date Identified**: 2026-11-19
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Medium
**Source**: [Workshop Persona Tools](../epics/epic-workshop-persona-tools-2026-11-19/README.md), PR #286's re-review (finding 1)

## Problem

`commitStoredFileRewrite` (`packages/core/src/infrastructure/storage/StoredFileRewrite.ts`)
stages the new bytes beside the file, outside its claim, unless the caller
passes a `stagingPath`. It checks that the claim is still its own, then
publishes with a separate rename. `StoredFileClaims` recovers a claim held
past `STORED_FILE_CLAIM_LEASE_MS`.

A writer that pauses past the lease, after that check and before its
publish, may still hold its staged file after another window has recovered
the claim and deleted the file. Its publish could then recreate the
deleted file. The module's header names a narrower race; PR #286's
re-review found it for named Workshop sessions, which the epic answers
with a lock of their own (ADR 2026-11-19 D6b). The pinned-context list
already stages inside its lock (PR #204 F-01), under a fresh name per write, and releases by detach-then-verify; checked against the second re-review's two gaps (ADR D6d) and found clear of both, apart from this shared claim.

Lightbox boards (`LightboxBoardRewrite`) and project memory
(`ProjectMemoryStore`) use the shared path without a fencing
`stagingPath`.

## Recommendation

Confirm the exposure for boards and memory with a witness (pause past the
lease, takeover and delete, resume). If it reproduces, move their staging
inside a per-file lock, as `WorkshopNamedSessionLock` and
`WorkshopPinnedContextLock` do.

## Related Files

- `packages/core/src/infrastructure/storage/StoredFileRewrite.ts`
- `packages/core/src/infrastructure/storage/StoredFileClaims.ts`
- `packages/core/src/infrastructure/storage/LightboxBoardRewrite.ts`
- `packages/core/src/infrastructure/storage/ProjectMemoryStore.ts`
- `docs/adr/2026-11-19-workshop-persona-tools.md` (D6b)

## Completion Criteria

- [ ] A witness for boards and memory, either passing or fixed.
