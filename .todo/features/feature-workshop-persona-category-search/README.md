# Feature: Personas Ask for a Category Search

**Date Identified:** 2026-11-28
**Status:** Idea, decided: Okey took Ada's leans (2026-11-28). Medium. An addendum to ADR 2026-11-20 (D16–D21): the persona's paid-search card serves a second kind. Build it after the [Persona Measures](../../epics/epic-persona-measures-2026-11-27/README.md) epic's A1, which lifts the scope type it reuses.
**Priority:** Medium
**Origin:** Okey, 2026-11-28. Split from [#35](../feature-workshop-persona-measures/README.md): Category Search isn't deterministic, so it doesn't join `measure.*`.

## Why it isn't a measure

Category Search (`CategorySearchService`) asks the category model which of
the text's words fit a category ("emotion verbs"), then counts them with
Word Search. Every run is a paid model call. So, like Passage Search, a
persona **asks**, and the writer sees the price and presses Run.

The split is a good one: the model only picks words, and host code counts
them in the text. A word the model invents (zero occurrences) is already
filtered out.

## What exists

- **The persona's paid-search card** (Passage Search Slice 4; ADR 2026-11-20
  D16–D21). A reply trailer, settled before the reply commits, makes a card
  showing the price, with Run, Stop, Cancel, Send, Discard and Open report.
  Results reach the persona as a directed run, fitted to the window
  (`handlers/domain/workshop/WorkshopPassageSearch*`,
  `services/workshop/passageSearch/`). All of it is Passage Search's alone
  today.
- **The scope grammar:** the excerpt, a group (optionally narrowed by
  `match`), or a file by group and path. A persona never names a free path
  or pattern. The Persona Measures epic's A1 lifts it to a neutral module.
- **Category Search's service** takes text (`searchByCategory(query, text,
  files, sourceMode, options)`) with options for relevance (`broad`,
  `focused`, `specific`, `synonym`), word limit, and words, bigrams or
  trigrams.

## What has to change in the service

1. **An estimate before any call.** Today it runs straight through. The
   card's rule (the price is never skipped) needs `plan` and `run(plan)`,
   as Passage Search has:
   - the unique words or n-grams, then batches, then calls and an
     approximate price;
   - a `planKey`, so Run sends only what was priced.
2. **A stop per run.** The service holds one `abortController` for the
   instance, so a persona's search and the sidebar's would cancel each
   other. Each run takes its own signal.
3. **Counts-only logs.** It logs the invented words it filters ("Filtered N
   hallucinated words: …"). The persona path logs counts only. Lean: drop
   the words from the sidebar's log too.

## Idea

1. **The persona asks with a trailer:** the category, one or more scopes,
   and bounded options (relevance, words or n-grams, a word limit from the
   closed values the sidebar offers). It is settled before the reply
   commits, like Passage Search's: form, scopes and the catalog checked,
   nothing read or priced.
2. **The card is the paid-search card,** made to serve two kinds (C1). It
   shows the category, where it searches, the number of calls and the
   price, with the same buttons and rules.
3. **Results reach the persona as evidence:** each matched word with its
   count and a few lines of context, fitted by whole words to half the room
   left. The full report (the sidebar's own result) is a click away on the
   card.
4. **Partial results** (a word limit reached, a batch failed, a stop) are
   said in the shared words, and sent only on Send partial results, as
   Passage Search's are.
5. **Everything else follows ADR 2026-11-20's persona rules:**
   - one search per room;
   - held results bound to their room instance;
   - Rewind keeps a result whose card it left as searched;
   - logs carry counts and closed outcomes only.

## Decisions (Okey, 2026-11-28: Ada's leans, taken)

| # | Question | Decision |
|---|---|---|
| C1 | One card for both kinds, or a second card? | One card, extracted to serve both. The run slot, held results and delivery become kind-neutral; each kind keeps its own trailer, records and codec. |
| C2 | Which options can a persona set? | Category, scopes, relevance, and words or n-grams. The word limit takes the sidebar's default unless named, within its closed values. |
| C3 | Does the sidebar get the price confirmation too? | Not in this item. The engine gains `plan`, and the sidebar can adopt it later. |

## Completion Criteria

- [ ] A persona's trailer makes a card with the category, scopes, calls and
      an approximate price; nothing is sent before Run, and Run sends only
      the plan priced (tests).
- [ ] A persona's search and a sidebar search run without cancelling each
      other (test).
- [ ] Results reach the persona fitted to the window; partial results wait
      for Send partial results (tests).
- [ ] Passage Search's card behaves as before (its tests pass unchanged).
- [ ] The session fields are optional and exact, and a pre-feature fixture
      still reads.
- [ ] A help section explains asking for a category search.
- [ ] Logs carry counts only on every path (test).

## Related Files

- `packages/core/src/infrastructure/api/services/search/CategorySearchService.ts`
- `packages/core/src/shared/types/messages/search.ts` (`CategorySearchOptions`, `CategorySearchResult`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopPassageSearchHandler.ts` and its siblings
- `packages/core/src/application/services/workshop/passageSearch/`
- `packages/core/src/utils/workshopReplyPassageSearch.ts` (the trailer's codec)
- `docs/adr/2026-11-20-passage-search.md` (D16–D21)
