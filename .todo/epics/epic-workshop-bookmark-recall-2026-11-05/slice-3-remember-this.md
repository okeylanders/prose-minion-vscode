# Slice 3: Remember This, and Proposals That Cite Bookmarks

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D9 and D10, with [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) D3
**Status:** Planned (after Slice 2)

## Outcome

"Remember this" on a bookmark opens Project Memory's sheet, prefilled with the bookmarked message. Saving it records the bookmark's session and turn as the memory's source.

A persona asked to "propose new memories from what I bookmarked" can cite the bookmarked turns in its proposal. The host checks each one, and the saved memory's source includes them (D10).

## Build

- **Live room.** For a bookmark in the room that is open (the Notes list, or the browser's `leading` rows), it calls the existing `projectMemory.saveTurn(turn)`. There's no new route.
- **Saved session.** A new route, `WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`, carries `{ requestId, sessionId, turnId, draft }`.
  - **Checking the turn.** The host checks the turn through the recall service (`positionsOf`, or the document). It refuses one that's unknown, gone, or not bookmarkable.
  - **What it writes.** `{ origin: 'writer', sourceSession, sourceTurns: [turnId] }`, through Project Memory's single-writer queue, with the same estimate and write-result messages as today's saves.
- **The sheet.**
  - `useWorkshopProjectMemory` gains a mode, for example `'saved-turn'`. `WorkshopMemorySheet`'s source line reads "from “Title”".
  - The prefill is the projected message the host supplies, capped as `workshopMemoryNoteFromTurn` caps it.
- **Proposals that cite bookmarks (D10).**
  - **The trailer.** Project Memory's proposal trailer gains an optional list of cited turns. An open-room turn is named by its id; a saved-session turn by its session and its id.
  - **Checking them.** `workshopProposalProvenance` keeps a cited turn only if the open-room ledger holds it and the proposing persona could see it, or, for a saved session, if recall confirms it. Anything else is dropped and logged by id.
  - **The result.** The kept turns join `sourceTurns`, within its bound of 32.
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
  - a saved-session citation is checked through recall;
  - a proposal with no cited turns is unchanged.

## Completion Criteria

- [ ] "Remember this" works from live-room and saved-session bookmarks.
- [ ] A saved-session memory cites its session and turn, checked by the host.
- [ ] A persona's proposal from bookmarks cites them, and the host checks each one.
- [ ] The epic's per-slice verification passes. Counts are recorded.
