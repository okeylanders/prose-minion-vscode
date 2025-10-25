# Sprint 4 — Token Cost Widget

Status: Planned

- Window: 2025-10-22 → 2025-10-23 (Days 4–5)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Add visibility into token usage (and optional cost), decoupled from providers. Initial posture: tokens‑only, with cost behind a setting.

## Guidance (from epic)
- Prefer provider‑supplied usage when present; avoid inventing numbers.
- Generation stats may lag slightly; UI should handle late updates.
- Pricing estimates may use `/api/v1/models` only when necessary and clearly labeled.

## Tasks
- OpenRouter client path:
  - Add `usage.include=true` when calling `/chat/completions` to request usage in responses.
  - Thread `usage` (prompt, completion, total) through Orchestrator to UI; accumulate per scope.
- Optional “after‑the‑fact” fetch (feature‑flagged):
  - If a generation id is returned, background call `/api/v1/generation?id=…` to confirm cost once ready.
- Webview App: render a small header widget (right of title, left of settings icon).
- Pricing fallback (optional):
  - Use `/api/v1/models` pricing to estimate cost when usage/cost is unavailable; clearly label as estimate.

## Affected Files
- src/infrastructure/api/OpenRouterClient.ts
- src/application/services/AIResourceOrchestrator.ts
- src/presentation/webview/App.tsx (header widget)
- src/shared/types/messages.ts (new message for token totals and optional cost)

## Acceptance Criteria
- Token totals increment as assistant/dictionary/context calls complete.
- Widget can be toggled via setting.
- No regressions when API key is absent.
