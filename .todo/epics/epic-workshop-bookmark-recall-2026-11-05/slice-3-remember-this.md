# Slice 3: Remember This

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D9, with [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) D3
**Status:** Planned (after Slice 2)

## Outcome

"Remember this" on a bookmark opens Project Memory's sheet, prefilled with the bookmarked message. Saving it records the bookmark's session and turn as the memory's source.

## Build

- **Live room.** For a bookmark in the room that is open (the Notes list, or the browser's `leading` rows), it calls the existing `projectMemory.saveTurn(turn)`. There's no new route.
- **Saved session.** A new route, `WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`, carries `{ requestId, sessionId, turnId, draft }`.
  - **Checking the turn.** The host checks the turn through the recall service (`positionsOf`, or the document). It refuses one that's unknown, gone, or not bookmarkable.
  - **What it writes.** `{ origin: 'writer', sourceSession, sourceTurns: [turnId] }`, through Project Memory's single-writer queue, with the same estimate and write-result messages as today's saves.
- **The sheet.**
  - `useWorkshopProjectMemory` gains a mode, for example `'saved-turn'`. `WorkshopMemorySheet`'s source line reads "from “Title”".
  - The prefill is the projected message the host supplies, capped as `workshopMemoryNoteFromTurn` caps it.
- **Provenance reads back unchanged.** The memory manager already names a saved session's source through `positionsOf`.

## Tests

- **Live-room bookmark:** goes through `saveTurn`, unchanged.
- **Saved-session bookmark:**
  - the route checks the turn and writes the source;
  - an unknown or gone turn is refused with nothing written;
  - the write goes through the queue.
- **The sheet:** the new mode's copy and prefill, plus correlation.
- **Provenance:** after saving, the memory manager shows "from “Title”".

## Completion Criteria

- [ ] "Remember this" works from live-room and saved-session bookmarks.
- [ ] A saved-session memory cites its session and turn, checked by the host.
- [ ] The epic's per-slice verification passes. Counts are recorded.
