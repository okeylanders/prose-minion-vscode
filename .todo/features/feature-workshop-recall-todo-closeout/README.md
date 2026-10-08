# Feature: Close Recalled To-dos

**Date Identified:** 2026-10-05
**Status:** Idea. Needs an ADR; builds on the Session Recall epic's Slice 2B
**Priority:** Medium
**Origin:** Okey, while settling Slice 2B's D5: "A future use-case will be
telling the agent just to mark them down."

## Problem

`transcript.todos` lists open to-dos across saved sessions. A to-do the writer
has already handled stays `open` in its saved session, so it keeps coming back
in every `open` list until someone reopens that session and closes it by hand.

## Idea

The writer says "mark those done", and the persona asks a host service to set
the status of the named to-dos in a saved session, then re-save it. Slice 2B
already shows each to-do's id beside its session id for exactly this request.

## What the ADR has to settle

- **A separate write port.** Recall's corpus port stays read-only, and its
  architecture witnesses keep it that way. The write goes through the session
  store's write path, never through recall.
- **Writer approval.** Does the persona propose and the writer confirm, as a
  Workshop gesture or prompt? Or may a direct instruction close items on its
  own?
- **Stale files.** The store must check the file still matches what recall
  read, a compare-and-swap like Branch's `beforeCommit` check, and refuse
  when it does not.
- **The live room.** It is excluded from recall, and its to-dos already close
  through `setTodoStatus`. The service must refuse the live session id rather
  than write `current.json` behind the room.
- **Status words.** Which statuses may be set (`completed`, `dismissed`), and
  whether an edit records who closed the item and from which session.

## Related Files

- `.todo/epics/epic-workshop-session-recall-2026-10-05/slice-2b-transcript-todos.md`
- `packages/core/src/application/services/workshop/session/WorkshopTodoLedger.ts`
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `docs/adr/2026-09-30-workshop-rewind-and-branch.md` (the `beforeCommit` seam)

## Completion Criteria

- [ ] An ADR covers the questions above.
- [ ] Closing writes only the named to-dos in the named saved session, and
      refuses a changed file, the live session, and unknown ids.
- [ ] Recall's ports and their boundary witnesses stay read-only.
