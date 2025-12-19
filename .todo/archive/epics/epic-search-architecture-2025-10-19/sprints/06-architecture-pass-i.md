# Sprint 6 — Architecture Pass I

Status: Planned

- Window: 2025-10-24 → 2025-10-25 (Days 6–7)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Abstract AI chat client from the orchestrator and prepare to split the message handler without breaking behavior.

## ADR to Author
- docs/adr/2025-10-XX-abstract-ai-client-and-handler-split-plan.md
  - Decision: Introduce `AIChatClient` interface; wrap OpenRouter client; identify MessageHandler split boundaries.

## Tasks
- Define `AIChatClient` (createChatCompletion returns content, finishReason, usage).
- Adapt OpenRouterClient with a thin adapter implementing `AIChatClient`.
- Update `AIResourceOrchestrator` to depend on the interface.
- Draft handler split structure (files/classes per concern) without moving code yet to reduce risk.

## Affected Files
- src/application/services/AIResourceOrchestrator.ts
- src/infrastructure/api/OpenRouterClient.ts (or an adapter next to it)
- src/application/handlers/* (plans for split)

## Acceptance Criteria
- All features compile and behave the same.
- Orchestrator accepts any client implementing the new interface.
