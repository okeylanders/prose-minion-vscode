# The Boards Rail Drops Focus After a Confirmed Delete

**Date Identified**: 2026-10-22 (Lightbox Slice 5A)
**Status**: Resolved in Lightbox Slice 5A.1, 2026-10-22 (`epic/lightbox-slice-5a1-board-names`), both completion criteria. A confirmed delete keeps focus on its row's Delete until the host's answer removes the row, then moves it to the next row's Delete, or to the head's Name or Rename when no row is below; a refused delete leaves it on the row (`LightboxBoardsPanel.test.tsx`). A restore that finds its file missing clears the reload pointer, so the next session does not try it again (`LightboxSparkSaves.test.ts`). Not taken: a spoken "Deleted the board saved …" in a live region; the row going, and focus moving, say it
**Priority**: Was Low; resolved
**Estimated Effort**: Small

## Problem

In the rail's Boards section, Delete opens a confirm step in the row with
focus on Keep, and Escape or Keep returns focus to the row's Delete
(`LightboxBoardsPanel`). Confirming with Delete removes the row when the
host's answer arrives, and focus falls to the document body: a keyboard
writer starts again from the top of the page.

Two smaller edges of the same feature:
- a restore whose file is gone is logged, but the reload pointer is not
  cleared, so the next session tries the same file again (and logs again);
- after a delete, the section shows the host's shelf, but nothing says the
  file is gone beyond its row disappearing.

## Recommendation

After a confirmed delete, move focus to the next row's Open (or Delete),
else the previous row's, else the section's heading; announce "Deleted the
board saved <date>" in a polite live region. Clear the pointer when a
restore finds its file missing.

## Related Files

- `packages/core/src/presentation/webview/components/lightbox/LightboxBoardsPanel.tsx`
- `packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts` (`restoreOnce`)

## Completion Criteria

- After a confirmed delete, focus lands on a neighbouring row's control, with
  a component test.
- A restore that finds its file missing clears the pointer, with a test.
