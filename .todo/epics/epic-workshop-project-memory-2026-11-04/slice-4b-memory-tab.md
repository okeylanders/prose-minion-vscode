# Slice 4b: Memory Tab and Manager

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D5 (the estimate), D8 (the modes), D10 (manager operations), D13 (the handler); decided questions 1 (global mode) and 4 (pinned budget)
**Design:** `docs/design/workshop-project-memory/` (Slice 0d). **The design doc owns the layout, copy and states**; this doc owns the wiring.
**Status:** Waiting on Slice 0d (approved design), Slice 4a (panels split), Slice 2 (library reads, estimate) and **Slice 3** (the memory sheet and the write routes; PR #192 F-03).

## Outcome

Conversation settings gets a fourth tab, **Memory**. It has the three mode
cards, what loads at the start of each conversation, **Manage memories…**, and
**Open memory folder**. The manager lists every memory, unreadable and
conflicting files included. It can search, group, open a file, pin, archive and
delete, and it has **New memory**.

## Since 4a, Slice 2 and Slice 3

- 4a leaves one component per tab, with behavior and markup unchanged. The
  Memory tab is a new panel component beside them. The modal's shell gains one
  tab entry and its arrow-key order.
- Slice 2's library provides `catalog`, `estimateProjectMemoryFrame` and the
  mode read.
- **Slice 3 owns** the memory sheet (`WorkshopMemorySheet`, with Edit, Save to
  memory… and New modes), the library's writes, and the write routes on
  `WorkshopProjectMemoryHandler` (create, update, the proposal actions). This
  slice reuses them. It adds only the manager's routes (list, pin, unpin,
  archive, restore, delete, open file, open folder), on the same handler.

## Build

### Mode setting (D8, question 1: global)

- Manifest: `proseMinion.workshop.projectMemory`, enum `off | ask | auto`,
  default `off`, written globally like the other Conversation settings. There's
  no `SettingsStore` target and no port change. (Slice 2 may have added the
  entry; keep one.) A defaults sync test, like
  `workshopConversationBehaviorDefaultsSync.test.ts`, checks it.
- **The copy makes the split clear:** the switch applies to every project, and
  each project keeps its own memories (0d's design holds the words).
- The mode's draft joins the modal's apply-together footer, whose copy gains
  Memory. The settings round-trip (overlay ↔ VS Code settings ↔ webview) is
  tested as ADR 2025-11-03 requires.

### Memory tab

- It's a panel component under the shared conversation-settings folder from 4a,
  and a presentational one: it takes state and callbacks and posts nothing
  itself.
- It shows the mode cards, the "Memory isn't context" well (Slice 0d decision
  15), the estimate (labels `N memories`, `M in full`, `≈ T tokens`, and a
  meter each for "Loaded in full" and "Titles and summaries"), and the unavailable reason (no folder,
  several folders) when this workspace can't hold memory.
- **Unavailable never disables the mode cards** (ADR D8): the switch is global
  and still applies to every other project. Unavailable disables only this
  workspace's memory and the manager, with the reason.

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
  - list: every row carries an opaque `entryKey` (ADR D10, PR #192 F-02), a
    session-keyed HMAC of the file's contained path, like `LightboxFileKey`.
    Readable rows also carry their `mem-` id;
  - pin and unpin, by `mem-` id, refused past `pinnedTokens` (5,000, question 4)
    with the reason. The meter shows "about N of 5,000 tokens", and reads over
    budget ("about 5,600 of 5,000 tokens") when hand edits or another window
    have pushed it there;
  - archive and restore, by `mem-` id;
  - delete, by `mem-` id (claimed, with a confirmation);
  - new and edit: Slice 3's sheet and routes;
  - open the file, by `entryKey` only: resolved against the current contained
    listing, and refused when stale, forged or outside the folder. Open the
    folder through `ShellService`. The webview never sends a path.
- **Rows that can't be addressed by id.** Conflict rows (the id isn't unique)
  and unreadable rows (maybe no id) offer *Open file* only. No pin, archive,
  edit or delete action can reach them.
- **Doesn't fit in full** (ADR D5, F-04; the frame's "pinned, not loaded"):
  rows whose body didn't fit the loaded-in-full budget show that badge.
  Nothing is turned off automatically.
- **UI words** (Slice 0d decision 16): the manager's pin action is **Always
  load in full** (a toggle, the `eye` glyph), its badge **Loaded in full**.
  Routes, fields and tests may keep `pin`/`pinned`; no visible string says
  "pin".
- A presentation hook, `useWorkshopProjectMemory`, follows the tripartite
  interface, and its persistence is empty: the host owns the truth.

## Tests

- **Tab:**
  - modes render and post through the modal's apply;
  - the estimate matches the frame builder's output for a fixture folder;
  - the unavailable states: with no folder, and with several, the mode cards
    stay enabled and a change still writes the global setting, while the
    estimate, *Manage memories…* and *Open memory folder* are disabled with
    the reason.
- **Manager:**
  - each action through the real handler and library, on a temporary folder;
  - unreadable and conflict rows never offer pin, archive or edit;
  - the pin refusal past budget;
  - over-budget state from hand edits: the meter reads requested over budget
    ("Set to load in full · 4 · 1 doesn't fit", "about 5,600 requested of
    5,000 tokens"), the labels separate set from loaded ("4 set to load in full ·
    3 loaded"; Slice 0d decision 17, PR #196 F-05), and the right rows
    show "Doesn't fit in full", matching what the frame loaded for the same
    folder;
  - entry handles (F-02): two files sharing one id each open their own file; a
    malformed file with no id opens; stale, forged and out-of-folder keys are
    refused; conflict and unreadable rows can't be pinned, archived, edited or
    deleted through any route;
  - Delete of a newer memory revives the one it superseded, while Forget and
    archive don't (N-01);
  - request correlation ignores a stale answer.
- **Shared components:** the Workshop session browser's tests run unchanged.
- **Settings:** the mode writes globally, and the round trip holds.

## Completion Criteria

- [ ] The Memory tab matches the approved design.
- [ ] The writer can turn memory on and off, and sees the cost before it loads.
- [ ] The manager does every listed action, through claimed writes, and shows
      unreadable files without touching them.
- [ ] Every row opens by its entry handle; mutations go only by a unique
      `mem-` id.
- [ ] The meter and the "Doesn't fit in full" rows agree with the frame.
- [ ] The modal stays under 500 lines, and the new files do too.
- [ ] The epic's per-slice verification passes, with counts recorded here.
