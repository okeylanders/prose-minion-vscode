# Workshop Browser Modal Shell

**Date Identified**: 2026-07-10
**Source**: PR #70 review, finding 9
**Status**: Deferred
**Priority**: Medium
**Estimated Effort**: Small

## Problem

`WorkshopPersonaBrowserModal` and `WorkshopToolsModal` duplicate the same
dialog backdrop, Escape, and close wiring. The persona browser now also manages
initial focus and returns focus to its trigger, while the tool browser does not.
Two visually identical modal shells therefore carry different accessibility
contracts.

## Recommendation

Extract the shared dialog shell, or backport the persona browser's focus-return
behavior to the tool browser before extracting it. Keep persona and tool cards
separate; only the genuinely identical dialog mechanics should be shared.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopPersonaBrowserModal.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx`
- `packages/core/src/presentation/webview/components/workshop/`

## Completion Criteria

- Both browser dialogs share one tested backdrop/Escape/focus-management shell,
  or intentionally use equivalent tested behavior.
- Opening a dialog moves focus meaningfully inside it.
- Closing by button, Escape, or backdrop returns focus to the originating
  trigger.
- Persona and tool card content remains independently owned.
