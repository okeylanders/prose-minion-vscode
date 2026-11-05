# Slice 2a: Three Starts and the Seed Port

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D2 (the three starts), D7 (the menu and the result lines), D9 (the port)
**Design:** `docs/design/workshop-pinned-context/` (approved 2026-11-05): `Workshop.dc.html`'s sessions menu and result lines
**Branch:** `epic-pinned-context-slice-2a-starts-seed-port`
**Status:** Built 2026-11-05, waiting for its PR into `epic-pinned-context`. It runs beside Slice 1: neither touches the other's files.

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

- [x] Three starts, one field; `clearWorkingSet` is gone from the contract.
- [x] The port is called exactly where ADR D9 says, and nowhere else.
- [x] With `WORKSHOP_NO_ROOM_SEED`, the Workshop behaves exactly as before.
- [x] No touched file grows past 500 lines, unless it was already past it;
      those grow only by calls.
- [x] The epic's verification passes, with counts recorded here.

## Built

**Commits** (on `b94fc674`).

- `443fa508`: the port and its no-op seed, exported through the core barrel.
- `e0dba18e`: three starts replace `clearWorkingSet` (payload, handler,
  coordinator, hook, session surfaces, confirm copy); the coordinator's seed
  calls; `extension.ts` passes `WORKSHOP_NO_ROOM_SEED`. Existing tests move to
  `start`.
- `417232c2`: the menu's empty-context item behind `pinnedFileCount`;
  `WorkshopApp` passes `0`, with a comment naming Slice 3.
- `4ed47742`: the new tests and boundary guards.

**Where each piece lives.**

| Piece | Where |
|---|---|
| `WorkshopSessionStart`, `WORKSHOP_SESSION_STARTS`, the payload | `shared/types/messages/workshop/session.ts` (type only; the file shrank 1,009 → 1,005) |
| The port: kinds, plan, report, target, `WORKSHOP_NO_ROOM_SEED`, `isEmptyWorkshopRoomSeedReport` | `application/services/workshop/pinnedContext/WorkshopRoomSeed.ts` (96 lines) |
| Reading the start, the refusal, the result line, the log line | `application/handlers/domain/workshop/WorkshopSessionStartResult.ts` (beside the handler) |
| The handler | `handleResetSession` reads the start, refuses, calls, posts (596 → 593 lines) |
| The coordinator's calls | `initializeOnce`'s no-current branch (`prepare('first')`, `install`, then `recordStartMarker`); `resetSession` (`prepare` inside the session-operation queue, before `replaceLiveRoom`; `install` right after `session.reset`). 1,797 → 1,812: two imports, the constructor parameter, `WorkshopResetSummary.seed`, the calls, and the method's doc comment |
| `WorkshopRoomSeedTarget` | `Pick<WorkshopSessionService, 'getContextAttachments' \| 'addContextAttachment' \| 'refreshContextFileAttachments'>` |
| The empty start in the webview | `useWorkshopSessionSurfaces.startEmptyReset` and the confirm kind `new-empty`, with copy in `workshopSessionConfirmCopy.ts` |
| The menu | `WorkshopSessionsMenu` props `pinnedFileCount`, `onEmptyResetSession` |

**Tests.**

- `pinnedContext/WorkshopRoomSeedCoordinator.test.ts`: a recording seed through
  the real coordinator, aggregate and store. It covers the first room,
  `carry` → `new`, `full-reset` → `full-reset` (each install is in the first
  `current.json`), and `empty` calling nothing. It also covers a failed
  promotion (the prior room kept, its plan never installed later), a `prepare`
  that rejects (nothing starts), a reload of `current.json`, and Open,
  Duplicate, Rewind and Branch never calling it.
- `WorkshopSessionStart.test.ts`: each start posted through the route as
  written; no start, an unknown start, the old `clearWorkingSet` shape and no
  payload are each refused with a reason, and nothing starts. It also checks
  the result lines with and without a report, and that the log line never
  carries a left-out label.
- The menu: at 0 it is today's copy and tooltip, with one full-reset item.
  Above 0 the empty item sits directly under it, with its copy, `danger` and
  tooltip, and each item sends its own start. The existing cases are
  untouched; the render helper gained the two new props' defaults.
- Surfaces: each start confirms its own kind and sends its own start, or
  sends at once in an empty room. The hook posts each start as written.
- `boundaries.test.ts`, two guards:
  - The coordinator imports the port as a type only, and only `initializeOnce`
    and `resetSession` call it (two `prepare`s, two `install`s). No other core
    module names `roomSeed`.
  - Only the port and the barrel name `WORKSHOP_NO_ROOM_SEED` or implement a
    seed, and `extension.ts` passes it to the coordinator once.

## Verification

| Check | Before (`b94fc674`) | After (`4ed47742`, after `npm ci`, Node 22) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npx jest` | 691 suites / 9,696 tests / 59 snapshots | 693 suites / 9,732 tests / 59 snapshots, all passing |
| `npm run lint` | 0 errors / 1,165 warnings | 0 errors / 1,165 warnings (no new ones) |
| `from 'vscode'` in `packages/core/src` | none | none |
| New files over 500 lines | — | none (largest new one: the coordinator seed test, 184) |

The "before" counts are the epic's recorded baseline on `b94fc674`.

## Deviations and open items

- **`prepare` resolves; the port's doc says so.** A file it cannot read is a
  left-out entry, never a rejection. If one rejects anyway, `resetSession`
  fails before the replacement and changes nothing (tested). But in
  `initializeOnce`, a rejection would land in the restore `catch`, which
  pauses rolling autosave. Slice 2b's seed must keep to the contract.
- **The clearing log line still names what it cleared.** The slice says to
  keep today's shape: the excerpt label and the cleared attachment labels, a
  deliberate choice ("it deleted my context"). The seed adds only counts and
  reason tallies, never a label.
- **Full reset with pinned context, the copy.** The ADR gives none, so the
  function says "Started a new Workshop session with the excerpt and context
  cleared and your pinned context: 10 files, about 23,400 words." With files
  left out, it says "… cleared. 9 of 10 pinned files attached; not attached:
  …". Slice 2b may reword it.
- **"About" rounds** to hundreds from 1,000 words up, and to tens below.
- **The empty start confirms** like the full reset (`new-empty`). The
  full-reset confirm body still says "starts an empty room". That is true
  while nothing is pinned, but Slice 3 should reword it once the count is
  real.
- `WorkshopRoomSeedPlan` is `{ kind }`. A seed extends it with what it read,
  and narrows it again in `install`. The coordinator only hands it back.

## Progress

- **2026-11-05.** Split from Slice 2 by the coordinator, so it can run beside
  Slice 1.
- **2026-11-05.** Built on `epic-pinned-context-slice-2a-starts-seed-port`; see
  Built and Verification above.
