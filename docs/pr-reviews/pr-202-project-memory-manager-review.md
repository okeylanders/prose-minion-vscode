# PR #202 — Project Memory manager wiring review

## Verdict and exact target

**REQUEST CHANGES** before merging into `epic/workshop-project-memory`.

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/202
- Reviewed implementation: `87e14f6ac64d2b56d2126b95db4c613dc0df0ab0`
- Reviewed epic base: `6a964813583d6e7bffec853a301f1ddfcfac5687`
- Review date: 2026-11-04 UTC.
- Four P2 findings remain open; two P3 integration follow-ups are also recorded.
- This is an advisory review report, not a GitHub approval or merge. It evaluates Slice 4b-wire on its actual epic target, not main and not an unmerged Slice 5 trial merge.

## Resolution ledger (author, 2026-11-04)

| Finding | Status | Commit | Correction |
|---|---|---|---|
| F01 | Fixed | `01eae439` | `StoredFileClaims.deleteClaimed` takes `stillPermitted`, asked with nothing awaited before retiring leftovers and again before removing the claimed bytes. The store's delete passes "the folder is still the one it read, and `beforeCommit` allows it"; the library's `beforeCommit` is the room's scope. Withdrawn, the file goes back under its name (or a free one) and the delete is refused with the workspace's reason. `ProjectMemoryDeleteScope.test.ts` pauses the folder read, the claimed-bytes read and the retirement. |
| F02 | Fixed | `e0392dec` | `ProjectMemoryManager.moved(directory)` compares the store's folder now, and the scope, with the folder the rows were read for: after the queued list, after the titles, and after making the folder. A to B to available is caught by the folder comparison. `ProjectMemoryManagerScope.test.ts` covers the three probes. |
| F03 | Fixed | `2548c577` | A failed apply writes the previous mode back before it rethrows. A refused rollback throws `WorkshopConversationSettingsPartialApplyError`, and the handler names the mode that stands. Tests: both directions, a combined behavior change, the watcher after the rollback, and a refused rollback (service and router). |
| F04 | Fixed | `7f507259` | Open memory folder has its own status (`folder`: pending, the newest press's refusal). The Memory tab marks the button busy and shows the refusal beside it; a retry or closing the settings clears it. Tests: refused folder creation and a refused shell open through `WorkshopApp`, and stale answers in the hook. |
| N01 | Fixed | `7f507259` | `setSettingsVisible` from WorkshopApp's open and close; another hook's write refreshes while the manager or the settings show the listing. |
| N02 | Fixed | `7f507259` | `memoryControls.onOpenManager` opens the manager with that memory's row marked (`aria-current`) and scrolled to. |
| Rename (title-only write) | Left as disclosed | | Still the sheet's read then whole-draft update. A title change writes a receipt (D7), so a host title-only write belongs with the receipt path, not this PR. Recorded in the slice doc's deviations. |

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

At the reviewed implementation:
- `npm run typecheck`: **passed** core, webview and extension.
- `npm run lint`: **passed**, 0 errors / 1,165 existing warnings.
- Focused production selection `(ProjectMemory|Workshop.*Memory|useWorkshopAppMessageRouter)`: **38 suites / 513 tests passed**.
- Independent UI/settings production selection: **4 suites / 20 tests passed**, overlapping the focused count above rather than additional coverage.
- Independent manager/handler selection: **2 suites / 26 tests passed**, also overlapping.
- Full production Jest run: **in progress when this report was published**; independent expected-failing reviewer probes excluded. Its result will be appended.
- GitHub CI for `87e14f6`: **success**, run [41912863863](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41912863863).

Reviewer-only witnesses, not production changes:
- `Review202DeleteScope.test.ts`: 2 passing reproduction tests assert the observed stale deletions.
- `Review202UiModeFailure.test.ts` and `Review202UiMemoryManager.test.tsx`: 4 intentionally failing regression assertions covering F03, F04, N01 and N02.
- Separate hash-verified manager witnesses cover F02's listing, folder and queued cross-root file resolution, using 111–112 exact production imports.

The tests use an in-memory filesystem, mocked scope/recall/shell and jsdom. No native VS Code Extension Development Host, OS shell, screen reader or screenshot-based validation was performed. Green existing tests/CI do not close the reproduced gaps.

## Follow-up gate

Keep F01–F04 open until corrections and targeted regressions are reviewed on their new exact head, followed by affected tests/typechecks/CI. Recheck integration if the epic base or overlapping Slice 5 implementation changes. No formal GitHub approval or merge was performed.
