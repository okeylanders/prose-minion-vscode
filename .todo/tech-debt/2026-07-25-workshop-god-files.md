# Resolved Tech Debt: Workshop aggregate and room owners were load-bearing god files

- **Status**: Resolved 2026-08-06 by Workshop Architecture Refactor Phase 7; Okey lifted the feature freeze on 2026-08-06
- **Priority**: Was critical — feature-freeze gate is satisfied
- **Filed**: 2026-07-25
- **Source**: [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md),
  finding #7 (🎯🎯 strong consensus — Marcus, Parker, Stan), and
  [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md),
  finding #10

## Problem

The original debt was two files absorbing every new Workshop feature instead
of shedding any. Phases 4 and 5 narrowed both; Phase 7 completed the audit and
made the remaining handler boundary explicit:

| File | Lines (post-13A) | Nearest sibling |
| --- | --- | --- |
| `packages/core/src/application/services/workshop/WorkshopSessionService.ts` | 2,121 (Phase 5, 2026-08-06) | `session/WorkshopPassageScope.ts`, `WorkshopParticipantRoster.ts`, `WorkshopTodoLedger.ts`, `WorkshopTurnLedger.ts` |
| `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts` | 1,517 (Phase 7, 2026-08-06) | `WorkshopSliceComposition` plus eight named route owners |

Line count remains pressure evidence, not the completion rule. The open question
is whether the remaining lines form one coherent aggregate facade and one
coherent room/run orchestrator, not whether either crosses an arbitrary limit.

## Why it matters

The codebase has now applied the proven pattern across both files.
`WorkshopRoomHandler` owns only room/run orchestration and transport envelopes;
`WorkshopSliceComposition` constructs the named context, excerpt/scope,
session, todo, standing-directive, and widget route owners and holds the shared
mutation gate. `WorkshopSessionService` delegates closed passage, participant,
todo, turn, widget-config, and standing-directive state while remaining the
sole whole-session mutation boundary and cross-record integrity owner.

The cost is concentration risk: a single file is becoming the place every
Workshop change has to touch, which makes review harder, merge conflicts more
likely, and the blast radius of any edit larger than the edit deserves.

PR #88 also identified `WorkshopPersonaCapability` as a smaller instance of
the same pressure. That local seam was addressed immediately:
`WorkshopAnalysisInputs` now owns analysis-input resolution and shared
provenance descriptions, reducing the capability adapter from ~850 to ~740
lines. The two larger files below remain the tracked debt.

## Progress

- **2026-07-31 — widget-config ledger extracted.**
  `WorkshopWidgetConfigLedger` now owns `wc-N` identity, config state, commit
  linkage, display summaries, reset, export, and hydration replacement.
  `WorkshopSessionService` keeps the aggregate-facing methods but no longer
  stores that collection/counter or its Gesture clone/summary rules inline.
  This closes PR #96 finding 12 while leaving the broader god-file target open.
- **2026-08-05 — scope/context IPC extraction completed in Phase 4.**
  `WorkshopContextHandler` and `WorkshopExcerptScopeHandler` now own the
  measured route families; the earlier optional Sprint 02C seam is superseded.
- **2026-07-31 — standing-directive presentation extracted during PR #98
  review.** Widget-local frame building, summaries, marker copy, and display
  formatting moved out of `WorkshopSessionService`; the aggregate now delegates
  through the standing presentation registry. This reduced the session file
  from the reviewed ~2,950 lines to 2,894 while leaving the broader target open.
- **2026-08-06 — aggregate state machines extracted in Phase 5.** Passage
  scope, participant roster, todo, turn, persistence, and time responsibilities
  now have named owners behind `WorkshopSessionService`, reducing it to 2,121
  lines without exposing an internal ledger to handlers.
- **2026-08-06 — Sprint 06 deliberately leaves this record open.** Okey accepted
  D3: the `WorkshopHandler` → `WorkshopRoomHandler` naming tension and final
  facade-cohesion verdict belong to Phase 7, not the contract-normalization diff.
- **2026-08-06 — Phase 7 closes the measured boundary.**
  `WorkshopSliceComposition` now owns eight sibling constructions, guarded
  route assembly, and slice disposal. `WorkshopRoomHandler` retains exactly the
  nine room/run routes, one active-run slot, and the only Workshop session-state
  envelope. The five-facade audit and representative traces are published in
  the final responsibility map.

## Phase 7 disposition

[Sprint 07: Architecture Closure](../epics/epic-workshop-architecture-refactor-2026-08-03/sprints/07-architecture-closure.md)
records D7-A as option C: extract composition and rename the remainder. D7-B
reads the next-feature fixture as one explicit arm per applicable closed seam,
not one generic file total. D7-C audits all five feature-freeze facades.

The [final responsibility map](../../docs/architecture/2026-08-06-workshop-responsibility-map.md)
shows that the five facades have one primary responsibility or are narrow
composition/aggregate facades over named collaborators. Seven representative
actions trace by filename from UI through returned or durable truth. The audit
found no remaining responsibility with an independent invariant and reason to
change; further extraction would be cosmetic line-count work.

The code-level debt is closed. The implementation did not lift the feature
freeze implicitly; Okey explicitly lifted it on 2026-08-06 after reviewing the
closure evidence.

## Closure guard — satisfied

Phase 7 was measured against the original rule recorded before implementation:

> If the evidence does not support closure, this record stays open and
> continues to block the Workshop feature-freeze lift. Phase 7 must not
> manufacture closure through a cosmetic rename or arbitrary line-count
> extraction.

The final split follows independently changing responsibilities and preserves
the room/run lifecycle intact. The guard remains part of the resolved record so
a future audit can reconstruct the rule rather than only the outcome.

## Closure questions — answered

1. **Name:** the remaining room/run boundary is now
   `WorkshopRoomHandler`; the separate construction/gate responsibility is
   named `WorkshopSliceComposition` ([closure decisions](../../docs/architecture/2026-08-06-workshop-responsibility-map.md#closure-decisions)).
2. **Facade coherence:** the five-facade audit records one primary
   responsibility and named collaborators for both broad owners
   ([five-facade audit](../../docs/architecture/2026-08-06-workshop-responsibility-map.md#five-facade-audit)).
3. **Stop condition:** the audit found no remaining responsibility with both an
   independent invariant and reason to change; further extraction would divide
   the room/run or aggregate integrity lifecycle merely to lower line counts
   ([closure verdict](../../docs/architecture/2026-08-06-workshop-responsibility-map.md#closure-verdict)).

Presentation-modal workflow ownership is tracked separately in
`2026-08-04-workshop-modal-workflow-ownership.md`; it is not a reason to reopen
the aggregate or handler boundaries here.

## Completion criteria

- [x] Each broad file has one legible primary responsibility or is a narrow
      facade over named collaborators.
- [x] Each extraction follows an independently changing domain concept and owns
      its complete state/helper/invariant cluster.
- [x] Behavior-preserving moves and behavior changes use separate commits.
- [x] Existing behavior suites pass; focused collaborator tests are added where
      ownership becomes independently testable.
- [x] The final responsibility map can trace representative UI-to-persistence
      actions without searching unrelated broad files.
- [x] Architecture fitness witnesses protect the resulting boundaries.
- [x] The `WorkshopHandler` retain-or-rename verdict is explicit and every
      source, test, witness, and live architecture document uses the selected
      name consistently.

There is no longer a numeric line-count completion target. Line count remains a
pressure signal, not the definition of a coherent module.

## Related

- [Workshop Architecture Refactor epic](../epics/epic-workshop-architecture-refactor-2026-08-03/epic-workshop-architecture-refactor.md)
- [Workshop Responsibility and Dependency Map](../../docs/architecture/2026-08-06-workshop-responsibility-map.md)
- [ADR 2026-08-03: Workshop Feature Family and Module Boundaries](../../docs/adr/2026-08-03-workshop-feature-family-and-module-boundaries.md)
- [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md)
- [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md)
- ADR 2026-06-18: MessageHandler Composition-Root Consolidation
- ADR 2026-07-31: Workshop Widget State Ownership
