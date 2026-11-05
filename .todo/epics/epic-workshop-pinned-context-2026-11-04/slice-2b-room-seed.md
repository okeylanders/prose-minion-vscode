# Slice 2b: Room Seed

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D2 (when), D3 (how), D4 (the match rule), D5 (workspace identity), D6 (budget), D7 (the report), D9 (the port)
**Branch:** `epic-pinned-context-slice-2b-room-seed`
**Status:** Waits on Slice 1 (the store) and Slice 2a (the starts and the port), both merged into the epic.

## Outcome

The first room in a project, New session and New session: full reset start
with the pinned files as ordinary context attachments. The result line says
what was attached and what wasn't. Opening, branching, rewinding and
reloading a room never touch it. Empty context stays empty.

## Build

### The match rule (`core/shared/constants/workshopPinnedContext.ts`)

- `workshopPinnedContextMatches(entry, attachment)` is pure and shared
  (ADR D4). It matches when the attachment's catalog key path equals the
  entry's path, or, failing that, when its `relativePath` does, compared
  after Slice 1's path normalization.
- Slice 2b, Slice 3's hook and Slice 4's pill all call it.

### Library (`application/services/workshop/pinnedContext/WorkshopPinnedContextLibrary.ts`)

- It is built only in `extension.ts`, and joins `CoreServices`. It takes the
  store and `WorkshopContextIntakeService`.
- `describe()` returns the list with each entry resolved: in the catalog
  (with its group) or a workspace file; its words; and its state (`ready`,
  `missing`, `unreadable` with the reason, or `head-sliced`). Slice 3's tab
  reads this.
- `readForSeed()` reads every pinned file through the intake service's
  existing doors (ADR D3), with `CONTEXT_ATTACHMENTS` bounds. It returns
  ready inputs (`WorkshopContextAttachmentInput`, `origin: 'writer'`), plus
  the entries left out and why.

### The real seed (`WorkshopPinnedContextRoomSeed`, implementing 2a's port)

- **`prepare(kind)`:**
  - captures the accepted workspace identity first, before anything awaits
    (ADR D5, after `ProjectMemoryWorkspaceIdentity`);
  - then calls `readForSeed()`. An unreadable or absent list plans nothing,
    and the report says why.
- **`install(plan, target)`:**
  - drops a plan whose identity is no longer the accepted one;
  - `first` and `full-reset` attach in pinned order;
  - `new` re-reads each carried pinned attachment in its slot (matched with
    the shared rule), appends the missing ones in pinned order, and leaves
    the rest of the carried attachments alone;
  - every attachment goes through the aggregate's budget and duplicate
    guards. Over budget, the next file is tried; nothing is truncated to fit
    (ADR D6);
  - it returns 2a's `WorkshopRoomSeedReport`.
- **`extension.ts`** swaps `WORKSHOP_NO_ROOM_SEED` for this seed. That is
  the only change outside the new modules and the result-line function.

### What the writer sees

- 2a's `workshopSessionStartResult` gains the report's sentences
  (ADR D7):
  - "Started a new Workshop session with your pinned context: 10 files,
    about 23,400 words.";
  - "… 9 of 10 pinned files attached; not attached: *the-cheshire-cat.md*
    (not found).";
  - "… *manuscript.md* (doesn't fit in the 100,000-word context limit).".
- The first room's report goes to the status ticker. There is no action
  result to carry it.
- Logs carry counts and categories only, for example
  `[WorkshopPinnedContext] Seeded new room (attached=9, missing=1,
  over-budget=0)`.

## Tests

- **Seed planning,** pure, with an in-memory target:
  - order;
  - re-read in its slot;
  - missing ones appended;
  - over budget skips and continues;
  - duplicates;
  - an empty list;
  - an unreadable list file seeds nothing, and the report says why;
  - a plan installed under another workspace identity installs nothing.
- **Through the real coordinator and store,** on a temporary folder:
  - full reset, New and the first room each produce a first checkpoint that
    holds the pinned files;
  - empty context holds none;
  - Open, Branch, Rewind and reload never seed;
  - a failed replacement leaves the prior room as it was;
  - no divider turn is minted at room start.
- **Delivery:**
  - the first host turn after a seed sends the attachments as one
    `replace`;
  - the system message is unchanged;
  - with Project Memory on, its catalog frame still ends the first user
    message, after the context (ADR D3).
- **The match rule:** catalog key and relative path both match; two
  different paths never do; Windows case-folding as Slice 1 defines it.

## Completion criteria

- [ ] Every room start in ADR D2's table seeds, or doesn't, as the table
      says.
- [ ] A missing, unreadable or oversized pinned file never fails a room.
- [ ] The coordinator and session service don't grow in this slice.
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec (as Slice 2).
- **2026-11-05.** Split by the coordinator: the starts, the port and the menu
  moved to Slice 2a.
