# PR #236: Persona File Edits Slice 4c review

## Verdict

**Scoped code review approved at `300a0e61`: F-01, F-02 and N-01 are closed.** The delayed-snapshot race now passes through the production modal, room hook, router and settings service for both global modes. Untouched modes are omitted end to end, and pending Apply waits only for explicitly selected modes. No unsafe retry was found. This review changes only its report and text test witnesses, not production code. No merge was performed. Exact-head CI is reported separately below and in the PR follow-up.

- PR: <https://github.com/okeylanders/prose-minion-vscode/pull/236>
- Initial reviewed code: `8450dd8cd39b72443a5fc7719fa01f778e6929f7`
- Correction: `3d8942f`, with documentation head `d286d41fadc1df7c09ddbf32898dc6771a251421`.
- Intermediate reviewed code: `9bfce925305a5b9a5eee309b1de3fca3e011680f`, including the epic sync at `9dfa293f8a6cb5a62a49f7cffbf4ab5dd60cdaeb`.
- Final correction: `21a54625`, with reviewed documentation/test-lint head `300a0e61f2a7f8be4edba540dd2232e48f855d85`.
- The initial findings and original validation below are retained as history; the current correction review is appended.
- Base: `9f70f23676250e629dabec4790f60d80c74db987`
- Reconciliation: the PR had no existing comments or reviews when this pass began. Earlier #233 and #234 review artifacts were read as dependency context; their closed findings are not reopened here.
- Scope: transient refusal settlement, dispatch tracking, retry authorization and persistence, the new settings row and message round trip, generalized mode writes/rollback, and regression tests.

## F-01 (P2, closed at `d286d41f`): A rejected Off write is described as active for this session

**Anchor:** [`WorkshopRoomHandler.ts:459–468`](https://github.com/okeylanders/prose-minion-vscode/blob/8450dd8cd39b72443a5fc7719fa01f778e6929f7/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L459-L468).

`fileEdits` now joins `persistenceErrors`, but a global-mode write failure differs from a behavior/profile persistence failure. `WorkshopGlobalModeSetting.write` leaves the effective setting unchanged on rejection, and the file-edit gate reads that setting live. If the writer chooses Off and VS Code refuses the settings write, the room still reports `fileEdits: 'ask'`. The handler nevertheless says: “Conversation settings changed for this session, but VS Code could not save them for restart.”

That tells the writer the requested disable took effect temporarily, although proposals and the Apply gate remain enabled. The modal also retains its submitted Off draft after the error, making this especially misleading. The service-level refusal test correctly verifies that the mode stays Ask first; the route-level suite does not cover the corresponding message.

**Required correction:** distinguish unapplied global modes from session-active settings whose persistence failed. Say which requested mode could not be changed and which mode is still effective. For a mixed submission, preserve truthful reporting of behavior/profile changes that did apply. Do not silently fall back to a session-only permission mode.

**Independent reproduction:** [route witness](probes/pr-236-file-edits-refusal.test.ts.txt). It uses the real router, room handler and settings service, with only the settings port rejecting the Off write. The snapshot assertion (`ask`) passes; the assertion that the error must not claim “changed for this session” fails on the reviewed code.

## F-02 (P2, closed at `300a0e61`): An untouched open modal can overwrite a newer Off choice

**Anchor:** [`WorkshopConversationBehaviorModal.tsx:111–122`](https://github.com/okeylanders/prose-minion-vscode/blob/8450dd8cd39b72443a5fc7719fa01f778e6929f7/packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx#L111-L122), with unconditional submission at [169–181](https://github.com/okeylanders/prose-minion-vscode/blob/8450dd8cd39b72443a5fc7719fa01f778e6929f7/packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx#L169-L181).

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

## N-01 (nonblocking, closed at `d286d41f`): Keep a known landing when only reveal fails

The slice explicitly raises this question. The initially reviewed conservative behavior was safe against duplicate application: reveal throws after a known landing and the whole proposal becomes unknown, without another Apply. However, a UI reveal failure need not erase a conclusive edit result or its landed records. Prefer isolating step 8, retaining applied/partial and the operation outcomes, returning `revealed: false`, and separately logging the reveal failure. Keep exceptions before conclusive reconciliation unknown. This is a follow-up recommendation, not an unsafe-retry finding.

## Initial verification at `8450dd8c`

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


## Correction review: `9bfce925` (2026-11-07)

Reconciled the two existing inline threads and the author's re-review request before this pass. The author explicitly flagged the residual notification race. The merge from the epic introduces the Bookmark Recall and Helper Agent integration; the scoped settings/retry behavior was checked at the merged head, rather than assuming the earlier correction checks still applied.

**F-01 closed.** Refused global-mode writes have their own `modeRefusals` result, including the effective mode, separate from `persistenceErrors`. The room reports that suggested file edits could not be changed and are still Ask first. The original real-route witness passes unchanged. The independent mixed-result control also passes: Behavior changes to Analyze but cannot be saved, while Off is refused; the response distinguishes the still-active Ask first mode from the session-active, unsaved Behavior change. The same correction covers memory modes without weakening rollback.

**F-02 remains open: preserve intent, not a cached mode.** The modal now tracks optional explicit picks. An untouched row follows each snapshot that reaches it, while deliberate picks and unrelated drafts survive host updates. This fixes the original witness. It does not protect a host update that has not arrived in React yet.

Current source anchors:

- [Modal: displayed drafts and submission, lines 105–111 and 169–185](https://github.com/okeylanders/prose-minion-vscode/blob/9bfce925305a5b9a5eee309b1de3fca3e011680f/packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx#L105-L111): `memoryPick`/`fileEditsPick` retain intent, but `onApply` receives the resolved `memoryDraft`/`fileEditsDraft` even when neither was picked.
- [Room hook, lines 570–587](https://github.com/okeylanders/prose-minion-vscode/blob/9bfce925305a5b9a5eee309b1de3fca3e011680f/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts#L570-L587): passing `undefined` alone is insufficient because default arguments replace it with the cached host modes.
- [Host service, lines 112–129](https://github.com/okeylanders/prose-minion-vscode/blob/9bfce925305a5b9a5eee309b1de3fca3e011680f/packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts#L112-L129): absent modes already mean leave unchanged, but a stale explicit `ask` is a new write over the effective `off`.

Reproduction:

1. Open Conversation settings while the webview knows Ask first.
2. Change the host's effective global mode to Off, withholding its next session-state notification.
3. Leave that mode row untouched; select only Analyze and apply.
4. The real modal and hook send `ask`. The real host route applies Analyze and writes the global mode back to Ask first.

The [six-case delayed-snapshot witness](probes/pr-236-delayed-modes.test.tsx.txt) has **three expected failures and three passing controls** at this head. Both untouched-mode cases fail (`off` expected, `ask` received); the hook also fails the omission contract by synthesizing both cached `ask` values. Controls show that deliberate picks still take effect and that the host already preserves both effective Off settings when the fields are absent. Thus this is a missing expression of user intent in the message, not an unsafe retry or a host refusal.

**Required complete correction:**

1. Continue displaying the live host mode for untouched rows, but submit only explicit picks for both global modes.
2. Preserve omission through `useWorkshopRoom`; remove its cached-mode defaults for these optional fields. The host service already handles absence; the shared payload type must expose optional modes too.
3. Make pending/apply settlement require equality only for modes actually submitted. Do not leave an unrelated Apply waiting for a stale, unsubmitted mode. Retain the existing error unlock and deliberate-pick behavior.
4. Cover delayed snapshots, explicit picks, omitted-hook fields, host no-write behavior, and successful modal settlement without discarding other drafts.

The original witness's expectation that an untouched row sends the latest observed value was a way to expose the stale-draft defect, not a requirement to keep writing untouched modes. It should be updated to the omission contract. The safety requirement is that an unrelated Apply must not undo a newer Off. This remains P2 despite the short timing window; no native timing/frequency estimate is claimed.

**N-01 closed.** The gateway catches reveal failures separately and returns `revealed: false` while preserving the conclusive edit outcome and landed records. Gateway coverage includes full and partial landings. The independent production-stack witness now requires applied state, the actual bounded before/after record, durable applied state, and no second dispatch after another Apply. It passes. The existing `fileEditApply.integration.test.ts` additionally confirms save/reopen retains applied state. Dispatched throws before conclusive read-back still become unknown; pre-dispatch failures and conclusive non-landings still permit a new authorized Apply.

**Retry safety rechecked.** Dispatch tracking spans the applier's attempts; each attempt rechecks authority and policy immediately before dispatch. Landed/unknown reconciliation precedes any `host-failed` retry result. New Apply requests still claim the card, checkpoint applying to current/named storage, and recheck live Off/run/room gates. Interrupted applying reopens as unknown. No new retry-safety defect was found. The four-case independent witness checks durable state but does not itself reopen or exercise its optional named-session branch; those broader cases are covered by the separate integration suite and production-path inspection.

### Intermediate-head verification at `9bfce925`

- Node `v24.22.1`, unchanged production tree at `9bfce925`.
- **15 existing focused suites / 259 tests passed**: gateway, apply integration, handler, settlement, room setting route, settings service/file-edit/memory paths, all three modal suites, room/session hook, and file-edit hook.
- **Four independent suites / 19 tests: 16 passed and 3 expected failures**. Thirteen passing cases are the original three suites with the F-01 mixed-result and N-01 corrections; the delayed-snapshot suite contributes three passing controls and the three failures described above.
- All three local typecheck targets passed. Local lint: **0 errors / 1,165 warnings**, unchanged. Local production build and bundle verification passed, with the existing three webpack size/performance warnings.
- Exact-code-head [CI run 42356534441](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42356534441) passed typecheck, **796 suites / 11,179 tests / 59 snapshots**, lint and both webpack bundles. The logs and individual job steps were checked. Full tests were not rerun locally.
- The `.txt` witnesses do not join the ordinary test gate. Green CI therefore does not close F-02. Temporary test copies were removed after validation.
- No native Extension Development Host run, actual cross-window VS Code timing test, visual/theme/accessibility pass, or live model call is claimed. Automated checks do not replace Slice 5's native-host acceptance.
- Report-head CI is checked separately after publication; the reviewed code-head pass is not substituted for the report commit's status.

To rerun all independent cases, copy the three original witnesses as described above, plus `pr-236-delayed-modes.test.tsx.txt` to `packages/core/src/__tests__/presentation/webview/components/workshop/Review236DelayedModes.test.tsx`. Run `npm test -- --runInBand --testPathPattern='Review236(DelayedModes|Independent|RetryIndependent)'`, then remove the temporary copies. At `9bfce925`, expect exactly the three delayed-mode failures, with all other cases passing.


## Final correction review: `300a0e61` (2026-11-07)

The author supplied `21a54625` while the preceding review publication's CI was running, followed by `300a0e61` for test lint and recorded counts. The previous changes-requested verdict applies to `9bfce925`; it is superseded by this scoped approval after checking the new production diff and rerunning the witnesses.

**F-02 closed across the complete path:**

- The modal still displays `pick ?? hostMode`, so untouched rows follow received host updates and explicit picks survive them. Apply sends the optional picks themselves.
- `useWorkshopRoom.setConversationSettings` no longer defaults omitted modes from its cached state. Its payload includes a mode only when a pick was supplied.
- `WorkshopSetConversationSettingsPayload` now marks both modes optional. This makes the wire type match the host service's existing leave-absent-modes-unchanged behavior.
- Pending Apply stores only submitted modes and checks only those modes on settlement. Production tests prove that an unrelated host-mode change neither blocks an unpicked row nor prematurely satisfies a picked row.
- Abandoned picks still reset on reopen, deliberately picked rows still win under the chosen conflict policy, unrelated Behavior drafts survive host updates, and the existing refusal/error unlock behavior is retained.

The [six-case delayed-snapshot witness](probes/pr-236-delayed-modes.test.tsx.txt) passes without changing any assertions: both delayed Off cases, both explicit-pick controls, omitted-mode host preservation, and hook omission. The author also ported those six cases into `WorkshopConversationSettingsDelayedModes.test.tsx`, so they now run in the production test gate.

The earlier [external-mode text witness](probes/pr-236-file-edits-external-mode.test.tsx.txt) is updated only for the deliberate omission contract: untouched mode arguments are undefined, including the untouched memory argument beside an explicit file-edit pick. It continues to test received host updates, explicit Off, pending settlement, and reopening. The retry/reveal and refusal witnesses still pass. No production source was edited by this review.

Final local verification, Node `v24.22.1`, at unchanged production code `300a0e61`:

- **16 existing focused suites / 266 tests passed**, including the newly ported delayed-mode suite.
- **Four independent suites / 19 tests passed**. The three failures recorded at `9bfce925` are now resolved.
- All three typecheck targets passed; lint passed with **0 errors / 1,165 warnings**; production build and bundle verification passed with the same three webpack size/performance warnings.
- Full local tests were not rerun. Exact-code-head [CI run 42397076496](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42397076496) is checked independently of the earlier report commit's successful [run 42396331223](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42396331223). Final code/report CI outcomes are posted in the PR follow-up rather than inferred from an earlier commit.
- No native-host or live-model acceptance is claimed; Slice 5 remains the native acceptance boundary.

The rerun commands above remain valid, but at `300a0e61` all 19 independent cases pass. Temporary copies were removed after validation. No merge, production fix, deployment or live provider call was performed by this review.
