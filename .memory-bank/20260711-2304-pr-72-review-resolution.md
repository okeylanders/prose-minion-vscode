# PR #72 Review Resolution — Workshop tool sidecars & direct mode

**Date:** 2026-07-11
**Branch:** `sprint/workshop-editor-tab-06b-tool-side-pass`
**Input:** [docs/pr-reviews/pr-72-workshop-tool-sidecars-direct-mode-review.md](../docs/pr-reviews/pr-72-workshop-tool-sidecars-direct-mode-review.md)

## What happened

All 12 review findings resolved on-branch (11 Addressed, #12 Partially — turn
retention deferred to tech-debt with Tim's blessing). The five High findings
were one design flaw wearing five masks: the delivery cursor was computed from
*intent* (the unseen set) and committed on *proxy success*, while windowing,
character budgeting, and report replacement changed the payload in between.

## The architectural change (matters for Sprints 06C/09)

The handoff pipeline is now three explicit stages with honest ownership:

1. `WorkshopSessionService.collectUnseenDirectExchanges()` — pure state query,
   returns unseen writer/tool turn pairs. No formatting, no cursor movement.
2. `WorkshopPromptBuilder.buildWorkshopDirectHandoff(unseen)` — owns the
   newest-8 window + 20k char budget + envelope copy; returns
   `deliveredTurnIds` (exactly what shipped). Safety frame bytes are RESERVED
   off the top (`HANDOFF_FRAME_RESERVE`); no trailing hard slice exists.
3. `WorkshopSessionService.commitHostHandoff(deliveredTurnIds)` — advances
   per-tool cursors only to the newest *shipped* turn, forward-only. Dropped
   turns roll to the next handoff instead of being silently marked delivered.

Also new: `WorkshopRunCompletion.completeWorkshopRun()` — the single
four-branch completion machine (cancelled → api-key → retention → adopt+zombie)
used by both `WorkshopHandler.executeMessage` and the side-pass synthesis leg.
Adoption happens BEFORE content streams; every discard path logs its why.
`completeToolReport` now inherits the prior sidecar's cursor on replacement
(adoption ≠ delivery). Sprint 09's guest catch-up should reuse stages 1–3
rather than copying.

## Decisions worth remembering

- Redelivery semantics: a writer turn whose response was budget-dropped is NOT
  redelivered with the response next time — "unseen delivered once" wins over
  pair cohesion (guard `index - 1 > deliveredIndex` in collection).
- The unified zombie-discard predicate (`createsRetainedConversation`) fixed a
  latent bug the drift hid: the handler could discard a conversation still
  owned by a live sidecar/host on a preempted continuation.
- `activePhase` removed from `WorkshopSessionSnapshot` (no webview consumer);
  tests probe phase via `activeRequestId?.includes('synthesis')`.

## Verification

- Full jest: 82 suites / 627 tests green (new suites: WorkshopPromptBuilder,
  WorkshopRunCompletion, workshopPromptFrames).
- `npm run typecheck` clean; eslint 0 errors, no new warnings in touched files.
- Adversarial trio from the review now exists: two-tool interleaved handoff,
  same-tool re-run + failed synthesis, over-budget newest block.

## Follow-ups

- [.todo/tech-debt/2026-07-11-workshop-session-turn-retention.md](../.todo/tech-debt/2026-07-11-workshop-session-turn-retention.md)
  — `this.turns` unbounded until `reset()`; any future trim must respect
  delivery cursors.
