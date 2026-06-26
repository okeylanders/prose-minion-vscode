# AI Service Refresh Duplication

**Date Identified**: 2026-06-26
**Source**: PR #64 review, finding 6
**Status**: Identified
**Priority**: Low
**Estimated Effort**: 3-5 hours

## Problem

The API-key-change refresh path calls `aiResourceManager.refreshConfiguration()`
and then refreshes assistant, dictionary, and context services. Each service
refresh also initializes resources through the same manager. The result is
multiple `initializeResources()` passes for one secret change.

This is rare-path work and not currently a user-visible performance issue, but
the dependency shape is harder to reason about than it needs to be.

## Recommendation

Audit the refresh ownership boundary:

- decide whether the resource manager owns the full refresh cascade;
- or decide whether each service owns its own refresh and the explicit manager
  refresh can be removed;
- keep model-setting refresh and secret-change refresh behavior consistent.

Avoid a broad refactor unless the ownership decision is clear. The abstraction
should reduce repeated setup work without hiding service-specific behavior.

## Related Files

- `packages/core/src/application/handlers/MessageHandler.ts`
- `packages/core/src/application/handlers/domain/ConfigurationHandler.ts`
- `packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/infrastructure/api/services/analysis/ContextAssistantService.ts`
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`

## Completion Criteria

- One secret-change refresh does not redundantly initialize the same resources
  through multiple paths
- Model-setting refresh and secret-change refresh use the same ownership model
- Existing service refresh behavior remains covered by tests
