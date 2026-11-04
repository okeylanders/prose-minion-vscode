# Slice 4b-wire: Memory Tab and Manager, Wired to the Host

**Epic:** [Workshop Project Memory](README.md)
**Part of:** [Slice 4b](slice-4b-memory-tab.md), after [4b-ui](slice-4b-1-ui.md) (PR #199, merged)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) D5, D8, D10, D13
**Branch:** `epic/workshop-project-memory-slice-4b-ui`, fast-forwarded to Slice 3's head (`cbb1446c`, #200 with the epic and #199 merged in). The branch name is my session's designated one (see Deviations).
**Status:** PR #202. Astra's review (`docs/pr-reviews/pr-202-project-memory-manager-review.md`) found F01–F04 and N01–N02; all six are fixed (see Review fixes). The re-review at `d57734ac` closed F02, F04, N01 and N02 and narrowed F01 and F03, now fixed again (round 2). Slice 5 (#201) is merged in.

## Scope

The coordinator's brief:
- mount the Memory tab, with the mode as a fourth apply-together draft;
- the manager's host routes, beside Slice 3's handler;
- the estimate's two fields and per-id residency, from the renderer;
- `entryKey`, distinct for a set-aside copy;
- the presentation hook, composed into `WorkshopApp`;
- the tests.

## Built

### Host

- **The estimate** (`ProjectMemoryFrameEstimate`, `ProjectMemoryCatalogFrame`):
  `pinnedLoadedTokens` (the loaded bodies' tokens, never past the budget) and
  `catalogEntries`, straight from the renderer.
- **`ProjectMemoryManager`** (`application/services/workshop/memory/`), composed
  by the library as its writes are, so no new service is threaded through
  `CoreServices`:
  - **Listing.** The folder for the tab and the manager:
    - standing from `listProjectMemories`, so it follows #197's accepted links;
    - the estimate and each memory's `residency` (`full`, `listed` or
      `searchable`) from `renderProjectMemoryFrame` over the same set;
    - `fullLoad` for each pinned memory in effect;
    - each source session's title through recall (`unnamed` when it can't be
      named, `none` when there is none);
    - the persona's display name.
  - **Search** is host-side over titles, summaries and notes (recall's
    rules). Files that need attention are always listed.
  - **Open file** resolves an `entryKey` against a fresh listing. A
    malformed, stale or forged key opens nothing (`stale`). A set-aside copy
    has no file of its own (`set-aside`).
  - **Folder.** `ProjectMemoryStore.ensureFolder()` creates it for Open
    memory folder.
- **`ProjectMemoryEntryKey`** (`infrastructure/storage/`): a session-keyed
  HMAC over the row's kind (`memory`, `file` or `set-aside`) and its
  contained path, on the `LightboxFileKey` precedent. A set-aside copy and
  the standing file beside it never share a key.
- **`ProjectMemoryWrites`** gains two writes, both in its single-writer queue
  (Slice 3 F-04):
  - `setPinned(id, pinned)` changes only `pinned`, read under the store's
    claim, and leaves `updated` alone. Turning it on is budget-checked as an
    edit is.
  - `remove(id)` is the store's claimed delete with `verify`. Its refusals are
    their own type (`ProjectMemoryDeleteRefusalReason`, `changed` added), so
    Slice 3's refusal table is untouched.
  - The library passes them through as `setLoadInFull` and `remove`, beside
    `managerListing`, `managerFile` and `memoryFolder`.
- **`WorkshopProjectMemoryManagerHandler`** (a sibling route owner composed in
  `WorkshopSliceComposition`):
  - `WORKSHOP_MEMORY_LIST` answers `WORKSHOP_MEMORY_LISTING`.
  - `WORKSHOP_MEMORY_MANAGER_ACTION` (`set-load-in-full`, `delete`,
    `open-file`, `open-folder`) answers `WORKSHOP_MEMORY_MANAGER_RESULT`, in
    the writer's words.
  - Neither changes the room (no receipt, no snapshot), so both are direct
    routes, off the gate.
  - The contracts are `shared/types/messages/workshop/projectMemoryManager.ts`.
  - **Slice 3's handler is unchanged.** Archive and Restore use its
    `WORKSHOP_MEMORY_FORGET`, so their receipts stand. Rename uses its
    request-edit then update. Edit and New open its sheet.
- **The mode's round trip.**
  - `WorkshopSetConversationSettingsPayload.projectMemory` carries the
    tab's draft.
  - `WorkshopConversationSettingsService.applyFromWebview` writes it to
    `proseMinion.workshop.projectMemory` first, so the prompt rebuild sees the
    new mode, and reports a write VS Code refuses.
  - `getProjectMemoryMode()` rides the session state
    (`WorkshopSessionStatePayload.projectMemory`; absent reads as Off).
  - The existing settings watcher already re-reads an edit made in VS Code
    Settings.

### Webview

- **The tab is registered.** `WORKSHOP_CONVERSATION_SETTINGS_TABS` now reads
  Behavior · About you · Memory · Advanced. The modal renders the Memory
  panel with a `memoryDraft` that joins the apply and its pending-settle
  check. The header and footer copy follow Slice 0d.
- **`useWorkshopMemoryManager`** (tripartite; persistence empty):
  - the listing, correlated by request id;
  - the manager's open state and search;
  - every row action, with the refused Always load in full on its row and
    other refusals as an alert.
  - Slice 3's `WORKSHOP_MEMORY_WRITE_RESULT` and `WORKSHOP_MEMORY_EDIT_DATA`
    fan out in `useWorkshopAppMessageRouter` to both memory hooks, and each
    takes only its own requests.
- **`WorkshopMemoryManagerMount`** renders the manager after Conversation
  settings and before Slice 3's sheet. The manager therefore stacks over the
  settings, which keep every draft (watchpoint 2), and the sheet stacks over
  the manager.
- **`workshopMemoryListingInputs`** (pure) maps the listing into the tab's
  and the manager's inputs. 4b-ui's view inputs now alias the wire shapes,
  so the two can't drift.

## Review fixes (PR #202)

- **F01: Delete checks the workspace at its commit points.** The shared
  `StoredFileClaims.deleteClaimed` takes `stillPermitted` and asks it
  synchronously, with nothing awaited after, before it retires leftovers
  and again before it removes the claimed bytes. The store asks that its
  folder is still the one it read, and the library's `beforeCommit` that
  the room's scope holds. Withdrawn, the file goes back under its name and
  the delete is refused with the workspace's reason. The Lightbox's calls
  pass no check and are unchanged.
  **Round 2:** the library's `remove` captures the workspace's identity
  (live room and memory folder) at the request, before either queue can
  wait, and the store compares its turn and every commit point with that
  folder. A copied project with the same id and file name is never deleted
  for a request about another.
- **F02: the manager's answers stay with their root.** `moved(directory)`
  compares the scope and the store's folder now with the folder the rows
  were read for, after each await (the queued list, the titles, making the
  folder). A root that moved, A to B included, lists nothing, opens no file
  and reveals no folder.
- **F03: a failed apply sets the mode back.** The previous mode is written
  back before the error is rethrown. A refused rollback raises
  `WorkshopConversationSettingsPartialApplyError`, and the room handler
  says which mode stands ("Project memory is now Save and tell me: it
  couldn't be set back. Your other previous settings are still active.").
  **Round 2:** the undo is the apply's own write only
  (`WorkshopProjectMemoryModeSetting`): it writes back what it wrote over,
  only while the setting still holds what it wrote, so a newer choice made
  in VS Code Settings stands and the watcher's sync rebuilds for it.
- **F04: Open memory folder says why where it was pressed.** The hook keeps
  the folder's own status (pending, and the newest press's refusal). The
  Memory tab marks the button busy and shows the refusal beside it. A retry,
  or closing the settings, clears it; the manager's alert shows it only
  while the manager is open.
- **N01:** WorkshopApp tells the hook when Conversation settings open and
  close (`setSettingsVisible`). Another hook's write refreshes the listing
  while the manager or the settings show it.
- **N02:** a saved card's Open in manager opens the manager with that
  memory's row marked (`aria-current`, an accent edge) and scrolled to.

## Deviations

1. **The branch.** My session may push only to
   `epic/workshop-project-memory-slice-4b-ui`. Follow-up work on a merged
   branch restarts that same name from the new base, so I fast-forwarded it
   (no force) instead of creating `…-slice-4b-wire`. If Okey wants the other
   name, he can say so in this session.
2. **The base.** I built on `cbb1446c` (your `47999208` plus one docs-only
   commit).
3. **Rename** is Slice 3's request-edit then whole-draft update: the same
   read-then-write the sheet's Edit does. Another window's edit between the
   two is overwritten, as with the sheet. Always load in full and Delete
   avoid this because they are single atomic writes. PR #202's review
   suggested a title-only host write. It is left out because a title change
   writes a receipt (D7), so a title-only write belongs with the receipt
   path, not this PR. It is tracked in
   [`.todo/tech-debt/2026-11-04-workshop-memory-title-only-rename.md`](../../tech-debt/2026-11-04-workshop-memory-title-only-rename.md).
4. **The route owner is a `…Handler`** (the coordinator's call). It was
   first named `WorkshopProjectMemoryManagerRoutes`, which the
   composition-tier construction guard couldn't see. Renamed to
   `WorkshopProjectMemoryManagerHandler`, it is in that guard's list as well
   as the route ledger and the extracted-slice guard.
5. **Files over 500 that grew.** Each was already past 500 lines:
   - `WorkshopApp.tsx` (1,775 → 1,801): the hook, the mount, the modal's
     props, and the review's settings visibility and Open in manager;
   - `useWorkshopRoom.ts` (909 → 923): the mode, beside web research;
   - `session.ts` (1,002 → 1,009);
   - `WorkshopRoomHandler.ts` (1,624 → 1,634): the review's partial-apply
     message (F03);
   - `memory.css` (653 → 657): the marked row (N02).
6. **The tests that pinned the three-tab modal now pin four.** 4a's modal
   test (tab order, the fourth `onApply` argument), the tab-list test, the
   room hook's settings payload and the router test's deps. The change is
   deliberate.
7. **The snapshot's mode is optional.** It's marked optional with a
   fail-closed read, so that about 20 test fixtures of the session state
   needed no edit. The host always sends it.

## For Slice 5 (shared files touched)

- **`ProjectMemoryWrites`:** `setPinned` and `remove` added, and
  `ProjectMemoryWriteStorePort` gains `delete`.
- **`ProjectMemoryLibrary`:** five pass-throughs and the composed manager.
  The store port gains `ensureFolder`.
- **`WorkshopRouteContracts`:** `WorkshopProjectMemoryPort` = writes ∩
  manager; one new route owner.
- **`useWorkshopAppMessageRouter`:** the two Slice 3 answers fan out to both
  memory hooks.
- **`WorkshopProjectMemoryHandler` and `useWorkshopProjectMemory` are
  untouched.**

## Verification

Node 22, on this branch:

| | Suites | Tests | Snapshots |
|---|---|---|---|
| Base (`cbb1446c`, a clean worktree) | 676 | 9,551 | 59 |
| After 4b-wire (`87e14f6a`) | 682 | 9,598 | 59 |
| After the review fixes | 685 | 9,622 | 59 |
| Round 2, with Slice 5 (#201) merged in | 690 | 9,679 | 59 |

- `npm run typecheck`: clean.
- `npm run lint`: 0 errors and no new warnings. The memory components mark
  their PascalCase names as Slice 3's siblings in the same folder do, so the
  repository's count fell from 1,171 to 1,165.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines (the largest is `useWorkshopMemoryManager.ts`,
  at 261). Touched files under 500 stay under: `ProjectMemoryWrites`
  457, `ProjectMemoryLibrary` 473, `WorkshopConversationSettingsService`
  475, `ProjectMemoryStore` 460.
- New tests:
  - `ProjectMemoryManager.test.ts`: the listing against the real renderer,
    the list over budget, search, Off, unavailable states, entry keys for
    each conflicting copy, forged, stale and cross-workspace keys, set-aside
    distinctness, the folder, logs, and both writes, including Delete
    reviving what it superseded and the store's `changed`, `busy` and
    `conflict`.
  - `WorkshopProjectMemoryManagerHandler.test.ts`: every route's success,
    refusal and busy or stale case through the real router and composition,
    with no receipt and no snapshot.
  - `WorkshopConversationSettingsMemoryApply.test.ts`: the mode round trip.
  - `WorkshopConversationBehaviorModal.memory.test.tsx`: the tab mounted,
    the four-draft footer, the apply waiting on the host's mode, drafts kept
    across the manager, and unavailable workspaces.
  - `useWorkshopMemoryManager.test.ts`: correlation, routes, the refusal,
    and rename.
  - `WorkshopApp.memoryManager.test.tsx`: the whole path through the real
    app.
  - A renderer-backed check of the estimate's two fields, in
    `ProjectMemoryCatalogFrame.test.ts`.
- Guards updated deliberately:
  - `boundaries.test.ts`: the route ledger 71 → 73 (direct 26 → 28), the
    memory module list, the extracted slices 7 → 8, the message modules;
  - `WorkshopRoomHandler.seams.test.ts` (71 → 73);
  - the message trees in `docs/ARCHITECTURE.md` and
    `.ai/central-agent-setup.md`.
