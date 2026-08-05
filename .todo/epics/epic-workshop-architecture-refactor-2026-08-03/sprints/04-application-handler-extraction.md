# Sprint 04: Application Handler Extraction

**Status:** Complete — implemented and verified locally 2026-08-04 (uncommitted)

**Branch:** `sprint/workshop-architecture-refactor-04-handlers` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 03

**Evidence:** [Sprint 04 architecture change runway](../../../../docs/architecture/2026-08-04-workshop-sprint-04-handler-runway.md) — gate **SATISFIED**; decisions D1–D4 accepted by Okey on 2026-08-04 and verified in the implementation below.

## Accepted decisions

| ID | Accepted option | Consequence |
|---|---|---|
| D1 | **C** | Extract excerpt/scope (6) and context/resources (13) by helper closure **and** rename/evolve the existing `WorkshopContextResourceService` into `WorkshopContextIntakeService`. It owns disk/catalog reads, bounds, fingerprints/truncation, provenance, and structured refusal descriptors. It stays route-, transport-, session-, and UI-effect-free; no competing second service. |
| D2 | **C, refined** | Behavior tests dispatch through a small real `MessageRouter` fixture around `WorkshopHandler`, then split into focused suites by owner plus one thin assembly/cross-slice suite. Do not construct the full twelve-domain `MessageHandler`; add no production passthroughs. |
| D3 | **A** | Move the Context wizard with `WorkshopContextHandler`. The central cancel route delegates `workshop-context` to `cancelRun(requestId)`. User cancel aborts but leaves `isRunning()` true until the run's `finally`; `dispose()` aborts and clears immediately. |
| D4 | **A** | Pure-move `WorkshopHandler.ts` and `WorkshopSessionMessageHandler.ts` into `handlers/domain/workshop/` before logic extraction. |

## Goal

Make `WorkshopHandler` a legible room/run orchestrator and Workshop-internal
slice composer rather than the default owner for unrelated IPC behavior.

## Scope

- Extract `WorkshopExcerptScopeHandler` (6 routes), `WorkshopContextHandler`
  (13 routes including the wizard), and `WorkshopTodoHandler` (1 route) by
  complete helper closure.
- Rename/evolve the existing root-owned context-resource service into the
  route-free `WorkshopContextIntakeService`; update the core barrel,
  `CoreServices`, `extension.ts`, `MessageHandler`, and fixtures atomically.
- Keep `CANCEL_WORKSHOP_REQUEST` registered once in central `WorkshopHandler`;
  delegate only its context-domain branch and preserve cancel/finally/dispose
  lifecycle semantics.
- Keep `executeMessage`, active-run lifecycle, room delivery, and cross-slice
  orchestration central until a narrower seam is independently justified.
- Keep participant/persona and conversation-settings routes central in this
  sprint because they participate in run lifecycle/settlement ordering.
- Give each sibling a narrow dependency/callback contract and route-driven,
  focused tests.

## Implementation order

0. Pure-move the two root-level Workshop handlers.
1. Pure-rename the existing intake service and its `CoreServices`/root wiring.
2. Convert the behavior suite to real-router dispatch and split it by owner.
3. Add shared handler contracts.
4. Extract the todo route.
5. Evolve the intake service while the existing handler still consumes it.
6. Extract excerpt/scope.
7. Extract context/resources + wizard with the explicit run-control contract.
8. Complete route-owner, session-state-composition, and intake negative-space witnesses; run the full baseline.

Slices 0 and 1 are pure, independently reversible commits. Do not parallelize
work touching `MessageHandler.ts`, `MessageHandlerContracts.ts`, `extension.ts`,
the shared route fixture, or `boundaries.test.ts`.

## Completion criteria

- [x] Every remaining `WorkshopHandler` route belongs to room/run orchestration
      or a documented cross-slice responsibility.
- [x] Sibling handlers own complete route/helper clusters, not arbitrary method
      fragments.
- [x] Mutation/read gating remains behaviorally identical.
- [x] All moved behavior tests enter through `MessageRouter`; suites are focused
      by owner and no new handler passthroughs exist for tests.
- [x] `WorkshopContextIntakeService` is the renamed/evolved existing service,
      is constructed once at the composition root, and has no route, transport,
      session, or logging dependency.
- [x] User cancellation keeps the wizard slot occupied until `finally`; an
      immediate second wizard is refused; a later wizard starts after
      settlement; disposal clears immediately.
- [x] Wire messages and persisted shapes are unchanged.
- [x] Handler architecture and behavior suites pass.

## Implementation outcome

The global `MessageHandler`/`MessageRouter` remains the one extension ingress
and dispatcher. Workshop-internal route registration and behavior now live with
their cohesive owners:

| Owner | Routes | Registration shape |
|---|---:|---|
| `WorkshopHandler` | 9 | Room/run orchestration, including the single cancel route |
| `WorkshopExcerptScopeHandler` | 6 | Excerpt and session-scope mutations |
| `WorkshopContextHandler` | 13 | Context/resources, message attachments, and the Context wizard |
| `WorkshopTodoHandler` | 1 | Todo mutation |
| Existing session/widget/standing siblings | 19 | Unchanged ownership |
| **Total** | **48** | **34 mutation-gated, 14 direct/read routes** |

`WorkshopContextIntakeService` is the single root-owned intake policy. It owns
fresh catalog snapshots, configured and disk reads, bounds, decoding,
fingerprints/truncation, provenance matching, display paths, and structured
refusal descriptions. Architecture tests enforce that it owns no routes,
transport, session, or logging concerns.

The Context wizard moved with its workflow. Its public run-control seam is
exactly `isRunning()`, `cancelRun(requestId): boolean`, and `dispose()`.
User cancellation aborts without releasing the slot before guarded `finally`;
disposal aborts and clears immediately. Context was extracted before
excerpt/scope during implementation so the excerpt gate could consume this
finished seam; the accepted final ownership is unchanged.

The participant cluster was deliberately declined. `INVITE_GUEST` participates
directly in capability minting, streaming, active-run settlement, and room
delivery; extracting it would move the lifecycle this sprint intentionally kept
central, while the remaining persona/target methods do not justify a truthful
standalone owner. Conversation-settings ownership also remains central because
its deferred flush ordering crosses the central and session handlers.

### Test topology

- `WorkshopHandlerTestHarness.ts` assembles a real `MessageRouter` around the
  production handler family; aggregate behavior stimuli do not call handler
  methods directly.
- Owner suites cover room/run (45 cases), assembly/cross-slice behavior (16),
  excerpt/scope (15), context (24), todo (4), and session messages (10):
  **114 aggregate cases**, including the cross-slice wizard/excerpt refusal and
  owner-aware log-prefix witness.
- Narrow sibling and intake-service tests cover mechanics and result variants;
  the intake service has 17 focused cases.
- `boundaries.test.ts` contains an exact 48-route owner ledger, exact
  `registerMutation` versus direct-registration classification, duplicate and
  missing-route detection, the single session-state composer witness, and the
  intake negative-space witness.

### Verification

- Full typecheck: passed for core, webview, and VS Code adapter.
- Full Jest baseline: **183 suites, 1,877 tests, 1 snapshot — all passed**.
- Workshop handler plus side-pass suites: **174/174 passed**.
- Architecture suite: **16/16 passed**.
- ESLint: **0 errors, 921 existing warnings**.
- Production build and bundle sentinel verification: passed; webpack retained
  its existing three asset-size recommendations.
- VSIX packaging: passed — 192 files, 11.19 MB.

No commit was created as part of this implementation request. When the working
tree is committed, preserve the runway's rollback seams: construct the D4 pure
directory move and D1 pure service rename as separate commits before the test,
contract, service-evolution, and route-owner slices. Do not collapse those
behavior-preserving moves into the extraction commit.
