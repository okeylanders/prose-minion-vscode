# Feature: Two-Tab Workshop Rail

**Date Identified**: 2026-10-27
**Source**: Brainstorm with Okey (Workshop sidebar batch)
**Status**: Idea
**Priority**: Medium

> One of four related notes from the same brainstorm. This one owns the rail
> layout. The other three add to it or sit beside it:
> [Read-In Material](../feature-workshop-rail-read-in/README.md),
> [Thread Bookmarks](../feature-workshop-thread-bookmarks/README.md), and
> [Model Slices](../feature-workshop-model-slices/README.md).

**Planning render**: [Workshop Rail Planning canvas](https://claude.ai/artifact/UBUrNmVPeZkeT5MEXf4T6M)
(private to Okey). It shows today's rail, the proposed two tabs with working tab and
Bookmark toggles, the reader sheet, and the time and model slices.

## Problem

The Workshop rail (`<aside className="pm-ws-rail">` in `WorkshopApp.tsx`)
stacks four blocks in one scrolling column:

1. Excerpt (`ExcerptPanel`)
2. Context attachments (`ContextPanel`)
3. Tools: six favorites plus "All N tools…" (this is the `pm-ws-block-grow` block)
4. To-dos (`WorkshopTodoList`)

The two ideas in this batch would add two more growing lists: material a
persona read in, and bookmarked bubbles. Six stacked blocks in a narrow
column means a lot of scrolling and no clear sense of place.

## Proposal

Add file-style tabs at the top of the rail and retire the rail's Tools block.

| Tab | Contents |
|---|---|
| 1. Excerpt and context | Excerpt, context attachments, read-in material |
| 2. To-dos and bookmarks | To-dos, bookmarks |

The split follows a real line. Tab 1 is the material the room works *on*.
Tab 2 is what the room has *produced* or the writer wants to come back to.

## Retiring the Rail Tools Block

**What covers it today:**

- The composer's tool button (`WorkshopComposer` → `onOpenTools`) opens the
  full tools modal. It also works when there's no excerpt: its title switches
  to "Ask your host to run a tool". The rail block is gated with a "needs
  excerpt" badge, so the composer is already the more capable entry point.
- The empty thread states still offer quick-start tools
  (`EMPTY_STATE_TOOL_IDS`), so new writers still discover tools.

**What's lost:**

- One-click access to the six favorites. It becomes two clicks (button, then
  the modal row).
- The rail's active-tool highlight (`selectedToolId`).
- The approved Direction B layout. `RAIL_TOOL_IDS` cites
  `pm-direction-b.js` `railTools` as approved design. Update that comment and
  the design reference when the block goes. Otherwise a future review will
  "restore" the block to match the prototype.

**Verdict:** retire it. It's the largest block in the rail, it duplicates the
composer, and the space is worth more as list room. Following the alpha
guidelines, delete `RAIL_TOOLS`, the gating copy that only the rail uses, and
the related styles outright. Don't hide them behind a flag.

## Design Notes

- **Don't hide news behind a closed tab.** When the host proposes a to-do, or a
  persona reads something in, the inactive tab shows a count badge ("2 new").
  Never switch tabs automatically. That would yank the writer's view mid-thought.
- **Remember the last tab per viewer.** This is a UI preference, so it goes in
  webview persisted state through `usePersistence`. It does not go in the
  session file. A reopened session shouldn't dictate which tab you see.
- **Entry points must switch tabs first.** Any action that targets a rail panel
  by id (for example `WORKSHOP_CONTEXT_PANEL_ID`, or a future "show bookmarks")
  must select that panel's tab before it scrolls or focuses. Every rail panel is
  visible today, so no current code expects a hidden one.
- **Accessibility:** `role="tablist"` / `tab` / `tabpanel`, roving tabindex
  with arrow keys, `aria-controls` and `aria-selected`, and badge counts in
  the tab's accessible name.
- **Tab labels:** the code calls excerpt plus context the "working set"
  (`hasWorkingSet`, "reset working set"). The term is accurate but it's jargon
  for writers. The rail is narrow, so short labels with icons will fit better
  than "Excerpt and context" / "To-dos and bookmarks". Candidates: "Material"
  / "Notes", or "Passage" / "Notes". Okey's call.

## Architecture

`WorkshopApp.tsx` is about 1,800 lines, and the rail JSX is inline in it.
Extract `WorkshopRail.tsx` as part of this work, not as a later cleanup:

- `WorkshopRail` owns the tab strip and the two panels, and keeps the rail's
  existing `ErrorBoundary`.
- A small controller under `hooks/domain/workshop/controllers/` (for example
  `useWorkshopRailTabs`) owns tab state and badge "seen" counters. It follows
  the tripartite interface, and its persistence is the last-selected tab. As a
  controller, it never touches `MessageType` or `postMessage`.
- No host or contract changes. This feature is presentation only.

## Sequencing

1. **Tabs and Tools retirement.** Layout only, no contract change.
2. **Read-in list** in tab 1. The v1 list needs no contract change.
3. **Bookmarks** in tab 2. This adds a session contract, and its persistence
   decision is shared with [Model Slices](../feature-workshop-model-slices/README.md#forward-compatibility-the-hard-part).

## Open Questions

- Is the two-tab split right, or should bookmarks share tab 1, with tab 2 kept
  for to-dos?
- Do the composer's context and tool buttons stay as they are, or does the rail
  get a slim "+" affordance per tab?
- Should a collapsed-rail mode come with this work (an icon strip with badges)?

## Related Files

- `packages/core/src/presentation/webview/WorkshopApp.tsx`: rail markup,
  `RAIL_TOOL_IDS`, `EMPTY_STATE_TOOL_IDS`
- `packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx`
- `packages/core/src/presentation/webview/components/workshop/ContextPanel.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTodoList.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx`:
  the tool and context buttons that replace the rail block
- `packages/core/src/presentation/webview/styles/workshop/shell.css`: `.pm-ws-rail`
- `docs/design/pm-direction-b.js`: approved rail tools (update the reference)
- `packages/core/src/__tests__/presentation/webview/WorkshopApp.test.tsx`

## Completion Criteria

- The rail renders two tabs with correct ARIA roles and keyboard navigation.
- The rail Tools block and its rail-only gating code are deleted. The composer
  tool button and empty-state quick starts still run every tool.
- An inactive tab shows a badge when new items arrive in it and never switches
  on its own.
- The last-selected tab survives a webview reload and doesn't come from the
  session file.
- The rail lives in its own component, and `WorkshopApp.tsx` shrinks by the
  rail's size.
- Tests cover tab switching, badges, and an entry point that has to switch tabs
  before it focuses a panel.
