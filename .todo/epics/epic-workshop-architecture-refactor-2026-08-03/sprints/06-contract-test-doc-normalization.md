# Sprint 06: Contract, Test, and Documentation Normalization

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-06-normalization` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 05

## Goal

Make shared contracts, tests, architecture docs, and active planning mirror the
implemented responsibility tree.

## Scope

- Complete the Workshop message split behind the existing barrel.
- Make feature-specific payload names exact and generic family unions explicit.
- Reorganize tests to mirror presentation, handler, service, and feature owners.
- Update `docs/ARCHITECTURE.md`, ADR references, active epics, and debt records.
- Archive or supersede completed extraction debt with closure notes.
- Strengthen import, route-owner, composition, feature-isolation, and aggregate
  encapsulation witnesses against the final tree.

## Completion criteria

- [ ] Source, test, and documentation trees use the same names and boundaries.
- [ ] No active plan points to retired paths or optional seams that are now
      mandatory/completed.
- [ ] Generic modules import feature code only through approved closed registries.
- [ ] P0's migration exception list is empty or contains only a Phase 7 blocker.
