# Slice 1: Format and Store

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D5 (storage), D6 (bounds)
**Branch:** `epic-pinned-context-slice-1-format-store`
**Status:** Built (2026-11-05), awaiting review. Runs beside Slice 2a. See
[Built](#built).

## Outcome

`prose-minion/pinned-context.json` has a strict, pure format-1 codec and a
store with the board store's write discipline. Nothing reads files from the
list yet, and nothing in the UI changes.

## Build

### Shared types (`core/shared/types/workshopPinnedContext.ts`)

- The list and entry shapes, `WorkshopPinnedContextList` and
  `WorkshopPinnedContextEntry` (`{ path }`), beside
  `shared/types/projectMemory.ts`. Slice 2b's library and match rule, and
  Slice 3's messages, import them from here.
- `PROMPT_BUDGETS.workshopPinnedContext = { files: 20 }` (ADR D6).

### Codec (`infrastructure/storage/WorkshopPinnedContextCodec.ts`)

- `decodeWorkshopPinnedContext(bytes) → { ok: true, list } | { ok: false,
  reason }`. A `reason` is a closed union the tab can say in words: `json`,
  `format`, `unknown-key`, `path`, `duplicate`, `too-many`.
- `encodeWorkshopPinnedContext(list)` writes stable JSON: two-space indent,
  `format` first, and a trailing newline. A hand edit then diffs cleanly.
- **Paths:** workspace-relative, `/`-separated, normalized. No empty
  segment, no `.` or `..`, no leading `/`, no drive letter, no backslash, and
  no control character. Unique, compared case-folded on Windows (pass the
  platform in, so tests cover both).
- At most `PROMPT_BUDGETS.workshopPinnedContext.files` (20) entries.
- The decoder fails whole. Never drop one bad entry and keep the rest: a
  silent drop would unpin a file for the writer.
- A fixture, `__tests__/fixtures/pinned-context-v1.json`, with *Alice*
  paths. A change that can't read it is a new format (ADR 2026-07-30).

### Store (`infrastructure/storage/WorkshopPinnedContextStore.ts`)

- `availability()`: one folder means available, none or several means
  unavailable with the reason. It is read live on every call, like
  `LightboxBoardStore.location()`.
- `read() → { state: 'absent' } | { state: 'ok', list, revision } |
  { state: 'unreadable', reason, revision }`. The revision is a SHA-256 of
  the file's bytes. `absent` has a fixed revision, so "create" can be
  checked too.
- `update(revision, change)` runs in one queue. It applies a pure `change`
  function to the list as read at its turn, after checking that the revision
  still matches:
  - absent → stage under a private random name, then rename, never
    overwriting. If a file appeared meanwhile, answer `changed`;
  - present → a claimed rewrite through `StoredFileRewrite`;
  - unreadable → refused. It is never written;
  - the outcome is `{ ok: true, list, revision } | { ok: false, reason:
    'changed' | 'unreadable' | 'unavailable' | 'busy' | 'io' }`.
- **A write belongs to the workspace it was asked in** (ADR D5; Project
  Memory's PR #202 F01).
  - `update` captures the accepted workspace identity when it is called,
    before the queue can wait, as `askedProjectMemoryWorkspace` does
    (`application/services/workshop/memory/ProjectMemoryWorkspaceIdentity.ts`).
  - A write whose turn or commit comes under another identity is withdrawn
    as `unavailable`, even when the new workspace has its own
    `pinned-context.json`.
  - Reuse the helper if its shape fits. Don't rename or move memory's code
    in this slice. If a neutral home would help, record it as tech debt.
- Folder read errors are `io`, never `absent`.
- Logs carry the outcome and its category only.

## Tests

- **Codec:** a round trip of the fixture; every refusal reason; Windows
  case-folding for duplicates; that encoding is stable byte for byte.
- **Store,** on a temporary folder:
  - create, update and refusal by revision;
  - a concurrent second store on the same folder (another window): its
    stale revision is refused, and the first write stands;
  - an unreadable file is never written;
  - an abandoned claim is settled by the shared primitive's rules;
  - unavailable with none or several folders;
  - a write asked in one workspace and reaching its turn in another is
    withdrawn, and neither folder's file changes.
- **Boundaries:** the store and codec live in `infrastructure/storage/`, and
  no handler imports the store.

## Completion criteria

- [x] The codec refuses every malformed shape whole, and round-trips the
      fixture.
- [x] The store never overwrites, never writes an unreadable file, and
      refuses a stale revision.
- [x] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec.
- **2026-11-05.** Built on `epic-pinned-context-slice-1-format-store`, from
  `b94fc674`. See below.

## Built

**Commits.**

- `0e1b0729`: the shared types, `PROMPT_BUDGETS.workshopPinnedContext`, the
  codec, its fixture and its tests.
- `a4d36e27`: the store, its test host, and its one-window and race tests.
- `33b68dc1`: the boundary guards.
- `e6ba3cdb`: this doc's first Built section.
- `1516f318`: the byte bound (the coordinator's review of `e6ba3cdb`).
- `b8527f22`, `182fcd1b`: this doc.
- `021b860b`, `f15a81a6`, `18b7b03a`: the PR #204 review's fixes (below).
- `42bbcd69`, `52da65ea`: this doc's PR #204 section.
- `6af772da`: the PR #204 re-review's fixes (below).
- This doc's re-review section.

**Where each piece lives.**

| Piece | Where |
|---|---|
| List and entry shapes, refusal vocabulary, path rule and key, platform | `shared/types/workshopPinnedContext.ts` (`WorkshopPinnedContextList`, `WorkshopPinnedContextEntry`, `WORKSHOP_PINNED_CONTEXT_REFUSALS`, `workshopPinnedContextPathFault`, `workshopPinnedContextPathKey`, `workshopPinnedContextPlatformOf`) |
| The bounds | `PROMPT_BUDGETS.workshopPinnedContext = { files: 20, fileBytes: 128 * 1024 }` (`shared/constants/promptBudgets.ts`), pinned in `promptBudgets.test.ts` |
| Codec | `infrastructure/storage/WorkshopPinnedContextCodec.ts` (`decodeWorkshopPinnedContext`, `encodeWorkshopPinnedContext`, `prepareWorkshopPinnedContext`) |
| Fixture | `__tests__/fixtures/pinned-context-v1.json` |
| Store | `infrastructure/storage/WorkshopPinnedContextStore.ts` (`WorkshopPinnedContextStore`: `availability()`, `read()`, `update(revision, change, options?)`, `shutDown()`); its contracts in `WorkshopPinnedContextStoreContracts.ts`, which the store re-exports |
| Lock | `infrastructure/storage/WorkshopPinnedContextLock.ts` (PR #204 F-01; a directory since the re-review), built only by the store |
| Tests | `__tests__/infrastructure/storage/WorkshopPinnedContextCodec.test.ts`, `WorkshopPinnedContextStore.test.ts`, `WorkshopPinnedContextStoreRaces.test.ts`, with `workshopPinnedContextStoreHost.ts` |
| Guards | `boundaries.test.ts`: "Workshop Pinned Context storage" (both modules in `infrastructure/storage/`, the codec's only import, no handler imports the store); the store joins `FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION` and the claims primitive's construction list |

**How the store behaves, for Slice 2b.**

- `read()` settles the file's claims first (`StoredFileClaims.settle`), so a
  list left mid-rewrite goes back and a leftover beside it goes.
- `update(revision, change)` reads the file again at its turn and compares
  revisions. `change` gets the list (`{ files: [] }` when absent), and its
  result must read back through the codec, or nothing is written.
- A change that leaves the bytes as they are writes nothing. So does one that
  leaves an absent list empty. An emptied list is written as `"files": []`,
  never by deleting the file.
- A lost race (a claim, or the new file's name) reads the file again. If it
  is still at the caller's revision the write is tried again, at most three
  times; otherwise the answer is `changed`.

**Deviations from the spec above.** Every name Slice 2b imports is as given.
These are additions, or a spec union made complete:

1. **`read()` has three more states:** `unavailable` (with the reason), `busy`
   (another window's live claim) and `io` (the folder or file could not be
   read; never `absent`). The spec's union had nowhere to put them.
2. **`decodeWorkshopPinnedContext(bytes, platform)`** takes the platform as
   its second argument (`'windows' | 'posix'`), as the spec asks ("pass the
   platform in"). A refusal carries the zero-based `entry` at fault when there
   is one, so the tab can say which. A leading byte-order mark is read past
   and never written.
3. **`update`'s outcome** adds two things:
   - `changed` carries `current`, the list as it reads now, so the tab can
     show "This is the current list" (ADR D5) without another read;
   - `{ ok: false, reason: 'invalid', refusal, entry? }`, for a `change` whose
     result wouldn't read back (a duplicate, a bad path, over 20). The spec's
     union had no honest reason for it.
4. **The workspace-identity rule is split across the store and the library.**
   `askedProjectMemoryWorkspace` lives in `application/`, and
   `infrastructure/` must not import upward.
   - The store captures the list's file path when `update` is called, before
     the queue can wait. A turn or commit under another folder, or none, is
     withdrawn as `unavailable`.
   - `update` takes an optional third argument, `{ beforeCommit }`. It is
     asked at the turn and synchronously before the committing rename, as
     memory's `ProjectMemoryTargetOptions` is. Slice 2b's library passes the
     live-room half there, from `askedProjectMemoryWorkspace`, which it can
     import as it is.
   - Nothing was moved or renamed, and no tech debt is needed: the helper's
     shape fits at the library.
5. **Extra exports:**
   - `WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION` (`'absent'`, never a SHA-256's
     hex);
   - `workshopPinnedContextRevisionOf`;
   - `WORKSHOP_PINNED_CONTEXT_FORMAT`, `WORKSHOP_PINNED_CONTEXT_FILES` and
     `WORKSHOP_PINNED_CONTEXT_DISPLAY_PATH`;
   - `shutDown()`, so deactivation can wait for owed writes (PR #183 F-03)
     once 2b wires it.
6. **Duplicates compare NFC-composed** as well as case-folded on Windows.
   A hand edit on macOS may write NFD, and one file in two Unicode forms is
   still one file.
7. **A released claim's fallback name.** When a rewrite gives its claim back
   and a new file has taken the saved name, the claim goes to
   `pinned-context.json.set-aside-<id>`. It is never put over the new file.

8. **A byte bound, `too-large`** (the coordinator's decision on review,
   2026-11-05, following Project Memory's `file-too-large`).
   - `PROMPT_BUDGETS.workshopPinnedContext.fileBytes` is 128 KiB. Twenty
     4,096-character paths encode to about 83 KB, so the bound never refuses
     a list the codec would otherwise read. A test holds that.
   - `too-large` joins `WORKSHOP_PINNED_CONTEXT_REFUSALS`. The decoder refuses
     over-bound bytes before decoding them, and
     `prepareWorkshopPinnedContext` refuses a list that would encode past the
     bound, so `update` answers `invalid` / `too-large` and writes nothing.
   - The store `stat`s the file before reading it. An oversized file reads as
     `unreadable` / `too-large` without its bytes being read, so its revision
     is `too-large-<size>-<mtime>`, never a SHA-256's hex. It is never
     written. The decoder's check stays, because a file can grow between the
     `stat` and the read.

## PR #204 review

Astra's review of `182fcd1b`
([report](../../../docs/pr-reviews/pr-204-pinned-context-format-store-review.md)):
changes required. The coordinator checked each finding and directed each fix.
The review's probes are promoted into the permanent suites. The `.txt` probe
file stays as evidence and is not run.

**F-01 (P1): a stale create took the saved name during another window's
claimed rewrite.** Fixed in `18b7b03a`.

- **A per-list lock.** Every `update` holds `WorkshopPinnedContextLock`
  (`.pinned-context.json.lock`) from before it reads at its turn until after
  it commits.
  - It is taken by a no-overwrite rename of a staged `{ token, at }`, and is
    live for the claims' 30-second lease.
  - An abandoned lock, or one that doesn't read as a lock, is renamed to a
    unique name and checked to be the very lock judged abandoned. If it isn't
    (a window took the lock anew in between), it is put back and the write is
    `busy`. Otherwise it is deleted and the lock is taken anew.
  - The holder reads its token again immediately before its commit rename,
    and withdraws as `busy` if the lock is no longer its own.
  - A window that can't take the lock answers `busy`.
- **A shared-primitive addition.** For a rewrite, the token check is
  `StoredFileRewrite`'s new optional `confirm` (async). It is asked after the
  claim is confirmed and before the synchronous `beforeCommit`. Project
  Memory doesn't pass it, so it is unchanged.
- **Hand edits still answer `changed`.** Under the lock, a create still
  commits by a no-overwrite rename, so a hand edit made meanwhile is never
  overwritten.
- **The race argument,** case by case, is in the store's doc comment:
  - **create vs create:** the window that waited reads the list at its turn
    and is `changed`; underneath, the no-overwrite rename lets only one win;
  - **create vs claimed rewrite:** only the lock holder takes a claim, so a
    create can't be renaming then; it is `busy`;
  - **rewrite vs rewrite:** serialized by the lock; underneath, the claim
    rules hold;
  - **a lease that expires mid-write:** the stalled holder fails its token
    check and withdraws. The one window left is a stall past the lease
    between that check and the rename, and there the claim and no-overwrite
    rules still keep either write off the other's file;
  - **a hand edit at each step:** before the read, between the read and a
    create's commit, between the read and a claim, while the claim holds the
    list, and after the commit. None is ever overwritten.
- **Tests** (`WorkshopPinnedContextStoreRaces.test.ts`):
  - the review's probe ("create vs claimed rewrite: a stale create never
    takes the saved name a rewrite's claim emptied");
  - create vs create, both orders;
  - a create holding the lock makes the other window's create busy;
  - rewrite vs rewrite;
  - two lease-expiry cases ("lets another window take the abandoned lock; the
    stalled holder withdraws…", and a stalled rewrite);
  - the lock file: live is busy; abandoned or unreadable is taken over; a
    mistaken takeover is put back;
  - a hand edit at three steps.
- **Mutation-checked.** With the lock stubbed out, eight of these fail. With
  only the token check removed, the lease-expiry test fails.
- **Contracts moved.** The store's contracts moved to
  `WorkshopPinnedContextStoreContracts.ts` (re-exported, so no import changes)
  to keep the store under 500 lines (484).

**F-02 (P2): an uncommitted changed claim was later deleted as a leftover.**
Fixed in `f15a81a6`.

- The store gives `StoredFileClaims` a preserving `leftovers` policy, as
  Project Memory's does. An abandoned claim beside the standing list is
  removed only when it holds exactly the standing bytes.
- Any other claim is set aside under `pinned-context.json.set-aside-<id>`,
  never deleted. The format records no ancestry, so it preserves whenever
  unsure.
- **Tests** (`WorkshopPinnedContextStore.test.ts`):
  - the review's probe, extended through recovery: "keeps a refused rewrite's
    claimed bytes through a failed release, and sets them aside once the
    fault clears and the lease passes";
  - "sets aside any other abandoned claim…";
  - "removes an abandoned claim… only when it holds the very bytes that
    stand".
- **Mutation-checked.** With the old delete-everything policy, the first two
  fail.

**F-03 (P2): lowercasing wasn't Windows' comparison.** Fixed in `021b860b`.

- `workshopPinnedContextPathKey` keeps its name and signature. On Windows it
  now upper-cases each UTF-16 code unit through a one-to-one table, as NTFS
  does. A unit takes `toUpperCase()` only when that is a single unit;
  otherwise it is kept, so surrogates are kept too.
- `σ`/`ς`/`Σ` are one name, `ß` stays `ß` (not `SS`), `ı` matches `I`, `İ`
  doesn't, and an astral character isn't folded.
- NFC is kept, documented as deliberately conservative. The doc states the
  known limit: a volume's upcase table differs slightly by Windows version.
- **Tests** (`WorkshopPinnedContextCodec.test.ts`):
  - the table "on Windows, %s and %s are one name";
  - the astral and `ß` key;
  - the review's sigma probe as a decoder case (a duplicate on Windows, two
    files elsewhere).

**N-01 (P3): C1 controls.** Fixed in `021b860b`.

- `workshopPinnedContextPathFault` refuses U+0080–U+009F, with the doc.
- **Tests:** the review's probe (`Notes/\u0085.md`) and the range's ends,
  both as `path` refusals.

**Re-verified** after `18b7b03a`: 694 suites / 9,813 tests / 59 snapshots.

## PR #204 re-review

Astra re-reviewed `52da65ea` (the report's "Re-review at `52da65ea`"
section). F-02, F-03 and N-01 are closed by their probes. F-01 remained, now
P2, and F-04 was new. Both are fixed in `6af772da`, to the coordinator's
design. Before building, I walked the interleavings and found no hole in that
design. Two points needed care, and both are built in:

- A stale writer's staged write can land in a successor's lock directory,
  because the path resolves at write time. Its token check comes after that
  write, so it fails there: the check is load-bearing, not only cheap.
- Release had to stop deleting the lock after merely reading its owner. A
  successor could take the lock in between, and that delete would remove its
  lock. Release now uses the takeover's pattern: rename aside, check the
  owner, then delete or put back.

**F-01: a stale owner's commit landed after a takeover.** A create passed its
token check, then stalled *inside* its final rename past the lease. The
successor created the list and claimed it for a rewrite, and the stale rename
landed in the emptied name. My earlier argument, that this residual was only
a spurious busy, was wrong.

- **The lock is a directory,** `.pinned-context.lock/`. It is taken by a
  no-overwrite rename of a staged directory holding `owner.json`
  (`{ token, at }`), and is live for the 30-second lease.
- **The fence.** Every write stages its new list inside its lock directory
  (`HeldLock.stagingPath`), and both commits rename from there:
  - a create renames it onto `pinned-context.json`, never over anything;
  - a rewrite goes through `StoredFileRewrite`'s new optional `stagingPath`,
    the smallest additive change. Lightbox and Project Memory don't pass it.
- **A takeover** renames the whole abandoned directory aside
  (`.pinned-context.lock.stale-<id>`, never over anything). It checks that
  the moved `owner.json` is the owner it judged abandoned; if not, it puts
  the directory back and answers `busy`. Then it deletes the directory with
  everything in it, including a stale writer's staged list, which was never
  acknowledged. A commit rename resolves its source when it runs, so a
  stalled owner's late rename finds no source and fails.
- **A stale writer never reports `ok`.** A commit that fails while its lock
  is gone answers `busy`.
- **The `confirm` token check stays,** as an early withdrawal.
- **The race argument** is rewritten in the store's doc comment, step by step
  for a holder stalled past the lease:
  - before or while reading: its staged write misses the lock, its token
    check fails, and it is `busy`;
  - between staging and the check: the takeover took its staged list, and
    the check fails;
  - inside the commit rename: if the rename ran before the takeover, it
    committed as the only owner and the successor reads its list; if after,
    there is no source and it is `busy`. A rewrite's claim goes back by the
    claims' rules;
  - after committing, before releasing: its list stands, and the release
    never removes the successor's lock;
  - within the lease, the lock alone serializes every pair;
  - a hand edit is handled at each step, as before.
- **Tests** (`WorkshopPinnedContextStoreRaces.test.ts`, "the fence…"):
  - the re-review's probe as written (only braces added, for lint);
  - the same stall with its outcomes asserted (stale `busy`, successor `ok`);
  - "fences a stale claimed rewrite the same way";
  - every earlier race test, updated to the lock directory.
- **The fence matters.** With staging moved back outside the lock, the
  probe and its outcome test fail.

**F-04: recovery read past the size bound.**

- `StoredFileClaims` takes an optional `maxBytes`, and its new `readBytes`
  `stat`s first. Every recovery read (the standing list and each claim) and
  a rewrite's read of its claimed bytes stay within it. A file over the bound
  is never read, so it is never shown to be a leftover: it is kept, and set
  aside beside a standing list. The store passes the 128 KiB file bound;
  Lightbox and Project Memory pass none.
- The lock's `owner.json` is bounded at 4 KiB
  (`WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES`). Over it, it is never read: the
  lock counts as unparseable, abandoned by its file's age.
- **Tests:**
  - the re-review's probe as written (the standing file never in
    `readFileCalls`);
  - "keeps an abandoned claim beside an oversized list, unread and
    untouched";
  - "never reads an oversized abandoned claim…, and sets it aside";
  - in the races suite, "an owner over its bound is never read…".
- **Mutation-checked.** Without `maxBytes`, the three claim tests fail.
  Without the owner bound, the lock test fails.

**Test double.** `MemoryFileSystem` gained directory rename (whole, and never
over anything) and recursive delete. These are additive: no other suite
changed.

**Re-verified** after `6af772da`; counts are in the table below.

## Verification

| Check | Before (`b94fc674`) | After (`6af772da`) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| jest | 691 suites / 9,696 tests / 59 snapshots | (full run in progress) |
| `npm run lint` | 0 errors / 1,165 warnings | 0 errors / 1,165 warnings (no new warnings) |
| `from 'vscode'` in `packages/core/src` (outside test strings) | none | none |
| New files over 500 lines | — | none (the store is 482, the lock 211, the contracts 62) |
| Fixtures and tests | — | *Alice*-style made-up paths only |
| Logs | — | outcomes and error categories only; a test fails on a path or a listed name |

The after column was measured after `npm ci`.
