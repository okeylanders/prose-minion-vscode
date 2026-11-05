# Slice 2a: Three Starts and the Seed Port

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D2 (the three starts), D7 (the menu and the result lines), D9 (the port)
**Design:** `docs/design/workshop-pinned-context/` (approved 2026-11-05): `Workshop.dc.html`'s sessions menu and result lines
**Branch:** `epic-pinned-context-slice-2a-starts-seed-port`
**Status:** Not started. It runs beside Slice 1: neither touches the other's files.

## Outcome

The Workshop can start a room three ways: **carry** (New session), **full
reset** and **empty** (New session: full reset, empty context). The
coordinator calls a room seed port at every room start that ADR D2 seeds.
`extension.ts` injects a seed that plans nothing, until Slice 2b swaps in
the real one.

Nothing a writer sees changes yet. With nothing pinned, the menu is
today's, and a full reset is empty, as it is today.

## Build

### The start (messages)

- `WorkshopResetSessionPayload` becomes `{ start: WorkshopSessionStart }`,
  with `WorkshopSessionStart = 'carry' | 'full-reset' | 'empty'` and a
  `WORKSHOP_SESSION_STARTS` list for validation. It lives in
  `core/shared/types/messages/workshop/session.ts`, which is already past
  500 lines, so add only the type there and put anything larger beside it.
- Remove `clearWorkingSet` outright. This is alpha: no shim, no fallback.
- `useWorkshopSessions.resetSession(start)` posts it. `WorkshopApp`'s New
  session sends `carry`, and its full reset sends `full-reset`.

### The handler

- `handleResetSession` (`WorkshopSessionMessageHandler.ts`) refuses a
  missing or unknown `start` with a reason, and starts nothing. That
  includes the old `clearWorkingSet` shape.
- Its result line comes from a pure function in a sibling module, e.g.
  `workshopSessionStartResult(start, cleared, seedReport)`, so the handler
  doesn't grow. It returns ADR D7's copy:
  - `carry`: "Started a new Workshop session." With a seed report, the
    report's sentence follows (2b fills it).
  - `full-reset` with nothing seeded: today's "Started an empty Workshop
    session — excerpt and context cleared."
  - `full-reset` with pinned context: 2b's copy, which this function takes
    from the report.
  - `empty`: "Started an empty Workshop session: excerpt and context
    cleared, and pinned context left out."
- The log line keeps today's shape, and adds the start, never a name.

### The coordinator and the port

- `WorkshopSessionPersistenceCoordinator.resetSession({ start })` takes
  the start.
  - The aggregate's own `session.reset({ clearWorkingSet })` stays as it
    is: it's internal, and it says exactly what it does.
  - The coordinator maps `start !== 'carry'` onto it.
- **The port** lives in
  `application/services/workshop/pinnedContext/WorkshopRoomSeed.ts`:
  - `WorkshopRoomSeedKind = 'first' | 'new' | 'full-reset'`;
  - `WorkshopRoomSeedPlan`, opaque to the coordinator;
  - `WorkshopRoomSeedReport`: how many were pinned and attached, the words,
    and each left-out file's label and reason (`missing`, `unreadable`,
    `over-budget`). Labels are for the UI, never for logs;
  - `WorkshopRoomSeedTarget`: the narrow slice of the session service that
    seeding needs: list attachments, add one, and replace one in its slot
    (`refreshContextFileAttachments`);
  - `WorkshopRoomSeed`: `prepare(kind): Promise<WorkshopRoomSeedPlan>` and
    `install(plan, target): WorkshopRoomSeedReport`;
  - `WORKSHOP_NO_ROOM_SEED`: plans nothing, and reports nothing.
- **Where the coordinator calls it** (ADR D9):
  - `resetSession` with `carry` calls `prepare('new')`, and with
    `full-reset` calls `prepare('full-reset')`, before `replaceLiveRoom`.
    Inside the replacement it calls `install`, after `session.reset` and
    before `recordStartMarker` and `capture`, so the first checkpoint holds
    what was installed;
  - `empty` never calls the port;
  - `initializeOnce`'s no-current branch calls `prepare('first')`, then
    `install` before `recordStartMarker`;
  - a failed replacement drops the plan with the room;
  - nothing else calls the port: not Open, Duplicate, Branch, Rewind or
    hydrate.
- The coordinator is 1,797 lines. It grows only by the port's calls and its
  constructor parameter; the plan, report and rules live in the port's
  module.
- `extension.ts` passes `WORKSHOP_NO_ROOM_SEED`, the only composition-root
  change.
- `WorkshopResetSummary` gains `seed?: WorkshopRoomSeedReport`.

### The menu

- `WorkshopSessionsMenu` takes a `pinnedFileCount: number` prop. While it is
  above 0, the menu shows 0d's copy:
  - **New session: full reset** with "clears the excerpt and context, then
    attaches pinned context";
  - **New session: full reset, empty context** directly under it, with
    "clears the excerpt and context, and leaves pinned context out", its
    `danger` treatment and its tooltip.
- At 0 it is today's menu, copy included.
- `WorkshopApp` passes `0` until Slice 3's hook supplies the count. Leave a
  one-line comment there naming Slice 3. That is the slice's one known
  placeholder.

## Tests

- **The payload:** each start is posted as written. A missing or unknown
  `start`, and the old `clearWorkingSet` shape, are refused with a reason,
  and nothing starts.
- **Through the real coordinator,** with a recording fake seed:
  - `carry` calls `prepare('new')`, `full-reset` calls
    `prepare('full-reset')`, and `empty` calls nothing;
  - the first room calls `prepare('first')`;
  - Open, Duplicate, Branch, Rewind and hydrate never call it;
  - a fake seed whose `install` adds an attachment leaves that attachment in
    the first checkpoint written;
  - a failed replacement leaves the prior room as it was, and the plan is
    never installed.
- **The result lines,** one per start, with and without a seed report.
- **The menu:** at 0 it is today's markup and copy, and its existing tests
  run unchanged. Above 0 it shows the empty-context item and the new
  subtitle, and each item sends its own start.
- **Boundaries:** the coordinator imports `WorkshopRoomSeed` as a type
  only, and only `extension.ts` constructs a seed.

## Completion criteria

- [ ] Three starts, one field; `clearWorkingSet` is gone from the contract.
- [ ] The port is called exactly where ADR D9 says, and nowhere else.
- [ ] With `WORKSHOP_NO_ROOM_SEED`, the Workshop behaves exactly as before.
- [ ] No touched file grows past 500 lines, unless it was already past it;
      those grow only by calls.
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-05.** Split from Slice 2 by the coordinator, so it can run beside
  Slice 1.
