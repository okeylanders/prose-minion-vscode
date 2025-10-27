# ADR: Token Usage and Cost Widget

Status: Accepted — Phase 1 Implemented
Date: 2025-10-26

## Context

We want to give users lightweight visibility into token usage across all AI tools in the extension, with optional cost display when available. Token totals should accumulate per session (i.e., until the VS Code Extension Host restarts) and should not be coupled to any single tool or scope.

OpenRouter supports returning token usage (and sometimes cost) when the request includes `usage: { include: true }` in `/api/v1/chat/completions`. Some providers expose authoritative cost via generation stats that may arrive after the completion response.

## Decision

1. Request usage on all completion calls
   - Include `usage: { include: true }` in every chat completion body.
2. Aggregate per-session, across all tools
   - Maintain an in-memory accumulator in the extension host (MessageHandler), summing prompt, completion, and total tokens across all assistant/dictionary/context runs.
   - Do not persist across restarts; optional webview state persistence is allowed for within-session reload stability.
3. Tokens-first UX, cost optional
   - Always render token totals in a small header widget.
   - Render cost when provided by the provider response; label it implicitly as best-effort (no estimates yet).
4. Message contract
   - New `TOKEN_USAGE_UPDATE` message from extension to webview with session totals.
5. Context/multi-turn correctness
   - Aggregate usage across all OpenRouter calls within a single operation (e.g., guide fulfillment turns and context assistant’s two-step flow).

## Alternatives Considered

- Persisting totals in globalState: rejected to honor “per-session” requirement.
- Estimating cost from `/api/v1/models` pricing: deferred; estimates can confuse users and vary by provider.
- Tracking per-scope (assistant|dictionary|context): replaced by single total across all tools for simplicity.

## Consequences

- Minimal storage footprint (in-memory only).
- Accurate token totals when providers return usage; cost appears opportunistically.
- No coupling to specific tools; the header reflects overall activity.

## Follow-ups

- Optional background fetch of generation stats for authoritative cost.
- Setting to toggle cost visibility once authoritative cost flow is added.

---

## Implementation Status (Phase 1)

- Client: `usage: { include: true }` added to all `/chat/completions` requests; optional `usage.cost` mapped to `costUsd`.
- Orchestrator: Aggregates usage across multi‑turn runs (guide fulfillment/context follow‑up) and includes `usage` in `ExecutionResult`.
- Extension Host: `MessageHandler` maintains per‑session totals (memory only) and emits `TOKEN_USAGE_UPDATE` messages; replays latest totals when the webview reattaches.
- Webview UI: Displays a single‑line usage widget under the right‑aligned header icon using theme highlight color (`--vscode-list-highlightForeground`).
- Persistence: No cross‑restart persistence (per the “per‑session” requirement). Within a session, webview state stores the latest totals for resilience.
- Cost: Shown only when included in the completion response; no estimates and no generation‑stats follow‑up yet.

### Amendment: UI Toggle + Typing Consolidation (2025-10-26)

Minor follow-ups landed with Sprint 4 to improve UX and type safety without changing the user-facing behavior:

- UI toggle for the header widget
  - Added setting `proseMinion.ui.showTokenWidget` (default: true).
  - Exposed to the webview via `MODEL_DATA.ui.showTokenWidget`; widget hides when disabled.
- Shared `TokenUsage` type across layers
  - Consolidated token usage shape under `src/shared/types/messages.ts` and reused in:
    - Orchestrator `ExecutionResult.usage`
    - Domain `AnalysisResult.usage` and `ContextGenerationResult.usage`
    - Extension/webview `TokenUsageUpdateMessage.totals`
- Safer metrics message contracts
  - Narrowed `METRICS_RESULT` payload via a discriminated union by tool name (`prose_stats`, `style_flags`, `word_frequency`), maintaining alpha compatibility for future tools.
- Truncation helper
  - Extracted a single helper in the Orchestrator to append the truncation notice consistently across flows.

Compatibility: No breaking changes to existing message types; `MODEL_DATA` gained an optional `ui.showTokenWidget` field.

### Message Contract (shipped)

`TOKEN_USAGE_UPDATE` (extension → webview)

```
type: 'token_usage_update'
totals: {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd?: number        // present when provider supplies cost
  isEstimate?: boolean    // reserved for future pricing estimates
}
timestamp: number
```

### Deferred Items

- Optional background fetch: `/api/v1/generation?id=…` for authoritative cost.
- Setting(s):
  - Show/hide cost (once authoritative flow exists)
  - Show/hide usage widget (if desired)
- Alternative placements: status bar item; native view title string update.

### Links

- Sprint 4 — Token Cost Widget: `.todo/epics/epic-search-architecture-2025-10-19/sprints/04-token-cost-widget.md`
