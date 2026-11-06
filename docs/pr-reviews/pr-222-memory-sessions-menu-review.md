# PR #222 review: Memory in the sessions menu

## Verdict

**Written approval of `584208360959c8e4fc3d0559991cb2afb4050bf9`, subject to final-head CI. No new blocking finding.** This is approval of this small change against its stated Bookmark Recall base, not a claim that the branch already contains #221's receipt correction, a formal self-approval, or authorization to merge.

- PR: [#222](https://github.com/okeylanders/prose-minion-vscode/pull/222)
- Base: `epic/workshop-bookmark-recall`, `4de1bad3e2e6e1e4fb980cd62a48c32c180ca9b6`
- Reviewed head: `claude/vibrant-shannon-croyue`, `584208360959c8e4fc3d0559991cb2afb4050bf9`
- Main used for the integration rehearsal: `4d6ead93affefd5f69e36e566964b7e54e6b98d0`
- Reviewed: 2026-11-05
- Scope: all five changed files; menu composition and focus dismissal; manager/listing/actions; memory-sheet stacking; prior settings/card entrances; #221's receipt correction and its interaction with Bookmark Recall; current CI.

## What reviewed cleanly

- `Memory…` is last, after `Bookmarks…`, and optional when the menu is used elsewhere. It reuses `SavedItemsMenu.Item`, whose invocation closes the menu before calling the action. It does not accidentally invoke Bookmarks or a session operation.
- Both settings and the new menu use the renamed `openMemoryManager` wrapper. Calling `memoryManager.openManager()` without an argument clears a previous card's selected row and requests a fresh host listing. The saved-card entrance still passes its memory ID, preserving its distinct behavior.
- No room, settings, memory-mode, storage, model-call, persistence or write protocol is introduced or changed. Being able to manage memories while persona memory is Off is intentional. A busy room does not prevent this independent project-file management surface from opening.
- The shared manager renders missing-folder, multi-root and listing-failure states and disables the appropriate controls. The new entrance does not bypass these decisions.
- The manager remains below the memory sheet. New opens the existing sheet; one Escape dismisses the sheet only, keeping the manager. Manager Escape or backdrop dismissal returns focus to the Sessions trigger, and reopening clears search and prior card focus.
- The manager's Archive request remains on its existing correlated route. Pending controls disable and a refused action displays the host's reason. This is separate from the thread-receipt refusal issue fixed in #221.
- The distinct-slug memory-ID race is correctly recorded as low-priority debt, including the narrow probability, retained bytes, deterministic witness, sequential control and the insufficiency of a non-atomic re-read. This PR does not claim to fix it. Its review/probe references become available when main is integrated; they are not yet present on the original feature head.

## N-01 — nonblocking integration note: retain both real conflict sites

The PR description says the overlap with #221 is the `openMemoryManager` rename. A local, uncommitted merge of the exact reviewed head with the main commit above shows a more specific result:

1. **`WorkshopApp.tsx`:** the conflict is beside the hooks. Keep Bookmark Recall's `bookmarkBrowser = useWorkshopBookmarkBrowser()` **and** #221's room-generation `roomKey` plus `useWorkshopProjectMemory({ roomKey })`. Keep the corresponding receipt busy/error wiring, and use the same room key for rail/Read in. Choosing either whole side would discard the other feature's behavior.
2. **`WorkshopApp.memoryManager.test.tsx`:** the new Sessions → Memory test and #221's receipt-refusal `describe` block are adjacent additions. Keep both, with their own closing braces.
3. The `openMemoryManager` rename and both consumers merge automatically in this rehearsal. There is no callback-name conflict to resolve.

The reviewed feature branch intentionally does **not** contain `12e575b3`, so the old thread-receipt bug is still inherited until that integration. This is not a regression introduced by #222 and is not a reason to reject this menu delta against its current base. Before the feature returns to main, preserve the actual receipt correction and recheck the resulting integration head.

**Independent keep-both rehearsal passed:** all three typechecks; **17 focused production suites / 269 tests**; and all **five existing #221 independent receipt probes unchanged**. The latter cover Forget/Restore visibility, disabled pending controls, correlation, retries, concurrent receipts with reversed replies, and replacement rooms with reused receipt IDs. The same focused run includes the new menu entrance and prior memory/settings/card behavior, Bookmark Recall and architecture boundaries.

This rehearsal was local only. No integration merge or product edit was pushed. The [resolved-file delta](probes/pr-222-main-conflict-resolution.patch.txt) records just the two conflicting files relative to the original PR head; it is not a standalone receipt-fix patch. See the [replay instructions](probes/pr-222-memory-menu-run.txt), [focused result](probes/pr-222-main-integration-focused-result.txt) and [receipt-probe result](probes/pr-222-main-integration-receipts-result.txt).

## Verification

- Isolated checkout of the exact head. Local Node `24.22.1`, npm `11.9.0`; reused installed dependencies have the same external lockfile entries (only root/workspace version labels differ). CI independently runs `npm ci` under Node 18.
- All three local typechecks pass.
- Full local lint passes: **0 errors / 1,165 baseline warnings**.
- Both webpack bundles and bundle verification pass. The webview retains its three size/performance warnings.
- Initial focused production run passes **5 suites / 56 tests**. This overlaps later checks and is not additive.
- **Six independent real-App probes pass** on the original feature head: Off mode during an active run; New-sheet layering and single-Escape dismissal; prior card-focus clearing, search reset and repeated opening; stale listing answers; no-workspace/multi-root/listing-failure controls; and Archive refusal visibility. Source and final output: [probe](probes/pr-222-memory-menu.test.tsx.txt), [result](probes/pr-222-memory-menu-result.txt). They are archived outside normal Jest discovery.
- A full local serial production suite is running at report publication. It was started before adding the independent probe and is not yet claimed as a full pass. Its terminal result will be recorded in the PR conversation.
- The reviewed head's actual GitHub [CI run 42103128253](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42103128253), verify job `127510857083`, **passed**: all three typechecks, **751 suites / 10,468 tests / 59 snapshots**, lint and both bundles. Its checkout log identifies merge candidate `0f0ef133891ca6ed150dce908a0d323401bd2914` with the exact base/head above. The report-only publication head will also receive its own CI verification. Neither previous PR CI nor the local integration rehearsal substitutes for that head's check.
- The original PR delta passes `git diff --check`. Report/evidence publication is documentation-only and will be checked separately before commit.

## Limits

These are automated JSDOM/host-mock and code-level checks, not native VS Code visual, screen-reader, operating-system focus or billable-provider acceptance. The local combined tree received focused tests and typechecks, not a separate complete integration suite. Actual integration/release acceptance remains the feature owner's later gate.

No merge, deployment, release or deferred PR work was performed.
