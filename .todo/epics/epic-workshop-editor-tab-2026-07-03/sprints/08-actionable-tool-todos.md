# Sprint 08: Actionable Tool To-do List

**Status**: In progress (2026-07-13)
**Priority**: Medium
**Branch**: `sprint/workshop-editor-tab-08-actionable-tool-todos` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3–5 days
**Depends on**: Sprint 06A agent-run engine and Sprint 06B tool-side-pass artifacts/host evidence handoff

## Goal

Turn actionable findings from a Workshop tool report or host synthesis into an
inspectable, writer-controlled To-do List below the tool selector. The active
list is visible to the persona as bounded, attributed evidence, but the persona
never silently adds or completes writer tasks.

## Product Decisions

- Tool reports remain the primary source artifact. A host may synthesize
  prioritized proposals from the whole report or conversation; tasks point
  back to the exact source turn and, for report-derived synthesis, the upstream
  tool report.
- Do not infer tasks from arbitrary prose with a heuristic. Extend the tool
  report contract with an optional structured `nextSteps` payload or a strictly
  parsed, deterministic `### Next steps` section.
- The writer owns completion, dismissal, ordering, and edits. Persona text may
  suggest a task, but only an explicit UI action adds it to the list.
- Host proposals use the same strict `### Next steps` contract and may carry
  `high`, `medium`, or `low` priority. Unsupported labels are rejected rather
  than guessed.
- The persona receives a bounded snapshot of open tasks on host turns, with
  task text, source tool/report attribution, and completion state.

## Kickoff Clarifications (2026-07-13)

- A task's stable opaque id crosses the webview boundary because edit,
  completion, dismissal, and reorder commands require correlation. Provider
  conversation ids remain private; snapshots are defensive copies.
- Replacing the excerpt preserves attributed tasks as visibly stale history,
  but stale tasks are excluded from persona evidence. Reset starts a genuinely
  new task list and clears every task.
- Sprint 08 uses a strictly parsed exact `### Next steps` Markdown section.
  Findings are single-line list items with hard item/count/section bounds; a
  malformed or oversized section contributes no actionable findings.
- The composer `+` becomes the writer-controlled context entry point. The
  existing bounded Context Brief is the delivered context path for this
  sprint; configured project-file attachments remain in the separately
  tracked Context Selector feature until its unresolved attachment semantics
  are decided.

## Tasks

### Contracts and session state

- [x] Add a typed `WorkshopTodoItem` with stable id, text, source tool/report
      id, status, created timestamp, and optional writer edit metadata.
- [x] Extend tool-report artifacts with optional structured actionable findings
      and validate their size/count before they enter session state.
- [x] Add host-owned operations to add, edit, complete, reopen, dismiss, and
      reorder tasks; expose an id-free defensive snapshot to the webview.
- [x] Define reset/excerpt-replacement semantics and test them explicitly.

### UI and interaction

- [ ] Make the composer’s + button open the writer-controlled Context Selector
      / project-file browser, not the Writing Tools modal. Keep the explicit
      Tools button as the sole tool-browser entry point.
      Current delivery deliberately stops at focusing the writable Context
      Brief; the configured project-file browser remains in the separately
      tracked Context Selector feature.
- [x] Render a compact To-do List below Workshop tool selection with counts,
      completion toggles, source attribution, and an empty state.
- [x] Let the writer promote an actionable finding into a task deliberately;
      do not create tasks merely because a model used imperative language.
- [x] Let the host propose prioritized tasks from its full synthesis, with
      explicit Add and Add all controls and immutable source-turn provenance.
- [x] Preserve keyboard toggles, readable source labels, and clear
      completed/dismissed state.
- [x] Preserve the reader's scroll position when a bubble action only updates
      task state; auto-scroll only for a new/streaming conversation turn.

### Persona evidence

- [x] Inject a bounded, attributed open-task snapshot into host turns after the
      Sprint 06 tool-report handoff; omit stale/dismissed items.
- [x] Ensure the host treats tasks as writer-owned planning evidence, not
      instructions to perform file writes or hidden tool calls.
- [x] Render the originating report or host turn verbatim even when a task is
      later edited or completed.

### Tests and verification

- [x] Cover structured extraction, malformed/oversized payload rejection,
      source attribution, lifecycle, reload restoration, and task UI actions.
- [x] Cover exact host evidence input and prove no task text crosses a boundary
      without its source/provenance.
- [ ] Run focused/full tests, typecheck, lint, build, and F5 smoke for task
      creation, edits, completion, direct-tool mode, host return, reset, and
      reload.

## Acceptance Criteria

- A writer can turn a concrete tool finding into a durable, attributed task and
  manage it without losing the original report.
- A host can turn whole-report or conversational judgment into visible,
  prioritized proposals, but cannot mutate the task list without writer input.
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

## Kickoff Implementation Record (2026-07-13)

- Added exact `### Next steps` extraction with whole-section rejection for
  malformed, duplicate, nested, oversized, or over-count findings. Workshop
  tool runs receive the trusted report-shape contract; reports remain verbatim.
- Added a host-owned task aggregate with opaque ids, immutable report/finding
  provenance, writer edits, completion/reopen/dismiss/reorder operations, a
  200-item session bound, defensive snapshots, reload restoration, and stale
  excerpt behavior.
- Added explicit finding promotion controls and the compact rail To-do List.
  The composer `+` now focuses writer context while the Tools button remains
  the sole tool-browser entry point.
- Added a 12-item / 12,000-character attributed persona snapshot. Only open
  tasks for the current excerpt enter it; task ids, completed/dismissed tasks,
  and stale tasks do not. Each task's text and immutable source travel in one
  indivisible evidence block.

Verification:

- `npm test -- --runInBand`: 92 suites / 728 tests passed.
- `npm run typecheck`: core, webview, and extension passed.
- `npm run lint`: 0 errors (repository warning baseline only).
- `npm run build`: production extension/webview builds and bundle sentinel
  passed. Bundles: `extension.js` 2,353,349 bytes and `webview.js` 604,516
  bytes; webpack retains its existing webview-size advisory.
- `git diff --check`: passed.
- Remaining before sprint completion: F5 smoke and the full configured
  project-file Context Selector (the separately tracked feature whose paste-
  only context path shipped in 06C). The `+` routing bug itself is fixed.

## Host Proposal Follow-up (2026-07-13)

- Jill now receives an output contract for an optional, exact `### Next steps`
  footer with single-line `[high]`, `[medium]`, or `[low]` proposals. The same
  bounded deterministic parser used for reports validates the footer.
- Host proposals render on Jill's response with per-item Add and explicit Add
  all controls. Adding remains a writer action; Jill cannot claim or perform a
  hidden task-list mutation.
- Todo provenance is a discriminated source contract. Direct findings cite the
  tool report; synthesized findings cite Jill's turn, persona, and upstream
  report when the synthesis followed one.
- Todo-only session snapshots no longer trigger thread auto-scroll. A named
  hook keys scrolling to actual turn/stream/error progression, with a regression
  test proving an Add action leaves the reader at the source bubble.
