# Slice 1: Store and Codec

**Epic:** [Workshop Project Memory](README.md)
**Decision:** ADR 2026-11-04 (Slice 0, being written in parallel). Built from
the feature note's "The memory file (format 1)" and "Storage and
concurrency"; adjusted to the ADR before the PR merges.
**Branch:** `epic/workshop-project-memory-slice-1-store`
**Status:** Built and pushed; waiting on the ADR and the coordinator's PR.

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

**Where each piece lives.**

| Piece | Where |
|---|---|
| Domain type, closed vocabularies, field bounds, id pattern | `shared/types/projectMemory.ts` (`ProjectMemory`, `PROJECT_MEMORY_KINDS` / `_STATUSES` / `_ORIGINS`, `PROJECT_MEMORY_FIELD_CHARACTERS`, `PROJECT_MEMORY_LIST_ENTRIES`, `PROJECT_MEMORY_ID`) |
| Codec | `infrastructure/storage/ProjectMemoryCodec.ts` (`decodeProjectMemory`, `encodeProjectMemory`, `PROJECT_MEMORY_KEYS`, `PROJECT_MEMORY_INVALID_REASONS`) |
| Folder read, file names, log names | `infrastructure/storage/ProjectMemoryFiles.ts` |
| Store and its contracts | `infrastructure/storage/ProjectMemoryStore.ts`, `ProjectMemoryStoreContracts.ts` |
| Shared claims (take, settle, retire, a delete under a claim) | `infrastructure/storage/StoredFileClaims.ts` (from `LightboxBoardClaims`) |
| Shared rewrite commit (stage, claim, check bytes, commit, release) | `infrastructure/storage/StoredFileRewrite.ts` (from `LightboxBoardRewrite`) |
| Fixtures | `__tests__/fixtures/project-memory-v1/` (three memories: proposed canon, a writer's pinned preference with milliseconds, a superseded open thread with an empty body) |

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
supersedes:
---

Free Markdown.
```

- **Keys** (closed, written in this order): `format`, `id`, `title`, `kind`,
  `summary`, `status`, `pinned`, `created`, `updated`, `origin`,
  `proposed-by`, `source-session`, `source-turns`, `supersedes`.
- **Required:** `format` through `updated`, but `pinned`; and `origin`.
  **Optional** (absent, or empty as `key:`): `pinned` (reads `false`),
  `proposed-by`, `source-session`, `source-turns`, `supersedes`.
- **Values:**
  - `id` is `mem-` and six lower-case hex digits.
  - Times are UTC ISO 8601, with optional milliseconds, and name a real day.
  - Lists are comma-separated: no empty entry, none twice.
  - A value is literal: no quoting, escapes or nesting, so a quoted title
    keeps its quotation marks.
  - No value holds a control character, U+2028 or U+2029.
- **Rules:**
  - A proposed memory names its persona, session and at least one turn.
  - A writer's memory names no persona.
  - Turns need a session.
  - `updated` is not before `created`.
  - A memory never supersedes itself.
- **Bounds:** title 120, summary 280, body 8,000 characters; 32 source
  turns, 8 superseded ids; files over 256 KiB are not read.
- **Hand edits read:** a BOM, CRLF or CR, space around keys, colons, values
  and list entries, blank lines in the frontmatter, missing optional keys.
  The body keeps everything but its leading blank lines and trailing space.
- **Refusals** (`PROJECT_MEMORY_INVALID_REASONS`, each with the known key
  where there is one; never the file's text):
  - shape: `no-frontmatter`, `unclosed-frontmatter`, `malformed-line`,
    `unknown-key`, `duplicate-key`, `missing-key`;
  - values: `unsupported-format`, `invalid-value`, `too-long`;
  - rules: `proposal-without-provenance`, `proposer-without-proposal`,
    `turns-without-session`, `updated-before-created`, `supersedes-itself`.

### The store, as built

- **`availability()`**, read live: `{ available: true, rootPath, directory,
  displayPath }` for one workspace folder, or `{ available: false, reason:
  'no-workspace' | 'multi-root' }`. This mirrors
  `WorkshopSessionStore.availability()`.
- **`list()`** returns one of:
  - `listed`, with `memories` (decoded, sorted by file name), `unreadable`
    (file name and reason) and `busy` (files a live claim holds, with the id
    the claimed bytes hold);
  - `unavailable`;
  - `unknown`, for a folder that cannot be read. A missing folder is an
    empty `listed`.

  Every `*.md` is read but `INDEX.md` (any case) and hidden files. Claims
  are settled first, as the board store settles them. Unreadable reasons are
  the codec's, plus `too-large`, `not-text` (invalid UTF-8), `duplicate-id`
  (every file holding a shared id) and `read-failed`.
- **`read(id)`** answers `memory | missing | busy | unreadable | unavailable
  | unknown`. It is resolved through the listing; an id is never a path.
- **`create(draft, { beforeCommit })`**
  - It mints the id, and sets `created` and `updated` to now, to the second.
  - It copies the draft field by field, and checks that the encoded file
    reads back.
  - It stages `.<name>.tmp-<uuid>`, runs the commit point, then renames
    without overwriting.
  - The file is `<slug>-<shortid>.md`: the title's ASCII slug, at most 48
    characters, or `memory`.
  - A final name taken meanwhile mints a new id, up to three times. A new id
    is never one the folder holds, a live claim holds, or a duplicate holds.
- **`replace(id, update, { beforeCommit })`** covers edit, pin, archive and
  supersede.
  - It reads through the listing, and refuses a change to `id` or `created`
    (`identity-changed`).
  - It checks the new file reads back, then commits through
    `commitStoredFileRewrite`: claimed, the claimed bytes compared with the
    bytes read, then committed.
  - A file that changed under it is read again, up to three times; one
    deleted under it is `missing`; one held is `busy`.
  - `updated` is the caller's to set.
- **`delete(id)`** goes through `StoredFileClaims.deleteClaimed`: claim,
  retire every leftover claim, delete. A file that does not read is never
  rewritten or deleted (a duplicate id answers `unreadable`).
- **Queue and drain.** One queue. Every write is owed until it settles, and
  `shutDown()` waits for every owed write and any started meanwhile, the
  Lightbox library's loop.
- **Logs** name a memory by id (`mem-7f3c2a's file` in the claims' lines),
  never by title, summary, body or file name.

### Tests

- `ProjectMemoryCodec.test.ts` (56):
  - the fixtures read as written and write back byte for byte;
  - every fixture is canonical;
  - every kind, status and origin round-trips;
  - a body holding `---` lines and indented code keeps them;
  - hand edits (CRLF, CR, BOM, extra space, blank lines, missing optional
    keys, quoted values);
  - one case per refusal, with a guard that every reason has one;
  - no refusal carries the file's text;
  - the body's bound, exact and one past;
  - a value with a line break does not read back.
- `ProjectMemoryStore.test.ts` (21):
  - availability, live;
  - a missing folder against an unreadable one;
  - what is listed;
  - every unreadable reason, with no file rewritten or deleted;
  - ids that are not paths;
  - creation: naming, staging and the rename's `overwrite: false`, id
    collisions, invalid drafts, stray fields, withdrawal, a failed staging
    write;
  - rewrites: claim and commit, archive and supersede, unchanged, identity,
    invalid, withdrawn;
  - deletes, with a leftover retired;
  - claims: an abandoned one put back, logged by id; a live one busy
    everywhere.
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
- **Format details the feature note left open,** chosen here:
  - the id's shape (six hex digits);
  - milliseconds allowed in times;
  - `supersedes` as a list of up to 8, not one id;
  - `proposed-by` forbidden on a writer's memory;
  - turns needing a session;
  - values literal, with no YAML quoting;
  - an empty optional value read as absent;
  - an empty body allowed.
- **`updated` is not stamped by the store on `replace`.** A pin need not
  reorder the catalog's "most recently updated"; the application service
  decides.
- **Shared, not copied** (the brief asked for this, and for a separate
  commit):
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
  writer text. `StoredFileClaims` therefore takes a per-store `logName`
  (identity for the Lightbox), and memory's names a file by its id.
- **Busy files are named.** A listing reads a live claim's bytes, read-only,
  so `read(id)` can answer `busy` rather than `missing`.

## Known Limits

- **Two windows minting one id for different titles.** The file names
  differ, so both commits succeed and both files become `duplicate-id`. They
  are unreadable, never lost, and never rewritten. The odds are 1 in 16.7
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
| `npm run typecheck` | clean | AFTER_TC |
| `npm run lint` | 0 errors | AFTER_LINT |
| `npx jest` | 636 suites / 8,977 tests / 59 snapshots | AFTER_JEST |
| `from 'vscode'` in `packages/core/src` | none | none |

**File sizes (lines).**

| File | Lines |
|---|---|
| `infrastructure/storage/StoredFileClaims.ts` (new) | 282 |
| `infrastructure/storage/StoredFileRewrite.ts` (new) | 159 |
| `infrastructure/storage/ProjectMemoryCodec.ts` (new) | 342 |
| `infrastructure/storage/ProjectMemoryFiles.ts` (new) | 204 |
| `infrastructure/storage/ProjectMemoryStore.ts` (new) | 421 |
| `infrastructure/storage/ProjectMemoryStoreContracts.ts` (new) | 99 |
| `shared/types/projectMemory.ts` (new) | 80 |
| `infrastructure/storage/LightboxBoardClaims.ts` | 229 → 82 |
| `infrastructure/storage/LightboxBoardRewrite.ts` | 263 → 216 |
| `infrastructure/storage/LightboxBoardStore.ts` | 429 → 414 |
| `infrastructure/storage/LightboxBoardNewFile.ts` | 91 → 92 |
| `__tests__/infrastructure/storage/ProjectMemoryCodec.test.ts` | 212 |
| `__tests__/infrastructure/storage/ProjectMemoryStore.test.ts` | 297 |
| `__tests__/infrastructure/storage/ProjectMemoryStoreRaces.test.ts` | 220 |
| `__tests__/infrastructure/storage/projectMemoryStoreHost.ts` | 72 |
