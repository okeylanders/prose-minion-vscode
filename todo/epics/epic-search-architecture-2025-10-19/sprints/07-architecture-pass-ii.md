# Sprint 7 — Architecture Pass II

Status: Planned

- Window: 2025-10-25 → 2025-10-27 (Days 7–9)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Segment services by concern and split the handler, while preserving the façade and message contracts.

## ADR to Author
- docs/adr/2025-10-XX-service-segmentation-and-handler-composition.md
  - Decision: Introduce `IAssistService`, `IHeuristicsService`, `ISearchService`, `ISharedService`; keep `ProseAnalysisService` as façade.
  - MessageHandler split into smaller handlers composed by a root dispatcher.

## Tasks
- Carve interfaces in `domain/services/`; move existing methods accordingly.
- Keep `ProseAnalysisService` delegating to concrete implementations; no change to consumers.
- Extract handler code paths (analysis/dictionary/context/metrics/search/config) into separate modules; wire in the provider.

## Affected Files
- src/domain/services/IProseAnalysisService.ts (refactor into multiple interfaces)
- src/infrastructure/api/ProseAnalysisService.ts (façade + delegation)
- src/application/handlers/* (split + composition)

## Acceptance Criteria
- Compile passes; no behavior regressions.
- Handlers and services are smaller and easier to navigate.
