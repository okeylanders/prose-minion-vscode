# Slice 4c: retry after a transient refusal, and the settings row

**Status:** Built, for review.
**Branch:** `epic/workshop-persona-file-edits-slice-4c-retry-and-setting`, from `origin/epic/workshop-persona-file-edits` at `9f70f236` (Slices 1–4b merged).
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D8's "No blind retry" (amended 2026-11-06), D11 (the row), and the PR #226 ledger's F-04 row.
**Why:** Okey's answers to the live-pass checklist (2026-11-06):
1. A temporary failure should let him press Apply again. **Task 1.**
2. He wants a settings row for `proseMinion.workshop.fileEdits`. **Task 2.**
3. A refused Apply's reason may stay unpersisted across a reload. **No change.**

## Task 1: transient refusals return to pending

### What changed

- **Two more refusals return the card to `pending`**, through the boundary refusals' own path (`workshopFileEditSettlementOf` → `{ state: 'pending' }`). The handler records that like any settlement, so the next flush persists `pending` over the durable `applying`. The two refusals are:
  - `catalog-unreadable` at Apply (the gateway's candidate read failed);
  - `host-failed`.

  `WORKSHOP_FILE_EDIT_TRANSIENT_REFUSALS` in `WorkshopFileEditSettlements.ts` lists them, beside `WORKSHOP_FILE_EDIT_BOUNDARY_REFUSALS`.
- **The answer carries the reason.** A pending card stores no reason (the session codec's `NO_REASON` rule), so the reason rides on the answer only: `workshopFileEditRetryReasonOf(outcome)` gives it, and the handler answers `settled` / `joined`, `state: 'pending'`, `reason`. The words come from the existing table:
  - `catalog-unreadable`: "The project’s configured files could not be listed."
  - `host-failed`: "The editor could not make the change."

  No new kind was added.
- **A boundary refusal is unchanged.** It is still `pending` with no reason on the answer, so its line is still the pending state's.
- **The webview needed no change** (confirmed, with a witness). `useWorkshopFileEdits` keeps an answer's words when the answer left the card `pending`, including `settled` and `joined`, and a `pending` card draws Apply. A new hook test pins this: the words kept, and Apply posting again.

### The safety rule: a retry is offered only when nothing could have landed

`ProjectFileEditGateway` now tells a failure before dispatch from one after it.

- **The dispatch mark.** `apply` holds a `Dispatch` flag. `beforeAttempt` sets it as its last step, after every check passes, immediately before the applier calls `applyEdits`. The applier runs `beforeAttempt` synchronously before every call (D7.6), the retry included, so the flag is set exactly when an `applyEdits` call may follow.
- **The catch-all.**
  - Flag unset: refused, `host-failed`, nothing written. That covers a throw in the catalog, the containment stat, open, planning, the applier's checks or its watch.
  - Flag set: `unknown`, every operation `unknown`, no reason (the card reads `outcome-unknown`).

  A line `[FileEdit] apply threw … dispatched=<bool>` logs which (ids only).
- **The read-back's `failed`.** `report()` reaches `host-failed` only after its `landed > 0` and `unknown` checks. So a host that answered `failed` and whose read-back found nothing landed and nothing unknown wrote nothing, and returns to `pending`. A host that answered `failed` after writing reads as landed (a control test).
- **A crash between the checkpoint and the flush** still reads `unknown` on reopen (`applying-on-reopen`), which is safe.
- **Unchanged:** `unreadable` and every other refusal stay terminal. A preview's refusals are already retried on reopen (PR #234 F-02).

### Decisions

1. **The flag lives in `beforeAttempt`, not around the applier's call.** A throw inside `applier.apply` before its first `applyEdits` (its checks, its watch) wrote nothing. A flag set around the whole call would read that as `unknown` and offer no retry where one is safe. `beforeAttempt` is the applier's documented "immediately before every `applyEdits`" seam (D7.6), so the gateway needs no new applier contract.
2. **A throw after dispatch reads `unknown` unless the read-back settled the landing first.** Before this slice, the catch-all called any throw `refused` / `host-failed`, which could claim nothing was written while edits had landed. A failure to show the document (step 8) is now caught on its own and keeps the settled `applied` / `partial` result, with `revealed: false` (PR #236 N-01, below). Any other throw after dispatch reads `unknown`.
3. **The reason is not stored**, as Okey answered (point 3). After a reload the card is plainly `pending`.

### Questions for the live pass

1. **Other refusals that write nothing.** These are terminal today and stay so. Each describes the project's state more than a passing failure, and the writer can fix most of them and ask the persona again:
   - `unreadable`: VS Code could not open the file as text. A file locked by another program is transient; a binary or deleted file is not.
   - `outside-workspace`: a workspace folder was removed.
   - `no-longer-configured`: the file left the context paths.

   Should any of them return to `pending`?
2. ~~**`reveal` failing after a landing.**~~ Settled by the PR #236 review (N-01): the read-back's result is kept. The coordinator tells Okey.

## Task 2: the settings row

### What changed

- **The row.** It sits on the Behavior tab (`WorkshopBehaviorSettingsPanel`), after Initiative, under the rule "Suggested file edits". It has two option cards:
  - **Off:** "Personas never propose edits to your files."
  - **Ask first:** "Each edit waits as a card, with its changes, until you press Apply."

  Below them is a one-line note: "Personas may propose edits to notes and chapters; nothing changes until you press Apply."
- **The draft.**
  - The modal (`WorkshopConversationBehaviorModal`) holds a fifth draft, `fileEditsDraft`, which starts from the host's mode on open.
  - The draft goes out as `onApply`'s fifth argument.
  - Like the memory mode, a pending apply settles only when the host's snapshot holds the submitted mode.
- **The round trip.**
  - **Messages.** `WorkshopSetConversationSettingsPayload.fileEdits` is required. `WorkshopSessionStatePayload.fileEdits` is optional and always sent: absent reads `ask`, the setting-unset rule.
  - **Webview.** `useWorkshopRoom` holds `fileEditsMode`. Its `setConversationSettings` posts the draft, or the host's mode when no draft is given, so an untouched row never changes the setting.
  - **Host.** `WorkshopRoomHandler` passes `fileEdits` to `applyFromWebview`, reports its persistence error as `file edits: …`, and puts `getFileEditsMode()` in every session state.
- **The write, generalized from the memory mode's.** `WorkshopConversationSettingsPartialApply.ts` now holds one `WorkshopGlobalModeSetting<Mode>` (get, write, rollback), built twice (`workshopProjectMemoryModeSetting`, `workshopFileEditsModeSetting`).
  - **Order.** `applyFromWebview` writes memory, then file edits, then rebuilds the prompts.
  - **A failed apply.** `undoWorkshopGlobalModeWrites` sets them back, the last written first, each only while the setting still holds what this apply wrote. A newer external choice stands.
  - **A refused write back** raises `WorkshopConversationSettingsPartialApplyError`, now naming each mode it left (`projectMemory?`, `fileEdits?`).
  - **The words.** `workshopConversationSettingsPartialApplyWords` says which modes stand, one or both, and replaces the handler's own words table.
  - **A refused write** is reported as `persistenceErrors.fileEdits`, and the mode stays as it was.
- **Sync with no reload.**
  - An apply writes the setting before the rebuild. The service's `fileEditsPrompted` sees the change and rebuilds the persona prompts.
  - An edit in VS Code Settings reaches the room through the existing watcher (`MessageHandler`'s `workshop.fileEdits` key → `syncConversationSettingsFromSettings`). The snapshot then carries the new mode to the webview.
- **Coercion.** An unknown webview value is written `off` (fail closed). An absent one writes nothing.

### Why the Behavior tab, not Memory

- **The Memory tab is about project memory**: what personas remember. Its explainer ("Memory isn't context"), its budget meter and its unavailable-workspace notice are all about memory's own storage. A row about editing the writer's files there would read as part of memory, and an unavailable memory folder has nothing to do with file edits.
- **The Behavior tab's Initiative section** already holds what a persona may offer on its own ("Use tools & widgets"). Suggested file edits is the same kind of permission, a persona's initiative on the writer's behalf. It is placed after Initiative and drawn with the same option cards as the tab's other choices, since the options are named "Off" and "Ask first" rather than a bare switch.
- **One draft, applied together.** The tab already applies with the others, so the row needs no new footer words.

## Tests

- **`WorkshopFileEditHandler.test.ts`** (+5):
  - each transient reason → `pending`, with the answer's reason and words, then a second Apply that lands (two checkpoints, one more gateway call);
  - a joined request gets the same reason;
  - control: `unreadable` stays `refused` and replays;
  - control: a boundary refusal is unchanged (pending, no reason, the pending line).
- **`ProjectFileEditGateway.test.ts`** (+5):
  - a throw before dispatch (open; the applier's watch) → refused `host-failed`, zero `applyEdits`, `dispatched=false`;
  - a throw after `applyEdits` that wrote → `unknown` by operation, no reason, `dispatched=true`, no leak;
  - a throw on the retry after a first attempt went out → `unknown`;
  - the read-back's `failed` with nothing landed → refused `host-failed`, `not-applied`;
  - control: `failed` after writing reads as landed.
- **`fileEditApply.integration.test.ts`** (+2, the real coordinator, store, staging, gateway and applier):
  - a catalog failure at Apply → `pending` with its reason, saved `pending` after the flush, then a second Apply lands once;
  - an exception after `applyEdits` → `unknown` (`outcome-unknown`), no second write, replayed, and still `unknown` after save and reopen.
- **`WorkshopFileEditSettlements.test.ts`** (+4): the two transient rows and an `unreadable` control (a pending settlement holds nothing else); `workshopFileEditRetryReasonOf` for each case.
- **`useWorkshopFileEdits.test.ts`** (+1): a transient refusal settled back to pending keeps its words, and Apply posts again.
- **Regressions fail without the fix.** With the production changes stashed, 8 of the new tests fail: the five transient handler and gateway cases and both integration cases. Every control passes either way. The integration test's `unknown` case also fails if only the settlement changed: the gateway alone would have turned that throw into a retryable `host-failed`.
- **`WorkshopConversationSettingsFileEditsApply.test.ts`** (new, 12):
  - written before the rebuild, the rebuild seeing it;
  - turned back on with no reload;
  - an unchanged or absent draft writes nothing, and an unknown one writes `off`;
  - a refused write is reported, the mode kept;
  - an external edit read back;
  - failed applies set back, in both directions, with the watcher finding nothing to rebuild;
  - with memory changed in the same apply, both are set back, the last written first;
  - a newer external choice stands;
  - a refused write is never rolled back;
  - a refused rollback names the mode, with the words;
  - both refused: both named;
  - the log line.
- **`WorkshopRoomHandler.fileEditsSetting.test.ts`** (new, 6, the real router and room handler):
  - the session state names the mode (unset → `ask`, `off`, unknown → `off`);
  - an apply writes it and the snapshot reads it back;
  - a failed apply is set back;
  - a refused rollback names "Suggested file edits are now Off".
- **`WorkshopConversationBehaviorModal.fileEdits.test.tsx`** (new, 6):
  - the row on the Behavior tab, the host's mode selected, the note;
  - a draft until Apply, sent fifth;
  - an untouched row sends the host's mode;
  - the apply settles only when the host holds the mode, with the cards locked meanwhile;
  - reopened from the host's mode;
  - an external change becomes the next draft.
- **`useWorkshopRoomAndSessions.test.ts`** (+1): it holds the host's mode, and posts it unless a draft is given.
- **Updated for the new field:** the modal's two suites (`onApply`'s fifth argument, the `fileEditsMode` prop) and the room hook's payload test. The memory-mode suites (`WorkshopConversationSettingsMemoryApply`, `WorkshopRoomHandler.memoryModeRollback`) run unchanged.

## PR #236 review fixes

The review is Astra's, at `8450dd8c`, in [`docs/pr-reviews/pr-236-retry-and-settings-review.md`](../../../docs/pr-reviews/pr-236-retry-and-settings-review.md). It found no unsafe retry in the dispatch or checkpoint path.

- **F-01 (P2): a refused mode change read as active for the session.** A global mode VS Code refuses to write never took effect, but it was reported with the behavior and profile persistence errors as "changed for this session". The project-memory mode had the same wording, so both are fixed together.
  - **The service.** It now reports `modeRefusals` (`{ error, effective }` per mode) apart from `persistenceErrors`, which keeps only settings that are active but unsaved.
  - **One report.** `workshopConversationSettingsApplyReport` (pure, in `WorkshopConversationSettingsPartialApply.ts`) words the outcome, with its details and log line:
    - a refused mode: "VS Code could not change suggested file edits, so they are still Ask first." / "VS Code could not change project memory, so it is still Off.";
    - a mixed apply adds "Your other conversation settings were applied.";
    - settings active but unsaved keep their sentence.
  - **The handler** posts that report, and shrank to 1,691 lines.
  - **Tests.** In `WorkshopRoomHandler.fileEditsSetting.test.ts`: Astra's route witness, a mixed apply and the memory mode. All three fail without the fix. The two service tests of a refused write now expect `modeRefusals`.
- **F-02 (P2): an untouched mode row went stale and wrote over a newer choice.**
  - **The fix.** The modal's two global-mode rows are `undefined` until the writer picks one, and meanwhile follow the host's mode (`memoryPick ?? projectMemoryMode`, `fileEditsPick ?? fileEditsMode`). Opening the modal resets the picks only, so the other drafts are untouched.
  - **The conflict policy.** A row the writer picked keeps their choice through a newer host mode, and Apply sends it. That is deliberate: it is the writer's last edit.
  - **Tests.** Astra's witness, and the same case for the memory row, both fail without the fix. Each has a control in which a deliberate pick survives a host update, with the Behavior draft kept.
  - **A residual window.** An untouched row sends the host's mode as the webview last heard it. A VS Code edit that lands after the snapshot was posted and before the apply reaches the host could still be written over. The window is the length of a message round trip. Omitting an untouched field would close it, but Astra's witness pins the latest host mode being sent, so I kept that contract. Flagged for review.
- **N-01 (nonblocking, done): a reveal failure keeps a settled landing.** Step 8 is now `ProjectFileEditGateway.reveal`, which catches its own failure, logs `[FileEdit] reveal failed turn=… index=…` and answers `false`.
  - The applied or partial result, its outcomes and its landed records stand.
  - A throw before the read-back settles still reads `unknown`.
  - **Tests.** In the gateway: applied and partial, each with `revealed: false`. In integration: applied through save and reopen, with the next Apply replayed and no second write. All three fail without the change.
  - **Astra's probe superseded.** Her `reveal-only failure … persists unknown` probe asserted the earlier behavior and now fails by design.
  - The ADR's D8 note says this.

## Verification

- **Baseline** at `9f70f236`: typecheck clean; lint 0 errors, 1,165 warnings; jest 785 suites, 10,988 tests, 59 snapshots. The jest count is derived: the baseline run overlapped my first edits, so it is the final run less the 42 tests and 3 suites this slice adds. The three suites that were mid-edit were rerun clean at `9f70f236`, 40 tests passing.
- **After:** typecheck clean; lint 0 errors, 1,165 warnings (no new); jest 788 suites, 11,030 tests, 59 snapshots, all passing.
  - The first full run caught `MessageHandler.test.ts`'s fake settings service, which lacked `getFileEditsMode`, now in every session state. Its two failing tests were fixed by adding the method (the suite passes, 26 tests).
- **Updated test, beyond the ones listed above:** `MessageHandler.test.ts`'s fake gains `getFileEditsMode`.
- **File sizes.**
  - `WorkshopConversationSettingsService.ts`: 491 → 499, kept under 500 by moving the mode-error gathering into the partial-apply module.
  - Over-500 files grew only by the seam:
    - `WorkshopRoomHandler.ts` 1,706 → 1,708 (its words table moved out);
    - `useWorkshopRoom.ts` 923 → 933;
    - `WorkshopApp.tsx` +1;
    - `messages/workshop/session.ts` +6.
  - Every new file is under 500 lines.
- `packages/core/src` has no `from 'vscode'`. Logs carry ids, counts, states and kinds only. Fixtures use *Alice*.
