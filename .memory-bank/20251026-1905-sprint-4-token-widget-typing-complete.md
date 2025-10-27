# Memory Note — Sprint 4 Implementation Complete (Token Widget + Typing)

Date: 2025-10-26 19:05

## Summary
- Implemented header Token Usage widget toggle (tokens-first; cost optional when provided).
- Consolidated token usage typing via shared `TokenUsage` across layers.
- Strengthened metrics message typing using a discriminated union keyed by `toolName`.
- Extracted Orchestrator truncation helper for consistent finish_reason: "length" notices.

## Artifacts
- ADR (amended): docs/adr/2025-10-26-token-usage-and-cost-widget.md
- Sprint 4 doc (linked ADR + outcomes): .todo/epics/epic-search-architecture-2025-10-19/sprints/04-token-cost-widget.md
- PR description: docs/pr/2025-10-26-sprint4-token-widget-and-typing.md

## Technical Notes
- Setting: `proseMinion.ui.showTokenWidget` (default true); propagated to webview via `MODEL_DATA.ui.showTokenWidget`.
- Shared type: `TokenUsage` in shared message types; used by Orchestrator `ExecutionResult`, domain results, and token update messages.
- Metrics typing: narrowed `METRICS_RESULT` payloads for `prose_stats`, `style_flags`, `word_frequency` while keeping alpha fallback.
- No breaking changes; `MODEL_DATA` gains an optional `ui` field.

## Next Steps
- Sprint 5: Add “Reset Token Usage” control in the Settings overlay to clear session totals and refresh the widget.
- Optional future: authoritative cost via generation stats; cost visibility toggle once authoritative flow exists.

## Verification
- Build passes; manual checks confirm toggle behavior, token accumulation, and truncation note appearance.
