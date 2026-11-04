# Slice 4b: Memory Tab and Manager

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D5 (the estimate), D8 (the modes), D10 (manager operations), D13 (the handler); open questions 1 and 4
**Design:** `docs/design/workshop-project-memory/` (Slice 0d). **The design doc owns the layout, copy and states**; this doc owns the wiring.
**Status:** Waiting on Slice 0d (approved design), Slice 4a (panels split) and Slice 2.

## Outcome

Conversation settings gets a fourth tab, **Memory**. It has the three mode
cards, what loads at the start of each conversation, **Manage memories…**, and
**Open memory folder**. The manager lists every memory, unreadable and
conflicting files included. It can search, group, open a file, pin, archive and
delete, and it has **New memory**.

## Since 4a and Slice 2

- 4a leaves one component per tab, with behavior and markup unchanged. The
  Memory tab is a new panel component beside them. The modal's shell gains one
  tab entry and its arrow-key order.
- Slice 2's library provides `catalog`, `estimateProjectMemoryFrame` and the
  mode read. Slice 3's provides the writes.

## Build

### Mode setting (D8, open question 1)

- Manifest: `proseMinion.workshop.projectMemory`, enum `off | ask | auto`,
  default `off`, with a scope that follows the writer's answer to question 1.
  A defaults sync test, like `workshopConversationBehaviorDefaultsSync.test.ts`,
  checks it.
- **If per project:**
  - `SettingsStore.update(section, key, value, target?)` gains
    `'global' | 'workspace'`;
  - `VsCodeSettingsStore` maps the target to `ConfigurationTarget`;
  - every other host adapter and fake implements it;
  - only this setting passes `'workspace'`.

  Record this as its own commit.
- The mode's draft joins the modal's apply-together footer, whose copy gains
  Memory. The settings round-trip (overlay ↔ VS Code settings ↔ webview) is
  tested as ADR 2025-11-03 requires.

### Memory tab

- It's a panel component under the shared conversation-settings folder from 4a,
  and a presentational one: it takes state and callbacks and posts nothing
  itself.
- It shows the mode cards, the estimate ("N memories · M pinned · about T tokens
  at the start of each conversation"), and the unavailable reason (no folder,
  several folders) when memory can't save.

### Manager

- `WorkshopMemoryBrowserModal` composes `SavedItemBrowserModal` and
  `SavedItemRow` (`components/fulltab/`, Lightbox Slice 5A.2). The shared
  components' Workshop markup must stay identical: their opt-ins only.
- Rows show title, kind, summary, updated, pinned, and status (active,
  superseded, archived). Unreadable and conflicting files get their own rows with
  the reason, plus **Open file** only.
- Actions are routes on `WorkshopProjectMemoryHandler`, correlated by a
  webview-minted `requestId` the host echoes, as the Lightbox's catalog routes
  are:
  - list;
  - pin and unpin, refused past `pinnedTokens` with the reason (question 4);
  - archive and restore;
  - delete (claimed, with a confirmation);
  - new;
  - edit (the Slice 3 sheet);
  - open the file and open the folder (through `ShellService`, by id, never a
    path from the webview).
- A presentation hook, `useWorkshopProjectMemory`, follows the tripartite
  interface, and its persistence is empty: the host owns the truth.

### INDEX.md

Only if the writer answers yes to open question 2. Otherwise nothing here.

## Tests

- **Tab:**
  - modes render and post through the modal's apply;
  - the estimate matches the frame builder's output for a fixture folder;
  - the unavailable states.
- **Manager:**
  - each action through the real handler and library, on a temporary folder;
  - unreadable and conflict rows never offer pin, archive or edit;
  - the pin refusal past budget;
  - request correlation ignores a stale answer.
- **Shared components:** the Workshop session browser's tests run unchanged.
- **Settings port** (if widened): adapter target mapping, and only this setting
  writes to the workspace.

## Completion Criteria

- [ ] The Memory tab matches the approved design.
- [ ] The writer can turn memory on and off, and sees the cost before it loads.
- [ ] The manager does every listed action, through claimed writes, and shows
      unreadable files without touching them.
- [ ] The modal stays under 500 lines, and the new files do too.
- [ ] The epic's per-slice verification passes, with counts recorded here.
