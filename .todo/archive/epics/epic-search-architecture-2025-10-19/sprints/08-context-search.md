# Sprint 8 — Context Search

Status: Planned

- Window: 2025-10-27 → 2025-10-30 (Days 9–12)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
AI‑assisted expansions for search: categories, synonyms, variants — backed by deterministic matching and existing scope resolution.

## References
- See Phase 8 section in the epic (details and constraints).

## Tasks (initial)
- Define UX within the new Search module (query + expansions pane).
- Implement deterministic matching pipeline leveraging existing scope resolution.
- Thread expansions through message contracts without breaking existing search.
- Add minimal formatting for expanded results in the UI.

## Affected Files (likely)
- src/presentation/webview/components/SearchTab.tsx (expansions UI)
- src/application/handlers/* (search path additions)
- src/shared/types/messages.ts (if a new message is introduced)
- src/infrastructure/api/* (if AI is used for expansions)

## Acceptance Criteria
- Users can opt‑in to expansions and see categorized results.
- Deterministic matching remains the source of truth for hits.
- No regressions to basic Word Search.

## Notes
- Flesh out details once the Phase 8 section is finalized in the epic.
