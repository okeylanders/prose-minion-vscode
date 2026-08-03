# Sprint 04: Application Handler Extraction

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-04-handlers` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 03

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
