# Sprint 02A: Widget State Architecture

**Status**: Implementation complete — awaiting review/PR
**Priority**: High
**Branch**: `sprint/conversation-widgets-02a-widget-state-architecture` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 1-2 days
**Depends on**: Sprint 01 merged into `epic/conversation-widgets`
**ADR**: [2026-07-31 — Workshop Widget State Ownership](../../../../docs/adr/2026-07-31-workshop-widget-state-ownership.md)

## Goal

Prepare the proven widget state and persistence seams for Lexical Gravity
without changing runtime behavior. Keep `WorkshopSessionService` as the
aggregate root while extracting widget-config lifecycle mechanics and Gesture
Playground's persisted draft rules into focused collaborators.

## Scope

1. Extract `WorkshopWidgetConfigLedger` for config identity, defensive state,
   commit linkage, snapshot summaries, reset, export, and hydration replacement.
2. Extract Gesture Playground's persisted draft shape, clone, summary, and
   development-checkpoint defaults into a widget-local codec.
3. Extract the exact-shape primitives shared by the V1 aggregate codec and its
   local widget codec into a narrowly scoped grammar module.
4. Preserve `WorkshopSessionService`'s public API and the exact V1 serialized
   contract.
5. Add focused collaborator coverage while retaining the existing behavior-
   level session tests unchanged.
6. Update the two triggering tech-debt records with the implemented seam and
   the remaining second-widget completion gate.

## Out of Scope

- Lexical Gravity behavior or UI.
- A standing-directive coordinator without a concrete producer.
- A generic widget plugin/runtime framework.
- Independent widget schema versions or storage.
- The unrelated Workshop scope/context IPC extraction.
- Any change to widget commit, retry-token, artifact-delivery, or session codec
  compatibility behavior.

## Completion Criteria

- `WorkshopSessionService` delegates widget-config mechanics to the ledger and
  no longer stores the config collection/counter or Gesture clone/summary
  helpers inline.
- `WorkshopSessionStateV1Shape` delegates Gesture draft validation and contains
  no Gesture field or menu rules.
- Checkpoint normalization delegates Gesture-specific defaults to the local
  codec.
- Existing persisted JSON, public session APIs, snapshot summaries, and error
  behavior remain unchanged.
- Focused tests and the full project verification suite pass.

## Completion Notes (2026-07-31)

- Added `WorkshopWidgetConfigLedger`; `WorkshopSessionService` delegates its
  existing config API and no longer owns the collection, counter, defensive
  clone, summary, reset, export, or hydration mechanics inline.
- Added `GesturePlaygroundConfigCodec`; the top-level V1 shape and development
  normalizer delegate Gesture draft, source-reference, recommendation-seed,
  clone, summary, and defaulting rules.
- Added `WorkshopSessionShapeGrammar` as codec-scoped structural primitives,
  reducing `WorkshopSessionStateV1Shape` to aggregate grammar and delegation.
- Preserved the serialized V1 contract and all existing `WorkshopSessionService`
  callers. No standing-directive or Lexical Gravity behavior was introduced.
- Recorded the pre-existing optional widget-counter integrity gap separately so
  this refactor remains behavior-preserving.
- Verification: all three TypeScript projects clean; 148 Jest suites / 1,692
  tests / 1 snapshot green; lint 0 errors (869 existing warnings); production
  build and bundle sentinel green with only the existing size warnings;
  `git diff --check` clean.
