# ADR: Per‑Subtool Metrics Result Cache in Webview

- Status: Accepted
- Date: 2025-10-26
- Epic: .todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md
- Sprint: .todo/epics/epic-search-architecture-2025-10-19/sprints/03-metrics-module-punchlist.md

## Context

The Metrics tab contains multiple sub‑tools (Prose Statistics, Style Flags, Word Frequency). Previously, the webview stored a single `metricsResult` and `metricsToolName`. Switching sub‑tabs could result in an empty pane or require a re‑run, even if results already existed for another sub‑tool. We want instantaneous switching with the last results for each tool while keeping memory modest.

Constraints:
- Avoid caching rendered markdown/HTML to keep memory footprint small and re‑render logic centralized.
- Respect alpha posture: remove legacy single‑result code paths if redundant.
- Maintain message contracts unchanged; this is a webview state concern.

## Decision

Add a per‑subtool cache in the webview state: `metricsResultsByTool: Partial<Record<'prose_stats'|'style_flags'|'word_frequency', any>>`.
- On `METRICS_RESULT`, store `metricsResultsByTool[toolName] = result` and set the active sub‑tool accordingly.
- The Metrics tab renders from `metricsResultsByTool[activeTool]`; legacy single‑result fallback is removed.
- On regenerate for a sub‑tool, clear only that tool’s entry before sending the request to avoid stale displays.
- On global error, clear the entire per‑subtool cache.

## Implementation

- App state/persistence:
  - File: src/presentation/webview/App.tsx
  - Add `metricsResultsByTool` to persisted state; update on `METRICS_RESULT`; clear on error.
- Metrics tab consumption:
  - File: src/presentation/webview/components/MetricsTab.tsx
  - Read from `metricsByTool[activeTool]`; add `onClearSubtoolResult` and call it before Generate.

## Alternatives Considered

- Cache rendered markdown per sub‑tool: rejected for memory and invalidation complexity; re‑render from data is cheap.
- Keep single `metricsResult`/`metricsToolName` and tolerate empties: rejected; poor UX when switching.

## Consequences

- UX: sub‑tab switching is immediate with last results displayed.
- Simplicity: data‑first cache with cheap markdown re‑render keeps memory usage low.
- Clean‑up: legacy UI state removed; message contracts unchanged.

## Links

- Sprint doc: .todo/epics/epic-search-architecture-2025-10-19/sprints/03-metrics-module-punchlist.md
- PR draft: docs/pr/2025-10-26-sprint-3-metrics-module-punchlist.md

