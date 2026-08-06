# Sprint 02C: Workshop Scope/Context IPC Extraction

**Status**: Superseded 2026-08-03 — mandatory work moved to Workshop Architecture Refactor Phase 4
**Priority**: Historical plan; do not execute independently
**Branch**: `sprint/conversation-widgets-02c-workshop-scope-context-ipc-extraction` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 1-2 days
**Depends on**: Sprint 02B-A merged into `epic/conversation-widgets`
**Blocks**: Superseded by [Workshop Architecture Refactor Sprint 04](../../epic-workshop-architecture-refactor-2026-08-03/sprints/04-application-handler-extraction.md)
**Tech debt**: [Workshop god files](../../../tech-debt/2026-07-25-workshop-god-files.md)

## Decision Gate

**Supersession note:** The decision owner froze all Workshop feature work until
the full responsibility refactor completes. The eight-route seam remains useful
evidence, but it is no longer optional and this sprint is not the execution
artifact. The architecture-refactor epic owns the move and its relationship to
the other handler boundaries.

Take this sprint only if Sprint 02B-A leaves the scope/context route cluster as a
clean pure-move seam and `WorkshopHandler` would otherwise absorb more wiring
for Prose Controller. Skip it if extraction would require behavior changes,
new abstractions, or surgery on the run/send pipeline. Optional means optional:
Sprint 03 depends on the standing rail from 02B, not on this cleanup.

## Goal

Make the god-file reduction tangible before Prose Controller by moving the
cohesive Workshop scope/context IPC slice out of `WorkshopHandler` into a
focused sibling handler. Preserve every message contract, mutation guard,
side effect, log, error, autosave-dirty call, and webview response exactly.

This is a **pure move with wiring**, not a second architecture sprint and not a
redesign of context intake.

## Target Seam

Extract a focused sibling (working name `WorkshopScopeContextHandler`) that owns
the route registration and implementations for:

- `WORKSHOP_SET_SESSION_SCOPE`
- `WORKSHOP_REPIN_EXCERPT`
- `WORKSHOP_ADD_CONTEXT_TEXT`
- `WORKSHOP_ADD_CONTEXT_FILE`
- `WORKSHOP_REMOVE_CONTEXT_ATTACHMENT`
- `WORKSHOP_UPDATE_CONTEXT_TEXT`
- `WORKSHOP_REQUEST_CONTEXT_ATTACHMENT`
- `WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE`

Move the private attachment/file helpers required exclusively by those routes.
Construct the sibling inside `WorkshopHandler` and register through the same
`registerRoutes(router, registerMutation)` seam used by
`WorkshopSessionMessageHandler` and `WorkshopWidgetHandler`.

## Locked Constraints

- **Behavior is frozen.** No new routes, message types, validation rules,
  persistence fields, copy changes, or UI changes.
- **Mutation semantics stay exact.** Scope and attachment writes keep the same
  session-operation gate; attachment reads remain available during session
  operations exactly as they are today.
- **No composition-root expansion.** This is a Workshop-internal sibling;
  `MessageHandler`, providers, and `CoreServices` remain unchanged unless the
  existing dependency shape makes that impossible—in which case defer 02C.
- **No run/send extraction.** `executeMessage`, active-run lifecycle, room
  delivery, context wizard execution, and resource-catalog orchestration stay
  in `WorkshopHandler`.
- **No aggregate extraction.** The scope/shelf state machine in
  `WorkshopSessionService` remains separately tracked debt. This sprint reduces
  the handler, not both god files at once.
- **No opportunistic cleanup.** Preserve names and control flow unless a change
  is mechanically required by access boundaries.

## Scope / Deliverables

1. Add the focused scope/context sibling handler and its narrow dependency /
   callback contract.
2. Move the eight routes and their exclusive helpers without behavior changes.
3. Remove the moved methods/imports from `WorkshopHandler`; keep it as the
   Workshop coordinator and owner of cross-slice seams.
4. Update the god-files debt record with before/after line counts and remaining
   candidate seams.
5. Run the unchanged behavior-level suites plus all project verification.

## Out of Scope

- Context catalog/search/resource attachment routes.
- Context wizard orchestration.
- Excerpt file picker, reread, or resource-loading pipelines.
- The `WorkshopSessionService` scope/shelf state machine.
- Webview hook/component extraction.
- Any Lexical Gravity or Prose Controller behavior.

## Completion Criteria

- The eight routes are registered by the sibling handler, with the same
  mutation/read gating and observable behavior.
- `WorkshopHandler` has a materially smaller, more legible route surface.
- Existing scope, context attachment, persistence, handler, and architecture
  tests pass without behavior-level rewrites.
- All three TypeScript projects, lint, full Jest, production build, bundle
  sentinel, architecture witnesses, and `git diff --check` pass.
- If any behavior change becomes necessary, stop and defer the sprint rather
  than laundering feature work through a cleanup PR.
