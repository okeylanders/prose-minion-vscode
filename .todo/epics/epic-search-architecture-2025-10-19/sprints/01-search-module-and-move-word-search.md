# Sprint 1 — Search Module + Move Word Search

Status: Planned

- Window: 2025-10-19 → 2025-10-20 (Days 1–2)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Introduce a top‑level Search module in the webview and relocate the Word Search UI there, leaving Metrics purely statistical.

## ADR to Author
- docs/adr/2025-10-XX-search-module-and-word-search-move.md
  - Decision: New Search module under presentation; Word Search moved; keep message contracts and backend unchanged.
  - Rationale: Align separation of concerns and unlock Context Search.
  - Alternatives: Keep under Metrics; rejected for clarity and growth.

## Tasks
- UI: Add `SearchTab.tsx` and add “Search” to the top `TabBar`.
- Move Word Search JSX/handlers from `MetricsTab` into `SearchTab` (minimal rewire; reuse `MessageType.MEASURE_WORD_SEARCH`).
- Preserve persistence hooks already used by the app state.

## Affected Files (initial)
- src/presentation/webview/components/TabBar.tsx (add Search tab)
- src/presentation/webview/components/SearchTab.tsx (new)
- src/presentation/webview/components/MetricsTab.tsx (remove Word Search block)
- src/presentation/webview/App.tsx (if needed for new tab state)

## Acceptance Criteria
- A “Search” tab appears with the Word Search panel and runs against the same scopes.
- Metrics tab no longer shows Word Search.
- Message contracts unchanged; results render as before.

## Risks/Notes
- Keep source selection UX consistent between Metrics and Search (Scope + Path/Pattern expected).
