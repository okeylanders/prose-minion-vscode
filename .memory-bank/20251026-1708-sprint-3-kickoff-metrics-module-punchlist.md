# Memory Note — Sprint 3 Kickoff: Metrics Module Punchlist (2025-10-26)

This note kicks off Sprint 3 for the epic-search-architecture, focused on tightening the Metrics module UX and ownership of Publishing Standards.

## Epic & Sprint

- Epic: `.todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md`
- Sprint 3: `.todo/epics/epic-search-architecture-2025-10-19/sprints/03-metrics-module-punchlist.md`
- Branch: `sprint/epic-search-arch-03-metrics-punchlist` (created)
- Status: In Progress ✅

## Scope (from Sprint Doc)

- Move Publishing Standards selection into the Prose Statistics sub-view only
- Rename “Measure:” → “Scope:”
- Ensure Prose Metrics sub‑tab bar appears above the scope block
- Optional: cache per‑tool rendered markdown; add explicit “Generate/Measure” per sub‑tool

## Initial Verification

1) Label/Terminology
- “Scope:” label already present in metrics UI
  - File: `src/presentation/webview/components/MetricsTab.tsx:230`

2) Sub-tab Bar Ordering
- Sub‑tab bar currently renders below Scope block (to be moved above)
  - File: `src/presentation/webview/components/MetricsTab.tsx:264`

3) Publishing Standards Scope
- Publishing Standards controls currently live at Metrics tab level (not scoped to Prose Statistics only)
  - File: `src/presentation/webview/components/MetricsTab.tsx:206`

4) Per‑tool Rendered Markdown Cache
- Webview re-renders markdown via `formatMetricsAsMarkdown()` on each active sub‑tool change; no explicit per‑tool markdown cache map detected
  - Files:
    - `src/presentation/webview/components/MetricsTab.tsx:214, 246`
    - `src/presentation/webview/utils/resultFormatter.ts`
- Extension-side result cache exists per category (analysis, metrics, search, etc.) via `sharedResultCache`, but not per sub‑tool rendered markdown
  - File: `src/application/handlers/MessageHandler.ts:43, 556, 894-919`

Conclusion: Per‑tool rendered markdown caching is NOT implemented yet on the webview side; will implement in Sprint 3 if prioritized.

## Acceptance Criteria Alignment

- Standards selection scoped to Prose Statistics only → Pending
- UI labels and ordering match the epic → Partially done (label OK; ordering pending)
- No regressions across other Metrics sub‑views → To verify post-change

## Next Steps

1. Move sub‑tab bar above Scope block in `MetricsTab.tsx`
2. Scope Publishing Standards controls to Prose Statistics sub‑view only
3. Add optional per‑tool markdown cache (map: subTool → lastRenderedMarkdown)
4. Add explicit “Generate/Measure” button per sub‑tool (retain current inline trigger behavior or switch to explicit-only per ADR)

## Session Metadata

- Date: 2025-10-26
- Agent: Codex
- Branch: `sprint/epic-search-arch-03-metrics-punchlist`
