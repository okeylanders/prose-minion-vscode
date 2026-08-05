# Sprint 04: Application Handler Extraction

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-04-handlers` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 03

**Evidence:** [Sprint 04 architecture change runway](../../../../docs/architecture/2026-08-04-workshop-sprint-04-handler-runway.md) — gate **BLOCKED** pending decisions D1–D4.

## Open decisions

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | Where the cuts fall: the superseded 02C eight-route list, helper-closure clusters, or clusters plus a context-intake service | Helper-closure clusters — excerpt/scope (6 routes) and context/resources (13) | slice 2 |
| D2 | What happens to the 3,035-line `WorkshopHandler` behavior suite, which calls `handle*` directly | Split it by owner; add no new delegating passthroughs | slice 1 |
| D3 | Whether the Context wizard moves with the context cluster | Yes, behind an explicit `cancelRun` / `isRunning` / `dispose` contract | slice 4 |
| D4 | Whether `WorkshopHandler.ts` moves into `handlers/domain/workshop/` this sprint | Yes, as a slice-0 pure move | slice 0 |

## Goal

Make `WorkshopHandler` a legible room/run orchestrator and Workshop-internal
slice composer rather than the default owner for unrelated IPC behavior.

## Scope

- Extract the planned scope/context route cluster.
- Extract additional cohesive file/resource, participant/persona, settings,
  todo, and context-wizard clusters where dependency and helper analysis proves
  independent ownership.
- Keep `executeMessage`, active-run lifecycle, room delivery, and cross-slice
  orchestration central until a narrower seam is independently justified.
- Give each sibling a narrow dependency/callback contract and focused tests.

## Completion criteria

- [ ] Every remaining `WorkshopHandler` route belongs to room/run orchestration
      or a documented cross-slice responsibility.
- [ ] Sibling handlers own complete route/helper clusters, not arbitrary method
      fragments.
- [ ] Mutation/read gating remains behaviorally identical.
- [ ] Handler architecture and behavior suites pass.
