# Feature: Personas Close To-dos, Here and in Saved Sessions

**Date Identified:** 2026-10-05; widened to the open room 2026-11-19
**Status:** In the Workshop Persona Tools epic (item A) since 2026-11-19, on `epic/workshop-persona-tools`. T1 decided. The epic README there records progress and the defaults taken.
**Priority:** Medium
**Origin:** Okey, while settling Slice 2B's D5: "A future use-case will be telling the agent just to mark them down." Again on 2026-11-19, below.

## In Okey's words (2026-11-19)

> Let an agent mark a to-do done in another session or in the same session.
> I normally use a "polish" session at the end to track all my to-dos across
> the sessions I spawned for the chapter, and start doing things. This
> will let the agent mark them as done.

## The workflow it serves

At the end of a chapter, Okey opens a "polish" session:
1. He asks the persona to gather every open to-do from the chapter's
   sessions (`transcript.todos` with `<match>6.11</match>`).
2. They work through them together.
3. As each is handled, the persona should mark it done, wherever it lives.

Today step 3 is manual: open each saved session and tick each to-do by hand.
So handled to-dos keep coming back in every `open` list.

## What exists today

- **To-dos are writer-owned.** Statuses are `open`, `completed` and
  `dismissed` (`WorkshopTodoStatus`).
  - The open room changes one through `WorkshopSessionService.setTodoStatus`
    → `WorkshopTodoLedger.setStatus`, from the writer's own actions
    (`WorkshopTodoHandler`).
- **A persona sees the open room's to-dos** in `<workshop-todo-snapshot>`
  (`WorkshopPromptBuilder`).
  - It shows no to-do id.
  - It ends: "only explicit writer UI actions change task state."
- **A persona lists saved sessions' to-dos** with `transcript.todos`. Each
  shows its id beside its session id, "for exactly this request" (Slice 2B).
- **Recall is read-only by design.** Its corpus port and the architecture
  witnesses keep it that way.

## Idea

The persona marks to-dos `completed` or `dismissed` by id, in the open room
or in a saved session, and the room shows what changed.

1. **The persona says so in its reply.** A `<prose-minion-todo-status>`
   trailer lists each change: which session (the open room, or a saved
   session's id), the to-do's id, the new status, and an optional one-line
   note ("fixed in the polish pass"). It is read in
   `extractWorkshopReplyControls`' one pass, bounded per reply.
   - Ids are copied from the snapshot or a `transcript.todos` result. An
     unknown id is refused, never guessed.
2. **The open room's to-dos change through the room's own path.**
   `setTodoStatus`, inside the room's mutation gate, in the reply's commit.
   Never a write to `current.json` behind the room. The snapshot gains
   to-do ids, and its last sentence changes to say a persona may mark them.
3. **A saved session's to-dos change through a separate write port,** never
   through recall.
   - It goes through the session store's write path.
   - It compares and swaps: the file must still match what was read (like
     Branch's `beforeCommit`), or the change is refused.
   - Recall's cache then sees the new status, so the next `transcript.todos`
     shows it closed.
4. **The writer sees a receipt.** A card under the reply lists each change
   (the to-do, its session's name, the new status), with **Undo** per item.
5. **Who closed it is recorded.** An optional, additive field on the to-do
   (`closedBy`: the participant, and the session and turn it was closed
   from). The to-do then reads "Done · by Jill in *Polish 6.11*". There is
   no `schemaVersion` bump (ADR 2026-07-30).

## Decisions (Okey, 2026-11-19)

| # | Decision | Notes |
|---|---|---|
| T1 | **Apply at once, with Undo.** A persona's status changes land in the reply's own commit; the receipt card offers Undo per change. | No confirm step: that would bring back the manual ticking this exists to remove. A status change is small, visible on the receipt, and reversed in one press. |

## What the ADR still has to settle

- **Status words.** Recommended: a persona may set `completed` and
  `dismissed`. Only the writer reopens, with Undo or the to-do's own
  control.
- **A saved session open in another window.** That window's room holds
  the session in memory, and a later save there could write the old status
  back. The compare-and-swap protects this write, not that later one.
  Options:
  - refuse sessions another window has open, if the store can tell;
  - or let that window's save check the file first.
- **Bounds.** How many changes one reply may carry (say 20), and how many
  saved sessions one reply may touch.
- **What the persona hears back.** An outcome line in its next message
  ("3 marked done; 1 refused: the session changed"), like round two's notes
  outcome (item D).

## Completion Criteria

- [ ] An ADR records T1 and settles the questions above.
- [ ] A persona marks to-dos done or dismissed by id, in the open room
      through `setTodoStatus` inside the mutation gate, and in a saved
      session through a separate write port (tests).
- [ ] Only the named to-dos in the named session change. A changed file, an
      unknown id or an unknown session is refused, and the reply's other
      changes still land (tests).
- [ ] The receipt card lists each change with Undo, and Undo restores the
      earlier status (test).
- [ ] `closedBy` is optional and additive, and a session from before it
      still reads (fixture).
- [ ] Recall's ports and their boundary witnesses stay read-only.
- [ ] Logs carry ids and counts, never a to-do's text.

## Related Files

- `.todo/epics/epic-workshop-session-recall-2026-10-05/slice-2b-transcript-todos.md`
- `packages/core/src/application/services/workshop/session/WorkshopTodoLedger.ts` (`setStatus`)
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts` (`setTodoStatus`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopTodoHandler.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts` (`<workshop-todo-snapshot>`)
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `packages/core/resources/system-prompts/workshop-personas/transcript-recall-capability.md` (`transcript.todos`)
- `docs/adr/2026-09-30-workshop-rewind-and-branch.md` (the `beforeCommit` seam)
