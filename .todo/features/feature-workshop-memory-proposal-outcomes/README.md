# Feature: Tell the Persona What Became of Its Notes

**Date Identified:** 2026-11-11 (split out 2026-11-17)
**Status:** In the Everyday Conveniences, Round Two epic (item D) since 2026-11-17, on `epic/everyday-conveniences-round-two`. The epic README there records progress and the defaults taken.
**Priority:** Medium
**Origin:** Okey's report of 2026-11-11, where Jill apologized for not sending notes she had sent

## Problem

A persona never learns what became of the notes it proposed. The fence
fix made its personal-word catches show as held cards, but every other
drop is still silent to the persona:
- a malformed frame;
- one misplaced in the reply's tail;
- a duplicate;
- memory turned off.

So the persona can claim, or deny, sending notes it doesn't know the fate
of. On 2026-11-11, Jill apologized for "not sending" two notes the host had
withheld.

## Idea

On its next turn, the persona's user message carries one host line about
its last reply's notes: counts and reasons only, never text.

> Your last reply's notes: 2 shown as cards, 1 dropped (malformed).

- **The precedent:** the room already shows a persona the writer's
  decisions ("Saved to project memory: …").
- **The source:** the reply's settled proposals and the log reasons already
  computed in `WorkshopReplyMemory` (`settleWorkshopMemoryProposals`).
- **Never history.** The line goes in the next user message's frames; earlier
  retained messages stay byte-identical.
- **Only when there's news.** A reply with no note trailers adds nothing.

## Open questions

- **Cards too?** Should the line also say how the writer answered cards
  (saved, dismissed), or does "Saved to project memory: …" already cover
  that?
- **File-edit trailers.** They have the same silence. One line for both?

## Completion Criteria

- [ ] After a reply whose notes were all or partly dropped, the persona's
      next message carries the counts-and-reasons line (test).
- [ ] A reply with no note trailers adds nothing.
- [ ] The line carries no note text, and earlier retained messages are
      byte-identical (test).

## Related Files

- `packages/core/src/application/services/workshop/memory/WorkshopReplyMemory.ts`
- `packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts`
