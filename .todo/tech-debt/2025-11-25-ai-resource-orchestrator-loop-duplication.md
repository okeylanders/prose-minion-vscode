# AIResourceOrchestrator Multi-Turn Loop Duplication

**Date Identified**: 2025-11-25
**Reviewed**: 2026-06-25
**Status**: Identified
**Priority**: Low
**Estimated Effort**: 3-5 hours

## Problem

`AIResourceOrchestrator` still maintains separate multi-turn loops for guides
and context resources:

- `executeWithAgentCapabilities()`
- `executeWithContextResources()`

Both repeat API dispatch, resource-request parsing, conversation assembly,
per-turn streaming/non-streaming execution, token aggregation, and response
cleanup. The implementations have also diverged: context resources have
forced-output recovery at the turn limit while guide requests do not.

## Recommendation

Start with small, honest extractions:

- Shared streaming/non-streaming turn executor
- Shared token-usage accumulator
- Shared conversation-message assembly where the contracts truly match

Only introduce a configured generic resource loop if those extractions reveal a
stable common shape. A single highly parameterized method could hide the
important semantic differences between guides and context resources.

## Decision Needed

Decide whether guide requests should receive the same forced-output recovery as
context requests. That is a behavior decision and should not be smuggled into a
mechanical DRY refactor.

## Related Files

- `packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts`
- `packages/core/src/__tests__/application/services/AIResourceOrchestrator.test.ts`

## Completion Criteria

- Shared execution mechanics have one implementation
- Guide and context-specific parsing/loading remain explicit
- Turn-limit behavior is deliberately specified for both paths
- Existing multi-turn, streaming, and token-usage tests remain green
