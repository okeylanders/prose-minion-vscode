# PR #202 — Project Memory manager wiring review

## Verdict and exact target

**REQUEST CHANGES** before merging into `epic/workshop-project-memory`.

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/202
- Latest reviewed implementation: `2c549f9c325c7d97b83502a009b6dbffaceb7e57` (original review: `87e14f6ac64d2b56d2126b95db4c613dc0df0ab0`)
- Latest epic base: `87ec7a9a90378aa4572bae885254cc2ea8f77354` (original base: `6a964813583d6e7bffec853a301f1ddfcfac5687`)
- Review date: 2026-11-04 UTC.
- **One P2 remains open: F01's previously reported wrong-project pin toggle. Delete, F02, F03, F04, N01 and N02 are verified fixed. N03 and N04 are nonblocking P3 follow-ups.**
- This is an advisory review report, not a GitHub approval or merge. It evaluates Slice 4b-wire on its actual epic target, not main and not an unmerged Slice 5 trial merge.

## Independent re-review — 2c549f9c, 2026-11-04 22:37 UTC

**Current verdict: request changes for the remaining pin-toggle portion of F01.** This head incorporates the merged Slice 5 implementation and is reviewed against epic `87ec7a9a`. The sections below retain earlier evidence; this section is the current status.

### F01 partially closed: delete fixed; the same queued pin witness still fails

Both queued-delete witnesses now refuse `workspace-changed` and preserve both projects' files. Delete captures the accepted room and directory before the library queue, and the store enforces its captured directory before and during commit. Original mid-read/claim guards still work.

However, the previously reported `setLoadInFull` witness is unchanged. At [ProjectMemoryWrites.ts:244–265](https://github.com/okeylanders/prose-minion-vscode/blob/2c549f9c325c7d97b83502a009b6dbffaceb7e57/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L244-L265), `setPinned` waits in `owe` without capturing the request's accepted room/directory.

Reproduction with the real library/store:
1. Root A and copied project B each contain the same memory id, with different titles and both unpinned.
2. Hold another root-A library write at its listing; enqueue `setLoadInFull(A-id, true)`.
3. Switch to and accept B, then release the earlier write.
4. **Observed: `written`, title `SECOND_PROJECT`, pinned true.** A stays unchanged; the toggle pins B's memory instead.

This was explicitly included in the prior re-review, not a new scope request. Apply the same captured request identity to this manager mutation before it queues, preserve it through listing and replacement, and refuse rather than retarget when the workspace changes. Regression coverage must include both library/store waits and verify neither memory is changed after target replacement.

### F03 closed; earlier UI/manager closures hold

The mode-setting helper records only a successful changed write and undoes it only while the current value is its own. Replays now pass for Behavior-only apply with external Off, changed-mode apply with newer Off/Ask, refused forward writes, ordinary rollback and refused rollback reporting.

F02 root/entry-key checks, F04 initiating-panel errors, N01 manual-write freshness and N02 saved-card manager navigation all remain verified. The selected row is marked and scrolled to.

### N03 stays open (P3); N04 — auto-save receipts do not refresh visible listings (P3)

N03's older folder failure can still overwrite the newer request's success; source is unchanged.

After integrating Slice 5, a new automatic-save receipt updates the visible thread but does not refresh either an already-open Memory settings panel or manager. Auto-save publishes a session snapshot rather than `WORKSHOP_MEMORY_WRITE_RESULT`; [useWorkshopAppMessageRouter.ts:129–133](https://github.com/okeylanders/prose-minion-vscode/blob/2c549f9c325c7d97b83502a009b6dbffaceb7e57/packages/core/src/presentation/webview/hooks/useWorkshopAppMessageRouter.ts#L129-L133) does not tell the manager about that snapshot.

Two actual WorkshopApp regression cases verify the receipt renders but listing counts stay at 1 instead of 2, and 2 instead of 3. Reopening or searching refreshes, so this is stale presentation rather than data loss. Refresh visible consumers when newly observed automatic-save receipts change the memory library, without reloading on every unrelated room snapshot.

### Validation at this exact integrated head

- 1,930 selected files checked: all core/extension source, config and resources match the Git tree. Only root guide terminal-newline materialization differences remain.
- Core/webview/extension typechecks pass; lint 0 errors / 1,165 warnings.
- Autosave/delete/store integration selection: **8 suites / 118 tests passed**.
- Independent current manager/handler/scope/delete selection: **4 suites / 37 tests passed**, plus 18 identity/privacy controls.
- UI/settings closure/control batch: **6 suites / 28 tests passed**. Expected-failing N03 and two N04 regression cases still fail as described.
- Independent queued pin witness uses 111 hash-verified production modules.
- Full local production suite: **690 suites / 9,679 tests / 59 snapshots passed**, 457.767 seconds; reviewer-only probes excluded. Exact implementation CI also passed: [run 41926221350](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41926221350).
- No native VS Code, OS shell, provider or screen-reader validation; the prior test-environment limitations remain.

## Historical re-review — d57734ac, 2026-11-04 21:49 UTC

The original findings below are historical evidence. This historical section records the earlier reviewer verdict; the author's resolution ledger records proposed corrections, not independent clearance.

### F01 remains open: capture the requested root before entering either queue

The original directory-read and claimed-byte withdrawal cases now preserve the file. A newer saved-name occupant is also preserved when withdrawal restores the claimed memory under a free name. However, `ProjectMemoryStore.delete` captures `where` **inside** `enqueue` (lines 302–304), after a queued request may have changed projects.

Independent real-library/store witness:
1. Root A has memory `mem-000001`. Pause a `store.list()` directory read, holding the store queue.
2. Start `library.remove('mem-000001')` and confirm it has entered `store.delete` while A is still accepted.
3. Switch to and accept root B, containing a different memory with the same id and filename (as copied projects can).
4. Release the queue.

**Observed: `deleted`; A's file survives, B's file is deleted.** Capturing B when the queued operation finally executes makes every new still-permitted check pass, but the user requested deletion in A. The exact production-module witness used 111 hash-verified imports. Two further real-queue witnesses also reproduce this: a delete queued behind another library write deletes B's same-id memory, and a queued `setLoadInFull(A-id, true)` pins B's same-id note instead. Bind both new manager mutations to their request root; protecting only entry into the store queue is insufficient.

Capture request root/generation before either the library write queue or store queue can wait, and require that captured identity at execution and commit. Add a regression behind a real queued list and one behind the library's write queue; verify neither project's file is deleted after the original target changes.

### F03 remains open: rollback must own the mode change it undoes

The original partial-apply case now restores the old value, and rollback failure is reported honestly. The new catch path at `WorkshopConversationSettingsService.ts:107–110,344–352` nevertheless restores *any* difference from the old value, even when this apply never wrote memory.

Independent expected-failing regression:
1. Start with global memory Auto.
2. Apply a Behavior-only change, leaving the mode Auto, so `persistProjectMemoryMode` makes no write.
3. While retained-prompt assembly is pending, the user sets global memory Off in VS Code Settings.
4. Reject prompt replacement.

**Expected: Off remains, and this apply performs no memory write. Observed: rollback writes Auto**, undoing the newer external Off. This also applies to newer external changes after an apply that did own an earlier write.

Track whether this operation actually changed the mode and the value/generation it owns. Do not roll back an unchanged/omitted/refused mode write or overwrite a newer external choice. Reconcile live prompts with the actual surviving value and describe partial outcomes accurately. Add unchanged-mode and changed-mode concurrent external-edit tests, including an external Off.

### Closures verified

- **F02:** original listing/title, folder and queued cross-root key witnesses now refuse safely. Accepted-new-root variants also pass. Eighteen identity/privacy controls still pass.
- **F04:** settings-tab folder refusal is visible at the initiating panel; its pending/error state is separate from ordinary manager actions.
- **N01:** a successful pending card save refreshes the visible settings consumer.
- **N02:** saved cards open the manager at the named row; focused-row tests pass.
- Original reviewer UI regressions and targeted rollback-failure/focus tests pass (4 suites / 11 tests in the independent rerun).

### N03 — P3 — Correlate the newest folder result by request id

At `useWorkshopMemoryManager.ts:223–227`, folder-result ownership waits for all pending folder requests to finish rather than checking which request was newest. The manager's Open memory folder button permits concurrent presses.

An actual WorkshopApp regression opens settings then the manager, presses Open memory folder twice, receives success for the second request and then failure for the first. Closing the manager reveals the older failure as “The memory folder didn't open,” contradicting the newer success. Track the newest folder request id or prevent concurrent folder opens consistently. The expected-failing `Review202UiFolderOrder.test.tsx` reproduces this; it is a nonblocking P3 follow-up.

### Re-review validation

- Exact core/extension source/config/resource materialization checked against d57734ac: 1,921 files checked, only non-executable root guide terminal-newline differences.
- Core/webview/extension typechecks pass; lint 0 errors / 1,165 warnings.
- Delete/store selection including independent withdrawal and occupied-name restoration probes: **5 suites / 69 tests passed**.
- CI for d57734ac: **success**, [run 41918468608](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41918468608).
- Full local production suite: **685 suites / 9,622 tests / 59 snapshots passed**, 435.519 seconds. Reviewer-only regressions were excluded. Passing production coverage does not close the two independently reproduced residuals.
- Report-only head `20732a93` also has green CI, [run 41919704555](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41919704555).
- Same validation limits apply: in-memory filesystem and jsdom; no native extension/screen-reader/OS-shell validation.

## Resolution ledger (author, 2026-11-04)

| Finding | Status | Commit | Correction |
|---|---|---|---|
| F01 | Fixed (round 3) | `01eae439`, `466a7ea1`, `092922c8`, `eecba54f` | `StoredFileClaims.deleteClaimed` takes `stillPermitted`, asked with nothing awaited before retiring leftovers and again before removing the claimed bytes. The store's delete passes "the folder is still the one it read, and `beforeCommit` allows it"; the library's `beforeCommit` is the room's scope. Withdrawn, the file goes back under its name (or a free one) and the delete is refused with the workspace's reason. `ProjectMemoryDeleteScope.test.ts` pauses the folder read, the claimed-bytes read and the retirement. **Round 2:** `remove` captures the accepted workspace's identity (live room and memory folder) at the request, before the library's write queue or the store's queue can wait, and passes the folder to the store. A turn that comes under another folder is `withdrawn`, and every commit point compares with the captured identity. Witnesses: a copied project B with the same id and file name, behind a real queued list and behind the library's write queue; neither project's file is deleted. **Round 3:** Always load in full (`setPinned`) is bound the same way: identity captured at the request, checked at its turn, after its list and at commit, and the store's `replace` takes the captured folder. The identity lives in `ProjectMemoryWorkspaceIdentity`. Witnesses for it behind a held store list and behind another library write; neither project's note changes. Delete's witness behind another library write was already in round 2. **In the queue, for every write (`092922c8`):** `owe` captures the identity at the request and refuses a turn under another workspace; each write's list and its store commit check the captured identity, and the store's `create`, `replace` and `delete` all withdraw under another folder. Save, Edit, Archive and Restore (and so Save and tell me's save) are bound too; witnesses for each behind a library write and a held store list. A→B→A in the same live room reads as unchanged, which is the delete the writer asked for in the project that is current (the coordinator's reading). |
| F02 | Fixed | `e0392dec` | `ProjectMemoryManager.moved(directory)` compares the store's folder now, and the scope, with the folder the rows were read for: after the queued list, after the titles, and after making the folder. A to B to available is caught by the folder comparison. `ProjectMemoryManagerScope.test.ts` covers the three probes. |
| F03 | Fixed (round 2) | `2548c577`, `b85122b5` | A failed apply writes the previous mode back before it rethrows. A refused rollback throws `WorkshopConversationSettingsPartialApplyError`, and the handler names the mode that stands. Tests: both directions, a combined behavior change, the watcher after the rollback, and a refused rollback (service and router). **Round 2:** `WorkshopProjectMemoryModeSetting` records what the apply wrote over what, and the undo writes back only that, only while the setting still holds it. An unchanged, absent or refused write is never undone, and a newer external choice stands; the settings watcher's sync rebuilds the prompts for it. Tests: a Behavior-only apply with an external Off (draft absent and unchanged), a changed mode with an external Off or Ask, and a refused write. |
| F04 | Fixed | `7f507259` | Open memory folder has its own status (`folder`: pending, the newest press's refusal). The Memory tab marks the button busy and shows the refusal beside it; a retry or closing the settings clears it. Tests: refused folder creation and a refused shell open through `WorkshopApp`, and stale answers in the hook. |
| N01 | Fixed | `7f507259` | `setSettingsVisible` from WorkshopApp's open and close; another hook's write refreshes while the manager or the settings show the listing. |
| N02 | Fixed | `7f507259` | `memoryControls.onOpenManager` opens the manager with that memory's row marked (`aria-current`) and scrolled to. |
| N03 | Fixed | `2ffc0879` | The hook keeps the newest folder request's id; an older answer changes neither the folder's status nor the manager's alert. Hook test: the second press opens, then the first fails; no error. |
| N04 | Fixed | `d1e20b53` | Each room snapshot reaches the memory manager hook, which remembers the Save and tell me receipts it has seen; a new one refreshes the listing while the manager or the settings show it. Unrelated snapshots ask nothing. Hook and router tests. |
| Rename (title-only write) | Tracked | `286a01bd` (tech debt, the coordinator's) | Still the sheet's read then whole-draft update. A title change writes a receipt (D7), so a host title-only write belongs with the receipt path, not this PR. Recorded in the slice doc's deviations. |

F04, N01 and N02 share the hook and WorkshopApp's wiring, so they are one commit; each has its own tests, which fail on `87e14f6a`.

## F01 — P2 — Delete must honor workspace withdrawal at its commit boundary

**Locations:** `packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts:239–246`; `packages/core/src/infrastructure/storage/ProjectMemoryStore.ts:299–322`.

`remove` checks the accepted workspace only before awaiting `store.delete`. Unlike create, replace, archive and pin changes, deletion carries no live before-commit guard. The store then performs asynchronous directory reads, claim acquisition, claimed-byte verification and retirement before deletion without checking whether this room may still mutate that workspace.

Two independent deterministic probes using the real library/store and in-memory filesystem reproduce this:
1. Put a valid memory in root A. Start `library.remove`, pause the first directory read, invalidate the room's scope with `workspace-changed` and move the workspace to root B, then resume. The operation returns `deleted` and root A's file is gone. A subsequent delete correctly refuses `workspace-changed`.
2. Pause reading the claimed bytes, withdraw the scope, then resume. The file is still deleted and success returned.

The claim correctly verifies file identity, but identity is not permission to finish a now-stale operation. Carry the workspace/root generation through the deletion and check it immediately before irreversible removal, releasing/restoring the claim safely when withdrawn. Preserve the existing changed-id, busy, conflict and set-aside recovery guarantees. Add regressions at both directory-read and claim/retirement boundaries.

## F02 — P2 — Bind asynchronous manager results to the root that produced them

**Locations:** `ProjectMemoryManager.ts:86–87,155–161,172–189` under `packages/core/src/application/services/workshop/memory/`.

The manager's checks do not cover all awaits, nor compare the captured directory with the current directory:
- Listing awaits source-session titles after its final workspace check, then returns the old rows as `workspace: available`.
- Folder opening awaits `ensureFolder` and returns its old path without a final scope check.
- `read` captures directory before queued `store.list`, then checks only whether the current scope is available. If a different root has become accepted, the captured directory can be paired with the new root's listing.

Independent real-manager/handler probes established:
1. Pause `recall.positionsOf`, invalidate scope and switch roots, then resume. The handler posts root A's private title as an available listing; the next listing refuses.
2. Pause folder creation, withdraw scope, resume. The handler reveals the old-root folder and reports success.
3. Block the real store queue, invoke `managerFile` with a root-A key, switch and accept root B containing the same filename but a different memory, then resume. Resolution returns root A's path even though B is current. A subsequent settled request correctly rejects that key.

Capture and compare accepted root/directory identity across the list, title-resolution and folder awaits. Refuse/drop stale results before posting data or handing a path to the shell. Rechecking only a boolean is insufficient for the A-to-B-to-available case. Keep opaque keys, no webview-supplied paths and set-aside key separation intact.

## F03 — P2 — Failed apply partially commits the global mode

**Locations:** `packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:105–107`; `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts:447–457`.

The four-draft apply writes the global memory mode first, then awaits a potentially failing retained-prompt replacement. A replacement failure does not roll back the mode. The handler reports “The previous settings are still active,” although its snapshot reads the new global value and retained prompts can still reflect the old mode.

Reproduction: begin Off with a retained conversation, make `replaceWorkshopConversationSettings` reject, and apply Auto. The operation rejects, but both stored mode and `getProjectMemoryMode()` are Auto. An independent expected-Off regression fails with actual Auto.

Make this apply consistent: prepare replacement work before committing the setting, or restore the previous setting if replacement fails. If rollback itself fails, expose the actual partial state rather than claiming all old settings remain. Test both mode directions, a simultaneous behavior/profile change, settings-watcher interaction and rollback failure.

## F04 — P2 — Show folder-operation failures where the action began

**Location:** `packages/core/src/presentation/webview/WorkshopApp.tsx:1675–1681`; manager result handling in `useWorkshopMemoryManager.ts`.

The Memory settings tab invokes `memoryManager.openFolder`, but receives no pending/error state. A correlated refusal is saved as `manager.actionError`; only the manager dialog renders it, and that dialog is closed when Open memory folder is used directly from settings.

An actual WorkshopApp test opens Memory settings, clicks Open memory folder, delivers its correlated failed result and a successful listing refresh. The error is nowhere in the rendered UI. The user sees an apparently inert command with no explanation.

Pass this operation's status into the initiating settings panel and expose a useful error there. Keep it associated with the current request and clear/retry it appropriately. Add tests for refused folder creation and shell opening, not only successful manager actions.

## P3 integration follow-ups

### N01 — Refresh the visible Memory tab after a pending card save

`useWorkshopMemoryManager.ts:222–225` refreshes another memory hook's successful write only while the manager is open. The settings tab is also a live consumer.

A reachable WorkshopApp probe clicks a proposal's Save, opens Memory settings while it is pending, receives the initial listing, then receives that save's success. No refresh is requested, leaving count/load information stale. Refresh when either consumer is visible, or otherwise invalidate and reload its listing.

### N02 — Wire the saved card's Open in manager action

`WorkshopApp.tsx:532–548` does not supply `memoryControls.onOpenManager`, so `WorkshopTurnMemory.tsx:55–58` keeps the previously deferred navigation absent. The approved Slice 0d design specifies it at `slice-0d-settings-design.md:317`. An actual saved-card rendering confirms the button is absent. Connect it to the manager, ideally preserving/focusing the selected memory.

## What was checked and what works

- Source materialization was compared to the Git tree for the exact implementation SHA: all selected core/extension source, package/config and resource blobs matched. 1,917 files checked; the only materialization differences were terminal newlines in root AGENTS.md and Claude.md, not executable files.
- Reviewed host listing, frame-derived estimate/residency, host search, opaque keys, unreadables/conflicts/set-aside identities, source-session titles, direct-route validation, queue ownership, claimed writes and error mapping.
- Positive independent identity/privacy probes passed 18 assertions: malformed/forged keys, conflicts and unreadables, rename invalidation, set-aside distinction/refusal, writer access while Off, and absence of private sentinel/path content in logs.
- The HMAC includes row kind plus contained path, so a set-aside row does not alias the standing file. Stable ordinary requests resolve against a fresh listing. F02 concerns asynchronous root changes, not a failure of HMAC construction.
- Pinning changes only the pinned field through the existing write queue and preserves the updated timestamp. Existing pinned-budget and deletion identity tests pass.
- Reviewed four-tab draft handling, correlated fanout to both memory hooks, layered settings/manager/sheet composition, search and row actions.
- Rename intentionally performs read then whole-draft update. Its disclosed last-write-wins overwrite of another window's intervening edit remains a limitation; this review does not characterize Rename as a title-only atomic update. A title-only host operation would avoid overwriting fields the rename gesture never edited.
- Pin budgets remain per-window as documented; this is not a cross-window reservation guarantee.

## Validation evidence

At the original reviewed implementation (87e14f6):
- `npm run typecheck`: **passed** core, webview and extension.
- `npm run lint`: **passed**, 0 errors / 1,165 existing warnings.
- Focused production selection `(ProjectMemory|Workshop.*Memory|useWorkshopAppMessageRouter)`: **38 suites / 513 tests passed**.
- Independent UI/settings production selection: **4 suites / 20 tests passed**, overlapping the focused count above rather than additional coverage.
- Independent manager/handler selection: **2 suites / 26 tests passed**, also overlapping.
- Full production Jest run: **682 suites / 9,598 tests / 59 snapshots passed**, 492.824 seconds; independent reviewer probes excluded with `--testPathIgnorePatterns=Review202`.
- GitHub CI for `87e14f6`: **success**, run [41912863863](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41912863863).
- Report-only head `0ef399eb`: **CI success**, run [41914692257](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41914692257). No implementation corrections were present as of 21:23 UTC; the findings remain open.

Reviewer-only witnesses, not production changes:
- `Review202DeleteScope.test.ts`: 2 passing reproduction tests assert the observed stale deletions.
- `Review202UiModeFailure.test.ts` and `Review202UiMemoryManager.test.tsx`: 4 intentionally failing regression assertions covering F03, F04, N01 and N02.
- Separate hash-verified manager witnesses cover F02's listing, folder and queued cross-root file resolution, using 111–112 exact production imports.

The tests use an in-memory filesystem, mocked scope/recall/shell and jsdom. No native VS Code Extension Development Host, OS shell, screen reader or screenshot-based validation was performed. Green existing tests/CI do not close the reproduced gaps.

## Follow-up gate

Keep residual F01 (pin toggle) open until its correction and targeted regressions are reviewed on their new exact head, followed by affected tests/typechecks/CI. Recheck integration if the epic base or overlapping Slice 5 implementation changes. No formal GitHub approval or merge was performed.
