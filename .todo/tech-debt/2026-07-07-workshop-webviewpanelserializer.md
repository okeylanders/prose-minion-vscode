# Tech Debt: Workshop WebviewPanelSerializer

**Date Identified**: 2026-07-07
**Source**: Workshop editor-tab Sprint 04 parked item
**Status**: Parked
**Priority**: Medium

## Problem

Workshop v1 restores across reload/reopen inside the same VS Code window via
`WorkshopSessionService` and `retainContextWhenHidden`. It does not yet restore
the editor tab across a full VS Code restart because no `WebviewPanelSerializer`
is registered for the Workshop panel.

## Related Files

- `apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts`
- `apps/vscode-extension/src/extension.ts`
- `packages/core/src/application/services/WorkshopSessionService.ts`

## Completion Criteria

- Register a Workshop `WebviewPanelSerializer` in the VS Code adapter.
- Decide which session state persists across VS Code restart and where it is
  stored.
- Rehydration preserves pinned excerpt, selected tool, thread, and conversation
  affordance honestly, or explicitly marks any lost conversation as unavailable.
- Tests cover serializer registration and restore behavior.
