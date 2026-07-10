# AI Resource Orchestrator Capability-Loop Consolidation

**Date Identified**: 2026-07-10
**Source**: Workshop persona/file-read/dictionary planning assessment
**Status**: Planned
**Priority**: High
**Estimated Effort**: Large

## Problem

`AIResourceOrchestrator` has four partially overlapping execution flows:

- Craft-guide capability loop
- Plain one-shot / optionally retained run
- Retained Workshop continuation
- Context-file capability loop

Guide and context loops duplicate conversation assembly, streaming, capability
request parsing, resource loading, synthetic delivery messages, token handling,
limits, and cleanup. Their meaningful policy differences are currently encoded
as parallel control flow rather than explicit capability contracts.

`AIResourceManager.initializeResources()` also rebuilds every model scope when
called by individual services. Assistant, Dictionary, and Context services all
initialize bundles independently, so unrelated activity can churn generations
and leave services holding stale orchestrators. Workshop's captured-generation
continuation path mitigates the observed symptom; it does not establish honest
lifecycle ownership.

## Recommendation

Create an ADR before implementation. Use an incremental extraction rather than
a rewrite inside Sprint 06–08:

1. Make `AIResourceManager` the single owner of initialization/rebuilds on
   activation and genuine configuration changes; expose generation identity.
2. Introduce typed `AgentCapability` adapters for guides and allow-listed
   context files: catalog description, exact request parser, fulfillment,
   delivery formatting, and limit behavior.
3. Extract one internal initial-run engine parameterized by an explicit
   `RunPolicy` (capabilities, limits, retention, streaming, cancellation,
   visible output). Keep public methods as adapters while migrating tests.
4. Buffer possible directives until validation succeeds. Capability requests and
   full file contents remain host/model evidence and structured artifacts—not
   visible chat text by default.
5. Add persona file-read and dictionary capability adapters only after the
   shared seam exists.

## Related Files

- `packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts`
- `packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/infrastructure/api/services/analysis/ContextAssistantService.ts`
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`
- `packages/core/src/infrastructure/context/ContextResourceResolver.ts`
- `packages/core/src/__tests__/application/services/AIResourceOrchestrator.test.ts`

## Completion Criteria

- An ADR identifies lifecycle ownership, capability protocol, visibility, and
  migration compatibility decisions.
- One tested initial-run engine owns common capability-loop mechanics.
- Guides, context files, and later dictionary/persona capabilities each retain
  their explicit policy differences through typed adapters.
- Resource rebuilds occur once per real lifecycle/configuration event, with no
  stale-generation conversation loss.
- Full file contents and raw directives never leak into visible chat unless the
  writer explicitly asks to inspect them.
