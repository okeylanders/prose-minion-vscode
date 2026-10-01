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

## Follow-up from Workshop Rewind and Branch (2026-10-01)

The [Workshop Rewind and Branch epic](../../archive/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md)
shipped a first Branch without a branch model. "Branch from here" saves the
room, cut at a rest point, as a new named session and opens it; the source
session is never modified ([ADR 2026-09-30 §7](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md)).
It deliberately persists no lineage. This feature owns the next step:

- **Lineage.** Record `branchedFrom` (the source session id and the cut turn)
  in the branch's persisted session. Add it as an optional, exact-key-validated
  field per [ADR 2026-07-30](../../../docs/adr/2026-07-30-workshop-session-codec-evolution.md).
  It must survive the source being renamed, deleted or never synced to this
  machine.
- **Browser.** Show a "branched from" row in the session browser, with a way
  to open the source from its branch.
- **Board.** Then the board itself: create, select and compare branches without
  losing the linear conversation (the criteria below).

## Related Files

- `docs/design/Prose Minion - Design Refresh.html`
- `docs/design/pm-frames-fulltab.js`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionBranch.ts` (the branch envelope)
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts` (`branchFrom`)
- `packages/core/src/presentation/webview/WorkshopApp.tsx`

## Completion Criteria

- Branches have an explicit data model instead of being presentation-only,
  starting with persisted `branchedFrom` lineage.
- The UI can create, select, and compare branches without losing the linear
  conversation.
- Reload/reopen restores branch state consistently.
- Tests cover branch creation, selection, reset, and snapshot behavior.
