# Workshop Handler Extraction — Sprint 04

**Date:** 2026-08-04

**Status:** Implemented and verified locally; working tree remains uncommitted.

**Branch:** `sprint/workshop-architecture-refactor-04-handlers`

## Decisions implemented

- D1=C: cut excerpt/scope and context/resources by helper closure and
  rename/evolve the existing resource service into one root-owned,
  route-free `WorkshopContextIntakeService`.
- D2=C refined: drive aggregate behavior through a real `MessageRouter`, split
  by route owner, and retain only a thin assembly/cross-slice suite.
- D3=A: move the Context wizard with `WorkshopContextHandler`; central cancel
  delegates through `cancelRun`, user cancellation holds the slot through
  guarded `finally`, and `dispose()` clears immediately.
- D4=A: move the two remaining root Workshop handlers under
  `application/handlers/domain/workshop/`.

## Landed architecture

- Exact Workshop route ledger: 48 routes — 34 mutation-gated and 14 direct/read.
- Ownership: central room/run 9; excerpt/scope 6; context/resources/wizard 13;
  todo 1; existing session/widget/standing siblings 19.
- Central `WorkshopHandler` is still the Workshop-internal composer and the only
  owner of `CANCEL_WORKSHOP_REQUEST` and `WORKSHOP_SESSION_STATE` construction.
- `WorkshopContextIntakeService` owns catalog/disk reads, bounds, decoding,
  fingerprints/truncation, provenance, display paths, and structured refusal
  descriptions. It owns no route, transport, session, UI-effect, or log concern.
- Shared contracts now live in `WorkshopHandlerContracts.ts`: mutation
  registrar, room effects, and refusal-copy run gate.
- Moved error logs use owner-aware prefixes while wire error source/copy/details
  remain unchanged. The mapping is recorded in the Sprint 04 runway under F9.
- Participant and conversation-settings routes intentionally remain central:
  their active-run/settlement and deferred-flush ordering are not independent
  handler seams.

## Test and witness topology

- `WorkshopHandlerTestHarness.ts` assembles the production handler family with a
  real `MessageRouter`; aggregate tests contain no direct route-handler calls.
- Owner aggregate cases: room/run 45, assembly 16, excerpt/scope 15, context 24,
  todo 4, session messages 10 — 114 total.
- Intake-service suite: 17 focused cases.
- `boundaries.test.ts` enforces the exact route owner and registration class,
  duplicate/missing/unledgered route detection, the sole session-state composer,
  and intake-service negative space.

## Verification

- Full typecheck passed for core, webview, and VS Code adapter.
- Full Jest: 183 suites, 1,877 tests, 1 snapshot; all passed.
- Workshop handler plus side-pass suites: 174/174 passed.
- Architecture suite: 16/16 passed.
- ESLint: 0 errors, 921 existing warnings.
- Production build and bundle sentinel verification passed; webpack reported
  the existing three asset-size recommendations.
- VSIX packaging passed: 192 files, 11.19 MB.

## Evidence

- [Sprint 04 plan](../.todo/epics/epic-workshop-architecture-refactor-2026-08-03/sprints/04-application-handler-extraction.md)
- [Sprint 04 architecture runway](../docs/architecture/2026-08-04-workshop-sprint-04-handler-runway.md)
- [Workshop feature-family ADR](../docs/adr/2026-08-03-workshop-feature-family-and-module-boundaries.md)

## Handoff

No commit was created. When committing, preserve the planned rollback seams:
construct the D4 directory move and D1 service rename as pure commits before
the route-driven test topology, contracts, service evolution, handler
extractions, witnesses, and closeout docs. Do not squash the pure moves into the
behavior-moving extraction commit.

Known inherited behavior retained by this sprint: cancellation after wizard
result adoption has already begun does not interrupt subsequent catalog work.
The extraction did not broaden or narrow that window.
