# Sprint 07 — Persona-Callable Capabilities

**Date:** 2026-07-12
**Branch:** `sprint/workshop-editor-tab-07-persona-capabilities`
**Target:** `epic/workshop-editor-tab`
**Status:** Implemented and verified locally
**Sprint:** [07-persona-capabilities.md](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/07-persona-capabilities.md)

## What Landed

- `AgentRunEngine` now runs initial and retained user turns through one bounded,
  transactional capability loop. Capability/correction budgets reset per turn;
  cancelled or failed continuations commit no partial history.
- `AgentCapability` is generalized from resource paths to typed request and
  rejection contracts. Resource adapters retain their shared allowlist gate;
  the Workshop host policy advertises `workshopPersona`, permits three calls,
  one correction, and forces final prose at the boundary.
- Strict single-root XML parsing for the closed `dictionary.lookup`,
  `dictionary.full-entry`, and `analysis.run` operation set. Unknown operations,
  tool ids, extra fields, mixed prose/fences, duplicates, and oversized inputs
  never execute services.
- All Workshop capability limits live in `PROMPT_BUDGETS`: word 100 chars,
  context 4,000, purpose 500, instructions 1,000, three calls per turn, one full
  dictionary entry, and one analysis side pass. Inputs are rejected, never
  silently truncated.
- Focused/full Writer's Dictionary calls preserve exact evidence, usage,
  truncation/error state, full-entry timing, and partial-failure metadata.
- Persona analysis reuses `WorkshopAnalysisSidePass`, the same tool invocation
  and sidecar replacement/cursor policy as writer-triggered runs. Reports remain
  verbatim and separately attributed before host synthesis.
- Capability artifacts are compact, expandable, reload-safe, distinguish
  persona vs writer provenance, and carry the excerpt version observed.
- Sprint 06C pending excerpt/context frames enter a capability turn exactly
  once and clear only after successful final host adoption. Completed nested
  artifacts remain honest if a later provider step fails; cancellation leaves
  pending frames untouched.

## Decisions and Invariants

- The tolerant preamble/fence parser remains specific to `resource.read`.
  Workshop operation calls use the sprint's stricter whole-response trust
  boundary without changing the shared streaming visibility guard.
- Capability routes call injected services/use cases directly—never handlers,
  webview messages, reflection registries, filesystem, shell, settings, or
  secrets.
- Nested usage is added to the enclosing host result once, while each provider
  engine continues emitting its own token-rail event once. No aggregate event
  is re-emitted.
- The initial host message records the capability contract once; follow-up turns
  mint fresh runtime validation and per-operation budget state.
- The two Sprint 07 housekeeping findings were verified as already landed:
  there is no stale Sprint 06 guard, and
  `WorkshopToolSidePass.integration.test.ts` spans handler↔engine assembly.

## Verification

- `npm test -- --runInBand` — 88 suites / 689 tests / 1 snapshot passed.
- `npm run typecheck` — core, webview, and extension passed.
- `npm run lint -- --quiet` — passed with zero errors.
- `npm run build` — production extension/webview build passed; only the existing
  webpack asset-size recommendations remain.
- `npm run verify:bundle -w apps/vscode-extension` — passed (3 Tailwind
  sentinels present).
- `git diff --check` — passed.
- Clean production comparison against `origin/epic/workshop-editor-tab`
  (`a2568b6`): extension 2,324,924 → 2,342,869 bytes (+17,945 / +0.77%);
  webview 590,131 → 593,123 bytes (+2,992 / +0.51%).

## References

- [Architecture](../docs/ARCHITECTURE.md)
- [Persona Host ADR](../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md)
- [Agent Run Engine ADR](../docs/adr/2026-07-10-agent-run-engine-and-resource-catalogs.md)
- [Excerpt Revision ADR](../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md)
