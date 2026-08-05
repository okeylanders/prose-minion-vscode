# Sprint 05: Session Aggregate Extraction

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-05-session-aggregate` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 04

**Evidence:** [Sprint 05 architecture change runway](../../../../docs/architecture/2026-08-05-workshop-sprint-05-session-aggregate-runway.md) — gate **BLOCKED on D1**; no code moves until D1 is answered and slice S0 has landed.

## Decisions required

| ID | Question | Blocking |
|---|---|---|
| D1 | This sprint's scope names seven clusters. Two (widget configs, standing directives) are already extracted, and method-span measurement supports four of the remaining five: todos, turn ledger, passage/scope, participant roster. Writer-source manifests and the active run cannot be separated without duplicating invariants — the failure completion criterion 1 forbids. Accept the narrowed set with recorded retention reasons, or direct a different set. | **Yes** |
| D2 | ~600 of the aggregate's lines are type declarations and module-private clone helpers rather than behavior. Take the optional mechanical slice S5 that moves them to `WorkshopSessionRecords.ts`, or leave them in place. | No |

## Goal

Give independently changing Workshop session concepts named internal owners
while preserving `WorkshopSessionService` as the single aggregate facade and
whole-session mutation boundary.

## Scope

- Inventory state/method clusters for scope/shelf, attachments, participants,
  turns, todos, widget configs, and standing directives.
- Extract only clusters with coherent invariants and focused tests.
- Preserve reset, snapshot, prepare/install hydration, cross-record integrity,
  and autosave ordering in the aggregate.
- Reassess store, search/index, and persistence-coordinator responsibilities;
  split only genuinely independent policies.

## Completion criteria

- [ ] Session concepts have one owner and no duplicated invariants.
- [ ] Handlers continue to depend on the aggregate facade, not internal ledgers.
- [ ] Hydration remains all-or-nothing and autosave ordering is unchanged.
- [ ] Remaining large files have one documented cohesive responsibility.
