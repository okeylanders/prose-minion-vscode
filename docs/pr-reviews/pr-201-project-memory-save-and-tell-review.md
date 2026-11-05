# PR #201 review: Project Memory Slice 5, Save and tell me

- **Reviewed:** 2026-11-04
- **PR:** https://github.com/okeylanders/prose-minion-vscode/pull/201
- **Latest reviewed head:** `cf506c354d7a1194d0e1f8beae3b04c952819ecd`
- **Comparison base:** `685e6b4c07dd24cf63f24f9b60edc1ace0f6d8a4` (`epic/workshop-project-memory`)
- **Verdict:** **Written approval; F-01 through F-04 closed.** This is a written review verdict, not a formal GitHub review submission or merge.

## Final re-review at `cf506c354d7a1194d0e1f8beae3b04c952819ecd` (2026-11-04 21:43 UTC)

**Current verdict: written approval. F-01 through F-04 are closed.** No remaining actionable defect was found in the reviewed scope. This is a committed written review verdict, not a formal GitHub approval or merge. Earlier sections preserve each finding at its historical head.

**F-04 verified fixed:** automatic saves reserve capacity synchronously, scoped to their room revision. Completion counts both receipts and reservations; the live commit permission checks capacity again. A reservation becomes a receipt without an asynchronous gap, and refusal/withdrawal releases it. Room replacement does not carry the old room's reservations.

The original independent witness now ends with **five files and five automatic receipts**, while the sixth card remains pending with `held: 'room-cap'`. A second independent probe disposes and recreates the real room handler over the same session/library while the fifth file is committed but its receipt-version read is delayed. The final commit check still prevents the sixth file and records the correct hold. This covers the lifecycle edge where the new handler cannot see the old handler's local reservation.

The F-01/F-02/F-03 regressions remain green: mode withdrawal before queue/commit, writer Save with memory Off, preserving edited drafts through refusal and retry, equivalent-save coalescing, original-target capture, room replacement and disposal. The accessibility recommendation was incorporated as labelled groups for interactive receipts.

### Final independent verification

- The exact tracked tree was materialized and Git-blob verified.
- **Full Jest:** **681 suites / 9,601 tests / 59 snapshots passed**, in 351 seconds; reviewer-only probes excluded.
- **Focused production tests:** **six suites / 67 tests passed**.
- **Independent corrected-behavior probes:** **two suites / five tests passed**, covering three run-ownership cases and the two post-commit cap cases.
- **Typecheck:** core, webview and extension passed.
- **Lint:** **0 errors / 1,170 warnings**, unchanged from the integrated base (reviewer-only probe files excluded).
- **CI:** [Exact-head run 41917011324](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41917011324) passed.
- GitHub reports the reviewed head mergeable against `685e6b4c07dd24cf63f24f9b60edc1ace0f6d8a4`.
- No live provider, manual VS Code or native screen-reader validation was performed. The separately planned manager Restore wiring remains outside Slice 5.

## Re-review at `0da80c5b1b81e6f40cc9bb93ae5548901138f8be` (2026-11-04 21:18 UTC)

**Verdict at this historical head: changes requested for F-04. F-01 through F-03 are closed.** The corrections address the original failures, but allowing the next run to proceed before an already-committed save records its receipt exposes the cap race below.

Verified corrections:
- **F-01:** the automatic save passes a live permission callback into the library queue and the store's final commit check. It checks mode, run cancellation, room revision and pending-card state. Ask/Off withdrawal before the queue or commit now leaves the card pending; writer saves with memory Off still work.
- **F-02:** a changed edited draft no longer receives an unchanged-save success. During the owning run's tail it receives an explicit refusal, retaining the sheet draft; a retry after settlement updates the saved memory and records an updated receipt. Unedited or equivalent duplicate Saves still coalesce.
- **F-03:** the automatic save is now the original run's tail, owned by its controller. The waits at the start of Send/tool/invite are removed. Independent replacement-room, target-change and disposal witnesses now pass their corrected-behavior assertions: no stale request resumes in a new room, the clicked recipient is retained, and disposal starts no provider request.
- **Accessibility:** interactive saved/forgotten receipts are now labelled groups; noninteractive receipts retain separator semantics. UI tests pass and the existing refusal correlation preserves the edited draft.

### F-04 · P2 · Account for committed saves whose receipts have not landed when enforcing the room cap

**Location:** [WorkshopMemoryAutoSaves.ts:88–95](https://github.com/okeylanders/prose-minion-vscode/blob/0da80c5b1b81e6f40cc9bb93ae5548901138f8be/packages/core/src/application/handlers/domain/workshop/WorkshopMemoryAutoSaves.ts#L88-L95). The completion-time decision counts only existing receipts at [WorkshopMemoryAutoSave.ts:48–49](https://github.com/okeylanders/prose-minion-vscode/blob/0da80c5b1b81e6f40cc9bb93ae5548901138f8be/packages/core/src/application/services/workshop/memory/WorkshopMemoryAutoSave.ts#L48-L49), while the file commits before the awaited [receipt-version read](https://github.com/okeylanders/prose-minion-vscode/blob/0da80c5b1b81e6f40cc9bb93ae5548901138f8be/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L338-L344).

The revised run flow correctly avoids delaying future sends. However, the next reply can now be admitted for automatic saving while an earlier memory is already on disk but its receipt is still pending. Its decision sees the old receipt count. The queued write's new live permit does not recheck or reserve room capacity.

**Executed witness, using the real router/session/completion/library/store:**
1. Save four automatic memories normally.
2. Let the fifth file commit, then delay its `store.list()` call used to compute the receipt version. Five files exist, but the room has four automatic receipts.
3. Send another message and complete a sixth proposal while that version read is held. Its route is `auto`, because it still sees four receipts.
4. Release the read and let both saves settle.

**Observed:** **six files, six `by: 'auto'` saved receipts, and six saved cards without a hold**, although `autoSavesPerRoom` is five. The fifth write was already committed, so aborting its original run does not remove it. Serialization of the file writes does not repair the stale admission decision.

This is distinct from the documented choice to record an already-committed save's receipt after a preempting writer message. That can be visible and accounted for; exceeding the explicit automatic-save cap cannot.

**Requested correction:** make automatic-save capacity coherent across admission, queued writes and receipts. Account for in-flight/reserved or committed-but-unreceipted saves and recheck the bounded capacity before an additional file commits. Release reservations correctly for refused/withdrawn writes and room replacement, without breaking the defined Rewind behavior. The over-cap proposal must wait with the `room-cap` reason, not save a sixth file. Add this delayed post-commit version-read regression.

### Verification at this head

- Full source/blob verification completed for the correction head.
- Core/webview/extension typechecks pass; lint remains **0 errors / 1,170 warnings**.
- **Four focused production suites / 44 tests pass**, including the new permission/edit/lifecycle race regressions.
- **Three independent corrected-behavior run-ownership witnesses pass.**
- **Two UI suites / 16 tests pass** for disclosure/group semantics and draft-preserving refusal/retry.
- The additional independent post-commit cap witness confirms F-04.
- The independent full suite passed: **681 suites / 9,598 tests / 59 snapshots**, in 379 seconds (reviewer-only probes excluded). [CI run 41914004062](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41914004062) also passed. F-04 remains open despite these green checks.
- No formal GitHub approval or merge performed. Earlier findings below remain the historical record of `4c13ce58`.

## Original scope at `4c13ce58`

Reviewed the 28-file diff, Slice 5's acceptance criteria and deviations, automatic-save decision and persistence, manual/automatic save coalescing, mode changes, room caps and Rewind, queued message/tool/invite entry points, attached-web provenance, failure fallback, held-card persistence, receipt expansion and accessibility.

The full tracked tree (3,802 blobs, including repository symlinks) was materialized and checked against the implementation head. Independent witnesses use the production router, room/session handlers, completion, library and store; provider calls and host filesystem seams are mocked. No live provider or manual VS Code pass was performed.

## Original findings (closed at the re-review above)

### F-01 · P2 · Recheck automatic-save permission when the queued write commits

**Location:** [WorkshopMemoryAutoSaves.ts:88–100](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/handlers/domain/workshop/WorkshopMemoryAutoSaves.ts#L88-L100). The queued save's commit guard is [ProjectMemoryWrites.ts:144](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L144).

The mode is checked before `library.save` enters the single-writer queue. A slow unrelated write can keep the automatic save waiting while the writer changes Save and tell me to Ask first or Off. The queued write subsequently checks workspace availability, not whether automatic saving is still permitted.

**Executed witness:** hold an unrelated writer save at the store's create seam, complete a reply with an automatic proposal, switch `auto → ask` or `auto → off`, and release the earlier write. Both cases still create the automatic memory and a `by: 'auto'` receipt. The mode change occurs before this automatic transaction starts, not after a completed write. Allowing explicit writer saves while Off does not justify committing a new automatic save after its permission has been withdrawn.

**Requested correction:** give automatic saves a live permission guard that is rechecked after queue waits and at the final commit boundary. Preserve ordinary writer-initiated saves while memory is Off. A withdrawn automatic save should leave the card available for the writer without writing a file. Regress both Ask first and Off, including waiting behind another write and a delayed commit.

### F-02 · P2 · An edited manual Save silently joins the original automatic draft

**Changed integration:** [WorkshopMemoryAutoSaves.ts:57–59](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/handlers/domain/workshop/WorkshopMemoryAutoSaves.ts#L57-L59), sharing the promise map with [WorkshopProjectMemoryHandler.ts:165–170](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/handlers/domain/workshop/WorkshopProjectMemoryHandler.ts#L165-L170).

Once completion announces the reply, the visible pending card can offer Edit while its automatic disk write is still in flight. Automatic saves are not represented in the webview's `busyTurnIds`. The shared-map branch treats every successful `action: 'save'` as equivalent, including one carrying a different `edited` draft.

**Executed witness:** hold the automatic create, submit a writer-edited Save with the title “Corrected by writer,” then release the create. The writer gets `ok: true` and the automatic memory id, but the file retains the original automatic title. The edited draft is never written. Independent rendered UI probes confirm that the pending card's Edit button is enabled and invokes its callback under the actual settled-run/no-UI-request state.

Coalescing an unchanged Save correctly avoids duplicates; it is not sufficient for a distinct edited Save. This new automatic/manual overlap can silently lose writer corrections.

**Requested correction:** represent the automatic operation in the card/sheet state and preserve the writer's submitted edits. Either prevent editing before it starts, explicitly apply the edited draft to the resulting saved memory, or return an accurate refusal that keeps the draft available. Do not acknowledge success for edits that were ignored. Test the full pending-card Edit → Save overlap, not only duplicate unedited Save.

### F-03 · P2 · Bind runs waiting for autosave to their original room and lifecycle

**Location:** [WorkshopRoomHandler.ts:969–976](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L969-L976); the tool and invite waits at [364–368](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L364-L368) and [567–571](https://github.com/okeylanders/prose-minion-vscode/blob/4c13ce5884a74ac65fa74bd540b2389417938417/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L567-L571) have the same unowned wait.

The new await occurs before the run gets a controller or reserves its room, target and attachments. The mutation gate was checked only before entering the handler. While the save is pending, New/Open/target changes or disposal can occur; after it settles, the old request simply resumes against whatever state now exists.

**Three executed route-level witnesses:**
1. Complete a proposal, hold its automatic save, click Send with `OLD_ROOM_ONLY_71bb`, then choose New and pin the replacement room. Releasing the save starts a new provider conversation and appends that old message to the replacement room.
2. Queue a send while the host is selected, switch to the already joined Margot guest, then release the save. The queued host-directed text is sent to `guest-conv`.
3. Queue a send, dispose the room handler, and release the save. A fresh continuation request still starts after disposal.

This differs from the documented choice to keep an already-written memory when its room is replaced. The problem is a previously unstarted conversation request crossing that boundary, or changing its intended recipient.

**Requested correction:** capture and preserve the accepted request's room revision, target and relevant staged inputs, and give the wait cancellation/lifecycle ownership. Recheck the session-operation gate after asynchronous waiting. Refuse or cancel stale requests on replacement/disposal instead of sending them in a new room; preserve the writer's draft when appropriate. Cover Send, tool, invite and widget-commit callers, plus changes to target/attachments during the wait.

## Verified behavior and nonblocking observations

- Attached-web holds use the tools actually attached by `AssistantToolService`, not citations. Independent host/guest/continuation probes cover `true`, `false` and omitted settings with zero citations: **nine checks pass**. No hold bypass was found in these paths.
- The ordinary room cap, held-card persistence, Ask-first behavior, unedited duplicate-Save coalescing, receipt placement before the next exchange, Forget/Edit behavior and isolated failure fallback pass the focused production suite.
- Rewind counting correctly uses retained automatic-save receipts, rather than files still on disk. The provided Rewind test uses the real transform over a scripted room, as disclosed.
- Receipt expansion is collapsed by default, carries `aria-expanded`/`aria-controls`, and uses the saved reply's card without mutating it. **Accessibility recommendation:** use a labelled `group` for the interactive receipt and a decorative divider for its line instead of `role="separator"`. No hidden-button failure is claimed: ARIA's presentational-descendant rule has exceptions for focusable controls, and native assistive-technology behavior was not tested.
- The explicitly deferred manager Restore wiring belongs to Slice 4b-wire, not a surprise blocker for this slice.

## Verification

- **Typecheck:** core, webview and extension passed.
- **Lint:** 0 errors / 1,170 warnings, unchanged from the integrated base.
- **Focused production tests:** 7 suites / 91 tests passed.
- **Independent UI/web attachment probes:** 2 suites / 11 tests passed.
- **Independent queued-run witnesses:** 1 suite / 3 tests confirmed F-03.
- **Independent persistence/coalescing witnesses:** both mode-withdrawal variants and the ignored-edited-draft case confirmed F-01/F-02.
- **Full suite:** **680 suites / 9,586 tests / 59 snapshots passed** independently against this exact head, in 453 seconds. Reviewer-only probes were excluded and run separately; full output was retained.
- **CI:** [implementation run 41909466377](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41909466377) passed. The report-only head's run remained in progress at 20:57 UTC.
- GitHub reported this head mergeable. No formal GitHub approval or merge performed.

## Original re-review gates

Fix F-01 through F-03 and add the interrupted/racing flow regressions. Rerun the exact new head's focused and aggregate checks, preserving full failure output for any intermittent test failure. Verify unchanged-scope behavior: explicit writer saves with memory Off, unchanged duplicate Save coalescing, next-turn receipt delivery, and the attached-web hold.
