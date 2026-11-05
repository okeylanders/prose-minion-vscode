# Slice 4: Verify Live

**Epic:** [Workshop Bookmark Recall](README.md)
**Status:** Pending (needs a human with VS Code)

## Checklist

Record the commit tested, the VS Code version and OS, the screen reader, and what happened at each step. A blocker is fixed. Accepted debt is filed, and only if Okey explicitly accepts it.

- [ ] **Bookmarks from earlier builds.** Bookmark a few turns in two saved sessions. Include bookmarks made before this build (Wayfinding era), both named and unnamed.
- [ ] **What a persona can do.** Ask a persona to:
  - list last week's bookmarks;
  - find one about a topic;
  - list another persona's bookmarked replies.

  Each answer cites the session and turn, and the full message shows (or a stated cut with a hint).
- [ ] **Reads.** Ask a persona to read a saved session. Bookmarked turns carry their label.
- [ ] **The open room.** Bookmark a turn in the open room. No persona sees it.
- [ ] **Opening the screen.** It opens from the sessions menu and from the Notes tab.
  - [ ] Rows, search, and both groupings.
  - [ ] Preview, Open session, and Open at bookmark, including a turn outside the window.
  - [ ] Focus, both themes, and a narrow column.
- [ ] **Remember this.** From a saved session's bookmark: the memory's source reads "from “Title”".
- [ ] **Older builds.** A room holding a bookmarks card won't open in an older build (ADR D6). This is the expected failure.

## Close-out

- Move ADR 2026-11-05 to Accepted.
- Write a memory-bank entry.
- Do the epic README's close-out steps, including the PR #205 reminder.
