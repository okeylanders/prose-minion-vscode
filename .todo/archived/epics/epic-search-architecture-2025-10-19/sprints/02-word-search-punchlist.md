# Sprint 2 — Word Search Punchlist

Status: ✅ Complete

- Window: 2025-10-20 → 2025-10-21 (Days 2–3)
- Completed: October 2025 (PR #6)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Apply ADR/todo improvements to the Word Search UX and output.

## References
- docs/adr/2025-10-24-metrics-word-search.md
- todo/metrics-module/2025-10-24-metrics-module.md

## Tasks
- Remove the “⚡” from the bot expand button; keep 🤖 and non‑blocking “coming soon” toast.
- Inputs styling parity with other inputs; avoid number steppers (text inputs with validation OK).
- Make targets textarea full‑width; center the “Run Search” button; add a lightning icon.
- Add summary table before breakdowns: `| File | Word | Hits | Cluster Count |` via formatter.
- Consider accurate path fields:
  - Either rename “absolute” → “relative” explicitly, or populate true absolute via workspace root.

## Affected Files
- src/presentation/webview/components/SearchTab.tsx (inputs/buttons, layout)
- src/presentation/webview/utils/metricsFormatter.ts (summary table)
- src/infrastructure/api/ProseAnalysisService.ts (scannedFiles path semantics if adjusted)

## Acceptance Criteria
- Summary table renders above per‑file details.
- Inputs/buttons match the extension’s styling and behavior.
- Expand button shows a “coming soon” note without ⚡.
