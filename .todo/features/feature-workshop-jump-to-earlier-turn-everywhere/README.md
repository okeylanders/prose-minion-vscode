# Feature: Every "Show Me That Turn" Loads Its Earlier Pages

**Date Identified:** 2026-11-18
**Status:** Identified. Split out of [Show a Long Room's Earlier Turns](../feature-workshop-thread-earlier-turns/README.md) at the Round Two epic's close.
**Priority:** Low
**Origin:** PR #281 ("Not changed"), ADR 2026-11-17 D6 amendment of 2026-11-18

## Problem

Since PR #281, a bookmark outside the snapshot window loads up to 3 pages
back to its turn and scrolls to it (`useWorkshopEarlierTurns.loadThrough`,
`PROMPT_BUDGETS.workshopThread.jumpPages`); past that it opens the reader.
Three other ways to reach a turn still open the read-only preview for any
turn outside the window, through `useWorkshopTurnJump`'s `onOutsideWindow`
(`WorkshopApp.tsx`, `openTurnPreviewSheet`):

- a to-do's "show source";
- a Read in card's link to the turn it was read in;
- the reader's "Show where it was read".

"Remember this" still decides by `inWindow` too.

## Proposal

- Send each through `loadThrough`, as the Notes rail and the Bookmarks
  screen do, with the same cap, outcome (`landed` scrolls, `refused` opens
  the reader), announcement and cancellation (any newer move supersedes,
  a new room abandons).
- One path: `onOutsideWindow` becomes the jump, so a new entry point gets
  it for free.

## Open questions

- Should "Remember this" load pages too, or stay window-only?
- Okey's two questions on PR #281 apply here as well: the reader carrying
  a refused jump's reason, and a re-read restarting the 3-page allowance
  (live-pass open questions 13 and 14).

## Completion Criteria

- [ ] A to-do's source, a Read in card and "Show where it was read" load
      and scroll to a turn within 3 pages, and open the reader past that.
- [ ] Tests for each entry point: within the cap, past it, and superseded.

## Related Files

- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopTurnJump.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopEarlierTurns.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
