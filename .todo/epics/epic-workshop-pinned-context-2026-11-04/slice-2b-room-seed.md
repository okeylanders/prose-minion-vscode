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
- **`prepare` never rejects** (Slice 2a's port contract). Every failure
  inside it becomes a plan whose report names what was left out and why.
  The reason matters most at the first room: there a rejection would land
  in `initializeOnce`'s restore `catch` and pause rolling autosave. Test it
  with a store and an intake service that throw.
- **`extension.ts`:**
  - builds `WorkshopPinnedContextStore` and the library, and swaps
    `WORKSHOP_NO_ROOM_SEED` for this seed;
  - hands the store's `shutDown()` to `shutDownExtension`, so owed writes
    drain before deactivation resolves (AGENTS.md, "Owed writes drain";
    PR #183 F-03).

  These, the new modules and the result-line function are the only changes.

### From the Slice 1 and 2a reviews (coordinator, 2026-11-05)

- **The store's API, as built:**
  - `read()` also answers `unavailable`, `busy` and `io`;
  - `update`'s `changed` carries `current`;
  - `invalid` covers a change that wouldn't read back;
  - `update(revision, change, { beforeCommit })` takes the caller's commit
    check;
  - there is a `too-large` refusal, with a 128 KiB bound (Slice 1's
    follow-up).

  The library maps every state to the words ADR D8 and 0d's boards use.
- **The live-room check belongs to the library.** The store withdraws a
  write when its folder changes. The library adds the accepted room: build
  its check with `askedProjectMemoryWorkspace` (or a sibling of it) and pass
  it as `beforeCommit` on every write. The library's writes are Slice 3's,
  but the check is built here.
- **2a's report** is `{ pinnedCount, attachedCount, attachedWords,
  leftOut: { label, reason }[] }`. Reword the result lines in
  `WorkshopSessionStartResult.ts` here if 2b needs to; their tests move
  with them.

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

- [x] Every room start in ADR D2's table seeds, or doesn't, as the table
      says.
- [x] A missing, unreadable or oversized pinned file never fails a room.
- [x] The coordinator and session service don't grow in this slice.
- [x] The epic's verification passes, with counts recorded here.

## Built

**Commits** (on `c35c2818`).

- `563bf89e`: the match rule, the file reader, the library, its words and
  the room seed.
- `2d968194`: the composition root: the store, the library and the seed
  built in `extension.ts`, the seed passed in place of `WORKSHOP_NO_ROOM_SEED`,
  the library in `CoreServices`, the store's `shutDown` handed to
  `shutDownExtension`; the result line for an unreadable list.
- `93f0e59a`: the tests and the boundary guards.
- This doc.

**Where each piece lives.**

| Piece | Where |
|---|---|
| The match rule | `shared/constants/workshopPinnedContext.ts` (`workshopPinnedContextMatches(entry, attachment, platform)`) |
| Reading pinned files through the intake doors | `application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader.ts` (250 lines) |
| The library: `describe()`, `readForSeed()`, `askLiveRoom()`, `askSeedWorkspace()` | `pinnedContext/WorkshopPinnedContextLibrary.ts` (265) |
| The states in D8's and 0d's words | `pinnedContext/WorkshopPinnedContextWords.ts` (67) |
| The seed | `pinnedContext/WorkshopPinnedContextRoomSeed.ts` (234), `implements WorkshopRoomSeed` |
| The result line for an unreadable list | `WorkshopSessionStartResult.ts` (`seedSays`; 130 lines) |
| Wiring | `extension.ts`; `extensionShutdown.ts` (`pinnedContext` part); `CoreServices.workshopPinnedContext` (`MessageHandlerContracts.ts`, a type import); the barrel exports the store, library, seed and `workshopPinnedContextPlatformOf` |

**How it reads a file** (ADR D3). The reader opens one fresh catalog per
read. A pinned path whose key (Slice 1's `workshopPinnedContextPathKey`)
equals a catalog entry's path goes through `WorkshopContextIntakeCatalog.load`
and keeps its catalog key. Any other path is `stat`ed (only to tell
*missing* from *unreadable*), re-authorized through `authorizeExcerptReread`
(contained, no symbolic link) and read through `loadFile`, as a refresh does.
Both use `CONTEXT_ATTACHMENTS`' `fileBytes` and the head slice at the budget's
words. A catalog that can't be opened reads every entry as a workspace file,
and is logged. Nothing in the reader throws: a failure is `unreadable` with a
category (`not-a-file`, `too-large`, `empty`, `refused`, `read-failed`).

**How the seed installs** (ADR D3, D6). In pinned order, for every kind: a
file the room already carries (the match rule, or the aggregate's own
duplicate key: the same `sourceUri` or catalog key) is re-read in its slot
through `refreshContextFileAttachments`, checked against the budget less its
own words; any other file goes through `addContextAttachment`. A file that
doesn't fit is left out as `over-budget` and the next is tried. Carried
attachments that aren't pinned are never touched. After a reset the room has
no host conversation, so neither call mints a divider turn (tested).

**Tests.**

- `pinnedContext/WorkshopPinnedContextRoomSeed.test.ts` (21): order; catalog
  key kept; re-read in its slot, missing appended, unpinned carried left
  alone; over budget skips and continues; a carried file that grew keeps its
  body; one file under another path is re-read, never duplicated; missing and
  unreadable named; no list and an empty list report nothing; an unreadable
  list reports `pinned-context.json`; another workspace, another live room, a
  foreign plan and a second install each install nothing; the first room's
  report kept once. **`prepare` never rejects**: a store whose `read` or
  `availability` throws, a scope that throws, a catalog, `authorizeExcerptReread`
  or `loadFile` that throws, a `stat` that fails for another reason, a
  `readForSeed` that throws. Logs are checked for no path or name.
- `pinnedContext/WorkshopPinnedContextLibrary.test.ts` (8): `describe()`'s
  rows (group chip, workspace, head-sliced, Not found, Can't read), an absent
  list, an unreadable one with its entry, both unavailable notices; the
  accepted-room check fails when the room or folder moves, refuses before a
  room settles (a seed accepts the first room), and withdraws a real store
  write as `beforeCommit`.
- `pinnedContext/WorkshopPinnedContextRoomSeedCoordinator.test.ts` (7), the
  real coordinator, session store and pinned store on one folder: the first
  room, New and full reset each write a first checkpoint holding the pinned
  files; empty reads nothing and holds nothing; no divider turn, over a room
  that had a conversation; a failed replacement keeps the prior room; reload,
  Open, Duplicate, Rewind and Branch never read the list; a list that throws
  at the first room starts the room with autosave on.
- `pinnedContext/WorkshopPinnedContextDelivery.integration.test.ts` (1): the
  first host turn through the real room handler, assistant service and
  persona capability. One `<context-attachments count="2">` frame in pinned
  order and no update frame; the system message equals an unseeded room's;
  memory's catalog frame comes after the context and ends the message.
- `shared/constants/workshopPinnedContext.test.ts` (5): catalog key, relative
  path, different paths, text notes, Windows case-folding, `\` and NFD.
- `extensionShutdown.integration.test.ts`: the order test drains pinned
  context too; a held list write keeps deactivation pending until it lands.
- `boundaries.test.ts`: the seed is the port's third chooser and
  `extension.ts` passes it, not the no-op; only `extension.ts` constructs the
  store, library and seed (once each) and hands the store to shutdown; no
  handler imports the library, seed or reader, and `CoreServices` names the
  library as a type only; `pinnedContext/` stays under 500 lines.
- `WorkshopCoordinatorHarness.setupCoordinator` takes an optional
  `fileSystem`, so the coordinator and the pinned store share one folder.

## Verification

| Check | Before (`c35c2818`, coordinator's baseline) | After (`93f0e59a`, after `npm ci`) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npx jest` | 696 suites / 9,820 tests / 59 snapshots | 701 suites / 9,867 tests / 59 snapshots, all passing |
| `npm run lint` | 0 errors / 1,165 warnings | 0 errors / 1,165 warnings (no new warnings) |
| `from 'vscode'` in `packages/core/src` | none | none |
| New files over 500 lines | — | none (largest: the seed test, 315) |
| Coordinator and session service | — | unchanged (no diff) |
| Fixtures and tests | — | *Alice*-style made-up paths and text only |
| Logs | — | counts and categories only; tests check no path or name |

## Deviations and open questions

1. **The match rule takes the platform**:
   `workshopPinnedContextMatches(entry, attachment, platform)`. The spec's
   two-argument form can't case-fold on Windows "as Slice 1 defines it",
   which needs the platform. Slice 3 will have to send the host's platform
   to the webview (or the hook asks the host) for the pill's mark and the
   "N missing" count.
2. **An unreadable list in the report.** 2a's report has no field for the
   list itself, and I didn't change the port. A list that can't be read
   (`unreadable`, `busy`, `io`, or a thrown read) reports `pinnedCount: 0`
   with one left-out entry, `{ label: 'pinned-context.json', reason:
   'unreadable' }`. The result line says "… No pinned context attached:
   pinned-context.json (couldn't be read)." An absent list, an empty one and
   an unavailable workspace report nothing (D2). If the coordinator would
   rather have a list-level field on the report, that's a port change for
   2a's owner.
3. **A carried pinned file whose re-read is left out keeps its old body**
   (missing, unreadable or now over budget), and is named in `leftOut`. The
   result line therefore says "not attached: alice.md (not found)" for a
   file the writer still sees as a pill, with its earlier text. Nothing is
   removed for the writer (D6), but the wording may want "not re-read" for
   that case. Open for Slice 3's copy pass.
4. **The first room's report isn't on the ticker yet.** The coordinator
   discards `install`'s return at the first room, and must not grow here, so
   the seed keeps that one report (`takeFirstRoomReport()`, once). Posting it
   needs a handler, which is Slice 3's: it can call
   `workshopSessionStartResult('carry', report)` when a Workshop webview is
   first ready.
5. **`CoreServices` gains the library only**, as `workshopPinnedContext`.
   ADR D9 says "the store and the library", but Slice 1's guard forbids any
   module under `application/handlers/` importing the store, and
   `MessageHandlerContracts.ts` lives there. Everything reaches the store
   through the library.
6. **The library's constructor** is `(store, intake, fileSystem, scope, log,
   { platform })`: `fileSystem` for the `stat` that tells missing from
   unreadable, and `scope` a thunk over the coordinator's `recallScope()`,
   because the seed is built before the coordinator it is passed to.
7. **`describe()` also answers `busy` and `io`** with their own lines, and its
   rows carry `stateWords`. 0d names neither state; the words are mine:
   "Pinned context is being changed in another window. Try again in a
   moment." and "pinned-context.json couldn't be read. Try again, or check
   the project folder."

## Progress

- **2026-11-04.** Slice doc written with the spec (as Slice 2).
- **2026-11-05.** Split by the coordinator: the starts, the port and the menu
  moved to Slice 2a.
- **2026-11-05.** Built on `epic-pinned-context-slice-2b-room-seed`; see Built,
  Verification and Deviations above.
