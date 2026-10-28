# A Spark Set Aside Is Saved Only With the Board's Next Save

**Date Identified**: 2026-10-22 (Lightbox Slice 5A)
**Status**: Resolved in Lightbox Slice 5A.1, 2026-10-22 (`epic/lightbox-slice-5a1-board-names`). The writer chose to save a set-aside at once (epic decision 35): "Not for me", and its Undo, rewrite the file that holds the board on screen in place (`LightboxBoardEdits.keepSpark`, through the store's claimed rewrite; since PR #164 F-03 the one spark acted on, and no other), so no new file and no new row is written. A board no file holds yet, or a session-only one, takes the mark with its next save, as before. Tests: `LightboxSparkSaves.test.ts` (in place, no new file, a reload brings it back; Undo; session-only) and `LightboxBoardStoreRewrite.test.ts`
**Priority**: Was Low; resolved
**Estimated Effort**: Small

## Problem

A board saves itself when a reading run ends having landed a group, and
when it is first measured from new text (epic decision 27). "Not for me"
on a spark, and its Undo, change the board's readings
(`LightboxReadingHandler.handleSetSparkDismissed`) but start no save. So a
spark set aside after the last save is on screen and not in any file:

- a reload restores the last saved board, with the spark back in the lane;
- the rail still marks that file "On screen", because the file names the
  board it was last saved to, not its exact readings.

The next run on the board saves the set-aside with it.

## Recommendation

Save after a set-aside too, through the library, debounced so a run of
toggles writes one file; or, cheaper, have the rail say "changed since this
save" when the board's readings differ from the file it names. Either way,
decide with the writer whether a set-aside is worth a file of its own
(files are never pruned).

## Related Files

- `packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts`
- `packages/core/src/application/handlers/domain/LightboxReadingHandler.ts`
- `packages/core/src/infrastructure/lightbox/LightboxSparkLane.ts`

## Completion Criteria

- A spark set aside survives a reload, or the rail says the board on screen
  has changed since the file it names, with a test either way.
