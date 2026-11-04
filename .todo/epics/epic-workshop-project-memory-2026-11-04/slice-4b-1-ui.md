# Slice 4b-ui: Memory Tab and Manager, Presentation Only

**Epic:** [Workshop Project Memory](README.md)
**Part of:** [Slice 4b](slice-4b-memory-tab.md) (4b-ui; 4b-wire follows Slice 3)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) D5, D8, D10
**Design:** Slice 0d's doc and `docs/design/workshop-project-memory/` (PR #196, merged); the design owns layout and copy
**Branch:** `epic/workshop-project-memory-slice-4b-ui`, from Slice 2a at `7ec50ba`, with the epic (#196 merged, `913e715`) merged in
**Status:** Done. Pushed; waiting on the coordinator's PR. 4b-wire waits on Slice 3.

## Scope

The Memory tab and the memory manager as tested components and pure view
models, with **no host wiring**: no route, no hook, no `postMessage`, no
`MessageType`, no message contract. Every action is a callback prop. The tab
is not registered in `WORKSHOP_CONVERSATION_SETTINGS_TABS`, and Edit and New
memory only call back (Slice 3 owns the sheet).

## Built

### View models (`presentation/webview/hooks/domain/workshop/memory/`)

- **`workshopMemoryViewInputs.ts`:** the presentation-owned shapes 4b-wire
  maps the library's answers into.
  - The frame estimate, the workspace (`loading | available | unavailable |
    unknown`), unreadable files, conflicts (one entry per file, each with
    its own `entryKey`), and a memory row.
  - A row carries its host `entryKey` and its `mem-` id, its derived
    `superseded` / `supersededBy` and `busy`, and `fullLoad`
    (`loaded | doesnt-fit | null`), the builder's own result.
  - `WORKSHOP_MEMORY_BUDGETS` reads `pinnedTokens`, `catalogTokens` and
    `CONTEXT_ATTACHMENTS.words` from `PROMPT_BUDGETS`.
- **`workshopMemoryTabView.ts`:** the tab's words and figures for every
  canvas state: on, off, empty (Ask first and Save and tell me), the list
  over its budget, set to load in full over its budget (decision 17),
  unreadable files, and unavailable with no folder or several folders. It
  also covers three states the canvas doesn't draw (see Deviations).
- **`workshopMemoryManagerView.ts`:**
  - the status labels, the off note, and the over-budget line naming what
    doesn't fit;
  - Needs attention rows, Active rows and Superseded and archived rows;
  - grouping by kind or by date (the shared `savedItemGroups` buckets);
  - the rename title rule (one non-empty line, at most 120 characters).
- **`workshopMemoryWords.ts`:** shared words:
  - "about N" rounding (tens under 1,000, hundreds above; an over-budget
    figure rounds up, so it never reads as within budget);
  - origin words (decision 12) and source words;
  - the UTC day;
  - every codec reason in words, with a plain fallback for a reason this
    build doesn't know.

### Components

- **`settings/WorkshopMemorySettingsPanel.tsx`:**
  - The panel's content: the unavailable notice, the "Memory isn't context"
    well (a `dl`, numbers from the budgets), the three mode cards
    (`OptionCard`; Ask first tagged Recommended), the start-of-conversation
    row with its chips, two meters and the amber lines, the folder row, and
    the unreadable row with Show in manager.
  - Meters are `role="meter"` with `aria-valuenow` / `aria-valuemax` and a
    full `aria-valuetext`.
  - Disabled buttons point `aria-describedby` at the unavailable notice.
  - `WORKSHOP_MEMORY_SETTINGS_TAB_IDS` gives 4b-wire the tab entry's label,
    ids and panel class.
  - Callbacks: `onSelectMode`, `onOpenManager` (Show in manager uses it
    too), `onOpenFolder`.
- **`memory/WorkshopMemoryBrowserModal.tsx`:**
  - The manager on `SavedItemBrowserModal`, with the Lightbox's opt-ins
    (`renameRule`, `sendOnlyEdits`, `returnFocus`) and the new
    `afterSection` for Superseded and archived. Needs attention is the
    browser's `leading` section.
  - Rows are keyed by `entryKey`. Rename and delete map the key to the
    `mem-` id before they call back.
  - Callbacks: `onQueryChange`, `onRename`, `onDelete`, `onEdit`,
    `onRestore`, `onArchive`, `onToggleLoadInFull(id, loadInFull)`,
    `onOpenFile(entryKey)`, `onOpenFolder`, `onNewMemory`, `onClose`.
  - The search is the host's, as the session browser's is: the webview
    holds no note bodies.
- **`memory/WorkshopMemoryRow.tsx`:**
  - A memory's row is `SavedItemRow`, with its own utilities: Always load
    in full (`eye`, `aria-pressed`), Archive (active rows only) and Open
    file. Its primary action is Edit, or Restore on an archived row.
  - A file that needs attention uses the same row classes with **Open file
    only**: no rename, Always load in full, archive, edit or delete can
    reach it.
- **Shared, by opt-in or optional prop only:**
  - `SavedItemBrowserModal.afterSection`: a second, ungrouped section of the
    same markup, whose rows share the list's rename, delete and focus order.
    Without it the markup is unchanged.
  - `OptionCard.tag`.
  - `iconPaths`: `archive` and `circleSlash` (the design's two new glyphs).
- **`styles/workshop/memory.css`:** memory's own rules on the existing
  tokens, imported from `WorkshopApp.tsx` after `schematic.css`
  (`workshopStyles.test.ts` lists it). Below 760px the well's grid and the
  tab's rows stack (0d open question 3).

## Deviations

1. **The estimate needs two more fields from Slice 2a.** The design states
   the tokens of the bodies that loaded ("4,400 of 5,000 loaded") and how
   many list entries fit ("25 of 37 fit"). 2a's `ProjectMemoryFrameEstimate`
   has neither, and neither can be derived. `WorkshopMemoryFrameEstimate` is
   2a's seven fields plus `pinnedLoadedTokens` and `catalogEntries`.
   4b-wire, or a 2a follow-up, adds them to the estimate from the renderer
   (`pinnedSpent` and `entries.length`). The list's candidate count is
   derived as `memories − pinnedLoaded`.
2. **The shared browser gained one opt-in** (`afterSection`). The design
   said none was needed, but the browser has a single grouped section, and
   the manager needs a third, ungrouped section whose rows keep the shared
   rename and delete-confirm flow (PR #196 watchpoint 6). The Workshop's and
   the Lightbox's browser tests run unchanged.
3. **Needs-attention rows are not `SavedItemRow`.** It always draws Rename
   and Delete (except for `current`, which also highlights the row). They
   use its classes and markup with Open file alone, rather than adding a
   second opt-in.
4. **States the canvas doesn't draw.** The words are mine, for the design
   pass to confirm:
   - reading ("Reading this project's memories…");
   - the folder couldn't be listed ("This project's memories couldn't be
     read");
   - nothing in effect ("Nothing loads yet": every memory is superseded or
     archived);
   - a memory another window holds (badge "Being edited", writes off;
     D10, N-02).
5. **Source words** (watchpoint 5).
   - The canvas's "made in the manager" isn't used: format 1 can't tell a
     manager-made memory from a hand-written file. A memory without a source
     session reads "no source conversation".
   - One whose session can't be named reads "from a conversation that isn't
     saved".
6. **The tab's attention row includes conflicts.** The row lists conflicting
   files too ("same id as another file"), and its title becomes "N files
   need attention" when any are present. With unreadable files alone it
   reads as drawn ("2 files can't be read").
7. **Rename** is a callback (`onRename(id, title)`), because the design's
   row offers it. It is a title edit, which Slice 3's write routes own.
8. **`WorkshopApp.tsx` grew by one line.** It was already 1,740 lines; the
   new line is the CSS import, at the composition point
   `workshopStyles.test.ts` requires. Every test that renders `WorkshopApp`
   mocks each Workshop stylesheet by path, so the 22 such tests each gained
   one `jest.mock` line for `memory.css`, beside their `schematic.css` line.

## For 4b-wire

- Register the tab: add `'memory'` to `WorkshopConversationSettingsTab` and
  an entry from `WORKSHOP_MEMORY_SETTINGS_TAB_IDS` between About you and
  Advanced, then add the panel to the modal's `panels` record.
- The mode draft joins the apply-together footer, whose copy gains Memory
  (0d: "Applies the Behavior, About You, Memory, and Advanced drafts
  together. Memory and live web research take effect on your next
  message."). The header copy gains "what they remember about this project".
- Map the library's listing and estimate into the view inputs. `fullLoad`
  comes from the frame's `pinnedLoaded` ids, never from dates.
- Open the manager over the settings modal (0d open question 2). Opening it
  must not discard or commit the drafts (watchpoint 2).

## Verification

Node 22, on this branch:

| | Suites | Tests | Snapshots |
|---|---|---|---|
| Before (`7ec50ba`) | 652 | 9,228 | 59 |
| After | 658 | 9,292 | 59 |

- `npm ci`, then `npm run typecheck`: clean.
- `npm run lint`: 0 errors. 12 new warnings, all `naming-convention`:
  - six PascalCase React component names: `WorkshopMemorySettingsPanel`,
    `MemoryMeter`, `WorkshopMemoryBrowserModal`, `WorkshopMemoryRow`,
    `WorkshopMemoryAttentionRow`, and the tests' `Harness`;
  - six kebab-case keys of the domain's own vocabularies (`no-workspace`,
    `multi-root` and `open-thread`, twice each).
- `webviewCssFloor.test.ts` and `workshopStyles.test.ts` pass.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines (the largest is `workshopMemoryTabView.ts`, at
  354). `SavedItemBrowserModal.tsx` went from 403 to 427 lines.
- New tests:
  - the view models (tab, manager, words);
  - the panel;
  - the manager modal, including focus returning to its opener and a check
    that no visible string or accessible name says "pin";
  - the shared browser's `afterSection`.
- Fixtures use *Alice* and made-up names.
