# Slice 1: Format and Store

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D5 (storage), D6 (bounds)
**Status:** Not started. The pure codec can start now from `epic-pinned-context`.
The store waits on `StoredFileClaims` / `StoredFileRewrite` reaching `main`
(Project Memory Slice 1, PR #194).

## Outcome

`prose-minion/pinned-context.json` has a strict, pure format-1 codec and a
store with the board store's write discipline. Nothing reads files from the
list yet, and nothing in the UI changes.

## Build

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
- At most `PROMPT_BUDGETS.workshopPinnedContext.files` (20) entries. Add the
  bound to `PromptBudgets` and to `promptBudgets.ts`.
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
  - unavailable with none or several folders.
- **Boundaries:** the store and codec live in `infrastructure/storage/`, and
  no handler imports the store.

## Completion criteria

- [ ] The codec refuses every malformed shape whole, and round-trips the
      fixture.
- [ ] The store never overwrites, never writes an unreadable file, and
      refuses a stale revision.
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec.
