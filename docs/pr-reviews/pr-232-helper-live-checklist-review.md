# PR #232 review: Helper Agent live-pass checklist

## Follow-up documentation review

**Written approval extended to `0392603d55c4ec1da636e2696e1bd1402a19177c`. No blocking finding.** Its only change from report-publication head `1df70726` is the checklist: N-01's safe-preview distinction, N-02's manually typed early-save test, and N-03's new-sheet off/on test and restored model/key are now explicit. All three nonblocking instructions below are incorporated. The native/live-model pass and ADR acceptance remain pending.

The complete follow-up diff and `git diff --check 1df7072 0392603` were checked. No production or test file changed. The 10 focused suites / 145 tests were also rerun successfully on `1df70726`. Both the original reviewed head's [CI 42136618245](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42136618245) and first report-publication head's [PR CI 42137287953](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42137287953) have passed: all typechecks, 761 suites / 10,608 tests / 59 snapshots, lint 0 errors / 1,165 existing warnings, both bundles and sentinel verification. The three existing bundle size/performance warnings remain. Final-head CI is recorded in the PR conversation, not assumed from those older green runs.

## Verdict

**Written approval of the documentation at `3b5fe0f19a2dbeb035c725b5defa60cca995df2b`. No blocking finding.** The checklist is consistent with the implemented Helper Agent and keeps the actual native/live-model pass and ADR acceptance as future work. This is not a claim that the live pass has happened, a formal self-approval, or permission to merge.

- PR: [#232](https://github.com/okeylanders/prose-minion-vscode/pull/232).
- Branch: `claude/vibrant-shannon-croyue`; base: `epic/helper-agent`, `550a64913286f2e3287aef598b2336284b8a8533`.
- Reviewed: 2026-11-06.
- Scope: both changed documentation files, the ADR, prior #225/#228/#231 findings and correction reports, and the production paths/tests behind the checklist's expectations.
- Duplicate check: no comments or submitted reviews existed when this review began.
- The reviewed diff changes **two documentation files only**. Relative to #231's approved report-publication head `307ff8a0`, the entire repository delta is also those two documentation files. The executable implementation and its regression tests are unchanged.

## What checked out

1. **Merge history is accurate.** `c040cb6` is the #225 spec merge, `9bd8ac9` the #228 engine merge, and `550a649` the #231 memory-drafting merge. All are ancestors of this head. The README accurately distinguishes completed code from the pending live pass.
2. **Model selection matches D3.** The Helper setting is empty by default and follows Proofread through `MODEL_SCOPE_FOLLOWS`. The Settings overlay offers “Same as Proofread (…)”; picking gives Helper its own model, and selecting the empty option resumes following. The resolved model is pinned before prompt preparation. The checklist exercises both overlay and host-setting behavior rather than only the pure resolver.
3. **The sheet behavior matches D5.** Ordinary writer/reply sheets request by host-owned identifiers, show placeholders rather than values, and fill only untouched title/summary/kind fields. The helper never changes the body. Close/reopen owns a fresh request; Save cancels the outstanding draft and freezes the values submitted. Normal validation continues to govern Save.
4. **#231 F-01 remains correctly resolved.** Capability-card bubbles and their in-window bookmarks preserve their report body and withhold drafting. The host independently withholds a bubble/projection mismatch. Saved and out-of-window bookmarks can still draft from the safe preview that their sheet actually holds. No capability evidence is newly exposed.
5. **Off and failure are distinct.** A new sheet opened with the setting off makes no helper request or placeholder. The host independently gates requests. Unconfigured, failed, refused and malformed outcomes preserve editable fields and produce the one quiet line. Restoring the switch is pushed without a reload.
6. **Usage and limits match the engine.** Helper uses the shared usage fanout, a capability-free policy, no retained conversation, temperature 0 and a 400-token output ceiling. Cut-off/invalid answers are rejected. Helper logs contain metadata, not the source note. Real-model quality, price and latency are appropriately left to the live pass, not inferred from mocked-provider tests.
7. **Close-out is properly conditional.** The ADR is still Proposed, the pass's findings area is empty, `AGENTS.md` updates are listed for afterward, and D6 `project-locations` remains explicitly unbuilt. No acceptance or completion is fabricated by this PR.

## Nonblocking instructions for the live pass

These clarify how to execute the existing checklist; they do not reopen the earlier corrected findings or require production changes.

### N-01: Keep the capability bookmark cases distinct

At [steps 8–9](../../.todo/archive/epics/epic-helper-agent-2026-11-05/slice-3-verify-live.md#drafting-in-the-memory-sheet-d5), use an ordinary writer/persona message for “It drafts the same way.” For a capability card, explicitly check all three source cases:

- **Bubble / in-window Remember this:** the sheet contains the report; no draft request, placeholder or failure line.
- **Outside-window Remember this:** the sheet contains the safe operation/status preview, and that preview may be drafted.
- **Saved-session Remember this:** likewise drafts the safe saved preview, not the original report evidence.

This is the deliberate resolution of #231 F-01, not an inconsistency. The production integration tests and the earlier correction report cover the distinction; recording it in the live notes prevents treating a valid saved-preview draft as a regression.

### N-02: Type the required fields yourself for “Saving early”

At step 11, manually enter a valid title and summary **before** the helper answers, then press **Save to memory**. Waiting for the helper to fill both fields ends the pending state and does not exercise early-save cancellation. Confirm the saved note contains the typed values even after the old reply could have arrived. The existing hook and sheet tests explicitly cover this route.

### N-03: Reopen a sheet for the off/on test

At step 12, close the current sheet before each off/on opening. The switch gates new requests; it does not revoke a request already accepted or restart a sheet opened while off. This is the same nonblocking switch-lifetime clarification recorded in the #231 review, not a new defect. After step 13, restore the model/key before recording normal cost and latency. Prefer a temporary invalid Helper model setting over deleting a key that would need to be re-entered.

For the normal-body check, use a short source: the sheet retains its pre-existing 8,000-UTF-16-unit bound. “Unchanged” means unchanged by the helper, not removal of that bound. For logs, successful dispatched calls name the model; a no-key/preparation refusal need not have a model to name.

## Verification

- Exact reviewed head checked out locally. `git diff --check 550a649 HEAD`: passed.
- Lockfile byte-identical to the existing #231 checkout; its installed dependencies were reused by a local symlink. No dependency/lockfile modification.
- **10 focused production suites / 145 tests pass**, covering the checklist's resolver/overlay, helper resource scope/service/codec/prompt, host handler, hook, sheet and cross-layer source behavior. [Commands and result](probes/pr-232-helper-checklist-verification.txt).
- The prior #228/#231 independent probes and their successful correction results were read as earlier evidence. No new independent probe count is claimed here.
- Exact reviewed-head PR CI [run 42136618245](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42136618245) identifies head `3b5fe0f19a2dbeb035c725b5defa60cca995df2b` and base `550a64913286f2e3287aef598b2336284b8a8533`. At report preparation it was still running: typechecks had passed, tests were running, lint/build had not completed. The final result and the report-publication head's checks are recorded separately in the PR conversation.
- No local full-suite, typecheck/lint/build rerun, Extension Development Host visual pass or live provider call is claimed for this documentation review. CI supplies the aggregate automated gate when it finishes; the native/live-model checklist remains pending.

Only this report and its verification record are published. No production edits, merge, auto-merge, deployment or ADR acceptance. #205 remains untouched.
