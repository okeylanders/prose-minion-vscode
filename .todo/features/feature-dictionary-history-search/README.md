# Feature: Search the Dictionary's Lookup History

**Date Identified:** 2026-11-07
**Status:** Idea. A named follow-up of [ADR 2026-10-14](../../../docs/adr/2026-10-14-dictionary-lookup-history.md) ("Filtering or searching inside the popup", in its out-of-scope list). Searching words needs no ADR; searching definitions adds a route, so it's an amendment.
**Priority:** Medium
**Origin:** Okey, 2026-11-07

## In Okey's words

> We should be able to search the dictionary's history of words.

## Problem

The Dictionary keeps up to 500 lookups (`DICTIONARY_HISTORY_LIMIT`), repeats
included. The only ways back to one are stepping with ‹ › or scrolling the
history popup (`DictionaryHistoryModal`). Finding "that word I looked up
last week", or "the lookup that mentioned *gloaming*", means scrolling
through hundreds of rows.

## What is already in place

- **Every summary is already in the webview.** The host sends the whole list
  as `DictionaryHistorySummary[]`: word, context preview (up to 140
  characters), file, mode, encyclopedia and palettes flags, models and time.
  Filtering these needs no host call.
- **Bodies stay on the host.** A result's Markdown is fetched one entry at a
  time (ADR D5). Searching inside definitions has to run host-side.
- **A word key.** `dictionaryPhraseKey` normalizes a word for the prior-lookup
  offer (`findPriorDictionaryLookups`). Search matches words with the same
  rule, so the two never disagree about what counts as the same word.
- **Search conventions to mirror.**
  - The full tabs' `SavedItemBrowserModal` focuses its search field on open,
    and Escape cancels before it closes.
  - The Workshop's session browser searches session content on the host,
    and labels the field with a pill saying what it searches ("greps
    content").

## Idea

A search field at the top of the history popup.

- **As you type, rows filter instantly** by word, context and file name,
  ignoring case and accents. A line says how many match: "12 of 500".
- **"Also search definitions"** extends the search to the results'
  Markdown, on the host.
  - The request carries a webview-minted request id, and the popup takes
    only the answer it still waits for, as the Lightbox's project search
    does.
  - The host returns matching ids, with a short snippet around the first
    hit.
  - It scans at most 500 entries, linearly, with the query's length bounded.
- **Matches are marked** in each row, and in the snippet.
- **Keyboard:** ↓ from the field moves into the rows, Enter opens one, and
  Escape clears the query, then closes.
- **Opening a match** shows it and moves the ‹ › cursor there, as opening any
  row does today.

## Open questions

- **‹ › and the filter.** Do the arrows step through only the matches while
  a search is active, or always the whole history? Leaning: the whole
  history. Search is for finding, and opening a match puts the cursor there.
- **Filters beyond text.** Chips for Fast or Full, encyclopedia, palettes,
  or a date range? Or text alone at first?
- **A bigger cap.** Search makes a long history more useful. The ADR says
  raising the cap is safe for existing files, and if writes ever slow down,
  the remedy is an append-friendly layout, not a smaller cap. Raise it with
  this feature?
- **Assistant and Category Search** get history later (the parent
  feature). Should search be built so they can reuse it?

## Completion Criteria

- [ ] The popup's search field filters by word, context and file name as
      the writer types, with a count of matches, and needs no host call.
- [ ] Words match by `dictionaryPhraseKey`, the prior-lookup offer's rule.
      A test holds the two together.
- [ ] "Also search definitions" searches result bodies on the host. It is
      correlated by request id, so a stale answer is never shown, and it
      returns ids and snippets, never whole bodies.
- [ ] Keyboard: focused on open, ↓ into rows, Enter opens, Escape clears
      then closes.
- [ ] Logs carry counts, never the query or a word. Fixtures use *Alice*.

## Related

- [ADR 2026-10-14: Dictionary Lookup History](../../../docs/adr/2026-10-14-dictionary-lookup-history.md):
  D5 summaries and entries, the out-of-scope list.
- [Epic: Dictionary Lookup History](../../epics/epic-dictionary-lookup-history-2026-10-14/README.md)
- [Feature: Request History Buttons](../feature-request-history-buttons/README.md):
  the parent feature, with Assistant and Category Search history.

## Related Files

- `packages/core/src/presentation/webview/components/dictionary/DictionaryHistoryModal.tsx`
- `packages/core/src/presentation/webview/hooks/domain/useDictionaryHistory.ts`
- `packages/core/src/presentation/webview/utils/dictionaryHistoryNavigation.ts`
  (`findPriorDictionaryLookups`, `dictionaryPhraseKey`)
- `packages/core/src/shared/types/messages/dictionaryHistory.ts`
  (`DictionaryHistorySummary`)
- `packages/core/src/infrastructure/storage/DictionaryHistoryStore.ts`
  (where a body search would run)
- `packages/core/src/presentation/webview/components/fulltab/SavedItemBrowserModal.tsx`
  (search conventions to mirror)
