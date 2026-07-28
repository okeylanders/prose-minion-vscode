# Workshop Session Storage Bounds

**Status:** Active
**Priority:** Medium
**Origin:** PR #85 review findings 12 and 19

Exact-read byte bounds and persisted-JSON depth bounds landed on 2026-07-27.
The item remains active for the full-snapshot rewrite/compaction strategy.

## Files first

- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `packages/core/src/application/services/workshop/WorkshopPersistedSession.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`

## Problem

One accepted v1 scaling risk remains after the Marketplace hardening:

1. Every committed mutation rewrites the full pretty-printed aggregate and
   retained conversation archive. Total write volume grows quadratically with
   a long session.
## Completion criteria

- [x] Establish an exact-read ceiling comfortably above valid long-session
  sizes, fail-closed error reporting, and boundary tests.
- [x] Replace unbounded recursive `persistedJson.ts` cloning with a
  depth-bounded persisted-value decoder.

- Define a compaction/incremental-write strategy that preserves exact restore,
  ordered autosave, and crash recovery without an O(n²) rewrite curve.
- Update the persistence ADR and migration/versioning contract before changing
  the durable format.
