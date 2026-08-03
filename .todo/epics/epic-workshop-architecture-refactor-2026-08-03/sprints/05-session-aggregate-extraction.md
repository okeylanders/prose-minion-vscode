# Sprint 05: Session Aggregate Extraction

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-05-session-aggregate` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 04

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
