# Triple `initializeResources()` at startup — every service rebuild nukes all AI bundles

**Status**: Open
**Priority**: Medium
**Discovered**: 2026-07-06, Sprint 03 (Workshop multi-turn) field bug — the first
follow-up died with `ConversationNotFoundError` because of this.

## Problem

`AssistantToolService`, `DictionaryService`, and `ContextAssistantService`
EACH call `aiResourceManager.initializeResources()` during their own
constructor-time initialization (and again on their own `refreshConfiguration`).
Every call **disposes and rebuilds all four** orchestrator bundles
(assistant/dictionary/context/category), each with a fresh `OpenRouterClient`
and `ConversationManager`. Consequences:

- At startup the bundles are built **three times**; two generations are
  discarded immediately. Wasted work, and any state (conversations!) in a
  discarded generation is stranded.
- Each service captures orchestrators from *its own* generation, so the
  "live" `getOrchestrator(scope)` and any service's captured instance can
  disagree at any time. Sprint 03 hit this: the Workshop's retained
  conversation lived in gen-1's ConversationManager while a live lookup
  returned gen-3 → "Conversation not found" on the very first follow-up.
  (Fixed at the symptom level by capturing the generation in
  `AssistantToolService` — `fb4b888` — with a regression suite pinning the
  symmetry.)
- A refresh triggered by ONE service silently invalidates the captures held
  by the OTHERS until they happen to refresh too (the pre-existing
  "live-read vs init-snapshot" asymmetry noted in the PR #64 work).

## Proposed direction

`initializeResources()` should be **idempotent-or-owned**: either
(a) the composition root calls it exactly once and services only *await* a
ready promise (`aiResourceManager.whenReady()`), or (b) `initializeResources`
coalesces concurrent/repeat calls into one build unless config actually
changed. Refresh should then be a single fan-out (`refreshConfiguration()` on
the manager notifies all services to re-capture), not three independent
rebuild triggers.

## Related files

- `packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`
- `packages/core/src/infrastructure/api/services/analysis/ContextAssistantService.ts`
- Regression net: `packages/core/src/__tests__/infrastructure/api/services/analysis/AssistantToolService.test.ts`

## Completion criteria

- `initializeResources` runs once at startup (verifiable via a log line count).
- A conversation retained before an unrelated service's init/refresh survives.
- All services re-capture on a genuine config change through one path.
