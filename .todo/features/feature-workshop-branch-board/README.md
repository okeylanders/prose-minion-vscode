# Feature: Workshop Branch Board

**Date Identified**: 2026-07-07
**Source**: Workshop editor-tab Sprint 04 parked item
**Status**: Parked
**Priority**: Medium

## Problem

The approved Sprint 04 scope ships linear variation cards. Direction C's branch
board and branching semantics remain out of scope because they require their
own state model: what counts as a branch, how branches relate to conversations,
and how a writer compares or returns to them.

## Related Files

- `docs/design/Prose Minion - Design Refresh.html`
- `docs/design/pm-frames-fulltab.js`
- `packages/core/src/application/services/WorkshopSessionService.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`

## Completion Criteria

- Branches have an explicit data model instead of being presentation-only.
- The UI can create, select, and compare branches without losing the linear
  conversation.
- Reload/reopen restores branch state consistently.
- Tests cover branch creation, selection, reset, and snapshot behavior.
