# Offer to Repair and Read a Lightbox Reply Already in the Recovery Folder

**Date Identified**: 2026-10-23 (Lightbox Slice 4H)
**Reviewed**: 2026-10-23
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Medium (a route, a picker or a link from the failed group, and the run's landing path)

## Problem

A group whose reply could not be read is failed, and its paid body is saved
to `prose-minion/recovery/model-responses/` with a metadata sidecar naming
the group, its lenses and its contract (since Slice 4H, that group's own
sentinels and blocks). Slice 4H reads more replies than before (structural
repairs, and salvage at the output ceiling), but a reply already in the
folder from before, or one a future rule could read, can only be opened as
text: getting its readings onto the board means pressing Read again and
paying again.

## Recommendation

Offer, from a failed group's notice (or the recovery file's own warning), to
read the saved reply again through the current frame reader and codec, with
no new call:
- read the sidecar to know the group and its lenses, and refuse a reply
  whose board or text is no longer the one on screen (its content hash);
- land it through the same path a fresh reply takes (`LightboxGroupReply`),
  so every quote is checked against the chapter as it is now;
- say plainly that it is a saved reply, read again, not a new reading.

## Related Files

- `packages/core/src/infrastructure/storage/RejectedModelResponseRecoveryStore.ts`
- `packages/core/src/infrastructure/lightbox/LightboxGroupReply.ts`
- `packages/core/src/infrastructure/lightbox/LightboxReadingFrame.ts`
- `packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts`
- [Slice 4H](../epics/epic-lightbox-2026-10-19/slice-4h-reading-tolerance.md)

## Completion Criteria

- A saved reply of the board on screen can be read onto its board with no
  provider call, its quotes checked against the current text.
- A saved reply of another board, or of text that has changed, is refused
  with the reason.
