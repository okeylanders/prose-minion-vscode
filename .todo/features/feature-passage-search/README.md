# Feature: Passage Search, a Search That Reads

**Date Identified:** 2026-11-19
**Status:** Idea. Medium: a third Search subtab, a fan-out reader with checked quotes, and a model scope. A short ADR, since it adds a model scope and a paid fan-out.
**Priority:** Medium
**Origin:** Okey, 2026-11-19

## In Okey's words

> I want to add a new search tab… It does something different than a word
> search or category search (which both rely on words or bi/tri-grams). This
> would split by file or every 5K characters and fan out to agents and
> perform a read search. The user would pose a question like: "Find all
> gestures for Jasper" or "Find all instances where Jasper adjusts his
> glasses" or "What are clichés that Raven uses".

## The gap

The sidebar's Search tab has two subtabs (`SearchTab.tsx`, `SearchSubtool`:
`'word' | 'category'`):
- **Word Search** counts exact words, bigrams and trigrams.
- **Category Search** asks a model which of the text's *words* fit a
  category ("emotion verbs"), then counts them (`CategorySearchService`).

Both find words. Neither can find a *moment*: Jasper pushing his glasses up
the bridge of his nose, a gesture written five different ways, or a cliché
in Raven's dialogue. That needs a model to read the passages.

## The name

Okey's candidates were "Topic Search", "General" and "Instances Of".
**Recommended: "Passage Search".**
- It sits beside Word and Category, and says what comes back: passages.
- It reads well with any question. "Instances Of" fits "find all times
  Jasper…" but not "what clichés does Raven use".
- "Topic" suggests themes, not moments.

Alternatives: "Read Search" or "Moment Search".

## Idea

### What the writer does

1. **Pick a scope,** as the other subtabs do: Active File, Manuscripts,
   Chapters or Selection, with a path or pattern (`TextSourceResolver`).
2. **Ask a question** in plain words: "Find all gestures for Jasper."
3. **Confirm the price.** A manuscript-wide read is many calls, so every run
   shows how many calls it makes and an estimated price ("≈ $0.42"), as
   Craft Flags does, before anything is sent.
4. **Watch it read** ("Reading 7 of 23"). **Stop** keeps what was found so
   far.

### How it splits: by file, splitting only big ones

- **A whole file per call when it fits** a word budget
  (`PROMPT_BUDGETS.passageSearch`). A file over the budget is split at
  paragraph breaks (`utils/draftEdit/chunkParagraphs.ts`), with one
  paragraph of overlap so a moment on a boundary isn't missed.
- **Why not every 5K characters.** About 900 words cuts scenes in half and
  loses who "he" is. "Jasper adjusted his glasses" becomes "he adjusted his
  glasses" by the third paragraph, so a chunk that never names Jasper can't
  attribute it. A whole chapter keeps that context. It also costs fewer
  calls, since each call's fixed prompt is paid once per chapter, not once
  per 5K.
- **A few calls at a time** (say 4), not all at once. A key change mid-run
  stops starting new calls, as Proofread does.

### What each call returns, and what the host checks

- **Each instance carries:**
  - an **exact quote** from the text;
  - a **short note** ("pushes glasses up when he's cornered");
  - a **label** for grouping ("adjusts glasses", "rubs his jaw").

  An empty list is a fine answer. The reply is read through
  `parseModelJson`, at temperature 0.
- **Every quote is anchored by host code** in its own chunk, as Draft Edit
  anchors its quotes (`utils/draftEdit/anchorEdits.ts`): found exactly once,
  or placed by its context.
  - **A quote that isn't in the text is dropped and counted** ("2 results
    dropped: quote not found"). The model can't invent a moment.
  - **The host computes each file and line** from the anchor; the model
    never gives a line number.
  - **Overlaps are merged:** the same moment found in two chunks is shown
    once.

### What the writer sees

- **A summary table** like Category Search's: each label, how many
  instances, and in how many files. Labels are merged by the host,
  ignoring case and spacing.
- **Then every instance:** file and line (click to open it there), the
  quote with a little text around it, and the note.
- **Copy and Save,** with the report saved under `prose-minion/reports/`,
  timestamped, like the other searches.

### Its model

A model scope of its own, `passageSearch` (`proseMinion.passageSearchModel`).
It follows the Category Search model until the writer picks one, the way
the Lightbox follows the Workshop's.
- Reading a chapter for who-did-what needs more than classifying words
  does, so the writer may want a stronger model here.
- It joins `ModelScope`, `MODEL_SCOPE_SETTING_KEYS`, `ModelScopeSelections`,
  `AIResourceManager`, the settings watcher and the Settings overlay, as
  AGENTS.md's model-setting path describes.

## Pieces it reuses

- the Search tab's subtabs and scope controls (`SearchTab.tsx`,
  `TextSourceResolver`);
- paragraph chunking (`chunkParagraphs`) and quote anchoring (`anchorEdits`)
  from Draft Edit;
- `parseModelJson`;
- the price estimate's approach (`CraftFlagsService.estimate`,
  `estimateRequestTokens`);
- the search report save.

New code lives in `services/search/` (a `PassageSearchService`), the
`SearchHandler`, `search.ts` messages, and a tripartite webview hook.

## Open questions

- **The name.** Recommended: Passage Search.
- **The word budget per call.** It decides how often a chapter is split.
  The ADR sets it against the scope model's window.
- **A summary pass?** For "what clichés does Raven use", the grouped labels
  may be enough. One more call that summarizes the found instances could
  come later. Leaning: later.
- **Bring to Workshop?** Send the results to a persona to discuss, as a
  message attachment. Leaning: later.
- **A persona capability?** Jill running a passage search is a paid fan-out
  started by a model, so it would need the writer's confirmation. Leaning:
  later, if at all.

## Completion Criteria

- [ ] Search has a third subtab that takes a scope and a question, and
      confirms the number of calls and an estimated price before reading.
- [ ] Files are read whole when they fit the budget, and split at paragraph
      breaks with overlap when they don't (test).
- [ ] Every result's quote is anchored by host code. Quotes not in the text
      are dropped and counted, and the same moment found twice shows once
      (tests).
- [ ] Results show grouped labels with counts, then each instance with its
      file, host-computed line, quote and note. Clicking opens the file at
      the line.
- [ ] Stop keeps what was found, and a key change stops starting calls
      (tests).
- [ ] The `passageSearch` model scope follows Category Search's model until
      picked.
- [ ] Logs carry counts only, never the question or a quote. Fixtures use
      *Alice*.

## Related Files

- `packages/core/src/presentation/webview/components/tabs/SearchTab.tsx`
  (`SearchSubtool`)
- `packages/core/src/presentation/webview/components/search/CategorySearchPanel.tsx`
- `packages/core/src/infrastructure/api/services/search/CategorySearchService.ts`
- `packages/core/src/infrastructure/text/TextSourceResolver.ts`
- `packages/core/src/utils/draftEdit/chunkParagraphs.ts` and `anchorEdits.ts`
- `packages/core/src/infrastructure/api/services/craftFlags/CraftFlagsService.ts`
  (`estimate`)
- `packages/core/src/shared/types/messages/search.ts`
- `packages/core/src/shared/types/messages/configuration.ts` (`ModelScope`)
