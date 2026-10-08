# A guest's to-do makes the Workshop room unsavable

**Date Identified**: 2026-10-06
**Reviewed**: 2026-10-08
**Status**: Save failure fixed on release branch; recall fixture follow-up open
**Priority**: Low (remaining fixture coverage)
**Estimated Effort**: Small (one ledger line, plus save-and-reopen tests)
**Found by**: Workshop Session Recall Slice 2B, building real to-do fixtures through the coordinator and store

## Problem

When the writer promotes a **guest** persona's finding into a to-do, every
later save of that room fails: autosave to `current.json` and Save as a named
session alike. The output channel shows, on every attempt:

```text
[WorkshopSessionPersistence] Autosave failed (id=…, revision=…, reason=…):
Workshop session state.todos[0].source contains unknown field upstreamReportTurnId.
```

`WorkshopTodoLedger.addFromFinding` builds host and guest sources in one
branch and always writes `upstreamReportTurnId: sourceTurn.reportTurnId`. On a
guest turn that value is `undefined`, but the key is present. The persisted
shape (`assertTodoSource` in `WorkshopSessionStateV1Shape.ts`) allows that key
only on `host_turn` sources, and `exactKeys` counts a key whose value is
`undefined`. The store validates the object before it serializes it, so the
`undefined` never gets the chance to drop out.

The existing round-trip test (`WorkshopSessionPersistence.test.ts`, "round-trips
guest-origin next steps") passes because it serializes with
`JSON.parse(JSON.stringify(...))` before parsing, which removes the key. The
coordinator's real save path does not.

Reproduced on `epic/workshop-session-recall` at `5eede32`; `main` has the same
ledger line. Every save of the room fails after the first guest to-do, so
writer work after that point is not persisted.

## Recommendation

Write `upstreamReportTurnId` only on `host_turn` sources, and only when it is
defined. Add a witness that saves and reopens a room holding a guest to-do
through the real coordinator and store, not a JSON round trip. Consider
whether the store should also reject `undefined`-valued keys with a clearer
message, or strip them, so the next instance of this fails in tests rather
than for a writer.

No saved file needs repair: the shape check refused every write, so no file
holds the bad key.

## Related Files

- `packages/core/src/application/services/workshop/session/WorkshopTodoLedger.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts` (`assertTodoSource`)
- `packages/core/src/application/services/workshop/persistedValidation.ts` (`exactKeys`)
- `packages/core/src/__tests__/application/services/workshop/WorkshopSessionPersistence.test.ts`
- `packages/core/src/__tests__/application/services/workshop/recall/workshopRecallTodoFixtures.ts`
  (its guest joins without a to-do until this is fixed)

## Completion Criteria

- [x] A room holding a guest's to-do autosaves, saves by name, and reopens
      through the real coordinator and store.
- [ ] The recall to-do fixture promotes a real guest finding.

## Release preparation fix — 2026-10-08

`WorkshopTodoLedger.addFromFinding` now adds `upstreamReportTurnId` only for a
host turn with a defined report id. Guest sources no longer carry the
undefined-valued key that the exact-key store validator rejected. A regression
drives a guest finding through the real coordinator and store: autosave to
`current.json`, named save, then reopen. It failed at the store's
`state.todos[0].source` check before the fix and passes afterward. The ledger's
host and guest provenance expectations pass too.

The existing recall to-do corpus still uses a synthetic guest source. Replace
that fixture in focused recall test work; it is no longer needed to establish
that a real guest to-do can persist.
