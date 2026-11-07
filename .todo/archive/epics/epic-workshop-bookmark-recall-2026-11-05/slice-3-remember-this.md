# Slice 3: Remember This, and Proposals That Cite Bookmarks

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D9 and D10, with [ADR 2026-11-04](../../../../docs/adr/2026-11-04-workshop-project-memory.md) D3
**Status:** Done (branch `epic/workshop-bookmark-recall-slice-3-remember-this`, cut from the epic at `78fe28d`; PR #219). See the [implementation note](#implementation-note).

## Outcome

"Remember this" on a bookmark opens Project Memory's sheet, prefilled with the bookmarked message. Saving it records the bookmark's session and turn as the memory's source.

A persona asked to "propose new memories from what I bookmarked" can cite the bookmarked turns in its proposal. The host checks each one, and the saved memory's source includes them (D10).

## Build

- **Live room (F-03).**
  - **In the window.** A bookmark whose turn is in the window (a bubble, or a Notes row) calls the existing `projectMemory.saveTurn(turn)`.
  - **Outside the window.** A live bookmark whose turn is outside it (the browser's `leading` rows, or a Notes row past the window) prefills the sheet from the host's live-row message. It saves through Project Memory's live-turn route (`WORKSHOP_SAVE_TURN_TO_MEMORY`), which finds the turn in the full ledger. The request carries `roomRevision`, and the host refuses it for another room.
- **Saved session.** A new route, `WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`, carries `{ requestId, sessionId, turnId, draft }`.
  - **Checking the turn.** The host checks the turn through the recall service (`positionsOf`, or the document). It refuses one that's unknown, gone, or not bookmarkable.
  - **What it writes.** `{ origin: 'writer', sourceSession, sourceTurns: [turnId] }`, through Project Memory's single-writer queue, with the same estimate and write-result messages as today's saves.
- **The sheet.**
  - `useWorkshopProjectMemory` gains a mode, for example `'saved-turn'`. `WorkshopMemorySheet`'s source line reads "from “Title”".
  - The prefill is the projected message the host supplies, capped as `workshopMemoryNoteFromTurn` caps it.
- **Proposals that cite bookmarks (D10).**
  - **The trailer.** Project Memory's proposal trailer gains an optional list of cited **open-room** turn ids, the ids `transcript.bookmarks` shows.
  - **Checking them.** `workshopProposalProvenance` keeps a cited turn only if the open-room ledger holds it and the proposing persona could see it. Anything else, including a saved-session reference, is dropped and logged by id. Saved-session citations are deferred (F-06), because a memory has one `sourceSession`.
  - **The result.** The kept turns join `sourceTurns` beside the reply and the writer's message, deduplicated, within its bound of 32. `sourceSession` stays the live room.
  - **The prompt.** `project-memory-proposals.md` teaches the field, with a worked example that cites a bookmark. `projectMemoryProposalPromptSync.test.ts` holds the prompt to the codec.
  - **No cited turns** behaves exactly as today.
- **Provenance reads back unchanged.** The memory manager already names a saved session's source through `positionsOf`.

## Tests

- **Live-room bookmark:** goes through `saveTurn`, unchanged.
- **Saved-session bookmark:**
  - the route checks the turn and writes the source;
  - an unknown or gone turn is refused with nothing written;
  - the write goes through the queue.
- **The sheet:** the new mode's copy and prefill, plus correlation.
- **Provenance:** after saving, the memory manager shows "from “Title”".
- **Cited turns:**
  - a proposal citing open-room bookmarks saves them as sources;
  - a cited turn the persona couldn't see, or a turn that doesn't exist, is dropped;
  - a saved-session reference is dropped and logged;
  - deduplication against the reply's own sources, and the bound of 32;
  - reopening the room shows the cited turns as its sources;
  - a proposal with no cited turns is unchanged.

## Completion Criteria

- [x] "Remember this" works from live-room and saved-session bookmarks.
- [x] A saved-session memory cites its session and turn, checked by the host.
- [x] A persona's proposal from bookmarks cites them, and the host checks each one.
- [x] The epic's per-slice verification passes. Counts are recorded.

## Implementation Note

Built on `epic/workshop-bookmark-recall-slice-3-remember-this` (PR #219) in two commits: host (`5e60b21c`), then webview (`20ce3f66`).

### Files

- **Host.**
  - `WorkshopSavedTurnMemoryHandler.ts` (new): owns `WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`, a mutation behind the session-operation gate. It checks the turn through the recall service's `savedTurn` alone, then saves through `WorkshopProjectMemoryHandler.saveWriterMemory`. That seam is the handler's own write path: the draft check, the single-writer queue, the receipt and the answer. It is composed in `WorkshopSliceComposition`, and the recall port is the Bookmarks screen's (`bookmarkBrowser`).
  - `WorkshopProjectMemoryHandler.ts`, 493 → 497 lines. It grew by its seam (`saveWriterMemory`), the `roomRevision` check on `WORKSHOP_SAVE_TURN_TO_MEMORY`, and passing the proposal to provenance. `requestIdOf` moved to `WorkshopProjectMemoryRefusals.ts` (`workshopMemoryRequestIdOf`), so both routes share it.
  - `WorkshopProjectMemoryProvenance.ts`: `workshopProposalProvenance` takes the proposal and an `onDropped` logger. `workshopCitedTurns` is the check. `workshopSavedTurnProvenance` builds a saved turn's source.
  - `workshopMemoryProposalProtocol.ts`: `<cites-turn>` and `WORKSHOP_MEMORY_CITED_TURN`. `workshopMemoryEditProtocol.ts`: `edit-cites`.
  - `WorkshopReplyMemory.ts`: the card keeps `cites`. `WorkshopMemoryProposalRecords.ts`: `cites` is checked and cloned.
  - `PROMPT_BUDGETS.workshopProjectMemory.citedTurns` = 30.
  - Messages: `WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY` with `WorkshopSaveSavedTurnToMemoryPayload`. `WorkshopSaveTurnToMemoryPayload.roomRevision?`. `WorkshopMemoryNewProposal.cites?`.
  - Prompt: `project-memory-proposals.md` gains "Citing bookmarked turns", with a worked example.
- **Webview.**
  - `useWorkshopProjectMemory.ts`, 417 → 485 lines. It adds `rememberRoomBookmark`, `rememberSavedBookmark`, `handleTurnPreview`, and the `saved-turn` mode.
  - `memory/workshopMemoryBookmarkSheets.ts` (new, pure): the sheet states, and `workshopMemoryNoteFromTurn`, which moved here and is re-exported from the hook.
  - `WorkshopMemorySheet.tsx`: the `saved-turn` source line.
  - `WorkshopBookmarkBrowserModal.tsx` and `WorkshopBookmarkBrowserMount.tsx`: "Remember this" on each row.
  - `WorkshopBookmarkList.tsx`: "Remember this" on each Notes row.
  - `useWorkshopAppMessageRouter.ts`: the turn preview reaches both its readers.
  - `WorkshopApp.tsx`, 1,858 → 1,866 lines, wiring only.
- **Pins moved deliberately:** `boundaries.test.ts` (route owner and composed sibling: 86 routes, 47 mutations), `WorkshopRoomHandler.seams.test.ts` (86 handlers), `promptBudgets.test.ts` (`citedTurns`, held within `sourceTurns` − 2).

### Tests, by criterion

- **"Remember this" from live-room and saved-session bookmarks.**
  - `WorkshopApp.rememberBookmark.test.tsx`, through the real App and host:
    - "a saved session's row opens the sheet from “Title”, prefilled by the host, and saves its session and turn as the source";
    - "this conversation's row on the Bookmarks screen saves from its message, naming the room";
    - "a Notes row in the window is Save to memory… on its bubble";
    - "a Notes row outside the window asks the host for its message, then saves it".
  - `useWorkshopProjectMemoryBookmarks.test.ts`: the in-window path unchanged (no `roomRevision`, no preview request), the out-of-window prefill and correlation (another request, another room, a closed sheet), the refused preview, and `saved-turn`'s prefill cap, route and refusal.
  - `WorkshopBookmarkBrowserModal.remember.test.tsx`: offered only when asked; disabled on a shared session id (as its Opens are) and on a row with no message.
  - `WorkshopBookmarkList.test.tsx`: "offers Remember this on each row only when asked…".
  - `WorkshopMemorySheet.test.tsx`: "a saved session's bookmark names its session by title".
  - `useWorkshopAppMessageRouter.test.ts`: the turn preview reaches both readers.
- **A saved-session memory cites its session and turn, checked by the host.** `WorkshopProjectMemoryBookmarkSources.test.ts`:
  - "checks the turn through recall and writes the session and turn as the memory's source, with a receipt";
  - "after saving, the memory manager names its source by the saved session's title";
  - "refuses %s with nothing written" (unknown session, unknown turn, unreadable, `ambiguous-session`, live session);
  - "refuses an event line, an id the memory format can't hold, and recall being unavailable";
  - "saves through the library's write path" (the draft check, and two at once giving two files through the queue).
  - The live route: "saves the turn from the full ledger for the room it names, and refuses another room".
- **A persona's proposal cites bookmarks, each checked by the host.**
  - `WorkshopProjectMemoryBookmarkSources.test.ts`:
    - "saves the cited turns the room holds as sources … and drops the rest by id" (a missing turn, a `current@…` ref and a saved-session ref, each logged as `id:reason`);
    - "the reopened memory asks recall for every source, the cited turns included";
    - "a proposal that cites nothing saves exactly as before".
  - `WorkshopMemoryCitedTurns.test.ts`: the codec (`invalid-cites`, `too-many-cites`, `edit-cites`); the card's `cites` round-tripping through save and reopen, then still a source; a malformed list refused in a saved session; a turn the persona couldn't see dropped (a sidecar, another participant's private capability work); deduplication and the bound of 32; no cites unchanged.
  - `projectMemoryProposalPromptSync.test.ts`: the prompt's "at most 30" pinned, the guidance present, and the worked example decoding to the turn ids it shows.
- **Verification.**
  - Typecheck clean.
  - Lint: 0 errors, 1,165 warnings (the baseline).
  - Jest: **749 suites / 10,453 tests / 59 snapshots**, all passing (full run, `--maxWorkers=4`), up from 744 / 10,410.
  - No `vscode` import in `packages/core/src`.

### Readings the ADR didn't settle

1. **The field is `<cites-turn>`,** repeated, one turn id each.
   - **Its bound** is `citedTurns` = 30, so a memory's reply and writer message still fit within `sourceTurns` (32). Past it, the proposal is rejected as `too-many-cites`, as `too-many-supersedes` is.
   - **A value that isn't one token** (space, empty) rejects the proposal as `invalid-cites`.
   - **A well-formed ref of another shape** (`current@…/…`, `{sessionId}/{bookmarkId}`) passes the codec, so the host can drop it by id at save, as D10 asks.
2. **The check runs at save, not at completion.** The card keeps what it cited, as written (`cites`, optional, no `schemaVersion` bump). `workshopProposalProvenance` checks the ledger as it stands when the writer (or Save and tell me) saves. So a turn a Rewind removed in the meantime is dropped then.
3. **A cited turn need not still be bookmarked.** D10 names two conditions, and the host checks only those: the ledger holds the turn, and the proposer could see it. A bookmark removed after the proposal doesn't unmake the memory's source.
4. **Who proposed.** The proposer is the reply's participant: the host, or a guest by persona id. A reply from anyone else keeps no cited turns (`not-visible`).
5. **An edit refuses `<cites-turn>`** (`edit-cites`). An edit changes a saved note and keeps its sources.
6. **What a saved turn must be.** It must be one a bookmark may mark, judged on the original turn by `isWorkshopBookmarkableTurn` and carried through recall as `bookmarkable`, never by its projection's kind. A capability card projects as an event and is eligible (PR #219 F-01). The route refuses any id the memory codec can't hold before it reads anything. It doesn't require that the saved turn still be bookmarked: the row the writer pressed was, and recall reads the session as it is now.
7. **A saved-turn save leaves a receipt in the open room,** like every other writer save. It goes through the same write path.
8. **The Bookmarks screen closes when "Remember this" opens the sheet,** so two modals never stack. Reopening the screen reads it again.
9. **An out-of-window Notes row** has no message in the snapshot. Its prefill comes from the room's existing turn-preview route (`WORKSHOP_REQUEST_TURN_PREVIEW`, correlated by request id and `roomRevision`), not the browser's live-rows route.
10. **An in-window save sends no `roomRevision`,** so Save to memory… on a bubble is byte-for-byte as before.
11. **"Remember this" stays enabled on Notes rows while the room is locked.** It only opens the sheet; the write is refused mid-reply by the route, as every save is.

### PR #219 review

Astra raised two P2s; both are fixed, and the ledger is in [the review](../../../../docs/pr-reviews/pr-219-remember-this-review.md).

- **F-01.** Saved capability-card bookmarks can now be remembered. Eligibility is the original turn's (`bookmarkable` on recall entries and bookmarks), and the screen's row is `rememberable` only when the host would save it.
- **F-02.** The saved-turn route takes the room revision when its message arrives. The shared write refuses, writing nothing, when the room was replaced during the source read (a same-id reopen or a Rewind included).

### Deferred

- **Saved-session citations in a proposal** (PR #214 F-06). These are refused and logged, as planned. Session-qualified, multi-source provenance is [its own follow-up](../../../features/feature-workshop-memory-multi-session-sources/README.md).
