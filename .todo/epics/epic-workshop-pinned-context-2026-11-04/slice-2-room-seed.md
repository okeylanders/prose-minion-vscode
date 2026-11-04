# Slice 2: Room Seed

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D2 (when), D3 (how), D6 (budget), D7 (the report), D9 (the port)
**Status:** Waits on Slice 1, and on Project Memory on `main`.

## Outcome

A room that starts (the first room in a project, New session, or New
session: full reset) starts with the pinned files as ordinary context
attachments. The New result says what was attached and what wasn't. Opening,
branching, rewinding and reloading a room never touch it.

## Build

### Library (`application/services/workshop/pinnedContext/WorkshopPinnedContextLibrary.ts`)

- It is built in `extension.ts` and joins `CoreServices`. It takes the
  store and `WorkshopContextIntakeService`.
- `describe()` returns the list with each entry resolved: in the catalog
  (with its group) or a workspace file; its words; and its state (`ready`,
  `missing`, `unreadable` with the reason, or `head-sliced`). Slice 3's tab
  reads this.
- `readForSeed()` reads every pinned file through the intake service's
  existing doors (ADR D3), with `CONTEXT_ATTACHMENTS` bounds. It returns
  ready inputs (`WorkshopContextAttachmentInput`, `origin: 'writer'`), plus
  the entries left out and why.
- The shared pure rule `workshopPinnedContextMatches(entry, attachment)`
  lives in `core/shared/constants/workshopPinnedContext.ts`. The webview
  uses it in Slices 3 and 4.

### The seed port (`WorkshopRoomSeed`)

- `prepare(kind)` is async and calls `readForSeed()`. `install(plan,
  target)` is synchronous and goes through `WorkshopRoomSeedTarget`, a
  narrow slice of the session service: list attachments, add, and replace
  in a slot (the aggregate's existing `refreshContextFileAttachments`).
- **Install rules:**
  - `first` and `full-reset`: attach in pinned order;
  - `new`: re-read each carried pinned attachment in its slot; append the
    missing ones in pinned order; leave the rest of the carried attachments
    alone;
  - each one goes through the aggregate's budget and duplicate guards.
    Over budget, the next file is tried; nothing is truncated to fit
    (ADR D6).
- **The coordinator's calls:** `resetSession` calls `prepare` before
  `replaceLiveRoom`, and `install` inside it, after `session.reset` and
  before `recordStartMarker` and `capture`. `initializeOnce`'s no-current
  branch does the same. A failed replacement drops the plan.
- **Nothing else calls the port.** Open, Duplicate, Branch, Rewind and
  hydrate never do. An architecture test pins the call sites.
- The coordinator imports the port's type only. `boundaries.test.ts` pins
  that, and that no handler constructs the library.

### What the writer sees

- `WorkshopResetSummary` gains the seed report, and `handleResetSession`'s
  result message carries it (ADR D7).
- The first room's report goes to the status ticker. There is no action
  result to carry it.
- The sessions menu's full reset subtitle and tooltip change while the list
  holds anything. The webview learns that from a `pinnedCount` on the
  session snapshot, or from Slice 3's hook if that has landed. Pick
  whichever adds less, and record it here.
- Logs carry counts and categories only, for example
  `[WorkshopPinnedContext] Seeded new room (attached=9, missing=1,
  over-budget=0)`.

## Tests

- **Seed planning,** pure, with an in-memory target: order; re-read in slot;
  missing appended; over budget skips and continues; duplicates; an empty
  list; an unreadable list file means nothing is seeded, and the report
  says why.
- **Through the real coordinator** on a temporary folder:
  - full reset and New each produce a first checkpoint that holds the pinned
    files;
  - the first room does too;
  - Open, Branch, Rewind and reload never seed;
  - a failed replacement leaves the prior room exactly as it was, with no
    pinned files added;
  - no divider turn is minted at room start.
- **Delivery:** the first host turn after a seed sends the attachments as
  one `replace`, and the system message is unchanged.
- **The full reset's copy** with and without pinned files.

## Completion criteria

- [ ] Every room start in ADR D2's table seeds, or doesn't, as the table
      says.
- [ ] A missing, unreadable or oversized pinned file never fails a room.
- [ ] Coordinator and session service grow only by the port's calls.
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec.
