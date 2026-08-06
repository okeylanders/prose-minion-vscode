# Tech Debt: `WorkshopSessionService` and `WorkshopHandler` are load-bearing god files

- **Status**: In progress — absorbed by the Workshop Architecture Refactor epic
- **Priority**: Critical — blocks Workshop feature development
- **Filed**: 2026-07-25
- **Source**: [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md),
  finding #7 (🎯🎯 strong consensus — Marcus, Parker, Stan), and
  [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md),
  finding #10

## Problem

The original debt was two files absorbing every new Workshop feature instead
of shedding any. Phases 4 and 5 have reduced and narrowed both substantially,
but Phase 7 still needs to certify that each remaining facade has one legible
primary responsibility:

| File | Lines (post-13A) | Nearest sibling |
| --- | --- | --- |
| `packages/core/src/application/services/workshop/WorkshopSessionService.ts` | 2,121 (Phase 5, 2026-08-06) | `session/WorkshopPassageScope.ts`, `WorkshopParticipantRoster.ts`, `WorkshopTodoLedger.ts`, `WorkshopTurnLedger.ts` |
| `packages/core/src/application/handlers/domain/workshop/WorkshopHandler.ts` | 1,653 (Phase 4, 2026-08-06) | Five shared route owners plus three widget route owners |

Line count remains pressure evidence, not the completion rule. The open question
is whether the remaining lines form one coherent aggregate facade and one
coherent room/run orchestrator, not whether either crosses an arbitrary limit.

## Why it matters

The codebase has now applied the proven pattern across both files.
`WorkshopHandler` composes named context, excerpt/scope, session, todo,
standing-directive, and widget route owners. `WorkshopSessionService` delegates
to named passage, participant, todo, turn, widget-config, standing-directive,
persistence, and time collaborators while remaining the sole whole-session
mutation boundary.

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

## Remaining closure questions

1. Does `WorkshopHandler`'s remaining room/run orchestration justify its name,
   or would `WorkshopRoomHandler` make the boundary materially easier to find?
2. Are `WorkshopHandler` and `WorkshopSessionService` now narrow facades over
   their named collaborators under representative end-to-end traces?
3. Does any remaining responsibility have an independent invariant and reason
   to change, rather than merely contributing line count? If not, stop
   extracting.

Presentation-modal workflow ownership is tracked separately in
`2026-08-04-workshop-modal-workflow-ownership.md`; it is not a reason to reopen
the aggregate or handler boundaries here.

## Completion criteria

- [ ] Each broad file has one legible primary responsibility or is a narrow
      facade over named collaborators.
- [ ] Each extraction follows an independently changing domain concept and owns
      its complete state/helper/invariant cluster.
- [ ] Behavior-preserving moves and behavior changes use separate commits.
- [ ] Existing behavior suites pass; focused collaborator tests are added where
      ownership becomes independently testable.
- [ ] The final responsibility map can trace representative UI-to-persistence
      actions without searching unrelated broad files.
- [ ] Architecture fitness witnesses protect the resulting boundaries.

There is no longer a numeric line-count completion target. Line count remains a
pressure signal, not the definition of a coherent module.

## Related

- [Workshop Architecture Refactor epic](../epics/epic-workshop-architecture-refactor-2026-08-03/epic-workshop-architecture-refactor.md)
- [ADR 2026-08-03: Workshop Feature Family and Module Boundaries](../../docs/adr/2026-08-03-workshop-feature-family-and-module-boundaries.md)
- [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md)
- [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md)
- ADR 2026-06-18: MessageHandler Composition-Root Consolidation
- ADR 2026-07-31: Workshop Widget State Ownership
