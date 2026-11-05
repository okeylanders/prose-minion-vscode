# Slice 3: Remember This, and Proposals That Cite Bookmarks

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D9 and D10, with [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) D3
**Status:** Planned (after Slice 2)

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

- [ ] "Remember this" works from live-room and saved-session bookmarks.
- [ ] A saved-session memory cites its session and turn, checked by the host.
- [ ] A persona's proposal from bookmarks cites them, and the host checks each one.
- [ ] The epic's per-slice verification passes. Counts are recorded.
