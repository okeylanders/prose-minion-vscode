# Sprint 3 — Metrics Module Punchlist

Status: In Progress

- Window: 2025-10-21 → 2025-10-22 (Days 3–4)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Tighten the Metrics UX per TODOs and ADRs; make Prose Stats own publishing standards selection.

## References
- docs/adr/2025-10-23-publishing-standards-comparison-and-formatting.md
- docs/adr/2025-10-23-metrics-source-selection-and-resolver.md
- todo/metrics-module/2025-10-24-metrics-module.md

## Tasks
- Move Publishing Standards selection control into the Prose Statistics sub‑view only.
- Rename “Measure:” → “Scope:”.
- Ensure the Prose Metrics sub‑tab bar appears above the scope block (visual order and clarity).
- Complete remaining TODOs noted in the epic for this phase.

## Affected Files
- src/presentation/webview/components/MetricsTab.tsx (controls, layout)
- src/presentation/webview/components/ProseStats/* (sub‑tab + standards control)
- src/presentation/webview/utils/metricsFormatter.ts (terminology/labels as needed)

## Acceptance Criteria
- Standards selection is scoped to Prose Stats only.
- UI labels and ordering match the epic.
- No regressions across other Metrics sub‑views.
