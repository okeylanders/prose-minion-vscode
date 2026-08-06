# Sprint 00: Architecture Fitness Witnesses

**Status:** Completed — merged in PR #101

**Branch:** `sprint/workshop-architecture-refactor-00-fitness-witnesses` -> `epic/workshop-architecture-refactor`

**Depends on:** Accepted architecture report and ADR

**Blocks:** Every later refactor phase

## Goal

Turn the accepted Workshop architecture direction into an executable migration
boundary before moving files. Pin current behavior, route ownership, composition,
aggregate encapsulation, and the exact known ownership exceptions so later
phases can remove debt without creating new hidden coupling.

## Deliverables

1. Accepted feature-family/module-boundary ADR.
2. Refactor epic and P0-P7 sprint sequence.
3. Current route-owner witness for all widget/standing messages.
4. Feature-isolation and aggregate-encapsulation witnesses.
5. Exact legacy ownership exception list with phase ownership.
6. Conversation Widgets plans marked paused behind the architecture gate.
7. Existing god-file debt reconciled to responsibility-based completion.

## Locked constraints

- No source moves in P0.
- No runtime behavior, wire contract, or persistence shape changes.
- New tests describe current truth and migration constraints; the suite remains
  green.
- Legacy exceptions are exact and may only shrink.

## Completion criteria

- [x] Architecture tests fail on a second owner for a widget route.
- [x] Architecture tests fail if handlers reach into session ledgers.
- [x] Architecture tests fail if Gesture and Lexical feature modules import one
      another.
- [x] Known false-generic owners are listed exactly and assigned to P1/P2/P3.
- [x] ADR, epic, feature pause, and active debt agree.
- [x] Focused architecture tests, typecheck, lint, and `git diff --check` pass.
