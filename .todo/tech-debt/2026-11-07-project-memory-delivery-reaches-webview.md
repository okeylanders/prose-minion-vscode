# `projectMemoryDelivery` reaches the webview

**Status:** Open
**Priority:** Low
**Found:** PR #246 review (Message Reactions Slice 2), finding L3

## Problem

`workshopTurnForWebview`
(`packages/core/src/application/services/workshop/fileEdits/WorkshopFileEditWebviewView.ts`)
is the projection every turn the room handler posts passes through: a turn
post, and each turn in a session snapshot. It strips `reactionDelivery`
(PR #246 L3) but passes `projectMemoryDelivery` through. That field is host
bookkeeping (ADR 2026-11-04 D14) that the webview never reads. It carries
memory ids and versions, up to 4,096 per record, on every persona reply in
every snapshot.

It predates the reactions epic, so the fix was left out of PR #246.

## Related files

- `packages/core/src/application/services/workshop/fileEdits/WorkshopFileEditWebviewView.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts` (`postTurn`, `postSessionState`)
- `packages/core/src/shared/types/messages/workshop/session.ts` (`WorkshopTurn.projectMemoryDelivery`)

## Completion criteria

- [ ] `workshopTurnForWebview` strips `projectMemoryDelivery`, as it does `reactionDelivery`.
- [ ] A test shows no posted turn or snapshot carries it.
- [ ] Confirm no webview code reads it, and drop it from the webview's view of the type if one exists.
