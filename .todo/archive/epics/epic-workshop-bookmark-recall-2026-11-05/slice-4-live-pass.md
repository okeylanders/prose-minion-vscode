# Slice 4: Verify Live

**Epic:** [Workshop Bookmark Recall](README.md)
**Status:** Done (2026-11-06). Okey live-tested the epic branch with the call and read limits raised (#237, #238): "This is working great so far." He reported no findings and approved the merge to `main`. The items were not reported one by one.

## Checklist

Test the epic branch at `298c17dc` or later. The items below the "Opening the screen" block were added after Slices 2 and 3 merged, from what their reviews pinned.

Record the commit tested, the VS Code version and OS, the screen reader, and what happened at each step. A blocker is fixed. Accepted debt is filed, and only if Okey explicitly accepts it.

- [ ] **Bookmarks from earlier builds.** Bookmark a few turns in two saved sessions. Include bookmarks made before this build (Wayfinding era), both named and unnamed.
- [ ] **What a persona can do.** Ask a persona to:
  - list last week's bookmarks;
  - find one about a topic;
  - list another persona's bookmarked replies.

  Each answer cites the session and turn, and the full message shows (or a stated cut with a hint).
- [ ] **Reads.** Ask a persona to read a saved session. Bookmarked turns carry their label.
- [ ] **The open room.** Bookmark a few turns in the open room, then ask: "can you see what I bookmarked in this session and propose any new memories?"
  - The persona lists them with their messages.
  - Its proposals cite the bookmarked turns: open a saved memory's source.
  - A guest doesn't see a bookmark on a private exchange it wasn't part of.
- [ ] **Opening the screen.** It opens from the sessions menu and from the Notes tab.
  - [ ] Rows, search, and both groupings.
  - [ ] Preview, Open session, and Open at bookmark, including a turn outside the window.
  - [ ] Focus, both themes, and a narrow column.
- [ ] **Remember this.** From a saved session's bookmark: the memory's source reads "from “Title”".
- [ ] **The Bookmarks screen at scale (Slice 2, PR #216).**
  - [ ] **Paging.** With more than 25 saved sessions, "Load more" pages through them.
    - With every session readable, the coverage line reads "Bookmarks from N of M saved sessions".
    - The warning "Shared session ids are checked across the N sessions read; M couldn't be read…" appears only when at least one session can't be read. To see it, include an unreadable file, for example one over the browser's 5 MiB bound. Astra's PR #224 note: use a 6 MiB fixture the search index has no entry for.
  - [ ] **Shared session ids.** Use a disposable test workspace, never your only copies. `WorkshopSessionStorePage.identity.test.ts` has the patterns.
    - **Set-up.** Make two valid files that claim the same session id and `updatedAt`, with different titles and different, distinguishable bookmarked text. Put them on different pages: about 24 newer sessions between them.
    - **Before loading the duplicate's page:** Preview the first copy's row, and try Open. The exact read refuses with a clear reason (`ambiguous-session`).
    - **After "Load more" reaches the duplicate:** every row with that id shows "Shared session id", the earlier page's row included. Open, Open at bookmark and Remember this are disabled there. Preview still opens and still refuses with its reason.
    - **The survivor.** In the same extension session, with no reload (a reload would clear the cache and hide the old failure):
      1. Delete the copy whose row loaded first.
      2. Reopen the screen.
      3. The surviving row shows the survivor's own title and text, never the deleted file's.
  - [ ] **Superseded Open at bookmark.** Start an Open at bookmark. While its confirmation is up, press Ctrl+Shift+N and accept New. Then open another session normally. Nothing jumps.
  - [ ] Closing the screen while a page is still loading stops the read. Reopening starts a fresh walk.
- [ ] **Remember this, every path (Slice 3, PR #219).**
  - [ ] From a bubble in the window: the existing sheet opens, unchanged.
  - [ ] From a live bookmark outside the window, from the screen's leading rows or a Notes row: the sheet is prefilled from the host's message. Saving records this room as the source.
  - [ ] From a saved session's bookmark: the source line reads "From “Title”, …". The memory manager names that session and turn.
  - [ ] From a saved **capability-card** bookmark: the memory saves with the card's safe summary.
    - Known wording nit (PR #219 re-review, non-blocking): the sheet labels it "Session's reply". Kept as is: Okey asked for no change at the merge.
  - [ ] **A save that overlaps a room change.** There are two phases, with different expected results (PR #220 F-01):
    - **Before the save reaches the memory writer**, while the saved session is still being read: reopen the same session, or Rewind. The save is refused with "the room changed", and nothing is written: no memory and no receipt.
    - **After the writer has taken the save:** a same-session reopen may still finish it. The memory is saved, the room-changed warning shows (`WORKSHOP_MEMORY_ROOM_CHANGED`), and no receipt enters the replacement room.
    - The first phase is hard to hit by hand. The real-coordinator probes in `WorkshopSavedTurnMemoryReview.test.ts` and the #219 recheck pin both phases. If you can't reproduce it, note it and rely on them.
- [ ] **Proposals that cite bookmarks (D10).**
  - [ ] Ask: "can you see what I bookmarked in this session and propose any new memories?" Saved proposals list the cited turns among their sources, and reopening the room still shows them.
  - [ ] A cited turn the persona couldn't see (another guest's private exchange) is dropped, never saved.
  - [ ] An edit proposal that cites turns is refused (`edit-cites`).
- [ ] **Older builds.** A room holding a bookmarks card won't open in an older build (ADR D6). This is the expected failure.

## Close-out

- Move ADR 2026-11-05 to Accepted.
- Write a memory-bank entry.
- Do the epic README's close-out steps, including the PR #205 reminder.
