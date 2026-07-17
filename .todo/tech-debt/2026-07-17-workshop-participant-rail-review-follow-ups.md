# Workshop participant-rail review follow-ups

**Date Identified**: 2026-07-17
**Reviewed**: 2026-07-17
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Several focused follow-ups
**Source**: [PR #78 review](../../docs/pr-reviews/pr-78-participant-rail-stabilization-review.md)

## Problem

PR #78's participant-rail correctness, copy, focus-transfer, and component
coverage findings fit safely in the stabilization patch. The remaining findings
cross message-delivery recovery, host-side mutation policy, keyboard navigation,
or root-component test architecture, so folding them into the UI-state fix would
hide materially different decisions in a small PR.

## Recommendation

- [ ] Add a `WorkshopApp` render harness and cover the app-level derivation of
      `disabled` and `showInviteGuest`, including the Jill-only mid-response
      state. Covers the remainder of review finding 4.
- [ ] Decide whether a fully locked `role="toolbar"` should use the project's
      native-disabled pattern or a guarded `aria-disabled` roving-focus pattern,
      then add keyboard and screen-reader coverage. Covers finding 6.
- [ ] Resynchronize Workshop session state on webview visibility/reconnect and
      make stale cancel requests return authoritative state so a dropped
      completion message cannot leave the UI locked. Covers finding 7.
- [ ] Revalidate `WORKSHOP_SET_CHAT_TARGET` against the active run at the host
      boundary, with an explicit preempt-or-reject contract and regression
      coverage. Covers finding 8.
- [ ] Extend the participant-rail test helper with an options object the next
      time its fixture matrix grows, rather than continuing to duplicate full
      component renders. Covers finding 14.

## Related Files

- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopParticipantRail.tsx`
- `packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopParticipantRail.test.tsx`

## Completion Criteria

- The app-level rail predicates have root-component regression coverage.
- A documented keyboard/AT pattern keeps participant state perceivable without
  allowing routing mutations during a response.
- Dropped or stale lifecycle messages converge on authoritative session state.
- Every mutating participant-rail message has an explicit active-run policy.
- The PR #78 review ledger links each deferred finding to its final fix or a
  narrower replacement artifact.
