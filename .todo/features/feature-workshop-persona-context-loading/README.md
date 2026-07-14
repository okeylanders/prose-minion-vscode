# Feature: Workshop Persona Context Loading

**Status**: Scheduled as [Sprint 11](../../epics/epic-workshop-editor-tab-2026-07-03/sprints/11-persona-file-access.md)
— **direction updated (2026-07-14)**: fulfillment ships as `resource.catalog`
/ `resource.search` / `resource.read` capabilities through the Sprint 07
persona-capability boundary, not the retained `<context-request>` parsing
path this README proposed (it predates Sprint 07). `ContextResourceResolver`,
configured context groups, and path containment remain the reachability
policy; the markdown-sanitization gate lands first in that sprint.
**Priority**: High (promoted 2026-07-14)
**Source**: Workshop persona-chat readiness review (2026-07-09)

## Problem

Workshop persona conversations can start from a pinned excerpt and compact
provenance, but retained assistant conversations cannot currently fulfill
workspace `<context-request>` messages. The existing context workflow can load
configured project resources on demand, but it deletes its conversation after
producing a context brief; the Workshop continuation seam retains a conversation
but does not parse or fulfill context-resource requests.

Adding a resource catalog to the persona prompt without a working fulfillment
path would invite the model to ask for files the runtime cannot deliver.

## Direction

- Reuse `ContextResourceResolver`, `ContextResourceRequestParser`, configured
  context groups, and path-containment checks.
- Define retained-conversation semantics for resource requests on both the
  opening persona turn and later follow-ups.
- Keep the assistant model/persona system prompt as the conversation owner;
  do not silently move the chat to the context-model orchestrator.
- Keep loading status and delivered-resource provenance visible in the
  Workshop thread/session snapshot.
- Bound catalog size, resource count, file size, and request rounds.

## Related files

- `packages/core/src/infrastructure/context/ContextResourceResolver.ts`
- `packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts`
- `packages/core/src/infrastructure/api/services/analysis/ContextAssistantService.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`

## Completion criteria

- A persona can request an allowlisted project resource on the opening turn or
  a later follow-up and continue under the same persona system prompt.
- Unknown, disallowed, oversized, and excessive requests fail safely and leave
  an observable trail.
- Loaded paths are recorded in host-side session state and restore on reload.
- Focused orchestration, handler, session, and path-containment tests pass.
