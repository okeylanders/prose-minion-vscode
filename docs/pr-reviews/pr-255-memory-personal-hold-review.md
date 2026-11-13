# PR #255: Project-memory personal hold review

## Verdict

**Scoped code review approved at `5c8af47b808ea877d7d6de548e554e3b49e9577d`. No blocking findings.** Flagged new notes and edits now reach the writer as held cards without entering automatic saving. The existing validation, explicit-save, provenance and stale-edit gates remain in place. No production code was changed by this review and no merge was performed.

- PR: <https://github.com/okeylanders/prose-minion-vscode/pull/255>
- Reviewed head: `5c8af47b808ea877d7d6de548e554e3b49e9577d` (`fix/workshop-memory-fence-holds`).
- Base: `256a96ae50e914d26b593c7b5f06072f69908da4` (`epic/workshop-reply-edit-actions`).
- Reconciliation: no existing comments, submitted reviews or inline review threads when this pass began. No other active reviewer was identified. Both branch refs were rechecked before publication.
- Scope: all 13 changed files, plus the completion, auto-save, explicit-save, session-state and card-rendering paths they feed. The unrelated reply-edit implementation and deferred PR #205 are not reviewed here.

## Behavior and safety

1. **New notes:** `WorkshopReplyMemory.ts:121–145` evaluates the fence before ordinary routing. A match yields `held: 'personal'` with `heldWord`, not an auto-save index. The hold applies without run facts and in both enabled modes. Unflagged notes retain the prior routing order. A flagged note consumes a proposal slot, as any visible card does, but no automatic-save quota.
2. **Edits:** `WorkshopReplyMemoryEdit.ts:47–100` still checks target availability/standing, anchoring and pinned budget. It flags the fully anchored result rather than only the requested edit text. `personal` supersedes `edit` and `web-research`; an edit never enters automatic saving. The preimage, edit token and complete supersession ids are unchanged.
3. **Defense at the writer:** `WorkshopMemoryAutoSaves.ts:130–144` independently requires a pending new proposal with no hold. A personal card cannot become eligible merely because an index is passed to this service. The existing live mode, room, cancellation, reservation and commit-time checks remain unchanged.
4. **Explicit actions:** the real router/handler/library/store witness passes for Ask first and Save and tell me, with web research attached. Completion writes no memory file or receipt; Dismiss and Show it again retain the personal hold and word; a writer's Save writes one proposed memory and one writer receipt. Repeated Save writes neither a second file nor a second receipt.
5. **Display:** both production card variants receive the matched word through `WorkshopTurnMemory.tsx:136–149`. Independent rendering tests use production settlement and real card components, without a Markdown/card mock. They show the personal reason and matched word under Ask first, preserve action indexes, and restore the warning when a dismissed card is shown again. Saved cards continue to show the settled line rather than an obsolete warning.
6. **Privacy and bounds:** logs use the fixed fault reason, ids, operation names and counts, not the matched word. Existing reply/payload redaction paths are unchanged. Structural rejections, closed-memory extraction and the pinned-budget refusal are not bypassed by a hold. The persona prompt and personal-word list are unchanged; this PR changes the outcome of an existing flag, not the detector's coverage.

## Session compatibility: no schema bump required

The PR's explicit question is answered by the current policy, not by assuming an older reader accepts the new data.

[ADR 2026-07-30](../adr/2026-07-30-workshop-session-codec-evolution.md), particularly its optional-cache-count precedent, explicitly accepts **forward-only** session compatibility for additive V2 fields: previously valid sessions remain readable, while an older strict V2 reader may reject data saved by a newer version. This change does not make an old valid card require a word; `heldWord` is required only for the newly introduced `held: 'personal'` variant. Old hold variants and cards without a hold keep their previous shape and meaning.

Consequently, no adjacent migration or schema bump is required for this addition. An older build rejecting a newly saved personal-hold card on downgrade is a real limitation, but is consistent with that accepted policy. A version bump alone would not provide downgrade support. Do not describe this as bidirectional compatibility.

The codec validates and clones the pair for both new notes and edits (`WorkshopMemoryProposalRecords.ts:99–115, 218–240`). It accepts a bounded lower-case word by shape, not current list membership, so removing a word from the detector cannot strand a valid saved session. Generic turn cloning, Save, Dismiss, Show it again and stale-edit marking preserve the pair. Existing old-fixture and released-V1 migration tests still pass.

## Verification

Local checks used Node `v24.22.1` against the reviewed code. Dependencies were reused from a local checkout with the identical lockfile and dependency declarations; no packages were added or upgraded.

- **60 existing focused suites / 942 tests passed:** memory proposal/completion, route/save/race behavior, persistence, storage, prompt synchronization and architecture boundaries. Command: `npm test -- --runInBand --testPathPattern='(WorkshopRunCompletionMemory|WorkshopMemory|WorkshopProjectMemory|workshopMemory|ProjectMemory|WorkshopPersistedSession|boundaries)'`.
- **Two production UI suites plus two independent witness suites / 34 tests passed**, including **4 independent cases**. Command: `npm test -- --runInBand --testPathPattern='(Review255Independent|WorkshopTurnMemory|WorkshopMemoryEditCard)'`. This total overlaps the focused run; it is not 34 additional unique tests. The UI witness initially imported a Node-only storage fixture into jsdom and could not start because TextEncoder was absent; replacing that unnecessary import with a typed fiction fixture fixed the test harness. No product failure was reproduced.
- All three local typecheck targets passed.
- Local lint passed with **0 errors / 1,171 warnings**, the same count as CI.
- Local production build and bundle verification passed, with three webpack bundle-size/performance warnings, also present in CI.
- Full tests were not rerun locally. The inspected [CI run 43013447114](https://github.com/okeylanders/prose-minion-vscode/actions/runs/43013447114) passed its Node `v18.20.8` verify job: typecheck, **842 suites / 11,906 tests / 59 snapshots**, lint and both production bundles. Checkout logs identify merge validation commit `c764933d314a9601fa5e2790b982e1f9415500d2`, merging the exact reviewed head into the exact base above. This is the PR-head-associated merge validation, not a claim that CI directly checked out the head ref.
- Report-commit CI is separate and must be checked after publication; the earlier code-associated pass is not substituted for that commit's status.
- No native Extension Development Host, visual/theme/accessibility inspection, live model call or actual downgrade installation was run. Automated DOM tests establish rendered content and actions, not a native visual acceptance pass.

## Independent witness artifacts

These text files preserve rerunnable tests without adding review-only tests to the normal production gate:

- [Route, explicit save and repeated-action witness](probes/pr-255-personal-hold-route.test.ts.txt).
- [New/edit card rendering witness](probes/pr-255-personal-hold-card.test.tsx.txt).

Copy the route artifact to `packages/core/src/__tests__/application/handlers/domain/workshop/Review255Independent.test.ts` and the card artifact to `packages/core/src/__tests__/presentation/webview/components/workshop/Review255Independent.test.tsx`. Run `npm test -- --runInBand --testPathPattern='Review255Independent'`, expecting four passing tests, then remove the temporary copies. The copies were removed before this report was committed.
