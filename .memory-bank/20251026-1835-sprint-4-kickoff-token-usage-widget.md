# Memory Note — Sprint 4 Kickoff: Token Usage Widget (2025-10-26)

Proceeding with Sprint 4 of the epic-search-architecture. This sprint implements a session-level token usage widget (tokens-first; cost optional when provided), aggregated across all AI tools.

## Epic & Sprint
- Epic: `.todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md`
- Sprint 4: `.todo/epics/epic-search-architecture-2025-10-19/sprints/04-token-cost-widget.md`
- Branch: `sprint/epic-search-arch-04-token-cost-widget` (active)
- Status: In Progress ✅

## ADR Authored
- `docs/adr/2025-10-26-token-usage-and-cost-widget.md` — Accepted
  - Decision: Request usage for every call; aggregate per session in-memory; show tokens-only by default; cost appears when provider supplies it.

## Changes Implemented
- Shared Types
  - Add `MessageType.TOKEN_USAGE_UPDATE` and `TokenUsageTotals`.
- OpenRouter Client
  - Send `usage: { include: true }` with chat completions; plumb `usage` back.
- Orchestrator
  - Aggregate usage across multi-turn runs; return `usage` in `ExecutionResult`.
- ProseAnalysisService + Tools
  - Forward `usage` from orchestrator for dialogue/prose/dictionary/context.
- MessageHandler (extension)
  - Maintain per-session totals; post `TOKEN_USAGE_UPDATE` to webview.
  - Replay totals on webview re-attach.
- Webview
  - Handle `TOKEN_USAGE_UPDATE`; persist within session; render header widget showing tokens (and cost when present).

## Build Verification
```bash
npm run build
# ✅ extension + webview compiled successfully
```

## Next Steps
- Optional: background generation stats for authoritative cost (feature-flagged) per sprint plan.
- Optional: setting to toggle cost display.

## Links
- Sprint doc: `.todo/epics/epic-search-architecture-2025-10-19/sprints/04-token-cost-widget.md`
- ADR: `docs/adr/2025-10-26-token-usage-and-cost-widget.md`
