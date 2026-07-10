# Workshop Streamed-Exchange Deduplication

**Date Identified**: 2026-07-10
**Source**: PR #70 review, finding 17
**Status**: Deferred
**Priority**: Medium
**Estimated Effort**: Medium

## Problem

`WorkshopHandler.handleRunTool` and `executeMessage` duplicate the streamed
run skeleton: preemption, active-run setup, state/status events, cancellation,
zombie completion, error translation, and settlement. Sprint 06 will rewrite
the tool-run path to produce a sidecar report and persona synthesis, making the
duplicated paths more likely to drift.

## Recommendation

During Sprint 06, extract a narrow private streamed-exchange coordinator. It
should own lifecycle mechanics while callers retain their domain-specific
invocation and successful-result reconciliation.

## Related Files

- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts`
- `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06-tool-side-pass.md`

## Completion Criteria

- One implementation owns preemption, cancellation, zombie, error, and
  settlement mechanics for Workshop streamed exchanges.
- Tool-sidecar and host-message success behavior remains explicit at the call
  site.
- Existing and Sprint 06 lifecycle tests cover the shared coordinator's
  contracts.
- `WorkshopHandler` becomes easier to keep below the project's 500-line review
  threshold without obscuring domain flow.
