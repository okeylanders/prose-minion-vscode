# Workshop Reaction and Bookmark Maps Are Rebuilt on Every Snapshot

**Date Identified**: 2026-11-07
**Reviewed**: 2026-11-07
**Status**: Identified
**Priority**: Low
**Estimated Effort**: A few hours

## Problem

Each `WORKSHOP_SESSION_STATE` snapshot rebuilds the webview's derived
lookups whole, even when nothing in them changed:

- `useWorkshopReactions` groups the snapshot's reactions into a new `Map`
  per snapshot (`groupWorkshopReactionsByTurn`), so `WorkshopApp`'s
  `reactionControls` memo, and with it every `WorkshopTurnBubble`'s
  `reactions` prop, changes identity on every snapshot.
- `useWorkshopBookmarks` does the same for `bookmarkedTurnIds`.

`WorkshopTurnBubble` is `React.memo`, so a new identity re-renders every
bubble in the window on every snapshot, streaming included. It is cheap at
today's window size, but it scales with the thread. Raised as PR #245 N2
(Message Reactions Slice 1).

## Recommendation

Keep the previous map when the snapshot's entries are equal (compare a
stable key string, as `WorkshopTurnReactionChips` already does), and pass
each bubble only its own turn's entries, so an unchanged bubble's props
keep their identity. Do bookmarks and reactions together.

## Related Files

- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopReactions.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopBookmarks.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx` (`reactionControls`)
- `packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx`

## Completion Criteria

- A snapshot that changes neither list re-renders no bubble on their account,
  witnessed by a render-count test.
