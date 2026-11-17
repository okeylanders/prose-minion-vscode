# Feature: Compaction That Keeps the Whole History Reachable

**Date Identified:** 2026-11-11
**Status:** Idea, as requirements for the planned [Workshop Context Compaction](../../epics/epic-workshop-context-compaction-2026-07-21/README.md) epic. That epic and its ADR predate recall, bookmarks, project memory and to-dos, so its README should take these in when work starts. This note doesn't edit it.
**Priority:** High (the compaction epic's own)
**Origin:** Okey, 2026-11-11

## In Okey's words

> Compact should compact the chat with a super detailed summary, but persona
> session searches and transcript matches should still be able to see the
> entire session transcript, even from before the compaction. Also, even
> after the compaction, the persona should be able to search and read the
> text prior to compaction. Bookmarks, to-dos, etc. should also be
> reachable, as well as all prior turns visible to the user.

## Where things stand

- **Compaction isn't built.** The epic is Planned (2026-07-21). Its design,
  [ADR 2026-07-18](../../../docs/adr/2026-07-18-workshop-thread-artifacts-and-context-compaction.md),
  plans three Context Bar actions: Release, Compress and Compact.
- **The ADR already has the right shape for Compact.** It "replaces a
  writer-selected retained span with an attributed assistant-written summary
  and a source-span tombstone… the original span remains recoverable as
  persisted provenance, while its prompt projection becomes the compacted
  artifact". So only what a persona is *sent* changes, never the room.
- **It plans a span, not the whole room,** and it was written before
  session recall, bookmarks, Project Memory, to-dos and File Edits existed.

## The requirements

1. **A very detailed summary** replaces what personas are sent of the
   compacted turns.
2. **The room's ledger is never cut.** Every turn stays in the thread for the
   writer, in export (`readRoomLedger`), and in the saved session file.
3. **Session search and recall still see everything.** Recall reads saved
   session files through the shared projection, so this follows from (2),
   provided compaction never trims the ledger.
4. **The persona can still read the open room's earlier turns.** This one is
   new work.
   - **The gap:** today recall reads *saved* sessions, plus the open room's
     bookmarks only (`transcript.bookmarks`, through
     `WorkshopLiveRoomBookmarks`). It can't search or read the open room's
     own turns.
   - **The precedent:** that bookmarks port. A types-only port in `recall/`,
     over the full ledger, built in `extension.ts`.
   - **What follows:** visibility by `isWorkshopTurnVisibleToParticipant`,
     and recall's window clamp.
5. **Bookmarks, to-dos, memory receipts, file-edit cards and everything else
   keyed by turn id stay reachable.** They point at ledger turns, which (2)
   keeps.

## Design questions for the epic

- **The scope.** The whole room ("compact the chat") or a writer-selected
  span, as the ADR planned? Possibly both, the whole room being the span
  from the start to the last compaction or the latest turn.
- **Whose history.** The host's only, or each participant's retained
  conversation, each summarized from what that participant could see?
- **The summary's call:**
  - which model scope;
  - its bound in `PROMPT_BUDGETS`, which "super detailed" pushes up;
  - one call, and a cancel keeps the original;
  - it names what it can't carry ("the full text of turns 12–40 is still
    readable with `transcript.read`").
- **Repeated compaction.** A compacted room keeps going and gets compacted
  again. Summarize the summary plus the new turns, or keep a chain of
  summaries?
- **Rewind and Branch across a compaction.** Marks before the compaction
  point at a retained history that has been replaced.
  - **Option 1:** restore the pre-compaction history from its persisted
    provenance.
  - **Option 2:** refuse with the host's reason.

  Either way it goes through the one transform, `rewindWorkshopSession`.
- **What the writer sees.** A divider like "Compacted · 142 turns summarized
  · Read the summary", the summary itself, and the Context Bar's before and
  after.
- **Persistence.** The compaction record is new session state. It follows
  ADR 2026-07-30: development normalizations during the epic, and a schema
  version at release. The ADR already planned the next schema version.
- **It feeds the session summary.** See [Workshop Session
  Summary](../feature-workshop-session-summary/README.md).

## Completion Criteria

- [ ] The compaction epic's README and ADR take in requirements 1–5, or
      record why not.
- [ ] After a compaction, every turn is still in the thread, in export and
      in the saved file (test).
- [ ] Recall of the saved session finds a phrase from a compacted turn
      (test).
- [ ] A persona in the open room can search and read its compacted turns,
      within its visibility and window (test).
- [ ] A bookmark and a to-do made before the compaction still open their
      turns.

## Related

- [Reads That Fit the Window](../feature-workshop-reads-fit-the-window/README.md):
  the window rules a read of compacted turns follows.
- [Context Strategies](../feature-workshop-context-strategies/README.md):
  the other ways to keep a room in its window.
