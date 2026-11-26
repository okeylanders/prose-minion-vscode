# Room context reads stage into whatever room is open when they land

**Date Identified**: 2026-11-18
**Status**: Fixed in the Workshop tabs epic. [Room-bound reads and panel disposal](https://github.com/okeylanders/prose-minion-vscode/pull/302).
**Priority**: Medium
**Estimated Effort**: Small (two handlers, one test each)
**Source**: [Everyday Conveniences, Round Two](../epics/epic-everyday-conveniences-round-two-2026-11-17/README.md), closing pass; the rule is PR #271 F-01's

## Problem

A message attachment's read is bound to the room it began in: it captures
`readRoomRevision()` before it awaits and stages nothing if the room
changed (`readAndStageMessageResources` and `readAndStagePickedMessageFile`,
`WorkshopContextHandler.ts` lines 654 and 704). The room's own context
attachments are not:

- **`handleAddContextResources`** (`WorkshopContextHandler.ts` lines
  564–604, `WORKSHOP_ADD_CONTEXT_RESOURCES`: Choose from project for the
  room's context) awaits `openCatalog()` and each `catalog.load()`, then
  calls `applyContextAttachment` with no room check.
- **`handleAddContextFile`** (lines 233–256, `WORKSHOP_ADD_CONTEXT_FILE`:
  the system picker) awaits the picker and the read the same way.

The mutation registrar does not close the gap. `createMutationRegistrar`
(`WorkshopSliceComposition.ts` lines 526–545) refuses a route only when a
session operation is pending **when the message arrives**; it does not
hold one off while the handler awaits. So New, Open, Rewind or Branch
landing during the read (a large file, a slow folder, a picker left open)
puts the earlier room's chosen file into the new room's context.

## Recommendation

- Capture `this.session.readRoomRevision()` before the first await in both
  handlers, check it after each read, and drop the file when it moved, with
  a log line that names no file (as `messageAttachmentRoomChanged` does).
- Tell the writer once, in the words the message-attachment path uses.
- Tests with held promises: a room replaced during the read stages
  nothing, in both handlers.

## Related Files

- `packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopSliceComposition.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopMessageAttachmentReads.ts` (the pattern)

## Completion Criteria

- Every Workshop read that stages a context or message attachment after an
  await stages only into the room it began in.
- Both handlers have a held-promise test for a room replaced mid-read.
