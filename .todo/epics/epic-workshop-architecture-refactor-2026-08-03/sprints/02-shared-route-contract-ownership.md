# Sprint 02: Shared Route and Contract Ownership

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-02-shared-ownership` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 01

## Goal

Make family-generic standing and widget-host contracts live under generic owners
while keeping all feature semantics in named slices.

## Scope

- Add `WorkshopStandingDirectiveHandler` as the sole generic apply/remove route
  owner.
- Split feature preparation/rendering operations from the generic serialized
  standing transaction kernel.
- Add exact request/action correlation and feature identity.
- Rename Gesture-specific generate/menu/commit messages honestly.
- Retain exact discriminated unions at shared family boundaries.
- Add a compile-time/minimal fixture proving a second standing family does not
  edit Lexical files or collide in `MessageRouter`.

## Completion criteria

- [ ] Generic standing routes are not registered by feature handlers.
- [ ] `WorkshopStandingDirectiveService` contains no Lexical-only request type or
      literals outside approved closed dispatch.
- [ ] Invalid widget/draft pairings are hard to represent.
- [ ] Cross-feature/stale acknowledgements cannot settle another feature.
- [ ] The P2 migration exceptions are empty.
