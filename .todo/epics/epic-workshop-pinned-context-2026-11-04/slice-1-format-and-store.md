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
- This doc's update.

**Where each piece lives.**

| Piece | Where |
|---|---|
| List and entry shapes, refusal vocabulary, path rule and key, platform | `shared/types/workshopPinnedContext.ts` (`WorkshopPinnedContextList`, `WorkshopPinnedContextEntry`, `WORKSHOP_PINNED_CONTEXT_REFUSALS`, `workshopPinnedContextPathFault`, `workshopPinnedContextPathKey`, `workshopPinnedContextPlatformOf`) |
| The bounds | `PROMPT_BUDGETS.workshopPinnedContext = { files: 20, fileBytes: 128 * 1024 }` (`shared/constants/promptBudgets.ts`), pinned in `promptBudgets.test.ts` |
| Codec | `infrastructure/storage/WorkshopPinnedContextCodec.ts` (`decodeWorkshopPinnedContext`, `encodeWorkshopPinnedContext`, `prepareWorkshopPinnedContext`) |
| Fixture | `__tests__/fixtures/pinned-context-v1.json` |
| Store | `infrastructure/storage/WorkshopPinnedContextStore.ts` (`WorkshopPinnedContextStore`: `availability()`, `read()`, `update(revision, change, options?)`, `shutDown()`) |
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

## Verification

| Check | Before (`b94fc674`) | After (`1516f318`) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| jest | 691 suites / 9,696 tests / 59 snapshots | 694 suites / 9,784 tests / 59 snapshots, all passing |
| `npm run lint` | 0 errors / 1,165 warnings | 0 errors / 1,165 warnings (no new warnings) |
| `from 'vscode'` in `packages/core/src` (outside test strings) | none | none |
| New files over 500 lines | — | none (the store is 440) |
| Fixtures and tests | — | *Alice*-style made-up paths only |
| Logs | — | outcomes and error categories only; a test fails on a path or a listed name |

The after column was measured after `npm ci`.
