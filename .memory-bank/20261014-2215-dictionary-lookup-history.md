# Dictionary Lookup History: Built on the Epic Branch

**Date:** 2026-10-14
**Branch:** `claude/stoic-brown-wsqqr5` (from `main` at `529a0dd`)
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
