# Feature: Show Personas Every Memory's Title

**Date Identified:** 2026-11-17
**Status:** In the Everyday Conveniences, Round Two epic (item C) since 2026-11-17, on `epic/everyday-conveniences-round-two`. With the size setting (decision T1). The epic README there records progress and the defaults taken.
**Priority:** Medium
**Origin:** Okey, 2026-11-17, from the Memory tab (81 memories: 2 load in full, 26 of 79 fit the list, 53 searchable only)

## In Okey's words

> I've already exceeded what's included in the default memory load in the
> initial prompt. Does the model know there are more available? I wonder if
> we should also add something to ping the model there are more memories and
> if it thinks necessary pull the full title index? Or a setting that rides
> along the recommendation setting like: include full memory titles and
> summary (within limit), include titles for all memories (excludes
> summaries), include summaries and titles truncated at 5K chars, 10K, 20K…

## What the persona sees today

- **A count, not names.** The `<project-memory>` block ends with
  `<more count="53">More notes, older, superseded or archived: memory.catalog, memory.search.</more>`
  (`ProjectMemoryCatalogFrame.ts`), and the capability prompt explains it.
  So the persona knows more exist. But it can't tell whether any of them
  bears on the question, so it has no reason to look, and the prompt says
  "Do not look routinely".
- **The wording undersells them.** `more` counts every note not shown, so
  the 53 live notes are lumped in with superseded and archived ones. "Older,
  superseded or archived" reads like leftovers.
- **Search needs the right words.** `memory.search` matches word beginnings.
  A persona can find a note only by guessing the words it holds.
- **`memory.catalog` can't list them either.** It shows at most
  `catalogEntries` (40), pinned first, then newest, with no paging
  (`renderWorkshopProjectMemoryCatalog`). With 79 notes in effect, the oldest
  39 can be reached only by search, or by a `<kind>` catalog when that kind
  holds 40 or fewer. So a persona that *wants* the full title index can't
  get it.

## Idea

### 1. Titles for the rest (the table of contents)

The block gains a third tier after the summaries:

| Tier | Holds | Budget |
|---|---|---|
| Loaded in full | pinned bodies (as now) | `pinnedTokens` (5,000) |
| Titles and summaries | the newest that fit (as now) | `catalogTokens` (2,000) |
| **Titles only** | **every other note in effect**, newest first, its id and kind on each line | a new `titleTokens` |

- **Then `<more>` counts only superseded and archived notes,** worded
  apart from the live ones.
- **It's cheap.** An entry with its summary costs about 77 tokens. A title
  line costs about 20 to 25. Okey's 53 unlisted notes come to about 1,200
  tokens, so the whole index of 81 is about 3,600 tokens against today's
  2,400. The
  first message is prompt-cached on the models that support it
  (`OpenRouterPromptCachePolicy`), so resending it each turn costs little
  there.
- **Deterministic,** like the rest of the block: the same folder gives the
  same bytes, so the cache holds.
- **The prompt changes by one sentence:** a title that bears on what the
  writer raised is a reason to read that note. Looking stays targeted, not
  routine.

### 2. Let the persona walk the whole index

`memory.catalog` gains a page: `<page>2</page>`. Its "N more notes" line
names the exact next call, which decodes as written (the recall rule:
every hint makes progress). This also reaches notes saved after the
conversation began, which the block never shows, and covers a folder large
enough to fill the titles tier too.

### 3. One size setting, in tokens

A **"List at the start of each conversation"** setting on the Memory tab,
beside "Suggest notes":

| Size | Titles and summaries | Titles only |
|---|---|---|
| **Standard** (default) | 2,000 tokens (today) | up to 2,000 tokens, about 80 titles |
| **Larger** | 5,000 | up to 3,000 |
| **Largest** | 10,000 | up to 4,000 |

The tab's meters already read the renderer, so they follow the setting,
with a third bar for titles.

**Why not Okey's five options as written:**

- **Tokens, not characters.** The tab already speaks tokens ("about 2,000
  of 2,000 tokens"). A second unit would make the meters and the setting
  disagree.
- **Truncating titles and summaries at 5K, 10K or 20K characters** cuts the
  oldest notes off again, only later. At 20K characters about 65 entries
  fit, and memory keeps growing. Titles scale about three times better.
- **"Titles only for all notes"** drops the summaries on the newest notes,
  the ones most likely to matter.
- **The layout is fixed and only its size moves,** so there's one knob,
  not modes that combine.

## Decisions (Okey, 2026-11-17)

| # | Decision | Notes |
|---|---|---|
| T1 | **The size setting ships with the rest, and each size grows both buckets:** titles and summaries, and titles only. | The table above. It is an amendment to [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) (D1 the catalog, D5 the frame), not a new ADR. |

## Open questions

- **Titles tier on by default?** Leaning yes: it only appears once the list
  overflows, and it costs about a quarter of what summaries do.
- **Order of the titles tier.** Newest first, as the list (leaning), or
  grouped by kind (decisions, canon, themes…), which scans more easily?
- **When a size change applies.** The block is built once per conversation,
  so a change applies to the next conversation. The tab's footer should say
  so.
- **Small-context models.** "Largest" spends more of the window before the
  excerpt and context. The preflight already guards the request; the tab
  could warn when the chosen size is a large share of the model's window.

## Completion Criteria

- [ ] With more notes in effect than the list holds, the block lists every
      other note's id, kind and title within the titles budget, and `<more>`
      counts only superseded and archived notes (test).
- [ ] The block is still byte-identical for the same folder (test).
- [ ] `memory.catalog` pages through every note in effect; its continuation
      line decodes as written, and following it reaches the end (test).
- [ ] The prompt's description of the block, `<more>` and the catalog's page
      is held to the renderer and `PROMPT_BUDGETS` by a sync test.
- [ ] The size setting grows both buckets at each size (T1). The tab's
      meters and the block agree at every size (they read one renderer), and
      a change applies from the next conversation.

## Related

- [ADR 2026-11-04: Workshop Project Memory](../../../docs/adr/2026-11-04-workshop-project-memory.md)
  (D1 the catalog, D5 the frame)
- [How Readily Personas Suggest Memories](../feature-workshop-memory-suggestion-level/README.md):
  its partner on the Memory tab.
- [Workshop Reads Fit the Window](../feature-workshop-reads-fit-the-window/README.md):
  the `memory.read` fit, still open.

## Related Files

- `packages/core/src/application/services/workshop/memory/ProjectMemoryCatalogFrame.ts`
  (the block, `<more>`)
- `packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryRenderer.ts`
  (`renderWorkshopProjectMemoryCatalog`)
- `packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryXmlCodec.ts`
  (`<page>`)
- `packages/core/resources/system-prompts/workshop-personas/project-memory-capability.md`
- `packages/core/src/shared/constants/promptBudgets.ts` (`workshopProjectMemory`)
- `packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryTabView.ts`
  (the meters and the "searchable" line)
