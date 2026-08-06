# Workshop Streamed-Exchange Deduplication

**Date Identified**: 2026-07-10
**Source**: PR #70 review, finding 17
**Status**: Deferred — reassess in Phase 7 or the next room-run lifecycle change
**Priority**: Medium
**Estimated Effort**: Medium

## Problem

`WorkshopHandler.handleRunTool` and `executeMessage` still duplicate the streamed
run skeleton: preemption, active-run setup, state/status events, cancellation,
zombie completion, error translation, and settlement. The original editor-tab
Sprint 06 introduced the sidecar report and persona synthesis; the current
architecture refactor intentionally leaves behavior-bearing lifecycle
unification outside its pure ownership moves.

## Recommendation

When Phase 7 or a later lifecycle change proves the seam, extract a narrow
private streamed-exchange coordinator. It
should own lifecycle mechanics while callers retain their domain-specific
invocation and successful-result reconciliation.

## Related Files

- `packages/core/src/application/handlers/domain/workshop/WorkshopHandler.ts`
- `packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopHandler.roomAndRun.test.ts`
- `.todo/archive/epics/epic-workshop-editor-tab-2026-07-03/sprints/06b-tool-side-pass.md`

## Completion Criteria

- One implementation owns preemption, cancellation, zombie, error, and
  settlement mechanics for Workshop streamed exchanges.
- Tool-sidecar and host-message success behavior remains explicit at the call
  site.
- Existing and Sprint 06 lifecycle tests cover the shared coordinator's
  contracts.
- `WorkshopHandler` becomes easier to reason about without obscuring domain flow
  or using a numeric line threshold as the extraction rule.
