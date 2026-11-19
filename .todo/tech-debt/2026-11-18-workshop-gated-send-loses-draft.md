# A send refused by the session gate loses its draft

**Date Identified**: 2026-11-18
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small
**Source**: [Everyday Conveniences, Round Two](../epics/epic-everyday-conveniences-round-two-2026-11-17/README.md), closing pass

## Problem

The composer clears on send. Every refusal inside `handleSendMessage`
gives the text back through `postComposerDraftRestored`
(`WorkshopRoomHandler.ts` lines 589 and 640, and the rollback at 1478), so
the writer does not lose a message there.

One refusal happens before the handler runs. `WORKSHOP_SEND_MESSAGE` is
registered through the mutation registrar with no `onBlocked`
(`WorkshopRoomHandler.ts` line 420). When a session operation is pending
(a save, flush or room replacement), `rejectMutationDuringSessionOperation`
(`WorkshopSliceComposition.ts` lines 547–566) reports "Wait for the current
session save or replacement to finish before changing the room." as a
route error and returns. No draft is restored.

The webview locks the composer only for operations it knows of
(`roomMutationLocked`, `WorkshopApp.tsx` lines 588–590: loading, a run, the
wizard, a session action it started). A host-side save or flush, or a
replacement started elsewhere, is not on that list, so the writer can press
Send into it and lose what they typed.

## Recommendation

- Register `WORKSHOP_SEND_MESSAGE` with an `onBlocked` that reports the
  refusal under `workshop.send_message` and calls
  `postComposerDraftRestored` with the payload's trimmed text, so the
  shared restore (`keepDraft`) puts it ahead of anything typed since.
- Test: a send arriving while `isSessionOperationPending()` is true
  restores its text.

## Related Files

- `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopSliceComposition.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts` (`handleComposerDraftRestored`)

## Completion Criteria

- No refused send loses its text; a test covers the session gate.
