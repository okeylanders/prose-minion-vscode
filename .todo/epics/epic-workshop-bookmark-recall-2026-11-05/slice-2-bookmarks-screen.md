# Slice 2: The Bookmarks Screen

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D8
**Status:** Planned (after Slice 1)

## Outcome

"Bookmarks…" opens a read-only browser of every bookmark: the live room's, and every saved session's.
- **Each row** shows the label, the speaker, the message's first lines, the session's title and the bookmark's date.
- **Search** covers labels and text. Rows group by date or by session.
- **Actions:** Preview, Open session, and Open at bookmark.

## Build

### Host

- **A writer-facing, read-only method on `WorkshopTranscriptRecallService`.** For example, `listBookmarks(signal)` returns summaries from every recallable session's document. Build it on Slice 1's document bookmarks, the corpus port and the cache. It never goes through `WORKSHOP_LIST_SESSIONS`, which initializes and flushes. This mirrors `positionsOf` serving the memory manager.
- **A saved turn's preview.** The service projects one saved turn (`sessionId`, `turnId`) through `projectWorkshopTranscriptTurn` from the recall document, and returns the `WorkshopTurnPreview` shape.
- **Composition.** The recall service joins `CoreServices` (`MessageHandlerContracts.ts`), built only in `extension.ts`.
  - Update `providerAssembly.test.ts`, which expects three mentions, and the comment in `extension.ts`.
  - Handlers still never construct it (`boundaries.test.ts`).
- **Routes.** The routes join `WorkshopBookmarkHandler`, or a sibling owner if that file would pass 500 lines:
  - `WORKSHOP_REQUEST_ALL_BOOKMARKS` → `WORKSHOP_ALL_BOOKMARKS`;
  - `WORKSHOP_REQUEST_SAVED_TURN_PREVIEW` → `WORKSHOP_SAVED_TURN_PREVIEW`.

  Both are correlated by a webview-minted `requestId`, and each answer takes only the pending request's first reply. Saved-session answers carry no `roomRevision`, since they aren't the room. The live room's bookmarks come from the snapshot the webview already holds.

### Webview

- **The browser.** `components/workshop/bookmarks/WorkshopBookmarkBrowserModal.tsx` composes `SavedItemBrowserModal` and `SavedItemRow`:
  - the live room's bookmarks in `leading`;
  - saved sessions' bookmarks as the list;
  - groupings by date and by session;
  - search over label and text.
- **Read-only rows.** Add a `readOnly` opt-in to `SavedItemBrowserModal` and `SavedItemRow`: no Rename or Delete, and the row still opens. Every existing caller's markup stays identical; the Workshop's and Lightbox's browser tests run unchanged.
- **Mounting.** Mount it through its own component, as `WorkshopMemoryManagerMount` does, so `WorkshopApp.tsx` grows by wiring only.
- **The transport hook.** `useWorkshopBookmarkBrowser` handles requests, correlation and the open state, and persists nothing.
- **Entry points.**
  - "Bookmarks…" in `WorkshopSessionsMenu`, beside "Browse all sessions…".
  - "All bookmarks…" in `WorkshopBookmarkList`'s header.
- **Actions.**
  - **Preview** reuses the turn-preview sheet mode, with a saved-turn source.
  - **Open session** calls `openStoredSession`, confirmation included.
  - **Open at bookmark** opens the session, waits for the new room's snapshot (its `roomRevision`), then jumps through `useWorkshopTurnJump`. If the turn is outside the window, it opens the preview instead. A refused or cancelled Open jumps nowhere.

## Tests

- **Host listing:**
  - every recallable session's bookmarks, with the live room excluded;
  - read-only: no flush, no initialize;
  - cache reuse;
  - an unreadable session is skipped and named.
- **Saved-turn preview:** a projected turn with no host-private fields; unknown sessions and turns refused.
- **Composition:** the recall service is built once, in `extension.ts`.
- **Shared browser:** `readOnly` hides Rename and Delete. The Workshop's and Lightbox's markup is unchanged; their tests run unchanged.
- **Through the real App:**
  - both entry points open the screen;
  - rows, search and groupings;
  - Preview, Open, and Open at bookmark, including a refused Open and a turn outside the window;
  - focus returns to the opener;
  - correlation drops late or stale answers.

## Completion Criteria

- [ ] The screen lists the live room's and every saved session's bookmarks, with search and groupings.
- [ ] Preview, Open session, and Open at bookmark work, and a refused Open goes nowhere.
- [ ] The host reads read-only, through the recall service.
- [ ] The shared browser's existing callers are unchanged.
- [ ] The epic's per-slice verification passes. Counts are recorded.
