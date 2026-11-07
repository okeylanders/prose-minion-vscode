# PR #236: Persona File Edits Slice 4c review

## Verdict

**Changes requested at `8450dd8c`: two P2 settings findings remain open.** No unsafe retry was found in the reviewed dispatch/checkpoint path. This review changes only its report and text test witnesses, not production code. No merge was performed.

- PR: <https://github.com/okeylanders/prose-minion-vscode/pull/236>
- Reviewed code: `8450dd8cd39b72443a5fc7719fa01f778e6929f7`
- Base: `9f70f23676250e629dabec4790f60d80c74db987`
- Reconciliation: the PR had no existing comments or reviews when this pass began. Earlier #233 and #234 review artifacts were read as dependency context; their closed findings are not reopened here.
- Scope: transient refusal settlement, dispatch tracking, retry authorization and persistence, the new settings row and message round trip, generalized mode writes/rollback, and regression tests.

## F-01 (P2): A rejected Off write is described as active for this session

**Anchor:** [`WorkshopRoomHandler.ts:459–468`](https://github.com/okeylanders/prose-minion-vscode/blob/8450dd8cd39b72443a5fc7719fa01f778e6929f7/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L459-L468).

`fileEdits` now joins `persistenceErrors`, but a global-mode write failure differs from a behavior/profile persistence failure. `WorkshopGlobalModeSetting.write` leaves the effective setting unchanged on rejection, and the file-edit gate reads that setting live. If the writer chooses Off and VS Code refuses the settings write, the room still reports `fileEdits: 'ask'`. The handler nevertheless says: “Conversation settings changed for this session, but VS Code could not save them for restart.”

That tells the writer the requested disable took effect temporarily, although proposals and the Apply gate remain enabled. The modal also retains its submitted Off draft after the error, making this especially misleading. The service-level refusal test correctly verifies that the mode stays Ask first; the route-level suite does not cover the corresponding message.

**Required correction:** distinguish unapplied global modes from session-active settings whose persistence failed. Say which requested mode could not be changed and which mode is still effective. For a mixed submission, preserve truthful reporting of behavior/profile changes that did apply. Do not silently fall back to a session-only permission mode.

**Independent reproduction:** [route witness](probes/pr-236-file-edits-refusal.test.ts.txt). It uses the real router, room handler and settings service, with only the settings port rejecting the Off write. The snapshot assertion (`ask`) passes; the assertion that the error must not claim “changed for this session” fails on the reviewed code.

## F-02 (P2): An untouched open modal can overwrite a newer Off choice

**Anchor:** [`WorkshopConversationBehaviorModal.ts:111–122`](https://github.com/okeylanders/prose-minion-vscode/blob/8450dd8cd39b72443a5fc7719fa01f778e6929f7/packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx#L111-L122), with unconditional submission at [169–181](https://github.com/okeylanders/prose-minion-vscode/blob/8450dd8cd39b72443a5fc7719fa01f778e6929f7/packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx#L169-L181).

The new file-edit draft is refreshed only when `open` changes. Open Conversation settings at Ask first, then turn the setting Off in VS Code Settings (or another window). The host's new snapshot reaches the modal as `fileEditsMode: 'off'`, but the untouched draft remains `ask`. Change only Behavior to Analyze and press Apply: the fifth argument is `ask`, so the service writes Ask first over the newer Off choice.

This is not an explicit conflicting edit to the permission row. An unrelated settings submission silently reenables it. The new “untouched row” test only covers the initial snapshot, and the external-change test only covers a closed modal.

**Required correction:** track whether the file-edit row was edited. Refresh an untouched draft from the latest host mode or omit that field when unchanged. Preserve a deliberate local draft, with an explicit conflict policy if a newer external change arrives. Do not simply add every prop to the modal's reset effect, which would discard unrelated unsaved drafts. Add an open-modal external-change test and a locally-edited-row control.

**Independent reproduction:** [modal witness](probes/pr-236-file-edits-external-mode.test.tsx.txt). The six existing row tests pass; the additional open-modal test expects `off` in the fifth argument and receives `ask`. The separately passing service test establishes that such an `ask` submission writes the global mode back on.

## Retry, authorization and persistence assessment

- `Dispatch.started` is per Apply and remains set across the applier's own retry. The mark is set after authority, freshness, policy and ceiling checks, immediately before the applier can call `applyEdits`. A later throw cannot be mislabeled as a safe pre-dispatch failure.
- An open/watch failure before dispatch returns retryable `host-failed`. A throw after dispatch returns terminal `unknown`, even when a test fake happened not to write anything: absence of a conclusive read-back is not evidence of non-execution.
- A host `failed` answer alone does not permit a retry. Operation read-back is considered first: landed operations remain applied/partial, unknown operations remain unknown, and only proven non-landings reach retryable `host-failed`.
- A fresh user Apply still traverses the claim, durable `applying` checkpoint and live authorization checks. Returning the card to pending does not itself dispatch another write. Joined requests share the same result and reason.
- A transient settlement marks the session dirty and the next successful flush replaces durable `applying` with `pending`. A crash before that flush stays conservatively unknown on reopen. The refusal reason is intentionally answer-only and is not stored on pending cards.
- The existing integration suite covers duplicate Apply, Apply/Decline races, current/named checkpoints, checkpoint failure, room replacement, authority changes, save/reopen, and a dispatched throw that must never expose another Apply.
- Four additional [production-stack probes](probes/pr-236-retry-boundary.test.ts.txt) passed: pre-dispatch open failure followed by persistence and a retry whose Off gate is honored; a dispatched throw with no conclusive read-back; failed-with-nothing-landed followed by one successful retry; and a reveal-only failure held terminal through save and repeated Apply.

## Settings rollback assessment

The memory and file-edit writes are serialized before the prompt rebuild. Rollback runs file edits then memory, and skips writes this operation did not make or whose current value differs from the value it wrote. Refused rollback reports the effective remaining modes. The existing memory rollback tests still pass after generalization. Unknown submitted modes coerce to Off; absent fields do not write; every host session-state envelope carries the live file-edit mode.

The compare-before-rollback guard is a value check, not a cross-window atomic transaction. This review does not claim it prevents every possible external write between the check and the asynchronous settings update. No new blocking rollback defect was established in this slice.

## N-01 (nonblocking): Keep a known landing when only reveal fails

The slice explicitly raises this question. The current conservative behavior is safe against duplicate application: reveal throws after a known landing and the whole proposal becomes unknown, without another Apply. However, a UI reveal failure need not erase a conclusive edit result or its landed records. Prefer isolating step 8, retaining applied/partial and the operation outcomes, returning `revealed: false`, and separately logging the reveal failure. Keep exceptions before conclusive reconciliation unknown. This is a follow-up recommendation, not an unsafe-retry finding.

## Verification

Local checks at the reviewed runtime code, using Node `v24.22.1`:

- Focused existing suites: **14 suites / 233 tests passed**.
- Independent retry/persistence probes: **4/4 passed**.
- Independent settings witnesses: **2 expected failures reproduced F-01 and F-02; 6 controls passed**. They assert the required corrected behavior, not the defects as success.
- All three typecheck targets: **passed**.
- Lint: **0 errors / 1,165 warnings**, matching the recorded baseline.
- Full local test/build gates were not rerun. The exact-code-head [CI run 42214331248](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42214331248) passed its Node 18 `verify` job, including typecheck, full tests, lint and both webpack bundles.
- Report-head CI is checked separately after publication; the earlier code-head pass is not substituted for the new commit's status.
- No native Extension Development Host run, live model call, visual/theme/accessibility pass, or actual cross-window VS Code interaction is claimed. The UI finding is reproduced with the production component receiving the same host-prop transition.

To rerun the witnesses, copy the refusal file to `packages/core/src/__tests__/application/handlers/domain/workshop/Review236Independent.test.ts`, the modal file to `packages/core/src/__tests__/presentation/webview/components/workshop/Review236Independent.test.tsx`, and the retry file to `packages/core/src/__tests__/application/services/fileEdits/Review236RetryIndependent.test.ts`. Run `npm test -- --runInBand --testPathPattern='Review236'`, then remove the temporary copies. The committed `.txt` artifacts do not join the production test gate.
