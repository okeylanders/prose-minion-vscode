# Sprint 06A Complete — Agent-Run Engine Consolidation (PR #71)

**Date**: 2026-07-11
**PR**: #71 `sprint/workshop-editor-tab-06a-agent-run-engine` → `epic/workshop-editor-tab`, merged as `14da5fc`
**Epic**: Workshop Editor Tab (`.todo/epics/epic-workshop-editor-tab-2026-07-03/`)

## What landed

- **One initial-run engine.** `AgentRunEngine.runInitial()` owns transport,
  cancellation, bounded capability rounds, output visibility, token accounting,
  and cleanup for Dialogue, Prose, Writing Tools, Dictionary, Category Search,
  Context, and Workshop. Caller behavior is declared as data in
  `AGENT_RUN_POLICIES`. `continueConversation()` remains deliberately
  history-only until Sprint 07 unifies the loop per-turn (ADR 2026-07-10
  amendment).
- **One XML transport.** `ResourceReadXmlCodec` (SAX) replaced both legacy
  regex request parsers. The parser is tolerant where the prompt is strict:
  a VALID tool-call document at the response tail is accepted regardless of
  narration length (the live-Haiku unlock — heals in-turn, no correction
  budget spent); backtick-quoted markers are mentions; broken tag-shaped text
  deeper than 500 chars is prose; content after the closing tag stays inert.
- **Shared capability seam.** `GuideCapability` / `ContextFileCapability`
  compose `ResourceRequestGate` (codec + displayed-catalog allowlist +
  correction wording). Assistants take an `AgentCapabilityFactory` and mint a
  fresh capability per run — no shared allowlist state across concurrent runs.
- **Deleted**: `AIResourceOrchestrator` (1,178 lines) and both legacy parsers.
  New prod dependency `saxes` (declared in `packages/core/package.json`).

## Review cycle (docs/pr-reviews/pr-71-agent-run-engine-review.md)

Multi-agent review found 3 High / 11 Standard / 2 Nit; no blockers. All
actionable findings fixed in `0802dbd` + `289db10`; the ledger in the review
doc records per-finding resolution. Highlights:

- Context source document now bounded to the shared 50k-word cap
  (`boundSourceContent`, behind `applyContextWindowTrimming`).
- Protocol detection anchored structurally so an answer quoting the tag is
  delivered, never traded for a correction turn.
- Narrated-intent stream hold cut 1,000 → 300 chars (progressive streaming
  restored for "Let me check…" openers).
- `ensureInitialized()` no longer caches a rejected promise; fire-and-forget
  startup calls all `.catch` and log.
- Full rejected-response dumps (may quote manuscript text) gated behind new
  `proseMinion.debugLogging` setting, default off.
- Deferred with tracking: WTA "Diversity & Creative Sampling" A/B validation
  (`.todo/tech-debt/2026-07-11-wta-diversity-ab-validation.md`).

## Verification

77 suites / 597 tests, typecheck, lint (0 errors), build, bundle verification,
`git diff --check` — all passing at merge. Live Extension Development Host
runs verified Sonnet and Haiku through guide requests and Context briefings.

## Known state handed to Sprint 06B

- `WorkshopHandler.handleRunTool` still carries the stale "Integrated tool
  runs arrive in Sprint 06" guard — 06B removes it with the side-pass.
- No WorkshopHandler↔engine end-to-end test exists (handler tests mock the
  service wholesale); 06B session lifecycle tests should close the gap.
- Sprint 07 engine prerequisites are recorded in
  `sprints/07-persona-capabilities.md` (per-turn capability loop, generalized
  capability contract, persona policy budget) and in the ADR 2026-07-10
  amendment.

## Related

- ADR 2026-07-10 (+ 2026-07-11 amendment) — engine, catalogs, tolerant parse
- `.memory-bank/20260711-capability-streaming-repair.md` — the repair arc
  that preceded the review
- Sprint doc: `sprints/06a-agent-run-engine.md` (refinement note 2026-07-11)
