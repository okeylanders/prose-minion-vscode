# Workshop Session Aggregate Extraction — Sprint 05

**Date:** 2026-08-05

**Branch:** `sprint/workshop-architecture-refactor-05-session-aggregate`

**Sprint:** [Session Aggregate Extraction](../.todo/epics/epic-workshop-architecture-refactor-2026-08-03/sprints/05-session-aggregate-extraction.md)

**Runway:** [Workshop Sprint 05 Session Aggregate Runway](../docs/architecture/2026-08-05-workshop-sprint-05-session-aggregate-runway.md)

## Decisions

- D1 accepted: the evidence supports exactly four new internal collaborators —
  todos, turn identity/order, passage/scope, and participant roster.
- Writer-source manifests, active-run coordination, context attachments,
  message attachments, and conversation behavior remain in the aggregate with
  written coupling/cohesion reasons.
- D2 accepted: aggregate record declarations and defensive-copy/projection
  helpers moved to `WorkshopSessionRecords.ts`. Its header explicitly records
  why types and copy boundaries intentionally stay together.
- Store, search index, and persistence coordinator remain unsplit. Their branch-
  point churn (5/2/9 commits) did not justify new boundaries against the
  aggregate's 63 commits.

## Implementation facts

- Added `WorkshopTodoLedger`, `WorkshopTurnLedger`, `WorkshopPassageScope`, and
  `WorkshopParticipantRoster`, each with export/prepare/install/reset lifecycle
  support and a focused suite.
- `WorkshopSessionService` remains the only production facade and whole-session
  mutation boundary. Handlers do not import or receive internal collaborators.
- Hydration prepares every collaborator above the first assignment and installs
  only prepared state below the barrier. Fault injection and an ordering fitness
  witness protect all-or-nothing restoration.
- The duplicate-live-host-pin rule now lives in
  `WorkshopSessionStateV1Integrity` rather than a hydration-only check.
- Ordinary reset preserves the existing monotonic turn/todo counters while
  clearing their rows. This corrects an over-broad “construction state” phrase
  in the runway without changing behavior.
- Room delivery remains an aggregate operation: the facade validates the turn
  head, then delegates participant-local offset compare-and-set behavior.
- A Gesture Playground test no longer mutates the aggregate's former private
  participant record; it creates and selects a real sidecar through public APIs.
- No message contract, persisted shape, schema version, aggregate method
  signature, or autosave ordering changed.

## Size

- `WorkshopSessionService.ts`: 2,127 lines (2,894 at the runway branch point)
- `WorkshopSessionRecords.ts`: 401 lines
- Collaborators: todo 199, turn 132, passage/scope 351, participant roster 444
- Focused collaborator suites: 905 lines total

## Verification

- Full typecheck: core, webview, and VS Code adapter passed.
- ESLint: zero errors; 921 repository-baseline warnings.
- Production build and bundle sentinel: passed; three existing webpack size
  recommendations remain.
- Full Jest baseline: 187 suites, 1,918 tests, and 1 snapshot passed.
- Workshop services, Workshop handlers, and architecture boundaries: 46 suites,
  718 tests passed.
- Independent S1–S4 correctness/architecture review: no findings.
- Independent records/copy-boundary review: redaction and clone behavior match
  the pre-extraction implementation; two documentation/import nits were fixed.
- `git diff --check`: passed.

## Working-tree note

No commit was created. The unrelated untracked
`docs/adr/2026-08-05-whats-new-notice-ledger.md` existed before this sprint work
and was left untouched.
