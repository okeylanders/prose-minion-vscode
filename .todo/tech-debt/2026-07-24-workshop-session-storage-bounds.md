# Workshop Session Storage Bounds

**Status:** Active
**Priority:** Medium
**Origin:** PR #85 review findings 12 and 19

## Files first

- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `packages/core/src/application/services/workshop/WorkshopPersistedSession.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`

## Problem

Two accepted v1 risks remain after the PR #85 correction:

1. Every committed mutation rewrites the full pretty-printed aggregate and
   retained conversation archive. Total write volume grows quadratically with
   a long session.
2. Exact restore/action reads are intentionally above the browser's 5 MB
   defensive bound, while the recursive conversation clone has no explicit
   maximum byte/depth contract. Hostile shared-workspace files can therefore
   exhaust extension-host memory or stack.

## Completion criteria

- Establish an exact-read ceiling comfortably above valid long-session sizes,
  with a visible recovery path and boundary tests.
- Replace recursive `persistedJson.ts` cloning with an iterative or
  depth-bounded persisted-value decoder.
- Define a compaction/incremental-write strategy that preserves exact restore,
  ordered autosave, and crash recovery without an O(n²) rewrite curve.
- Update the persistence ADR and migration/versioning contract before changing
  the durable format.
