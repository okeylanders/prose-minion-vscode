# Epic Search & Architecture

**Date**: 2025-10-19
**Status**: Partially Complete (5/8 phases done)
**Priority**: Medium (phases 6-7), Low (phase 8)
**Last Updated**: 2025-11-03

## Sprint Plan: 2025‑10‑19 → 2025‑11‑01

This master plan sequences ADRs and implementation for the next two weeks. Each block follows the flow: Draft ADR → Review/Approve → Implement → Verify. It aligns with Clean Architecture, message contracts, and publishing/reporting standards already in the repo.

## Phase Completion Status

- **Phase 1**: Search Module + Move Word Search → ✅ **DONE** (Archived: `.todo/archived/specs/search-module/`)
- **Phase 2**: Word Search Punchlist → ✅ **DONE** (Archived: `.todo/archived/specs/search-module/`)
- **Phase 3**: Metrics Module Punchlist → ✅ **DONE** (Archived: `.todo/archived/specs/metrics-module/`)
- **Phase 4**: Token Cost Widget → ✅ **DONE** (Archived: `.todo/archived/specs/token-cost-widget/`)
- **Phase 5**: Settings Module → ✅ **DONE** (Covered by Secure Storage + Settings Overlay epics)
- **Phase 6**: Architecture Pass I → 🟡 **PENDING** (AI client abstraction)
- **Phase 7**: Architecture Pass II → 🟡 **PENDING** (Service segmentation, handler split)
- **Phase 8**: Context Search → 📋 **PLANNING** (AI-assisted search expansion)

## Objectives

- Separate concerns in the UI by introducing a dedicated Search module and moving Word Search into it.
- Tighten the Metrics experience (scope clarity, per-tool ownership, UI polish, and correctness).
- Add visibility into token usage (and prepare for cost) without coupling to any provider.
- Improve onboarding with a Settings module in the webview.
- Begin incremental architecture passes to support multiple AI clients and smaller, focused handlers/services.
- Lay groundwork for Context Search (AI-assisted expansions) backed by deterministic matching and existing scope resolution.

## Scope Overview (High Level)

1) New Search Module + Move Word Search (Critical)
2) Apply Word Search punchlist (UX + summary table + path fix)
3) Apply Metrics module punchlist (scoped UI, terminology, optional caching)
4) Token Cost widget (tokens first; pricing optional)
5) Settings Module (overlay UI controlling the same VS Code settings)
6) Architecture Pass I (abstract AI client; prep MessageHandler split)
7) Architecture Pass II (service interfaces segmented; façade preserved)
8) Context Search (AI‑assisted categories/synonyms/variants)

Out‑of‑scope (unless time permits): Style Flags POS integration (tracked in metrics module TODO), broader refactors beyond handler split, and full pricing integration across all curated models.

## Milestones, ADRs, and Work Items

### Phase 1 — Search Module + Move Word Search ✅ DONE

- Goal
  - Introduce a top‑level Search module in the webview and relocate the Word Search UI there, leaving Metrics purely statistical.

- Status: **Complete** (Archived: `.todo/archived/specs/search-module/`)

- ADR to Author
  - docs/adr/2025-10-XX-search-module-and-word-search-move.md
    - Decision: New Search module under presentation; Word Search moved; keep message contracts and backend unchanged.
    - Rationale: Align separation of concerns and unlock Context Search.
    - Alternatives: Keep under Metrics; rejected for clarity and growth.

- Implementation
  - UI: Add `SearchTab.tsx` and add “Search” to the top `TabBar`.
  - Move Word Search JSX/handlers from `MetricsTab` into `SearchTab` (minimal rewire; reuse `MessageType.MEASURE_WORD_SEARCH`).
  - Preserve persistence hooks already used by the app state.

- Affected Files (initial)
  - src/presentation/webview/components/TabBar.tsx (add Search tab)
  - src/presentation/webview/components/SearchTab.tsx (new)
  - src/presentation/webview/components/MetricsTab.tsx (remove Word Search block)
  - src/presentation/webview/App.tsx (if needed for new tab state)

- Acceptance Criteria
  - A “Search” tab appears with the Word Search panel and runs against the same scopes.
  - Metrics tab no longer shows Word Search.
  - Message contracts unchanged; results render as before.

- Risks/Notes
  - Keep source selection UX consistent between Metrics and Search (Scope + Path/Pattern expected).

---

### Phase 2 — Word Search Punchlist ✅ DONE

- Goal
  - Apply ADR/todo improvements to the Word Search UX and output.

- Status: **Complete** (Archived: `.todo/archived/specs/search-module/`)

- References
  - docs/adr/2025-10-24-metrics-word-search.md
  - todo/metrics-module/2025-10-24-metrics-module.md

- Implementation
  - Remove the “⚡” from the bot expand button; keep 🤖 and non‑blocking “coming soon” toast.
  - Inputs styling parity with other inputs; avoid number steppers (text inputs with validation OK).
  - Make targets textarea full‑width; center the “Run Search” button; add a lightning icon.
  - Add summary table before breakdowns: `| File | Word | Hits | Cluster Count |` via formatter.
  - Consider accurate path fields:
    - Either rename “absolute” → “relative” explicitly, or populate true absolute via workspace root.

- Affected Files
  - src/presentation/webview/components/SearchTab.tsx (inputs/buttons, layout)
  - src/presentation/webview/utils/metricsFormatter.ts (summary table)
  - src/infrastructure/api/ProseAnalysisService.ts (scannedFiles path semantics if adjusted)

- Acceptance Criteria
  - Summary table renders above per‑file details.
  - Inputs/buttons match the extension’s styling and behavior.
  - Expand button shows a “coming soon” note without ⚡.

---

### Phase 3 — Metrics Module Punchlist ✅ DONE

- Goal
  - Tighten the Metrics UX per TODOs and ADRs; make Prose Stats own publishing standards selection.

- Status: **Complete** (Archived: `.todo/archived/specs/metrics-module/`)

- References
  - docs/adr/2025-10-23-publishing-standards-comparison-and-formatting.md
  - docs/adr/2025-10-23-metrics-source-selection-and-resolver.md
  - todo/metrics-module/2025-10-24-metrics-module.md

- Implementation
  - Move Publishing Standards selection control into the Prose Statistics sub‑view only.
  - Rename “Measure:” → “Scope:”.
  - Ensure the Prose Metrics sub‑tab bar appears above the scope block (visual order and clarity).
  - Cache per‑tool rendered markdown in App state; add explicit “Generate/Measure” button per sub‑tool.

- Affected Files
  - src/presentation/webview/components/MetricsTab.tsx
  - src/presentation/webview/App.tsx (if caching is added/persisted)

- Acceptance Criteria
  - Publishing Standards controls only visible when Prose Stats sub‑tab is active.
  - “Scope:” label replaces “Measure:”.
  - Prose Stats, Word Frequency, Style Flags run explicitly via button clicks without surprise auto‑run.

---

### Phase 4 — Token Cost Widget ✅ DONE

- Goal
  - Provide a lightweight, running token counter and prep for cost display.

- Status: **Complete** (Archived: `.todo/archived/specs/token-cost-widget/`)

- ADR to Author
  - docs/adr/2025-10-XX-token-usage-and-cost-widget.md
    - Decision: Track prompt/completion/total tokens per scope; optionally surface $ cost.
    - Cost Retrieval Options (decide in ADR):
      - On-response: include `"usage": { "include": true }` in `/api/v1/chat/completions` to receive `usage` (prompt_tokens, completion_tokens, total_tokens) and, when available, `cost` and `cost_details.upstream_inference_cost`.
      - Post-generation: call `/api/v1/generation?id=<GENERATION_ID>` after completion to fetch authoritative token usage and cost for that generation (may require a small delay before data is available; more accurate for billing).
      - Pricing lookup (optional): query `/api/v1/models` to read per-model pricing (`pricing.request|prompt|completion`) as a fallback when response cost is absent. Treat as best-effort due to provider variability.
    - Caveats to capture:
      - Standard `/chat/completions` without `usage.include=true` will not include cost (only token counts when available).
      - Token counts in responses can be “normalized”; billing uses native tokenizers. Prefer generation stats when precision matters.
      - Generation stats may lag slightly after the completion response (especially for streaming).
    - UI: Header widget “N tokens | $X.XXX” with a setting to show/hide cost; tokens-only is always available.

- Implementation
  - OpenRouter client path:
    - Add `usage.include=true` when calling `/chat/completions` (non-breaking) to request usage/cost in the response when available.
    - Thread `usage` (prompt, completion, total) through Orchestrator to UI; accumulate per scope.
  - Optional “after-the-fact” fetch:
    - If the completion returns a generation id, add a background call to `/api/v1/generation?id=…` to update/confirm cost once ready. Make this behavior opt-in via a setting.
  - Webview App: render small header widget (right of title, left of settings icon).
  - Pricing fallback (optional):
    - Use model pricing from `/api/v1/models` to estimate cost when response/generation cost is unavailable; clearly label as estimate.
  - Initial posture: ship tokens-only; cost display behind a feature flag/setting, finalized by the ADR decision.

- Affected Files
  - src/infrastructure/api/OpenRouterClient.ts
  - src/application/services/AIResourceOrchestrator.ts
  - src/presentation/webview/App.tsx (header widget)
  - src/shared/types/messages.ts (new message for token totals and optional cost)

- Acceptance Criteria
  - Token totals increment as assistant/dictionary/context calls complete.
  - Widget can be toggled via setting.
  - No regressions when API key is absent.

---

### Phase 5 — Settings Module ✅ DONE

- Goal
  - Full‑screen overlay module in the webview to guide non‑technical users through configuration; writes to the same VS Code settings.

- Status: **Complete** (Implemented via Secure Storage + Settings Overlay epics, archived)

- ADR to Author
  - docs/adr/2025-10-XX-webview-settings-module.md
    - Decision: Present friendly settings UI; changes persist via `MessageHandler` updates.
    - Scope: API key, models (per scope), guides toggle, max tokens, publishing standards preset, word frequency and word search options.

- Implementation
  - Add gear icon to top right to open the overlay.
  - Render settings groups with descriptive help text and links (OpenRouter docs, internal CONFIGURATION.md).
  - Post messages to update VS Code settings; rely on existing config watcher to refresh orchestrators/model data.

- Affected Files
  - src/presentation/webview/App.tsx (overlay + trigger icon)
  - src/application/handlers/MessageHandler.ts (existing setters for models; extend if needed for others)
  - docs/CONFIGURATION.md (link consistency)

- Acceptance Criteria
  - Users can configure API key and model scopes without opening VS Code settings.
  - Changes reflect immediately (watcher fires; model dropdown updates).

---

### Phase 6 — Architecture Pass I 🟡 PENDING

- Goal
  - Abstract AI chat client from the orchestrator and prepare to split the message handler without breaking behavior.

- Status: **Pending** (Not started, medium priority)

- ADR to Author
  - docs/adr/2025-10-XX-abstract-ai-client-and-handler-split-plan.md
    - Decision: Introduce `AIChatClient` interface; wrap OpenRouter client; identify MessageHandler split boundaries.

- Implementation
  - Define `AIChatClient` (createChatCompletion returns content, finishReason, usage).
  - Adapt OpenRouterClient with a thin adapter implementing `AIChatClient`.
  - Update `AIResourceOrchestrator` to depend on the interface.
  - Draft handler split structure (files/classes per concern) without moving code yet to reduce risk.

- Affected Files
  - src/application/services/AIResourceOrchestrator.ts
  - src/infrastructure/api/OpenRouterClient.ts (or an adapter next to it)
  - src/application/handlers/* (plans for split)

- Acceptance Criteria
  - All features compile and behave the same.
  - Orchestrator accepts any client implementing the new interface.

---

### Phase 7 — Architecture Pass II 🟡 PENDING

- Goal
  - Segment services by concern and split the handler, while preserving the façade and message contracts.

- Status: **Pending** (Blocked by Phase 6, medium priority)

- ADR to Author
  - docs/adr/2025-10-XX-service-segmentation-and-handler-composition.md
    - Decision: Introduce `IAssistService`, `IHeuristicsService`, `ISearchService`, `ISharedService`; keep `ProseAnalysisService` as façade.
    - MessageHandler split into smaller handlers composed by a root dispatcher.

- Implementation
  - Carve interfaces in `domain/services/`; move existing methods accordingly.
  - Keep `ProseAnalysisService` delegating to concrete implementations; no change to consumers.
  - Extract handler code paths (analysis/dictionary/context/metrics/search/config) into separate modules; wire in the provider.

- Affected Files
  - src/domain/services/IProseAnalysisService.ts (refactor into multiple interfaces)
  - src/infrastructure/api/ProseAnalysisService.ts (façade + delegation)
  - src/application/handlers/* (split + composition)

- Acceptance Criteria
  - Compile passes; no behavior regressions.
  - Handlers and services are smaller and easier to navigate.

---

### Phase 8 — Context Search 📋 PLANNING

- Goal
  - Build the AI‑assisted search that expands categories/synonyms/variants and re‑scans scope deterministically.

- Status: **Planning** (Specs archived in `.todo/archived/specs/search-module/`, low priority)

- References
  - todo/search-module/2025-10-24-context-search-component.md

- ADR to Author
  - docs/adr/2025-10-XX-context-search-architecture-and-flow.md
    - Decision: Two‑phase approach — enumerate vocabulary offline → AI expands → deterministic matching + optional clustering.

- Implementation
  - UI under Search module: input for category prompt + options; “Expand list” then “Run search”.
  - Service: use dictionary/context model scope to propose expansions; filter against enumerated vocabulary.
  - Reuse Word Search tokenization, occurrence capture, and cluster logic; format with a context‑search renderer (can extend current Markdown formatter).

- Affected Files
  - src/presentation/webview/components/SearchTab.tsx (new panel)
  - src/shared/types/messages.ts (new message types if needed)
  - src/infrastructure/api/ProseAnalysisService.ts (new method delegating to ISearchService impl)
  - src/presentation/webview/utils/metricsFormatter.ts (or new searchFormatter)

- Acceptance Criteria
  - Users can expand a category into terms and scan scopes similar to Word Search.
  - Output mirrors Word Search with category/term pivots in summary.

---

## Cross‑Cutting Concerns

- Message Contracts & Backward Compatibility
  - Preserve existing message types; add new ones additively and keep renderers in lockstep for search/metrics payloads.

- Publishing Standards + Reports
  - Keep “📖 Chapter‑by‑Chapter Prose Statistics” always on‑screen.
  - On Copy/Save, prompt to include/exclude “## Chapter Details”; save to `prose-minion/reports/` with timestamped filenames.

- Tokenization Consistency
  - Prefer reusing existing heuristics; extract shared helpers only when duplication grows.

- Performance & Offline
  - Heuristics tools remain offline and deterministic; POS via `wink-pos-tagger` is already integrated in Word Frequency.

- Defaults Consistency (Max Tokens)
  - Confirm/align `proseMinion.maxTokens` default (package.json vs orchestrator options). Document decision in a config ADR if changed.

## Review & Verification Cadence

- For each phase:
  - Draft ADR → async review → approve → implement.
  - Manual verification via Extension Development Host (npm run watch → F5).
  - Spot check UI against dark/light themes.
  - Keep changes scoped; avoid unrelated fixes.

## Stretch / Backlog (if time permits)

- Style Flags POS integration per todo/metrics-module/2025-10-24-metrics-module.md — add POS‑assisted rules with heuristic fallback and a `posEnabled` setting.
- Pricing map for cost widget using curated per‑model prices; show dollars alongside tokens.
- Per‑file Word Search exports to CSV/MD.

## Definition of Done

- ADRs committed for each phase with accepted status where applicable.
- Implementation merged with passing build; behavior validated interactively.
- Message contracts/types updated and used by both sides (webview/extension).
- Docs updated when settings or notable UX change (CONFIGURATION.md, PROSE_STATS.md if needed).
