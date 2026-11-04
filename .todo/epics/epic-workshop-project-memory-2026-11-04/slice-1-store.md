# Slice 1: Store and Codec

**Epic:** [Workshop Project Memory](README.md)
**Decision:** ADR 2026-11-04 (Slice 0, Proposed). Built from the feature
note's "The memory file (format 1)" and "Storage and concurrency", then
amended (`774e283`) to the spec thread's early format and storage decisions,
relayed by the coordinator on 2026-11-04. Where the two differ, the relay
wins.
**Branch:** `epic/workshop-project-memory-slice-1-store`
**Status:** Built, verified and pushed. PR #194's findings are fixed through the re-review (F-02 continued, F-06); waiting on Astra's next pass and the ADR (#192).

## Outcome

A project memory has a file format and a store, and nothing else yet: no
model, no UI, no route, no composition-root wiring.

- **Format 1** (`ProjectMemoryCodec`): one Markdown file per memory, flat
  `key: value` frontmatter over a closed key set, then a free Markdown body.
  Pure. Decoding fails closed with a named reason; encoding is canonical.
- **`ProjectMemoryStore`**: `prose-minion/memory/` in the workspace's one
  folder, with the Lightbox board store's write discipline, shared rather
  than copied.

## Scope

In: the codec, the domain type, the store, fixtures, tests, and a
behavior-preserving refactor that lets the store reuse the Lightbox board
store's claims and rewrite.

Out (later slices): `extension.ts` wiring and `shutDownExtension` (Slice 2,
when the store has a consumer), the catalog frame and `memory.*` (Slice 2),
the proposal trailer (Slice 3), the manager (Slice 4b), `INDEX.md` (Slice 5).

## Built

**Commits.**

| Commit | What |
|---|---|
| `768b41f` | Refactor: the Lightbox board store's claims and claimed rewrite, shared (`StoredFileClaims`, `StoredFileRewrite`). Behavior-preserving; no Lightbox test changed |
| `b26a789` | Format 1: the domain type, the codec, fixtures, codec tests |
| `0afa58d` | `ProjectMemoryStore`, its folder reader and contracts, store and race tests; `StoredFileClaims` gains a per-store `logName` |
| `774e283` | Format and store amended to the ADR relay: status `active \| archived` (superseded derived), origin `writer \| proposed \| auto`, real turn ids, only present optionals written, the body byte for byte, conflicts for a shared id, no file names in logs |

**Where each piece lives.**

| Piece | Where |
|---|---|
| Domain type, closed vocabularies, field bounds, id pattern | `shared/types/projectMemory.ts` (`ProjectMemory`, `PROJECT_MEMORY_KINDS` / `_STATUSES` / `_ORIGINS`, `PROJECT_MEMORY_FIELD_CHARACTERS`, `PROJECT_MEMORY_LIST_ENTRIES`, `PROJECT_MEMORY_ID`) |
| Codec | `infrastructure/storage/ProjectMemoryCodec.ts` (`decodeProjectMemory`, `encodeProjectMemory`, `PROJECT_MEMORY_KEYS`, `PROJECT_MEMORY_INVALID_REASONS`) |
| Folder read, file names, log names | `infrastructure/storage/ProjectMemoryFiles.ts` |
| Store and its contracts | `infrastructure/storage/ProjectMemoryStore.ts`, `ProjectMemoryStoreContracts.ts` |
| Shared claims (take, settle, retire, a delete under a claim) | `infrastructure/storage/StoredFileClaims.ts` (from `LightboxBoardClaims`) |
| Shared rewrite commit (stage, claim, check bytes, commit, release) | `infrastructure/storage/StoredFileRewrite.ts` (from `LightboxBoardRewrite`) |
| Fixtures | `__tests__/fixtures/project-memory-v1/` (four memories: proposed canon; a writer's pinned preference with milliseconds and no optional keys; a writer's archived open thread with provenance and an empty body; an automatic decision that supersedes the canon) |

### The format, as built

```markdown
---
format: 1
id: mem-7f3c2a
title: The Rabbit's watch runs backward
kind: canon
summary: From chapter 3 on, the White Rabbit's watch runs backward; nobody in Wonderland remarks on it.
status: active
pinned: false
created: 2026-11-03T14:22:05Z
updated: 2026-11-03T14:22:05Z
origin: proposed
proposed-by: cliff
source-session: 6b0f3c9e-2c1d-4e8a-9a51-0d6f2b7c9e11
source-turns: turn-12-assistant-1730643725000, turn-15-assistant-1730643925000
---

Free Markdown.
```

- **Keys** (closed, written in this order): `format`, `id`, `title`, `kind`,
  `summary`, `status`, `pinned`, `created`, `updated`, `origin`,
  `proposed-by`, `source-session`, `source-turns`, `supersedes`.
- **Required:** `format`, `id`, `title`, `kind`, `summary`, `status`,
  `created`, `updated`, `origin`.
- **Optional:** `pinned` (absent reads `false`), `proposed-by`,
  `source-session`, `source-turns`, `supersedes`. Absent and empty (`key:`)
  both mean none. Only the ones present are written; `pinned` always is.
- **Vocabularies:**
  - `kind`: `decision | canon | preference | open-thread`.
  - `status`: `active | archived`. **Superseded is derived, never stored**:
    a memory is superseded while a readable memory names it in
    `supersedes` (`supersededProjectMemoryIds`), so a supersession is one
    new file and never a rewrite of the old one. `status: superseded` is
    refused as an invalid value.
  - `origin`: `writer | proposed | auto`.
- **Values:**
  - `id` is `mem-` and six lower-case hex digits. It is the memory's
    identity, never read from the file's name.
  - Times are UTC ISO 8601, with optional milliseconds, and name a real day.
  - `source-turns` are Workshop turn ids, `turn-<n>-<user|assistant|system>-<ms>`
    (`WorkshopTurnLedger.nextId`).
  - Lists are comma-separated: no empty entry, none twice.
  - A value is literal: no quoting, escapes or nesting, so a quoted title
    keeps its quotation marks.
  - No value holds a control character, U+2028 or U+2029. `title` and
    `summary` are one line.
- **Rules:**
  - A `proposed` or `auto` memory names its persona, session and at least
    one turn. A `writer` memory may name any of them.
  - Turns need a session.
  - `updated` is not before `created`.
  - A memory never supersedes itself.
- **Bounds:** title 120, summary 280, body 8,000 characters; 32 source
  turns, 8 superseded ids; files over 256 KiB are not read. The constants
  are `PROJECT_MEMORY_FIELD_CHARACTERS`, `PROJECT_MEMORY_LIST_ENTRIES` and
  `PROJECT_MEMORY_FILE_BYTES`; they move to
  `PROMPT_BUDGETS.workshopProjectMemory` in Slice 2.
- **Hand edits read:** a BOM, CRLF or CR, space around keys, colons, values
  and list entries, blank lines in the frontmatter, and missing optional
  keys. The frontmatter is always written LF.
- **The body is kept byte for byte:** everything after the closing `---`
  line, line endings included, so a rewrite never changes it.
  `projectMemoryBody` gives a new memory's Markdown its blank separating
  line.
- **Refusals** (`PROJECT_MEMORY_INVALID_REASONS`, each with the known key
  where there is one; never the file's text):
  - shape: `no-frontmatter`, `unclosed-frontmatter`, `malformed-line`,
    `unknown-key`, `duplicate-key`, `missing-key`;
  - values: `unsupported-format`, `invalid-value`, `too-long`;
  - rules: `proposal-without-provenance`, `turns-without-session`,
    `updated-before-created`, `supersedes-itself`.

### The store, as built

- **`availability()`**, read live: `{ available: true, rootPath, directory,
  displayPath }` for one workspace folder, or `{ available: false, reason:
  'no-workspace' | 'multi-root' }`. This mirrors
  `WorkshopSessionStore.availability()`.
- **`list()`** returns one of:
  - `listed`, with `memories` (decoded, sorted by file name), `unreadable`
    (file name and reason), `conflicts` (ids two or more readable files
    hold, with their file names; none of them is a memory here) and `busy`
    (files a live claim holds, with the id the claimed bytes hold);
  - `unavailable`: memory is off (no session-only mode);
  - `unknown`, for a folder that cannot be read. A missing folder is an
    empty `listed`.

  Every `*.md` is read but `INDEX.md` (any case) and hidden files; not
  recursive. Claims are settled first, as the board store settles them.
  Unreadable reasons are the codec's, plus `too-large`, `not-text` (invalid
  UTF-8) and `read-failed`.
- **`read(id)`** answers `memory | missing | busy | conflict | unavailable
  | unknown`. It is resolved through the listing; an id is never a path.
- **`create(draft, { beforeCommit })`**
  - It mints the id, and sets `created` and `updated` to now, to the second.
  - It copies the draft field by field, and checks that the encoded file
    reads back.
  - It stages `.<name>.tmp-<uuid>`, runs the commit point, then renames
    without overwriting.
  - The file is `<slug>-<shortid>.md`: the title's ASCII slug at creation,
    at most 48 characters, or `memory`. A file is never renamed.
  - A final name taken meanwhile mints a new id, up to three times. A new id
    is never one the folder holds, a live claim holds, or a conflict holds.
- **`replace(id, update, { beforeCommit })`** covers edit (a title edit
  too: the file keeps its name), pin and archive.
  - It reads through the listing, and refuses a change to `id` or `created`
    (`identity-changed`).
  - It checks the new file reads back, then commits through
    `commitStoredFileRewrite`: claimed, the claimed bytes compared with the
    bytes read, then committed.
  - A file that changed under it is read again, up to three times; one
    deleted under it is `missing`; one held is `busy`.
  - `updated` is the caller's to set.
- **`delete(id)`** goes through `StoredFileClaims.deleteClaimed`: claim,
  retire every leftover claim, delete. A file that does not read, or
  conflicts, is never rewritten or deleted (`conflict`).
- **Queue and drain.** One queue. Every write is owed until it settles, and
  `shutDown()` waits for every owed write and any started meanwhile, the
  Lightbox library's loop.
- **Logs** name a memory by id in the store's own lines; the shared claims'
  lines say "a memory file". Never a title, summary, body or file name.

### Tests

- `ProjectMemoryCodec.test.ts` (61):
  - the fixtures read as written and write back byte for byte;
  - every fixture is canonical: the keys present, in order, and no empty
    optional;
  - superseded derived from the fixtures, the superseded one still stored
    `active`;
  - `projectMemoryBody`;
  - every kind, status and origin round-trips, and a writer's memory
    without provenance writes no optional key;
  - the body byte for byte (leading blank lines, `---` lines, indentation,
    trailing space, CRLF);
  - hand edits: CRLF, CR, a BOM, extra space, blank lines, missing or empty
    optional keys, quoted values;
  - one case per refusal (including `status: superseded`, the feature
    note's `t-0412` and a turn with an unknown role), with a guard that
    every reason has one;
  - no refusal carries the file's text;
  - the body's bound, exact and one past;
  - a value with a line break does not read back.
- `ProjectMemoryStore.test.ts` (23):
  - availability, live;
  - a missing folder against an unreadable one;
  - what is listed;
  - every unreadable reason, and a copied file's conflict, with no file
    rewritten or deleted;
  - ids that are not paths;
  - creation: naming, staging and the rename's `overwrite: false`, id
    collisions, invalid drafts, stray fields, withdrawal, a failed staging
    write;
  - rewrites: claim and commit, archive, a title edit that keeps the file's
    name, a hand-edited CRLF body kept byte for byte, unchanged, identity,
    invalid, withdrawn;
  - a supersession as one new file, with the old file untouched;
  - deletes, with a leftover retired;
  - claims: an abandoned one put back, logged without the file's name; a
    live one busy everywhere.
- `boundaries.test.ts`: the shared primitive imports no `Lightbox*` or
  `ProjectMemory*` module, and only `ProjectMemoryStore` builds
  `StoredFileClaims` directly. A mutation (a Lightbox import added to
  `StoredFileRewrite`) fails it.
- `ProjectMemoryStoreRaces.test.ts` (9), two stores on one file system:
  - **Two windows saving at once lose nothing,** including when both mint
    the same id.
  - **A second rewrite during a claim** is busy and writes nothing.
  - **A rewrite that read before the other committed** reads again and keeps
    both changes.
  - **A delete racing a rewrite,** both orders: busy while claimed; a
    rewrite whose file was deleted under it writes nothing, and nothing
    comes back.
  - **The shutdown drain:** a write in flight, and one started while
    waiting.
- The helper is `projectMemoryStoreHost.ts`. It uses the Lightbox store
  tests' `MemoryFileSystem` and `deferred`.

## Deviations and Decisions the ADR Should Confirm

- **Where the type lives.** `shared/types/projectMemory.ts`, beside
  `workshopCapabilities.ts`, not under `shared/types/messages/workshop/`.
  `boundaries.test.ts` requires every module there to appear in
  `AGENTS.md`'s tree, which this thread does not edit. It can move when
  Slice 2 or 4b adds messages.
- **Bounds are named `PROJECT_MEMORY_FIELD_CHARACTERS` and
  `PROJECT_MEMORY_LIST_ENTRIES`,** not `*_MAX`, which `promptBudgets.test.ts`
  would flag. The ADR may move them into `PROMPT_BUDGETS.workshopProjectMemory`
  once the trailer's prompt teaches them. The values (120, 280, 8,000, 32,
  8, 256 KiB) are this slice's guesses.
- **Format details neither the note nor the relay settles,** chosen here:
  - milliseconds allowed in times;
  - `supersedes` as a list of up to 8, not one id;
  - turns needing a session;
  - an empty body allowed;
  - `pinned` always written (`pinned: false`), and read as `false` when
    absent (the coordinator accepted this);
  - key lines read leniently (space before the colon, or `key:value` with no
    space), always written `key: value`, values literal after the first
    colon (accepted).
- **`updated` is not stamped by the store on `replace`.** A pin need not
  reorder the catalog's "most recently updated"; the application service
  decides.
- **`768b41f`: a deliberate, behavior-preserving Lightbox refactor.** The
  brief asked for reuse, with any refactor in its own commit. The relay's
  item 11 then asked for memory-owned claim siblings instead. The
  coordinator kept the refactor (one shared primitive for PR #164's rules,
  not two copies), so there is no tech-debt note, and the ADR's D10 names
  the primitive. `768b41f` touches no test file. Its targeted run
  (`npx jest Lightbox boundaries webviewHtml extensionShutdown`) passed
  184 suites / 2,306 tests unchanged, and the full suite passed after it
  (639 suites / 9,063 tests at `0afa58d`).
  `boundaries.test.ts` now holds `StoredFileClaims` and `StoredFileRewrite`
  neutral: they import no `Lightbox*` or `ProjectMemory*` module. As built:
  - `LightboxBoardClaims` is now `StoredFileClaims` over the Lightbox's claim
    pattern and log prefix.
  - The stage/claim/compare/commit/release half of
    `LightboxBoardRewrites.once` is `commitStoredFileRewrite`, with the
    Lightbox's fallback name given as a port.
  - `LightboxBoardStore.delete` calls `deleteClaimed`.
  - Log lines and staging-id order are unchanged, and no Lightbox test
    changed. The board store's new-file write stays its own: its timestamp
    names and numbered retries differ from memory's minted-id names.
- **`logName`.** A memory file's name carries its title's slug, which is
  writer text, and identity is never read from a name. `StoredFileClaims`
  therefore takes a per-store `logName` (identity for the Lightbox), and
  memory's says "a memory file".
- **Busy files are named.** A listing reads a live claim's bytes, read-only,
  so `read(id)` can answer `busy` rather than `missing`.

## Review Fixes (PR #194)

Astra's review (`docs/pr-reviews/pr-194-project-memory-store-review.md`,
`09a6955c`) asked for changes. Each finding was fixed in its own commit,
with a regression test that failed first.

| ID | Commit | Fix |
|---|---|---|
| F-01 | `ae95975` | `prepareProjectMemoryFile`: every field checked before it is put on a line (no line break or control character; no comma in a list entry), then the decoded file required to be the very memory meant (`not-as-written`). Create and replace both go through it |
| F-02 | `4d836d9` | `deleteClaimed(…, verify)`: the claimed bytes are checked before anything goes. Memory's requires them to read with the same id, else they are put back (`changed`). An overload keeps `changed` out of the Lightbox's result |
| F-03 | `2728e6c` | `PROJECT_MEMORY_CLAIM` matches `.md` in any case, as `isMemoryFileName` lists it |
| F-04 | `6f320b6` | `StoredFileClaims` `formatError` hook (the shared rewrite uses it); memory logs `fileSystemErrorCategory`: a code, never a message. The Lightbox's lines are unchanged |
| F-05 | `c898333` | The encoded bytes are held to `PROJECT_MEMORY_FILE_BYTES` before anything is staged (`file-too-large`); turn ids' counter and time are bounded to 9 and 16 digits |
| N-01 | `7824c22` | `supersededProjectMemoryIds` takes `{ id, supersedes }` and supersedes nothing on a cycle (ADR D4) |
| N-02 | `5f92624` | The coordinator's decision: a memory under a live claim stays in `memories`, read from the claim's bytes, `busy: true`; `read` answers busy; an unreadable claim is an unreadable row. The listing's `busy` array is gone |

Astra's re-review (`3e608da6`) verified F-01, F-03, F-04, F-05 and N-01
fixed, and found two more P2s, fixed the same way:

| ID | Commit | Fix |
|---|---|---|
| F-02 (re-review) | `0909c1c` | A refused delete's bytes go back under the saved name, else a free fallback name (`StoredFileDeleteCheck.fallbackPath`), as an ordinary file. Before, with the saved name taken, they stayed under the claim, and a lease-settling listing purged them as a rewrite's leftover |
| F-06 | `daf4668` | A busy memory is read from the newest of its claims (by time, ties broken as recovery does), not the first directory entry, so overlapping rewrites never list a stale version. This also settles N-02's accuracy |

What changed in the contracts:
- the store's `invalid` reason widens to `ProjectMemoryWriteFault`
  (`not-as-written`, `file-too-large`);
- a delete may answer `changed`, and `deleteClaimed`'s check is
  `{ verify, fallbackPath }`;
- `ProjectMemoryEntry.busy` replaces `ProjectMemoryListing.busy`.

## Known Limits

- **Two windows minting one id for different titles.** The file names
  differ, so both commits succeed and the two files become a conflict. They
  are listed, never lost, and never rewritten. The odds are 1 in 16.7
  million per pair of simultaneous saves. A longer id would shrink them; the
  ADR may prefer one.
- **Every operation reads the folder whole.** Memories are small and few,
  so v1 does not cache. Slice 2's catalog may want a cache keyed by the
  folder's listing.
- **The claims' residual race** is the board store's: it needs a writer
  stalled past the 30-second lease, and another window's recovery and
  delete inside that writer's last file operation.

## Verification

| | Before (`8fb016f`) | After |
|---|---|---|
| `npm run typecheck` | clean | clean |
| `npm run lint` | 0 errors | 0 errors, 1,153 warnings; none in a new or changed file (the one warning in the storage folder is `pathContainment.ts`'s, untouched) |
| `npx jest` | 636 suites / 8,977 tests / 59 snapshots | 639 suites / 9,107 tests / 59 snapshots after the re-review fixes (+3 suites, +130 tests; 9,071 before the review, 9,100 after its first round) |
| `from 'vscode'` in `packages/core/src` | none | none |

**File sizes (lines).**

| File | Lines |
|---|---|
| `infrastructure/storage/StoredFileClaims.ts` (new) | 355 |
| `infrastructure/storage/StoredFileRewrite.ts` (new) | 159 |
| `infrastructure/storage/ProjectMemoryCodec.ts` (new) | 423 |
| `infrastructure/storage/ProjectMemoryFiles.ts` (new) | 222 |
| `infrastructure/storage/ProjectMemoryStore.ts` (new) | 443 |
| `infrastructure/storage/ProjectMemoryStoreContracts.ts` (new) | 109 |
| `shared/types/projectMemory.ts` (new) | 148 |
| `infrastructure/storage/fileSystemErrors.ts` | 5 → 20 |
| `infrastructure/storage/LightboxBoardClaims.ts` | 229 → 82 |
| `infrastructure/storage/LightboxBoardRewrite.ts` | 263 → 216 |
| `infrastructure/storage/LightboxBoardStore.ts` | 429 → 414 |
| `infrastructure/storage/LightboxBoardNewFile.ts` | 91 → 92 |
| `__tests__/infrastructure/storage/ProjectMemoryCodec.test.ts` | 302 |
| `__tests__/infrastructure/storage/ProjectMemoryStore.test.ts` | 484 |
| `__tests__/infrastructure/storage/ProjectMemoryStoreRaces.test.ts` | 373 |
| `__tests__/infrastructure/storage/projectMemoryStoreHost.ts` | 73 |
| `__tests__/architecture/boundaries.test.ts` | 2,418 → 2,436 (already past 500 before this slice; the guard adds 18) |
