# Workshop Session Aggregate Extraction — Sprint 05

**Date:** 2026-08-05

**Review resolution:** 2026-08-06, PR #106

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
  only reconciled prepared state below the barrier. The ordering witness now
  pairs prepare/install owners and pins every install below the first live
  assignment; populated-state fault injection throws from the final roster
  prepare and proves all-or-nothing restoration.
- The duplicate-live-host-pin rule now lives in
  `WorkshopSessionStateV1Integrity` rather than a hydration-only check.
- Ordinary reset preserves the existing monotonic turn/todo counters while
  clearing their rows. This corrects an over-broad “construction state” phrase
  in the runway without changing behavior, with a facade-level ID regression.
- Context-only host delivery intentionally no longer appends a duplicate pin
  when both excerpt generations are absent. The manifest behavior is declared
  and protected by an observing regression.
- Two-live-pin corruption is intentionally refused before runtime-binding
  degradation. Released writers cannot produce that shape, so no checkpoint
  schema migration is required.
- `WorkshopSessionRecords` is the one turn-copy and record-type import origin;
  the aggregate's near-dead type re-export block and the snapshot double clone
  were removed.
- Guest dismissal now distinguishes “no transition” from “disposed without a
  conversation-id payload,” so manifest and active-run cleanup cannot be skipped.
- Session collaborator conventions are recorded in `session/README.md`.
- PR review F-10 (rollback double-failure observability) is inherited and tracked
  in `.todo/tech-debt/2026-08-06-workshop-rollback-failure-observability.md`.
- Room delivery remains an aggregate operation: the facade validates the turn
  head, then delegates participant-local offset compare-and-set behavior.
- A Gesture Playground test no longer mutates the aggregate's former private
  participant record; it creates and selects a real sidecar through public APIs.
- No message contract, persisted shape, schema version, aggregate method
  signature, or autosave ordering changed.

## Size

- `WorkshopSessionService.ts`: 2,121 lines (2,894 at the runway branch point)
- `WorkshopSessionRecords.ts`: 390 lines
- Collaborators: todo 200, turn 113, passage/scope 351, participant roster 451
- `session/README.md`: 22 lines
- Focused collaborator suites: 930 lines total

## Verification

- Full typecheck: core, webview, and VS Code adapter passed.
- ESLint: zero errors; 921 repository-baseline warnings.
- Production build and bundle sentinel: passed; three existing webpack size
  recommendations remain.
- Full Jest baseline after PR review fixes: 187 suites, 1,922 tests, and 1
  snapshot passed.
- Six directly affected suites: 161 tests passed.
- Independent S1–S4 correctness/architecture review: no findings.
- Independent records/copy-boundary review: redaction and clone behavior match
  the pre-extraction implementation; two documentation/import nits were fixed.
- `git diff --check`: passed.

## Publication note

The implementation is published in PR #106. The unrelated untracked
`docs/adr/2026-08-05-whats-new-notice-ledger.md` remains untouched.
