# Workshop Rollback Failure Observability

**Status:** Deferred — discovered during PR #106 review

**Priority:** High

**Created:** 2026-08-06

## Problem

`WorkshopSessionPersistenceCoordinator` restores a captured live-session
rollback inside the catch paths for `openNamed` and `resetSession`. If that
restore also throws, the secondary rollback failure replaces the original
operation error before either cause is logged. The caller then cannot tell why
the operation failed or which session state remains live.

This behavior predates Sprint 05. Fixing it safely requires an explicit error
propagation and live-state contract: whether callers receive the primary error,
the rollback error, or an aggregate error, and what can truthfully be said about
identity and room state at each failure phase.

## Related files

- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`
- `packages/core/src/__tests__/application/services/workshop/WorkshopSessionPersistenceCoordinator.test.ts`
- `docs/pr-reviews/pr-106-session-aggregate-ownership-c21e83b-review-v2.md` (F-10)

## Completion criteria

- Log the primary `openNamed` or `resetSession` failure before attempting the
  rollback restore.
- Catch and log rollback restoration failure separately without claiming a
  live-state outcome the coordinator cannot prove.
- Choose and document the error propagated when both the operation and rollback
  fail.
- Add fault-injection tests for both `openNamed` and `resetSession` that assert
  the two causes, emitted diagnostics, active named-session identity, and the
  live aggregate state after a double failure.
- Keep the successful rollback behavior and existing autosave ordering intact.
- Pass full typecheck, lint, build, Jest, and `git diff --check` verification.
