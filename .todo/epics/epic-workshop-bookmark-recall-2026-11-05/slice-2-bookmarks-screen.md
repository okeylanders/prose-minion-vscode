# Slice 2: The Bookmarks Screen

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D8
**Status:** Done (branch `epic/workshop-bookmark-recall-slice-2-bookmarks-screen`, cut from the epic at `ddf8356`; PR #216)

## Outcome

"Bookmarks…" opens a read-only browser of every bookmark: the live room's, and every saved session's.
- **Each row** shows the label, the speaker, the message's first lines, the session's title and the bookmark's date.
- **Search** covers labels and text. Rows group by date or by session.
- **Actions:** Preview, Open session, and Open at bookmark.

## Build

### Host

- **A writer-facing, read-only method on `WorkshopTranscriptRecallService`.** For example, `bookmarkPage(cursor, signal)` reads one page (F-02).
  - It's built on Slice 1's document bookmarks and the cache, and never goes through `WORKSHOP_LIST_SESSIONS`, which initializes and flushes. This mirrors `positionsOf` serving the memory manager.
  - **The paged enumeration.** Add `WorkshopSessionStore.listPage({ after?, limit })`, a read-only walk of every session file in a stable order. It isn't capped at 200, and never initializes or flushes. The corpus port gains it.
  - **What a page returns.** Each page loads at most `bookmarkBrowserSessions` sessions within `bookmarkBrowserBytes`, which are store-side constants. It returns rows, a `next` cursor, and counts of sessions read, unreadable and not yet read.
- **The live room's rows (F-03).**
  - The host builds them from the full ledger: label, `createdAt`, speaker, the projected message, and the turn id.
  - The request carries `roomRevision`, and the host answers only for that room.
  - The snapshot's summaries aren't used for these rows, because they lack the date and text, and the snapshot holds only a window of turns.
- **A saved turn's preview.** The service projects one saved turn (`sessionId`, `turnId`) through `projectWorkshopTranscriptTurn` from the recall document, and returns the `WorkshopTurnPreview` shape.
- **Composition.** The recall service joins `CoreServices` (`MessageHandlerContracts.ts`), built only in `extension.ts`.
  - Update `providerAssembly.test.ts`, which expects three mentions, and the comment in `extension.ts`.
  - Handlers still never construct it (`boundaries.test.ts`).
- **Routes.** The routes join `WorkshopBookmarkHandler`, or a sibling owner if that file would pass 500 lines:
  - `WORKSHOP_REQUEST_BOOKMARK_PAGE` → `WORKSHOP_BOOKMARK_PAGE` (saved sessions, by cursor);
  - `WORKSHOP_REQUEST_LIVE_BOOKMARKS` → `WORKSHOP_LIVE_BOOKMARKS` (the open room, by `roomRevision`);
  - `WORKSHOP_REQUEST_SAVED_TURN_PREVIEW` → `WORKSHOP_SAVED_TURN_PREVIEW`.

  All are correlated by a webview-minted `requestId`, and each answer takes only the pending request's first reply. A page request is cancelled when the browser closes or the room changes.

### Webview

- **The browser.** `components/workshop/bookmarks/WorkshopBookmarkBrowserModal.tsx` composes `SavedItemBrowserModal` and `SavedItemRow`:
  - the live room's bookmarks in `leading`, from the host's live rows;
  - saved sessions' bookmarks as the list, page by page, with "Load more" and a coverage line ("Bookmarks from 120 of 340 saved sessions"; unreadable sessions counted);
  - groupings by date and by session;
  - search over label and text: the full text for live rows, and the rows loaded so far for saved sessions. It says when more remain unloaded, and offers to load them.
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

- **Host paging (F-02):**
  - a corpus of more than 200 sessions is reached page by page;
  - a cold corpus beyond the byte budget pages without omitting earlier sessions;
  - counts of read, unreadable and remaining sessions;
  - cancellation;
  - the open room is excluded from pages.
- **Live rows (F-03):**
  - in-window and out-of-window bookmarks, each with its own `createdAt` (distinct from the turn's timestamp) and its message;
  - full-text search over live rows;
  - a stale answer after a room replacement is dropped.
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

- [x] The screen lists the live room's and every saved session's bookmarks, with search and groupings.
- [x] Preview, Open session, and Open at bookmark work, and a refused Open goes nowhere.
- [x] The host reads read-only, through the recall service.
- [x] The shared browser's existing callers are unchanged.
- [x] The epic's per-slice verification passes. Counts are recorded.

## Implementation Note

### What was built

**Host**

- **The store's paged walk.** `WorkshopSessionStore.listPage({ after?, limit })` reads the sessions folder, then hands the walk to `infrastructure/storage/WorkshopSessionStorePage.ts`.
  - Every named file, newest first by code unit. The cursor is the last file name a page took, and it is only compared, never a path.
  - It isn't capped at 200, and never initializes, writes or flushes.
  - Each file's size comes from `stat`, its summary from the search index or the browser's bounded read (`readPageEntry`, the store's seam). A readable summary also remembers the file's path, so the exact read that follows needn't rescan the folder.
  - Each page is bounded by `WORKSHOP_BOOKMARK_BROWSER_LIMITS` (`shared/constants/workshopBookmarkBrowser.ts`): at most 25 files, stopping once their sizes reach 32 MiB, and always taking at least one file.
  - A file whose summary can't be read is an entry without one. A file gone since the listing is passed over.
  - The store grew 1,102 → 1,161 lines: `listPage`, `readPageEntry`, imports, and an injectable `pageLimits` (tests only).
- **Recall's seams.** `WorkshopTranscriptRecallService.ts` went from 487 to 466 lines.
  - Its scope rule moved, unchanged, to `recall/WorkshopRecallScopeGate.ts`.
  - It gained three thin writer-facing seams:
    - `bookmarkPage({ after? })`, through `recall/WorkshopRecallBookmarkPage.ts`;
    - `liveRoomBookmarks()`, through the live port's new `readWriterBookmarks()`;
    - `savedTurn(sessionId, turnId)`, through `recall/WorkshopRecallSavedTurn.ts`.
  - The corpus port gains `listPage`.
  - The loader's cold read is now public as `readDocument`, and says whether a session was missing or unreadable.
  - All three new modules joined `WORKSHOP_RECALL_MODULES`.
- **The preview shape.** `workshopTurnPreviewOfEntry` (`transcript/WorkshopTurnPreview.ts`) copies an already-projected entry into `WorkshopTurnPreview`, by the same named fields.
- **Routes.** `WorkshopBookmarkBrowserHandler` (a sibling of `WorkshopBookmarkHandler`) owns four direct routes: `WORKSHOP_REQUEST_BOOKMARK_PAGE`, `WORKSHOP_CANCEL_BOOKMARK_PAGE`, `WORKSHOP_REQUEST_LIVE_BOOKMARKS` and `WORKSHOP_REQUEST_SAVED_TURN_PREVIEW`.
  - Rows are mapped by `WorkshopBookmarkBrowserRows`.
  - Wire shapes live in `shared/types/messages/workshop/bookmarkBrowser.ts`.
- **Composition.** `workshopTranscriptRecallService` joins `CoreServices`. It reaches the handler through `MessageHandler`, then `WorkshopRoomHandler` (a new last constructor parameter), then the slice composition's `bookmarkBrowser` dependency.
  - `providerAssembly.test.ts` now expects four mentions and one construction.
  - The `extension.ts` comment is updated.

**Webview**

- **The shared browser.** `SavedItemBrowserModal` and `SavedItemRow` take `readOnly`.
  - The row draws no utility block at all. The browser never opens a rename or delete.
  - `onRename` and `onDelete` became optional; every existing caller still passes them.
- **The screen.** `components/workshop/bookmarks/WorkshopBookmarkBrowserModal.tsx` and its mount, `WorkshopBookmarkBrowserMount.tsx`. The pure view helpers are in `hooks/domain/workshop/bookmarks/workshopBookmarkBrowserView.ts`.
- **The hooks.**
  - `useWorkshopBookmarkBrowser`: transport and correlation. It persists nothing.
  - `controllers/useWorkshopBookmarkOpenAt`: Open at bookmark.
- **The preview sheet.** `useWorkshopContextSheet`'s turn-preview mode takes a `source`, either `saved` or `given`. The room's own preview is unchanged. `WorkshopTextSheet` words the two new sources.
- **Entry points.** "Bookmarks…" in `WorkshopSessionsMenu`, and "All bookmarks…" in `WorkshopBookmarkList`'s header. Both props are optional, so the markup without them is unchanged.
- **`WorkshopApp.tsx`** grew 1,828 → 1,860 lines, all of it wiring.

### Tests, by criterion

- **The screen lists every bookmark, with search and groupings:**
  - `WorkshopSessionStorePage.test.ts` (205 sessions past the 200 cap; the byte budget; cursor order; gone and unsummarized files; cancellation; read-only);
  - `WorkshopTranscriptRecallBookmarkPage.test.ts` (205 sessions through the service with the open room left out; a cold corpus past the byte budget; counts; no write, flush or initialize; cache reuse; an unreadable session named, and an unsummarizable file counted; cancellation; a scope change; live rows from the full ledger with their own `createdAt`; a private exchange shown to the writer but not to a room-wide read);
  - `WorkshopBookmarkBrowserRoutes.test.ts` (live rows in and out of the window, each with its own date and whole message; a stale room refused, including one replaced while the request waited; pages by cursor; cancelled and superseded pages answer nothing; refusals name no content);
  - `workshopBookmarkBrowserView.test.ts`;
  - `WorkshopApp.bookmarkBrowser.test.tsx`, "opens from the sessions menu…".
- **Preview, Open session and Open at bookmark work, and a refused Open goes nowhere:**
  - `WorkshopApp.bookmarkBrowser.test.tsx`: Preview for saved and live turns, with focus back to the row; Show in thread; Open session through its confirmation, where a declined one opens nothing; Open at bookmark in and out of the window; a refused Open; focus back to the opener; a late answer dropped;
  - `useWorkshopBookmarkOpenAt.test.ts`;
  - `useWorkshopBookmarkBrowser.test.ts`;
  - `WorkshopTranscriptRecallBookmarkPage.test.ts`, "one saved turn, projected" (no host-private sentinel; unknown session, unknown turn and the open room refused).
- **The host reads read-only, through the recall service:**
  - the read-only cases above;
  - `boundaries.test.ts` (route owners, the extracted-slice import guard, recall modules);
  - `providerAssembly.test.ts` (built once, in `extension.ts`);
  - `WorkshopTranscriptRecallService.bookmarks.test.ts` (no persona operation reaches `readWriterBookmarks`).
- **The shared browser's existing callers are unchanged:** `SavedItemBrowserModal.readOnly.test.tsx`. The Workshop's, the Lightbox's and the memory manager's browser tests ran unchanged.

### Readings the ADR didn't settle

- **Where the page bounds live.** D8 puts them "beside the store's own listing bounds", but recall may import the store only as a type, and recall has to name the session bound when it asks for a page. They live in `shared/constants/workshopBookmarkBrowser.ts`. The store enforces both, and recall loads every session a page holds (with no byte budget of its own), so the store is the only place a page is bounded.
- **The byte budget.** It counts file sizes from `stat`. A page stops once it reaches the budget, so the file that crosses it is included. This is the conservative reading of "without omitting earlier sessions": every page is a contiguous run of the walk, and a file larger than the budget is read alone.
- **A fourth route.** I added `WORKSHOP_CANCEL_BOOKMARK_PAGE`, so the host stops reading a page when the screen closes or the room changes, not only the webview ignoring it. A newer page request also aborts the one in flight.
- **A sibling handler, not `WorkshopBookmarkHandler`.** The routes take a different dependency (recall) and hold per-webview in-flight state. That file would have come close to 500 lines. The new owner joined the boundary pins.
- **The writer sees the whole open room.** `readWriterBookmarks` reads every bookmark, private exchanges included. It serves only the screen; no persona operation calls it, and a test pins that.
- **A saved turn's preview** reads its session by id through the store's exact read, not the 200-file listing, because the screen reaches sessions past it. It reads cold, never from the cache.
- **Open at bookmark waits for two signals:** the `open` action result with `ok`, and a snapshot whose `roomRevision` differs from the one the Open left. The host posts the snapshot first. A refused Open's result, or a declined confirmation (`WorkshopApp` wraps Cancel), drops the pending jump.
- **Rows of this conversation** offer Preview (from the message the row holds, so out-of-window turns preview too) and Show in thread, which closes the screen and jumps through the thread's one jump path. Open session and Open at bookmark don't apply to them.
- **Search** folds case and accents, and requires every word. Over saved sessions it covers loaded pages only, and the status says how many sessions remain, beside "Load more".

### Deferred

- **The open room is counted, not shown.** If it is saved under a name, its file is excluded from pages but still counts in the walk's `remaining` until a page reaches it. So "N of M" can be one higher for a moment. This is harmless, and keeps the store unaware of the live room.
- **No live pass.** Visual layout at narrow widths, and real keyboard behavior in VS Code, belong to Slice 4's live pass.

### PR #216 review (Astra): two P2s, fixed in `72f92970`

- **F-01. Paging must never resolve a duplicate session id.** `listPage` no longer seeds the store's exact-read path cache. Each page counts, over every file in the folder, the id each file claims. An entry whose id another file also claims is marked `ambiguous`, and recall names it unreadable on whichever page it lands. A page reads its sessions page-locally (`readPagedSession(cursor, sessionId)`), from the file its own entry names. Regressions: `WorkshopSessionStorePage.identity.test.ts`.
  - **The cost.** A page now reads every file's id: its search index, or a bounded read for an index-less legacy file. That is the same reading the exact-read scan uses, done once per page instead of once per session read.
- **F-02. A superseded Open at bookmark must never jump.** `useWorkshopBookmarkOpenAt` follows its own Open through the session surfaces' state: `sessionConfirm`, `sessionActionPending` and `sessionActionResult`. The phases are starting, confirming, opening and opened (`nextPhase`, pure). The jump is dropped the moment anything else takes its place: a declined or replaced confirmation, a refused Open, or another action settling. Regressions:
  - the rewritten `useWorkshopBookmarkOpenAt.test.ts`;
  - Astra's real-App witness, kept in `WorkshopApp.bookmarkBrowser.test.tsx`.
