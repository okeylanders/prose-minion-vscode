# PR #221 review: Project Memory integration into main

## Verdict

**Written approval at `12e575b32e54703da3b87e25931d631cefbca8b9`, subject to final-head CI. F-01 is independently resolved.** The original finding and reproduction are preserved below. N-01 remains a rare, nonblocking storage hardening note. This is a written review verdict, not a formal self-approval or authorization to merge or release.

- PR: [#221](https://github.com/okeylanders/prose-minion-vscode/pull/221)
- Initial reviewed head: `0f72e83d8ba6e9a36af0149c41b45ac33625c379`
- Correction reviewed: `12e575b32e54703da3b87e25931d631cefbca8b9`
- Head branch: `epic/workshop-project-memory`
- Base: `main`, `d8bb69dc4a23f25435bc97a9dd71f7393e804c1f`
- Initial CI merge candidate: `6cff2facccfbdb6a403afc9bc2734dc2efa63ab2`
- Reviewed: 2026-11-05

## Independent correction review — `12e575b3`

**F-01 is closed.** The correction carries the receipt turn ID through Forget/Restore, stores busy/refusal state per receipt, and renders the host's reason in a `role="alert"` under that receipt. Buttons stay disabled while awaiting the host. The existing room generation now also clears receipt feedback and pending receipt ownership, so a reused turn ID in a replacement room cannot inherit the old answer.

- The original valid-receipt real-App visibility witnesses now pass unchanged. Only the independent hook control needed adaptation to the new per-receipt API.
- **Five independent correction probes pass:** both original failures; unrelated/duplicate correlation and retry/success clearing; concurrent distinct receipts answered in reverse order; room replacement with a reused receipt ID; and real-App pending controls, duplicate clicks and late answers after replacement.
- **29 focused production suites / 425 tests pass**, including memory UI and hooks plus Wayfinding bookmarks, Read in, turn preview and rail tabs. A separate boundary/coexistence lane passes **5 suites / 88 tests**; these counts overlap and are not additive.
- All three local typechecks, lint **0 errors / 1,165 warnings**, both bundles and bundle verification pass again on the correction. The changed hook remains below the module-size ceiling at 496 lines.
- The correction touches only the receipt feedback path, its App wiring/styles and tests. No storage, model-call, session-format or backend write behavior changes. N-01's storage observation therefore remains unchanged.
- [Correction CI 42100110001](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42100110001) is running at report publication. Its terminal result and the report-only publication head's own check will be recorded in the PR conversation. The original head's full pass is not substituted for those gates.

Correction evidence: [probe](probes/pr-221-receipt-refusal-recheck.test.tsx.txt), [run instructions](probes/pr-221-receipt-refusal-recheck-run.txt), [five-test result](probes/pr-221-receipt-refusal-recheck-result.txt), [focused production result](probes/pr-221-receipt-refusal-recheck-focused-result.txt).

## Original F-01 — P2: show refusals from receipt Forget and Restore

**Anchor:** [WorkshopApp.tsx:543–556](https://github.com/okeylanders/prose-minion-vscode/blob/0f72e83d8ba6e9a36af0149c41b45ac33625c379/packages/core/src/presentation/webview/WorkshopApp.tsx#L543-L556).

The App wires `onForget` and `onRestore`, but never consumes `projectMemory.receiptError`. The hook correctly correlates a failed write and stores its reason at [useWorkshopProjectMemory.ts:342–344](https://github.com/okeylanders/prose-minion-vscode/blob/0f72e83d8ba6e9a36af0149c41b45ac33625c379/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopProjectMemory.ts#L342-L344). No component renders that state, and the receipt-control contract has no failure field.

**Independently reproduced through the real WorkshopApp:**

1. Deliver a valid automatic-save receipt, accepted by the production receipt validator and formatted by the production formatter.
2. Click **Forget**. The expected memory action is posted with its request ID.
3. Return the matching host write result with the real `busy` refusal, as when another VS Code window owns the memory's claim.
4. No refusal text appears anywhere in the DOM. Forget has not succeeded, so the note remains available to future memory reads, without the writer being told why it could not be archived.
5. Repeat with **Restore** on a valid forgotten receipt and the real `missing` refusal: it is equally invisible.

The separate hook control passes: unrelated replies are ignored, the correlated failure is recorded, retry/success clears it, and a duplicate old reply is ignored. The defect is the missing presentation wiring, not request correlation or a fabricated receipt shape.

**Requested correction:** show the correlated refusal beside the initiating receipt or in a visible, accessible feedback area. Cover both actions through the App, including retry/success and obsolete-response controls. Do not rely on hook-only assertions. Preserve the appropriate feedback lifetime when the room is replaced.

Evidence: [probe](probes/pr-221-receipt-refusal.test.tsx.txt), [run instructions](probes/pr-221-receipt-refusal-run.txt), [observed result](probes/pr-221-receipt-refusal-result.txt). The two expected visibility assertions fail; the hook control passes. These review-only probes are separate from the passing production suite.

## N-01 — P3, nonblocking: the concurrent ID-collision test covers only equal titles

**Anchor:** [ProjectMemoryStore.ts:223–232](https://github.com/okeylanders/prose-minion-vscode/blob/0f72e83d8ba6e9a36af0149c41b45ac33625c379/packages/core/src/infrastructure/storage/ProjectMemoryStore.ts#L223-L232).

The create path checks the ID against its earlier folder listing, then resolves a late collision only when the final **filename** is occupied. Because the filename contains both the title slug and the ID, two overlapping stores that mint the same ID for different titles can both report `created`. The next listing classifies both as a duplicate-ID conflict, omits both from readable memories, and `read(id)` returns `conflict`.

The existing same-ID race test gives both notes `Same title`, so its no-overwrite rename triggers the retry. The same interleaving with `The Hatter keeps six` and `The Rabbit runs backward` never collides on the filename. A deterministic actual-store probe reproduces this; a sequential control remints correctly.

This requires the same random 24-bit ID to be minted in the overlapping window, approximately one in 16.8 million for a particular pair of independent draws. Both files survive; there is no demonstrated byte loss. It is therefore a low-probability hardening item, not a release blocker. Extend the concurrency test to distinct slugs and either make the commit protocol reserve/check identity independently of the slug or explicitly record this narrower guarantee. A pre-rename re-read alone does not provide an atomic cross-window uniqueness guarantee.

Evidence: [two-test witness and sequential control](probes/pr-221-memory-id-collision.test.ts.txt). Both assertions pass by checking the observed failure state and its control; the witness is not a claim that duplicate identity is desirable behavior.

## Initial-head integration and prior-review reconciliation

- The 302-file diff contains 131 production/configuration files, 118 test/fixture files and 53 planning/review/documentation files. The review covered composition and shutdown, shared storage extraction, memory library and write queue, persona capability and delivery records, proposal/redaction paths, session persistence/projection, settings and the real-App interfaces.
- Every slice merge named in the epic README is an ancestor of this head. Prior reports for #193, #194, #196–#202, #206, #207, #209 and #212 record closure of their findings; the relevant corrected paths and regression tests remain integrated. Historical findings in those ledgers were not treated as currently open.
- `main` is already an ancestor of the reviewed head. The fetched GitHub merge candidate has exactly the stated base/head parents and the same complete tree as the head (`d71241c46b326a239aa55b4bf9ec9b54d07e4677`). There is no unreviewed conflict resolution in that merge candidate.
- Production code, tests, package manifests and CI configuration are identical to the final #212 review head `c35a66b2`. The later epic/main integration changes are documentation only. This narrows integration risk, but does not erase F-01, which the previous passing tests did not observe.
- The shared `StoredFileClaims`/`StoredFileRewrite` extraction retains the Lightbox's default behavior while memory opts into safe leftover-byte validation and bounded error categories. Existing race/recovery coverage remains in place, including refused-delete preservation, live-claim metadata and uppercase Markdown files.
- Workspace-bound write queues, edit tokens including supersedes IDs, fresh-folder verification, automatic-save reservations/withdrawal, per-card routing and receipt ownership remain intact. The suspected accepted-root handoff was not a production defect: the session coordinator accepts its root once and refuses a later different root until host reload.
- The pre-memory session fixture still has an explicit byte-for-byte round-trip test. New optional fields and development-checkpoint normalization do not imply downgrade compatibility with old readers. Wayfinding's previously recorded forward-only warning still applies.
- The manifest setting is application-scoped and defaults to Off. Manual memory management remains available with persona memory off, as the accepted design specifies. Idea/Theme vocabulary, read-only capability boundaries and prompt sync remain covered.

## Initial-head verification

- Isolated checkout of the exact reviewed head; local Node `24.22.1`, npm `11.9.0`. No product edits or live provider calls.
- **Exact-head GitHub CI passed:** [run 42097819421](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42097819421), verify job `127492383542`. Checkout logs identify merge candidate `6cff2fac` with the exact head/base above. All three typechecks, **698 suites / 9,864 tests / 59 snapshots**, lint **0 errors / 1,165 baseline warnings**, both webpack bundles and bundle verification passed. The webview retains its three size/performance warnings.
- **Independent local aggregate passed:** all three typechecks; **698 suites / 9,864 tests / 59 snapshots** in one serial run; lint **0 errors / 1,165 warnings**; both webpack bundles and bundle verification. The clock-bounded Lightbox test passed in this run. No failed production assertion was retried into a claimed full pass.
- Additional focused review runs passed **25 backend suites / 341 tests** and **28 UI suites / 415 tests**. These overlap the aggregate suite and are not additive.
- Independent review probes: F-01 has two failing desired-behavior assertions and one passing hook control; N-01 has two passing observed-behavior/control assertions. Their source is archived as `.txt`, outside normal Jest discovery.
- The cumulative `git diff --check` reports existing trailing Markdown hard-break spaces in earlier review ledgers and trailing blank lines in several slice files; it is not claimed clean. Newly published report/probe files are checked separately.
- Publication changes only the report and review evidence. The resulting branch head's own CI will be verified and recorded in the PR conversation without creating repeated CI-only report commits.

## Release and acceptance limits

The PR author reports the live pass was run and integration requested. There is no item-by-item result record in the committed Slice 6 checklist, and this review did not independently run native VS Code layout, focus/screen-reader behavior, extension restart or billable provider/cache/budget checks.

The PR explicitly leaves documentation close-out for main: ADR acceptance, feature-note archival, the completion record, and the architecture/agent-guide updates. The epic README's opening status and Slice 6's stated last head are stale relative to the merged slice table; update them with that close-out. These are disclosed documentation follow-ups, not a new code blocker.

Retain the documented limits in that close-out: cross-file supersession can race after the final folder read; pin-budget admission is not a cross-window transaction; Rename is a whole-draft read/write; claim timestamp ordering is not a clock-skew-proof chronology; and the Lightbox clock-bounded test is known debt. None is presented as newly solved by this PR.

No merge, deployment, release or unrelated PR work was performed.
