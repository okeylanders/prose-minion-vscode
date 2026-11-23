# Feature: Passage Search, a Search That Reads

**Date Identified:** 2026-11-19
**Status:** Built on `epic/passage-search` (PRs #292–#297, closing pass included), cut from `epic/workshop-persona-tools`. Slice 5 (PR #298: narrowing a group by patterns, with `resource.catalog` as the group inventory) is in review. Next: Okey's live pass, then a PR to `main` once Persona Tools has landed. P1–P4 decided; the epic README there records the defaults taken.
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

## Decisions (Okey, 2026-11-19)

| # | Decision | Notes |
|---|---|---|
| P1 | **A final pass organizes the results:** it puts them in sequence and writes a headline analysis, such as "What's an idiom Raven says a lot?" or "How do Jasper's gestures evolve across chapters?" | The shape is below. |
| P2 | **Personas can run it too.** | Through a request the writer approves, since it is a paid fan-out a model would start. The shape is below. |
| P3 | **Build it as an engine a research agent can call later** (2026-11-20). | Passage Search is close to a research agent. The engine takes a question and scopes and returns checked results, and the sidebar, the persona request and a future research agent are all callers. See below. |
| P4 | **It searches any project locations, several at once** (2026-11-20): characters, locations, chapters and the other context groups, as well as the active file, a selection or a pattern. | See below. |

## The organizing pass (P1)

- **It reads only the checked instances,** never the text again: each
  instance's number, quote, note, label, file and line, in reading order. So
  it is one short call, priced in the estimate with the rest.
- **The host decides the order.** Files go in the scope's reading order,
  with chapter names sorted naturally (6.9 before 6.10, 6.9.2 between
  them), then by line. "Across chapters" means what the writer means.
- **It writes:**
  - **a headline:** the one-line answer to the question;
  - **sections,** by chapter or by theme, whichever the question calls for.
- **Every claim cites instances by number** ("[#4, #12]"). The host keeps
  only citations to instances that exist, and drops a claim that cites none.
- **It quotes only what an instance quotes.** Any other quotation in the
  analysis is withheld, so it cannot slip in a line the text doesn't have.
- **The host's table is the source of truth for counts.** The pass is given
  each label's count, and the summary table beside the analysis shows them.
- **On by default, with a toggle** ("Organize the results"), so a writer who
  only wants the list skips the extra call.
- The results then read: headline, analysis, summary table, every instance.

## Personas run it (P2)

A persona asking for a passage search would start a paid fan-out, so it
asks, and the writer decides.

1. **The persona asks in a reply.** It writes a
   `<prose-minion-passage-search>` trailer holding the question and a scope,
   naming files the way `resource.read` does (the excerpt, a group, or files
   by group and path). It is read in `extractWorkshopReplyControls`' one
   pass, like the other trailers.
2. **A card shows the request:** the question, the scope, how many calls,
   and an estimated price, with **Run** and **Cancel**.
3. **Run starts the search on the host,** outside the persona's turn. The
   card shows progress and Stop.
4. **When it finishes, the persona is started with the results,** as a
   pressed edit offer starts its run (ADR 2026-11-10): a host directive
   carrying the headline, the analysis and the instances, fitted to the
   window (`reads/WorkshopReadWindowFit`), as neutralized evidence. The
   persona then answers the writer.
5. **The full report is a click away** on the card. It is the same result
   the Search tab shows, and it can be saved.

- **The price is never skipped.** Every persona request waits for Run.
- **The persona's own model doesn't do the reading.** The fan-out runs on
  the `passageSearch` scope. Only the results reach the room.
- **A Rewind that removes the request** removes its card. A search already
  run stays in the reports it was saved to.

## One engine, many callers (P3)

- **The engine is a core service** (say `PassageSearchService`), host-free
  and UI-free. It takes:
  - a question;
  - one or more scopes (P4);
  - options: organize or not, and the model it was priced for.

  It offers `estimate` (calls and price) and `run` (with a stop signal and
  progress). It returns a typed result: the checked instances, the labels
  and counts, the organizing pass's analysis, and what was dropped and why.
- **Callers own the consent.** The engine never asks the writer anything.
  - The sidebar confirms the price on a press.
  - A persona's request shows a card with Run (P2).
  - A future research agent ([Workshop Research
    Agent](../feature-workshop-research-agent/README.md), "a run policy,
    not a helper task") would call the same engine under its own consent
    rule.
- **Nothing in the engine names the sidebar, the Workshop or a persona.** A
  boundary test holds that, as `boundaries.test.ts` holds the helper's.

## Scopes: any project locations, several at once (P4)

- **A scope is one of:**
  - the active file;
  - a selection;
  - a context group (characters, locations, themes, things, chapters,
    manuscript, project brief, general): every file in it;
  - one file, by catalog key;
  - a path or pattern (the sidebar's field, writer-typed only).
- **A search takes several scopes at once**, such as chapters and
  characters, de-duplicated by file.
- **Files come from the shared catalog,** one per operation (the
  Workshop's catalog-per-operation rule), so a group means exactly what
  the picker shows.
- **A persona names groups or files by catalog key, never a free path or
  pattern.**
- **Bounds:** at most some number of files and calls per search, in
  `PROMPT_BUDGETS`. The estimate shows the count before anything is sent.

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
- **Bring to Workshop?** Sending a Search-tab result to a persona as a
  message attachment. P2 covers a persona asking; this would cover the
  writer starting from the sidebar. Leaning: later.
- **How a persona names chapters in a scope.** By group, by files, or by a
  pattern? Leaning: as `resource.read` names files, with a group meaning
  every file in it.

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
- [ ] The organizing pass reads only checked instances in the host's reading
      order (chapters sorted naturally), and writes a headline and sections.
      Citations to missing instances and quotes no instance holds are
      dropped (tests).
- [ ] A persona's request shows a card with the calls and price, and runs
      only on Run. The persona is then started with the results, fitted to
      the window (tests).
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
