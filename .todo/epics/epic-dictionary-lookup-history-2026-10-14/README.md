# Epic: Dictionary Lookup History

**Status:** In progress. Spec written 2026-10-14; Slices 1–3 being built
**Priority:** Medium
**Created:** 2026-10-14
**Integration branch:** `claude/stoic-brown-wsqqr5` (from `main` at `529a0dd`). Each slice lands as its own reviewed commit series on this branch.
**Decision:** [ADR 2026-10-14: Dictionary Lookup History](../../../docs/adr/2026-10-14-dictionary-lookup-history.md) (Proposed)
**Realizes:** the Dictionary third of [Feature: Request History Buttons](../../features/feature-request-history-buttons/README.md)

## Goal

Writers can step back and forward through past Dictionary lookups with `‹` `›`
buttons beside the "Utilities · Dictionary" title, and can open a history
popup to jump to any recent lookup. Each entry restores the full lookup: word
or phrase, extra context, entry options, mode, source, model, and the
Markdown result. Restoring never reruns the lookup and never changes the model
selection.

```
 Utilities · Dictionary                     [‹] [🕘 3 / 12] [›]
 ─────────────────────────────────────────────────────────────
 From history · Oct 14, 14:02 · ⚡ Fast · anthropic/claude-sonnet-4.5
```

## Shape

- **Host:** `DictionaryHistoryStore` (in memory, persisted to
  `prose-minion/history/dictionary.json`, newest 50) lives in `CoreServices`.
  `DictionaryHandler` records successful Dictionary-tab lookups. Six message
  types separate summaries from entries, and result payloads carry
  `historyEntryId`.
- **Webview:** a `useDictionaryHistory` domain hook holds summaries, the
  cursor, the pending load, and the draft slot. A pure navigation module
  decides which entry `‹` and `›` load. `useDictionary` gains
  `lookupSubject` and `restoreView`.
- **UI:** a nav cluster in the tab header, a "From history" meta line, and a
  `DictionaryHistoryModal` popup with open, delete, clear (with
  confirmation), and a note on where the history is kept.

## Slices

| # | Slice | Outcome | Status |
|---|---|---|---|
| 0 | Spec | ADR + this epic; feature note linked | Done |
| 1 | [Host history ledger](slice-1-host-history-ledger.md) | Contracts, store, codec, recording, routes, broadcast, composition root | Done: `76e1ec8`, `04d891b` |
| 2 | [Navigation](slice-2-webview-navigation.md) | `lookupSubject` / `restoreView`, pure navigation rules, `useDictionaryHistory`, header `‹ 🕘 ›` cluster, meta line | Planned |
| 3 | [History popup](slice-3-history-popup.md) | `DictionaryHistoryModal` (list, open, delete, clear), wiring, docs, memory bank | Planned |

Slice 1 is the foundation. Slices 2 and 3 both build on its contracts. Slice
3's modal is presentational (props in, callbacks out), so it can be built
alongside Slice 2 and mounted once Slice 2's hook exists.

## Verification (every slice)

- `npm run typecheck`, `npm run lint` (no new warnings), `npx jest` (full suite)
- `packages/core/src` has no `from 'vscode'` (the architecture tests guard this)
- The live Extension Development Host check comes after Slice 3. Run a standard
  lookup, a fast lookup, and a cancelled lookup. Confirm that only the first two
  are recorded, that `‹` `›` restore everything listed in the goal, that a
  reload keeps the history and the cursor, and that a no-folder window shows
  the session-only note.

## Completion criteria

- `‹` `›` move through recent lookups and disable at each end. `›` past the
  newest entry restores unsaved input.
- The popup lists entries newest first with word, time, mode, options, model,
  and context preview. Selecting a row restores that lookup. Rows can be
  deleted, and the history can be cleared after confirmation.
- Restoring changes no model selection and reruns nothing.
- Cancelled, failed, and unconfigured lookups are not recorded.
- The history survives a reload in a single-folder workspace and degrades
  visibly without one.
- Each behavior above has a focused test (store/codec, handler, navigation,
  hook, components).

## Progress notes

- **2026-10-14. Slice 0.** Spec from the writer's request, with a screenshot
  marking the header area for the controls. Decisions: host-owned project file
  (`setState` is re-serialized on every render, so fifty Markdown entries
  cannot ride in it); no de-duplication (comparing reruns is the point); the
  model is captured at request start; a draft slot keeps unsaved input. The
  Copy/Save header moves from `lastLookupRef` to `lookupSubject`, because the
  ref would name the wrong word after a restore.
- **2026-10-14. Slice 1.** Host ledger landed: 308 suites / 4,537 tests
  (+2 suites, +60 tests), typecheck clean, no `vscode` in core. It went
  beyond the spec in a few places, all listed in the slice's implementation
  notes:
  - A file the store can neither read nor set aside is never overwritten.
    History stays session-only instead.
  - Duplicate ids are de-duplicated on load.
  - The file location is fixed at first load.
  - Logs never carry the writer's words, context, or results.

  Observed order: the result (with `historyEntryId`) is posted before the
  `DICTIONARY_HISTORY` broadcast, so the webview must not drop a
  just-followed cursor while it waits for that list.
