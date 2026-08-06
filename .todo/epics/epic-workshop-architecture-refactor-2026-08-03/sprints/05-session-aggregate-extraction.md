# Sprint 05: Session Aggregate Extraction

**Status:** Complete — implemented and verified locally 2026-08-05 (uncommitted)

**Branch:** `sprint/workshop-architecture-refactor-05-session-aggregate` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 04

**Evidence:** [Sprint 05 architecture change runway](../../../../docs/architecture/2026-08-05-workshop-sprint-05-session-aggregate-runway.md) — D1 and D2 accepted by Okey on 2026-08-05; S0 landed before any extraction.

## Accepted decisions

| ID | Accepted option | Consequence |
|---|---|---|
| D1 | **Four clusters** | Extract todos, turn identity/order, passage/scope, and the participant roster. Retain writer-source manifests, the active run, context attachments, message attachments, and conversation behavior in the aggregate for the coupling reasons recorded below. |
| D2 | **Take S5** | Move aggregate record declarations and their defensive-copy/projection rules to `WorkshopSessionRecords.ts`. Its header states explicitly why those types and copy boundaries intentionally stay together. |

## Goal

Give independently changing Workshop session concepts named internal owners
while preserving `WorkshopSessionService` as the single aggregate facade and
whole-session mutation boundary.

## Scope

- Install the hydration fault-injection and prepare-before-install architecture
  witnesses before changing aggregate ownership.
- Extract the four measured clusters with coherent invariants and focused tests:
  todos, turn identity/order, passage/scope, and the participant roster.
- Move aggregate record contracts and their defensive-copy/projection discipline
  to the intentionally type-focused `WorkshopSessionRecords.ts` module.
- Retain manifests, active-run coordination, context/message attachments, and
  conversation behavior in the aggregate; do not manufacture owners by
  duplicating their cross-record invariants.
- Preserve reset, snapshot, prepare/install hydration, cross-record integrity,
  and autosave ordering in the aggregate.
- Reassess store, search/index, and persistence-coordinator responsibilities;
  record the evidence-backed no-split result.

## Completion criteria

- [x] Session concepts have one owner and no duplicated invariants.
- [x] Handlers continue to depend on the aggregate facade, not internal ledgers.
- [x] Hydration remains all-or-nothing and autosave ordering is unchanged.
- [x] Remaining large files have one documented cohesive responsibility.

## Implementation outcome

`WorkshopSessionService` remains the single production facade and whole-session
mutation boundary. Four internal collaborators now own the state and invariants
that close over one concept:

| Owner | Closed responsibility | Lifecycle contract |
|---|---|---|
| `WorkshopTodoLedger` | Todo identity, finding deduplication, bounds, ordering, and excerpt-version-derived staleness | `exportState` / `prepareState` / `installPreparedState` / `reset` |
| `WorkshopTurnLedger` | Monotonic turn identity, append/update, lookup, ordering, head/window reads | `exportState` / `prepareState` / `installPreparedState` / `reset` |
| `WorkshopPassageScope` | Pinned/shelved passage, scope lock, excerpt revision, replacement count, pending excerpt delivery | `exportState` / `prepareState` / `installPreparedState` / `reset` |
| `WorkshopParticipantRoster` | Host, tool sidecars, guest tombstones, composer target, selected tool, and participant-local room offsets | `exportState` / `prepareState` / `installPreparedState` / `reset` |

Room-delivery reads and mutation remain aggregate operations: the facade joins
the roster with the turn ledger, proves a delivery head exists, and only then
delegates the participant-local compare-and-set offset. No handler imports or
receives an internal collaborator; the architecture witness discovers exported
session collaborator classes from the directory so future additions are covered
without another hard-coded regex.

Hydration now visibly has two phases. Every collaborator validates and clones
through `prepareState` above the first aggregate assignment; only prepared state
crosses the install barrier. A fault-injection test compares the full committed
state before and after a throwing preparation, and an architecture test pins all
`.prepareState(...)` calls above that barrier. The duplicate-live-host-pin rule
also moved to `WorkshopSessionStateV1Integrity`, giving persisted-state validity
one owner.

The ordinary reset contract needed one correction to the runway's generic
wording: existing behavior cleared turn and todo rows while preserving their
monotonic counters. The extracted ledgers preserve those counters; only the rows
reset. This is deliberate compatibility, not cached cross-cluster state.

### D2 records boundary

`WorkshopSessionRecords.ts` owns record declarations plus structural clones and
host-to-webview projections. The file comment records that co-location as an
intentional maintenance boundary: a nested mutable or host-private field and its
defensive copy change together. It owns no I/O or mutation policy. Existing
type imports through `WorkshopSessionService` remain source-compatible via
explicit re-exports, while production type-only consumers now name the records
module directly.

### Retained aggregate clusters

| Cluster | Why it remains in `WorkshopSessionService` |
|---|---|
| Writer-source manifests | Rows are derived at passage, attachment, sidecar, guest, and delivery transitions; extracting them would duplicate pin/attachment derivation or hand a ledger the aggregate. |
| Active run | It is coordination state spanning turns, participants, manifests, passage versions, capabilities, and behavior. A separate owner would be an anemic holder or invert dependencies. |
| Context attachments | Budget/duplicate policy is coupled to revisions, event turns, host delivery, and writer manifests. |
| Message attachments | Three mutation/commit paths also update writer manifests and one-shot thread artifacts. |
| Conversation behavior | Transition provenance is cohesive but only a few methods; another file boundary would add ceremony without independent policy. |

The aggregate header names these retained responsibilities and the lifecycle
quartet explicitly, so the remaining large file has one documented reason to
exist rather than being a residual drawer.

### Size and adjacent-file reassessment

The runway budgeted the facade at roughly 2,400 lines after S1–S4, including
the unavoidable delegation and lifecycle tax. Taking optional S5 then moved the
remaining declarations/copy discipline out as well. The final composition is:

| File | Lines | Interpretation |
|---|---:|---|
| `WorkshopSessionService.ts` | 2,127 | Aggregate behavior, retained coupled clusters, public delegation, whole-session lifecycle |
| `WorkshopSessionRecords.ts` | 401 | Record contracts and defensive copy/projection discipline |
| `WorkshopTodoLedger.ts` | 199 | Todo invariants and state contract |
| `WorkshopTurnLedger.ts` | 132 | Generic identity/order ledger and state contract |
| `WorkshopPassageScope.ts` | 351 | Passage/scope state machine and state contract |
| `WorkshopParticipantRoster.ts` | 444 | Participant/routing state, offsets, snapshots, and state contract |

The larger collaborator estimates were deliberately allowed to absorb complete
prepare/install/reset contracts, defensive copying, and boundary documentation;
the evaluation criterion is closed ownership, not cosmetic line movement.

`WorkshopSessionStore`, `WorkshopSessionSearchIndexV1`, and
`WorkshopSessionPersistenceCoordinator` were reassessed and not split. Their
churn since 2026-05-01 was 5, 2, and 9 commits respectively, versus 63 for the
session aggregate at the runway branch point. Each still describes one cohesive
policy, so another boundary would add ceremony without independent change.

### Contract preservation

- No public aggregate method signature changed.
- No message, payload, persisted field, checkpoint schema, or autosave ordering changed.
- Existing aggregate type exports remain available; the core barrel continues
  to expose `WorkshopSessionHydrationResult`.
- The Gesture Playground test that mutated the former private `participants`
  field now constructs and targets a real tool sidecar through public aggregate
  behavior.

### Verification

- Full typecheck: passed for core, webview, and VS Code adapter.
- ESLint: zero errors; 921 existing warnings.
- Production build and bundle sentinel verification: passed; webpack retained
  its existing three asset-size recommendations.
- Full Jest baseline: **187 suites, 1,918 tests, 1 snapshot — all passed**.
- Workshop services, Workshop handlers, and architecture boundary suite:
  **46 suites, 718 tests — all passed**.
- `git diff --check`: passed.

No commit was created as part of this implementation request. The unrelated
untracked `docs/adr/2026-08-05-whats-new-notice-ledger.md` was present before
the sprint work and remains untouched.
