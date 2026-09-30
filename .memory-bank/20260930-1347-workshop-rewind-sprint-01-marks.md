# Workshop Rewind and Branch — Sprint 01 (retained-history marks) implemented

**Date:** 2026-09-30 (CDT)
**Epic:** [Workshop Rewind and Branch](../.todo/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md)
**ADR:** [2026-09-30 Workshop Rewind and Branch](../docs/adr/2026-09-30-workshop-rewind-and-branch.md) (Proposed; amended with Sprint 01 findings)
**Branches:** `epic/workshop-rewind-and-branch` (integration, cut from `main` at `53ebaa6`); `sprint/workshop-rewind-and-branch-01-marks`
**State:** Sprint 01 in review. Sprint 02 not started, by request: pause for review after each sprint.

## What landed

- **Contract.** `WorkshopRetainedHistoryMarkV1` plus an optional `retainedHistoryMarks` field on `WorkshopSessionStateV1`. No schema bump (ADR §9).
- **Modules.**
  - `session/WorkshopRetainedHistoryMarks.ts` holds the pure rules: key parsing, commit-turn → key, integrity, archive verification, hydration baselines.
  - `session/WorkshopRetainedHistoryLedger.ts` is the collaborator.
  - `session/WorkshopRewindPolicy.ts` holds the cut and bubble layers.
- **Recording.**
  - `WorkshopRetainedHistoryCommit.recordWorkshopRetainedHistoryCommit` is called by `completeWorkshopRun` after its new `settleCommittedRun` hook, and by `adoptWriterReport`.
  - Counts come from `AssistantToolService.readWorkshopRetainedHistory` → `AgentRunEngine.getConversationHistoryCounts` → `ConversationManager.getCommittedHistoryCounts`.
  - The aggregate adds manifest rows and the offset in `recordRetainedHistoryMark`.
- **Pruning.** Every discard or rebinding: sidecar replacement, excerpt-revision retirement, dismissal, re-adoption, `clearAllConversations`, reset, hydration degradation.
- **Baselines.** `hydrateCommittedState(..., importedHistory)` records them; the coordinator passes imported archive counts.
- **Codec.**
  - Exact-key shape.
  - Strict integrity, skipped only at the raw-checkpoint preflight.
  - Normalizations `dropped-inconsistent-retained-history-marks` and `dropped-unverifiable-retained-history-marks`.
  - The persisted boundary requires latest-mark equality with the archive.
- **Snapshot.** `turnRewindability` covers the window only. Marks never reach the webview; an architecture guard checks it.

## Decisions and findings (all in the ADR's findings section)

1. Marks are recorded after settlement. The ADR's original `completeRun` site would store a stale offset and too few manifest rows. A mutation test (recording before settlement) fails the scripted oracle.
2. Excerpt revision retires sidecars under the scope lock, a discard site missing from the plan.
3. `abandonRun` now removes the provisional one-shot widget manifest row, so participant state changes only at commits.
4. Recovery equality ignores marks. Otherwise opening a legacy file could spawn a spurious "(local recovery)" copy; mutation-tested.
5. Open for Sprint 02: `appendContextSources` replaces rows in place on re-delivery. Recommendation: append plus stale chain.

## Verification (sprint branch, before push)

- `npm test`: 219 suites, 2,528 tests, 2 snapshots passed. Baseline on `main` was 212 / 2,425.
- `npm run typecheck`: core, webview and extension clean.
- `npm run lint`: 0 errors, 1,024 warnings, identical to baseline.
- `git diff --check`: clean.

## Follow-ups

- Sprint 02: build the transform and the Rewind operation on `runCanonicalScriptedRoom()` and `WorkshopRewindPolicy.evaluateCut`. Settle the open questions in the Sprint 02 plan's "Inputs from Sprint 01" section.
- Ask Okey whether Sprint 01 should also merge to `main` early, so marks start accruing in real sessions.
