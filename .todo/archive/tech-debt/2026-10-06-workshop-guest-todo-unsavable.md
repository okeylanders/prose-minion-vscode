# A guest to-do makes the Workshop room unsavable

**Date Identified**: 2026-10-06
**Reviewed**: 2026-10-06
**Status**: Resolved
**Priority**: High
**Estimated Effort**: Small (one ledger branch plus a real-store witness)

## Problem

Once the writer promoted a **guest** persona's actionable finding into a
to-do, every autosave to `current.json` and every Save-as-named failed:

```
[WorkshopSessionPersistence] Autosave failed (…): Workshop session state.todos[0].source contains unknown field upstreamReportTurnId.
```

`WorkshopTodoLedger.addFromFinding` built host and guest sources in one object
literal and always wrote `upstreamReportTurnId: sourceTurn.reportTurnId`. On a
guest turn the value is `undefined`, but the key was present.
`assertTodoSource` (`WorkshopSessionStateV1Shape.ts`) allows that key only on
`host_turn` sources, and `exactKeys` (`persistedValidation.ts`) counts a key
whose value is `undefined`. `WorkshopSessionStore.validateSessionForWrite`
validates the live object before serializing it, so JSON never dropped the
key.

Three things hid the bug:

- **TypeScript.** The shared literal's `kind` was `'host_turn' | 'guest_turn'`.
  Excess-property checking against a union accepts a key that any member
  names.
- **Ledger test.** `WorkshopTodoLedger.test.ts` expected
  `upstreamReportTurnId: undefined` on the guest source under `toEqual`, which
  ignores undefined-valued keys.
- **Persistence test.** "round-trips guest-origin next steps" in
  `WorkshopSessionPersistence.test.ts` JSON-round-tripped the export before
  parsing it, which dropped the key the store would have refused.

No saved file needs repair. Every write was refused, so no file holds the key.
The room's files simply stopped at the last write before the promotion.

## Recommendation

Write `upstreamReportTurnId` only on `host_turn` sources, and only when it is
defined. Add a witness that autosaves, saves by name, and reopens a room
holding a guest to-do through the real coordinator and store, not a JSON round
trip. Optionally make the store's refusal of an undefined-valued key clearer.

## Related Files

- `packages/core/src/application/services/workshop/session/WorkshopTodoLedger.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts` (`assertTodoSource`)
- `packages/core/src/application/services/workshop/persistedValidation.ts` (`exactKeys`)
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts` (`validateSessionForWrite`)

## Completion Criteria

- A room holding a guest to-do autosaves, saves by name, and reopens.
- A test proves it through the real coordinator and store.

## Resolution (2026-10-06)

- **Ledger.** `findingSource` builds each source kind in its own literal, so
  the compiler checks each against its own union member. Re-adding the key to
  the guest literal now fails with TS2353. Guest sources never carry
  `upstreamReportTurnId`. Host sources carry it only when the turn names a
  report, so a live source matches its saved form.
- **Clearer refusal.** When `exactKeys` refuses an unknown key whose value is
  `undefined`, the message now adds "(its value is undefined)". Such a key
  appears in no saved file, which made the old message hard to act on. The
  store still refuses rather than strips. Stripping would have saved this
  room, but it would also have silenced the next producer that drifts from the
  codec. The set of accepted shapes is unchanged.

Regression tests:

- `WorkshopSessionPersistenceIntegration.test.ts`: "autosaves, saves by name,
  and reopens a room holding a guest to-do" drives the real coordinator and
  store through an autosave, a named save, a named autosave, a reset, and a
  reopen. On the old ledger its first autosave is refused for the stray key.
- `WorkshopTodoLedger.test.ts`: host and guest provenance use `toStrictEqual`.
  A guest turn that names a report still yields no `upstreamReportTurnId`. A
  host turn without a report omits the key.
- `WorkshopSessionPersistence.test.ts`: the guest round trip also validates
  the live export, as the store does, before its JSON round trip.
- `persistedValidation.test.ts`: `exactKeys` accepts an undefined optional key
  and names an undefined unknown key.
