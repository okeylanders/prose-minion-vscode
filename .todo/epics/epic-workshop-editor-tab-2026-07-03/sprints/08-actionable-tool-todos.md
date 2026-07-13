# Sprint 08: Actionable Tool To-do List

**Status**: Planned
**Priority**: Medium
**Branch**: `sprint/workshop-editor-tab-08-actionable-tool-todos` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3–5 days
**Depends on**: Sprint 06A agent-run engine and Sprint 06B tool-side-pass artifacts/host evidence handoff

## Goal

Turn actionable findings from a Workshop tool report into an inspectable,
writer-controlled To-do List below the tool selector. The active list is visible
to the persona as bounded, attributed evidence, but the persona never invents
or silently completes writer tasks.

## Product Decisions

- Tool reports remain the source artifact; tasks point back to the exact tool
  report and finding that created them.
- Do not infer tasks from arbitrary prose with a heuristic. Extend the tool
  report contract with an optional structured `nextSteps` payload or a strictly
  parsed, deterministic `### Next steps` section.
- The writer owns completion, dismissal, ordering, and edits. Persona text may
  suggest a task, but only an explicit UI action adds it to the list.
- The persona receives a bounded snapshot of open tasks on host turns, with
  task text, source tool/report attribution, and completion state.

## Tasks

### Contracts and session state

- [ ] Add a typed `WorkshopTodoItem` with stable id, text, source tool/report
      id, status, created timestamp, and optional writer edit metadata.
- [ ] Extend tool-report artifacts with optional structured actionable findings
      and validate their size/count before they enter session state.
- [ ] Add host-owned operations to add, edit, complete, reopen, dismiss, and
      reorder tasks; expose an id-free defensive snapshot to the webview.
- [ ] Define reset/excerpt-replacement semantics and test them explicitly.

### UI and interaction

- [ ] Make the composer’s + button open the writer-controlled Context Selector
      / project-file browser, not the Writing Tools modal. Keep the explicit
      Tools button as the sole tool-browser entry point.
- [ ] Render a compact To-do List below Workshop tool selection with counts,
      completion toggles, source attribution, and an empty state.
- [ ] Let the writer promote an actionable finding into a task deliberately;
      do not create tasks merely because a model used imperative language.
- [ ] Preserve keyboard toggles, readable source labels, and clear
      completed/dismissed state.

### Persona evidence

- [ ] Inject a bounded, attributed open-task snapshot into host turns after the
      Sprint 06 tool-report handoff; omit stale/dismissed items.
- [ ] Ensure the host treats tasks as writer-owned planning evidence, not
      instructions to perform file writes or hidden tool calls.
- [ ] Render the originating report verbatim even when a task is later edited
      or completed.

### Tests and verification

- [ ] Cover structured extraction, malformed/oversized payload rejection,
      source attribution, lifecycle, reload restoration, and task UI actions.
- [ ] Cover exact host evidence input and prove no task text crosses a boundary
      without its source/provenance.
- [ ] Run focused/full tests, typecheck, lint, build, and F5 smoke for task
      creation, edits, completion, direct-tool mode, host return, reset, and
      reload.

## Acceptance Criteria

- A writer can turn a concrete tool finding into a durable, attributed task and
  manage it without losing the original report.
- The To-do List is deterministic and writer-controlled, never an opaque model
  guess.
- The persona can see bounded open tasks and their provenance on subsequent
  host turns.
- Reload, reset, excerpt replacement, tool-sidecar loss, and host return leave
  task state honest and inspectable.

## Related Files

- `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06b-tool-side-pass.md`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/shared/types/messages/workshop.ts`
