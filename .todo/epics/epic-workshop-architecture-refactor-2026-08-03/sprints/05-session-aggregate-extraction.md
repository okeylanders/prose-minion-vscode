# Sprint 05: Session Aggregate Extraction

**Status:** Complete — implemented 2026-08-05; PR #106 review addressed 2026-08-06

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
through `prepareState` above the first aggregate assignment; prepared values are
mutable aggregate drafts only for throw-free degradation reconciliation before
the barrier. A populated-state fault-injection test throws from the final roster
prepare and proves the full committed state remains unchanged. The architecture
witness requires matching prepare/install collaborator sets, every prepare above
the first live assignment, and every install below it. The shared conventions
now live beside the collaborators in `session/README.md`.

The duplicate-live-host-pin rule moved to
`WorkshopSessionStateV1Integrity`, giving persisted-state validity one owner and
intentionally running the rule before runtime-binding degradation. A corrupt
two-live-pin checkpoint with a dead host binding is therefore refused instead
of degraded open. Released writers cannot produce that shape, so this is
consistent corruption rejection outside the codec-migration contract and does
not require a schema bump.

The ordinary reset contract needed one correction to the runway's generic
wording: existing behavior cleared turn and todo rows while preserving their
monotonic counters. The extracted ledgers preserve those counters; only the rows
reset. This is deliberate compatibility, not cached cross-cluster state, and a
facade-level regression now proves the post-reset IDs advance.

The review identified a second intentional correction: a context-only host
delivery no longer treats absent excerpt generations as a successful excerpt
commit. That old `undefined === undefined` path appended a duplicate live pin
row; the guarded path preserves the existing pin manifest, now covered by an
observing aggregate assertion.

### D2 records boundary

`WorkshopSessionRecords.ts` owns record declarations plus structural clones and
host-to-webview projections. The file comment records that co-location as an
intentional maintenance boundary: a nested mutable or host-private field and its
defensive copy change together. It owns no I/O or mutation policy. Existing
internal type consumers now name this canonical records module directly; the
near-dead `WorkshopSessionService` type re-export path was removed after its one
remaining test consumer moved.

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
| `WorkshopSessionService.ts` | 2,121 | Aggregate behavior, retained coupled clusters, public delegation, whole-session lifecycle |
| `WorkshopSessionRecords.ts` | 390 | Record contracts and the single turn-copy/projection discipline |
| `WorkshopTodoLedger.ts` | 200 | Todo invariants and state contract |
| `WorkshopTurnLedger.ts` | 113 | Generic identity/order ledger and state contract |
| `WorkshopPassageScope.ts` | 351 | Passage/scope state machine and state contract |
| `WorkshopParticipantRoster.ts` | 451 | Participant/routing state, offsets, snapshots, and state contract |
| `session/README.md` | 22 | Lifecycle, clock, mutation-discipline, and reset-counter conventions |

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
- Session record types have one canonical internal import origin; the core
  barrel continues to expose `WorkshopSessionHydrationResult`.
- The Gesture Playground test that mutated the former private `participants`
  field now constructs and targets a real tool sidecar through public aggregate
  behavior.
- Two deliberate corrections are declared above: context-only delivery cannot
  duplicate a host pin, and corrupt multi-live-pin checkpoints are refused
  before runtime-binding degradation.

### Verification

- Full typecheck: passed for core, webview, and VS Code adapter.
- ESLint: zero errors; 921 repository-baseline warnings.
- Production build and bundle sentinel verification: passed; webpack retained
  its existing three asset-size recommendations.
- Full Jest baseline after review fixes: **187 suites, 1,922 tests, 1 snapshot — all passed**.
- Six directly affected service, collaborator, prompt, and architecture suites:
  **161 tests — all passed**.
- `git diff --check`: passed.

Implementation is published in PR #106. The unrelated untracked
`docs/adr/2026-08-05-whats-new-notice-ledger.md` remains untouched.
