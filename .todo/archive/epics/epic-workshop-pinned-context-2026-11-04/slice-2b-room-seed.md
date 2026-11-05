# Slice 2b: Room Seed

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../../docs/adr/2026-11-04-workshop-pinned-context.md), D2 (when), D3 (how), D4 (the match rule), D5 (workspace identity), D6 (budget), D7 (the report), D9 (the port)
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
- `944c9268`: this doc's first Built section.
- `4152a127`, `aa1ef04b`: merges of Slice 1's PR #204 fixes (`52da65ea`) and
  Slice 2a's PR #203 F01 fix (`db93354f`), as the coordinator asked. No
  conflicts; nothing in 2b's modules changed.
- A follow-up: the match rule's σ/ς case under `'windows'` (Slice 1's
  NTFS-style key), and this doc's update.

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

After merging Slice 1's and 2a's fixes (and adding the σ/ς test), after
`npm ci` on `93f0e59a`: typecheck passes; jest 702 suites / 9,902 tests / 59
snapshots, all passing; lint 0 errors / 1,165 warnings (none new).

**Final pre-PR run**, on `511bf2a1` (the deviation-3 fix `54e7db78`, then
Slice 1's PR #204 re-review fixes `92acb220` merged in): typecheck passes;
`npx jest -w 2` 702 suites / 9,913 tests / 59 snapshots, all passing.

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
3. **A carried file kept as it was** (fixed on the coordinator's review of
   `e36526b4`). A carried pinned file whose re-read is left out (missing,
   unreadable, or now over budget) keeps the body it had, as before. The
   report now marks that entry `kept: true`, an **additive change to the
   port** (`WorkshopRoomSeedLeftOut.kept`, in `WorkshopRoomSeed.ts`, on the
   epic since #203 merged), set only when the room still holds the carried
   body.
   - The result line never lists a kept file as "not attached". It gets its
     own clause: "… 1 of 2 pinned files attached; kept as it was: alice.md
     (not found now)." The other reasons read "(couldn't be read now)" and
     "(its current version doesn't fit in the 100,000-word context limit)".
     A file that wasn't carried keeps today's wording, in its own "not
     attached" clause before the kept one.
   - `attachedCount` still counts only files attached or re-read now.
   - The seed's log tallies and the handler's log line gain `kept=<n>`, with
     no labels; the reason tallies count only files that aren't kept.
   - Tests: a carried file re-read as missing, as unreadable and as over
     budget each give the kept wording; a file that wasn't carried keeps
     today's beside a kept one; the handler's log counts a kept file.
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

## PR #208 review

Astra reviewed `b0429082` (report: `docs/pr-reviews/pr-208-pinned-context-room-seed-review.md`):
changes required, four findings, all confirmed by the coordinator. First the
epic was merged in (`356831da`, pushed alone so CI could start), then:

- `bc503b93`: the fixes;
- `5853bb03`: the regressions, with Astra's three probes promoted into
  `pinnedContext/WorkshopPinnedContextReviewFixes.test.ts`. Run against the
  pre-fix code, 11 of its 13 cases fail; the other two are controls (a held
  catalog load still reads A, and a single normalized match is still read).

| Finding | Fix | Test |
|---|---|---|
| **F01 (high)**: a seed's reads followed the live workspace, so A→B→A during `prepare` installed B's list and text into A | `askSeedWorkspace()` captures the root and the list's file once (`WorkshopPinnedContextAsk.where`), and `readForSeed(where)` reads only from them. **Slice 1's store gains an additive `read({ filePath })`** (`WorkshopPinnedContextReadOptions`): at its turn, another list file answers `unavailable` / `workspace-changed` and nothing is read; a caller naming no file reads live, as before. The reader checks every catalog row's absolute path, and every path `authorizeExcerptReread` hands back, with `isPathWithinRoot(capturedRoot, …)` before reading; a path outside is the fault `workspace-changed`, never read. Any such fault withdraws the whole plan. The report is one entry, `pinned-context.json` / `workspace-changed` (a new reason on the seed port, additive), and the line says "(the project folder changed while it was read)". `describe()` holds one root the same way, and answers `unavailable` / `workspace-changed`. Logs say which read was withdrawn, with a count, never a path | Astra's probe; A→B→A while the list read is queued (with the exact result line, and logs free of paths and names); A→B→A while the catalog opens; a held catalog load (control: it reads A's file); A→B→A while a workspace file's `stat` is held; `describe()` both ways; the store's `read({ filePath })` three ways (`WorkshopPinnedContextStore.test.ts`) |
| **F02 (medium)**: on POSIX, `Characters\alice.md` matched `Characters/alice.md` | `attachmentPathKey` turns `\` into `/` only when the platform is `windows` | Astra's probe; match-rule cases for POSIX `relativePath` and catalog key, and Windows |
| **F03 (medium)**: the reader picked the first catalog row by NFC key, so with both `café` spellings present it read the wrong file | The exact stored path is looked up first. A normalized match is used only when exactly one distinct catalog path has it; several give the fault `ambiguous`, left out as unreadable ("Can't read: more than one file in the project has this name, written differently. Pin the one you mean again."). Slice 1's duplicate rule is unchanged | Astra's probe; a single normalized match still read; an ambiguous Windows case-fold, in the seed and in `describe()` |
| **F04 (medium)**: a carried copy known by its URI under an older display path was reported "not attached" when its re-read failed | Every read result, failed ones too, carries `sourceUris`: the file URIs the entry names under the captured root (the path it spells, and the catalog row it resolved to when that differs), derived from the root and the entry, never from a read. Carried copies are matched by them. No body is invented and containment is unchanged | Astra's two probes (missing, whitespace-only) |

Two smaller changes came with these:

- **The workspace door no longer takes a catalog key from authorization.**
  `authorizeExcerptReread` matches against a live catalog, which could
  belong to another project mid-switch. The reader's own snapshot already
  decides the catalog case.
- **The test host's catalog lists the live folder's files when it opens,** as
  the real provider does. It also gains `moveTo` and `pinIn` for the
  two-project tests.

After the fixes: the store is 489 lines, the reader 300 and the library 305.
Typecheck passes, lint has 0 errors and 1,165 warnings (none new), and the
full `npx jest -w 2` on `5853bb03` (the code head) runs 703 suites / 9,930 tests / 59 snapshots, all passing.

**F01, tightened on the coordinator's review of `d8b8d2a4`.** The first fix
checked containment, which let a live root nested inside the captured one
through (A `/workspace/novel`, B `/workspace/novel/book-two`): B's catalog
row, and authorization's recovery under B, both lie under A. A read must now
be the captured root's own file (`0ead5d0e`):

- **a catalog row** is accepted only when `path.relative(root,
  row.absolutePath)`, with `/` separators, equals `row.path`, so the row was
  listed under the captured root itself. F03's normalized fallback still
  works, since that row's own path is relative to the root. `sourceUris`
  takes a row only when it passes the same check;
- **the workspace door** is accepted only when authorization returns the
  exact path the seed built from its root (`path.normalize` on both). Its
  first two branches return that path; only recovery of a stale URI returns
  another, and it is never read.

Anything else is `workspace-changed`, and nothing is read. Regressions
(`2cf658f8`), each failing on the containment-only reader: A→B→A with B
nested in A, with the catalog opened while B is live; with the workspace door
authorized while B is live (the file outside the catalog, so recovery runs);
and `describe()` once. A control, B a parent of A with the catalog opened in
A, still reads A's own file. The reader is now 315 lines.

Then `epic-pinned-context` at `25c9443c` (Project Memory's #206 and #207)
was merged in, as `0ee4d66b`, with no conflicts. On that head, typecheck
passes and `npx jest -w 2` runs 705 suites / 9,951 tests / 59 snapshots, all
passing.

**After the nested-root fix** (`2cf658f8`): typecheck passes; lint 0 errors /
1,165 warnings (none new); `npx jest -w 2` 705 suites / 9,955 tests / 59
snapshots, all passing.

**Astra's nested-workspace probes promoted.** I copied
`docs/pr-reviews/probes/pr-208-nested-workspace-binding.test.ts.txt`
unchanged into
`pinnedContext/WorkshopPinnedContextNestedWorkspaceProbe.test.ts`. Both of
its cases fail on `c70695f5`'s reader and pass after the fix. As copied,
it added 4 lint warnings (`curly` on one-line `if`s), so its four `if`s are
now braced, the only change from Astra's probe; the file's header says so.
After that: typecheck passes; lint 0 errors / 1,165 warnings (none new);
`npx jest -w 2` 706 suites / 9,957 tests / 59 snapshots, all passing (run
before the braces; the probe passes 2 of 2 after them).

## Progress

- **2026-11-04.** Slice doc written with the spec (as Slice 2).
- **2026-11-05.** Split by the coordinator: the starts, the port and the menu
  moved to Slice 2a.
- **2026-11-05.** Built on `epic-pinned-context-slice-2b-room-seed`; see Built,
  Verification and Deviations above.
