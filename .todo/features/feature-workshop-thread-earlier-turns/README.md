# Feature: Show a Long Room's Earlier Turns (Thread Pagination)

**Date Identified:** 2026-11-13
**Status:** Idea. Two parts: a quick fix to the notice, then pagination.
**Priority:** High. Long rooms hit it now: Okey's has 273 turns, so 73 are hidden.
**Origin:** Okey, 2026-11-13 ("We also need to deal with this fix")

## What the writer sees

Below the newest reply:

> Only the latest 200 turns are visible; 73 earlier turns are preserved.
> Pagination is coming soon. The full session remains preserved.

## Why

- **The snapshot is a window.** `WorkshopSessionService` sends the webview
  the newest `WORKSHOP_SNAPSHOT_TURN_WINDOW` (200) turns
  (`turnLedger.window(200)`), plus a count of the rest (`hiddenTurns`).
  Nothing else is lost: the ledger, the saved file, export
  (`readRoomLedger`), recall and the persona's history keep everything.
- **Pagination was never built,** and no `.todo` item tracked it, so "coming
  soon" pointed nowhere.
- **The notice is in the wrong place.** It renders *after* `<WorkshopThread>`
  (`WorkshopApp.tsx`), under the newest bubble, while the hidden turns are the
  *oldest*, at the top. It also says "preserved" twice.

## What a hidden turn can already do

- **A read-only preview:** `WORKSHOP_REQUEST_TURN_PREVIEW` /
  `WORKSHOP_TURN_PREVIEW`, as a bookmark, a to-do's source or a read-in card
  opens one.
- **Save to memory:** `WORKSHOP_SAVE_TURN_TO_MEMORY` with `roomRevision`.
- **Bookmarks** reach it through the Bookmarks screen.

So the host can already read single turns outside the window. Pagination
is reading a page of them.

## Part 1: the quick fix (no pagination yet)

- **Move the notice to the top** of the thread, where the hidden turns are.
- **Fix its wording.** For example: "73 earlier turns aren't shown here.
  They're kept in full: export, bookmarks and the personas still have them."
  Keep "coming soon" out of the product.

## Part 2: pagination

- **"Show earlier turns"** at the top of the thread loads the previous page
  (say 100 turns) from the host's full ledger. Pressed again, it loads the
  next page back. Scroll position holds, so the writer stays where they
  were.
- **Correlated, never persisted.**
  - Each page request carries a webview-minted request id and the room's
    revision. A page from before a room replacement (New, Open, Rewind,
    Branch) is dropped.
  - Loaded pages are not written to the webview's saved state; a reload
    shows the window again.
- **What an earlier bubble can do.** Decide per action:
  - **Copy, Bookmark and Save to memory** work as they do now, through their
    outside-the-window routes.
  - **Rewind and Branch** need the host's verdict for that turn
    (`turnRewindability` is host-private and never re-derived), so a page
    carries its turns' verdicts.
  - **Reactions, memory receipts and file-edit cards** draw from the turn's
    stored state, which a page carries like the snapshot does.
- **The same projection as the snapshot.** A page is built the way the
  snapshot window is, so an earlier bubble shows exactly what it would have
  shown in the window.
- **Bounds.** Pages are bounded by turns and by bytes, like the snapshot.
  Very long rooms page; they never load whole.

## Open questions

- **Read-only, or full bubbles?** A smaller first step shows earlier turns
  read-only (Copy, Bookmark, Save to memory), with Rewind and Branch only in
  the window. Leaning: full bubbles, since verdicts per page are cheap.
- **Page size, and should the window itself grow?** 200 was set for the
  snapshot's size. Is it still right?
- **Jump to a bookmark or to-do source** inside the thread, loading its page,
  instead of opening a preview?

## Completion Criteria

- [ ] The notice sits at the top of the thread, worded without "coming
      soon" (Part 1).
- [ ] "Show earlier turns" loads the previous page, keeps the scroll
      position, and can be pressed until the room's first turn shows.
- [ ] A page answer from before a room replacement is dropped (test).
- [ ] Earlier bubbles render exactly as they would in the window, and their
      actions work or say why not.
- [ ] Nothing loaded is persisted in the webview's state.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
  (`WORKSHOP_SNAPSHOT_TURN_WINDOW`, `turnLedger.window`)
- `packages/core/src/application/services/workshop/session/WorkshopTurnLedger.ts` (`window`)
- `packages/core/src/presentation/webview/WorkshopApp.tsx` (the notice, `hiddenTurns`)
- `packages/core/src/shared/types/messages/base.ts`
  (`WORKSHOP_REQUEST_TURN_PREVIEW`, `WORKSHOP_SAVE_TURN_TO_MEMORY`)
