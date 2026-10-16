# Dictionary Lookup History: Built on the Epic Branch

**Date:** 2026-10-14
**Branch:** `epic/dictionary-lookup-history` (built on `claude/stoic-brown-wsqqr5` from `main` at `529a0dd`; `main` v2.10.1 merged in)
**Epic:** [.todo/epics/epic-dictionary-lookup-history-2026-10-14](../.todo/epics/epic-dictionary-lookup-history-2026-10-14/README.md)
**ADR:** [docs/adr/2026-10-14-dictionary-lookup-history.md](../docs/adr/2026-10-14-dictionary-lookup-history.md) (Proposed; accept after the live pass)

## What shipped

The Dictionary tab header has `‹` `🕘 n / total` `›`. The arrows restore older
and newer lookups: word, context, Encyclopedia and Palettes switches, source,
and result. The `🕘` button opens a popup that lists lookups newest first,
with time, mode, options, model, and a context preview. Rows can be opened or
deleted, and the whole history can be cleared after a confirmation. A "From
history · time · mode · model" line marks a restored entry. Restoring never
reruns a lookup and never changes the model selection.

## Decisions worth remembering

- **Host-owned history** lives in `prose-minion/history/dictionary.json`
  (`formatVersion: 1`, newest 50). Webview `setState` is re-serialized on
  every App render, so fifty Markdown results cannot live there.
- **Recording** happens in `DictionaryHandler` and only for Dictionary-tab
  lookups. Workshop personas call `DictionaryService` directly. Cancelled,
  `unconfigured`, and `failed` outcomes are not recorded. The service now
  returns an explicit `outcome` instead of the handler sniffing `Error:` text.
- **The model** is captured at request start (`getActiveModelId()`), so a hot
  swap mid-run cannot mislabel the entry.
- **No de-duplication.** Comparing reruns is the point.
- **Protocol:** summaries and entries are separate messages (six message
  types), and result payloads carry `historyEntryId`.
- **Webview:**
  - `useDictionaryHistory` holds the summaries, the cursor, the pending load
    (latest wins), and an in-memory draft slot. `›` from the newest entry
    restores unsaved input.
  - `lookupSubject` replaced `lastLookupRef`, so Copy and Save name the
    displayed lookup.
  - The replay guard `hasFollowedEntry` exists because the provider uses
    `retainContextWhenHidden` and re-sends its cached result on visibility.

## Verification

- 312 suites / 4,641 tests pass. Typecheck is clean, lint has 0 errors, and
  the production build compiles.
- **Not done yet:** the Extension Development Host pass. Run a standard, a
  fast, and a cancelled lookup, step with `‹` `›`, reload, and try a
  no-folder window. The epic's Verification section lists the steps.

## Follow-ups

- **Right-click source:** right-click lookups don't record a source.
  `useSelection.handleSelectionUpdated` drops it for dictionary injections.
- **Two windows:** two windows on one folder each keep their own in-memory
  history, and the last writer wins on disk.
- **Other tools:** history for Assistant and Category Search
  (`feature-request-history-buttons`), reusing `prose-minion/history/<tool>.json`.

## 2026-10-15: PR #144 review fixes

Astra's review ([docs/pr-reviews/pr-144-dictionary-lookup-history-review.md](../docs/pr-reviews/pr-144-dictionary-lookup-history-review.md))
found four Medium findings, all fixed and mutation-checked. The ADR is amended.

- **Settlement ownership (F-01, F-02):** a dictionary result now settles only
  its own stream (`requestId`). The webview stays loading from stream
  completion until that result arrives. Any future host change must keep
  `STREAM_COMPLETE` and `DICTIONARY_RESULT` back to back, with no `await`
  between them, or the lock opens again.
- **Model provenance (F-03):** use `ExecutionResult.modelId`, never an
  `AIResourceManager` selection read. Hot swaps mutate the shared engine in
  place, and the provider picks its model at dispatch. Entries hold
  `modelIds: string[]`.
- **Log privacy (F-04):** never put `JSON.parse` messages or unvalidated
  values into a log line. Node's parser quotes the surrounding source text.
- **Verification:** 313 suites / 4,673 tests. Lint 1,137 warnings, 0 errors.

## 2026-10-15: Re-review (F-05)

F-01 to F-04 were verified as Addressed. **F-05:** recording before completion
kept the stream cancellable during the save. The host acknowledged a cancel
there, but still posted success and kept the entry.

The fix makes `record(input, signal)` withdrawable: no insert if the signal is
already aborted, and an exact rollback with no emit if it aborts during the
write. The handler reads `signal.aborted` after the save.

Invariant: the store's final abort check must stay after its last `await`, and
the handler must post with no `await` in between. Otherwise a cancel can slip
between commit and completion.

## 2026-10-15: Second re-review (F-05 rollback failure)

The compensating rollback is gone (`46a250d`). Invariants:
- **Commit point:** `DictionaryHistoryStore.record` commits only through
  `beforeCommit`. The gate is called synchronously, immediately before the
  committing rename. Never add an `await` between the gate and the rename.
- **History file:** it holds only committed history. Never write the history
  file before the commit point, and never "undo" a commit with a second write.
- **Cancel window:** the handler's gate withdraws an already-cancelled lookup
  and otherwise deletes the request from `activeRequests` in the same tick.
  Cancellation ends exactly where commitment begins.
