# Feature: A Persona's Reply Can Arrive as Several Bubbles

**Date Identified:** 2026-11-27
**Status:** Idea. Medium. An addendum to ADR 2026-11-07 (reactions), and a short section on the split marker.
**Priority:** Medium
**Origin:** Okey, 2026-11-27

## In Okey's words

> Give the persona the ability to "faux" message split. Just like in text
> messages. If I'm responding to multiple things, I generally break them up
> into multiple messages. I know the turn needs to be single (agent
> message), but we could allow the agent to fake the message split in its
> final response through syntax, right? Then I could react to individual
> bubbles.

## Yes: one turn, drawn as several bubbles

The turn stays one turn: one model reply, one retained message, one Rewind
mark. Only its drawing splits.

1. **The persona writes a split marker** between parts: a reserved frame on
   a line of its own, for example `<prose-minion-split/>`.
   - It joins `RESERVED_PERSONA_FRAME`, so the writer's text, attachments
     and evidence can never forge one.
   - It's read only outside code fences.
   - It's bounded: at most a few parts a reply, and a part has a minimum
     length (`PROMPT_BUDGETS`).
2. **The webview draws each part as its own bubble,** grouped as one reply.
   - The persona's name and model sit on the first part.
   - The footer row (edit-offer chips, widget chip) sits on the last.
   - Streaming splits as the marker arrives.
3. **Trailers come off first.** `extractWorkshopReplyControls` reads them
   from the end, as today; the split applies to the prose before them.
4. **Reactions by part.** A reaction gains an optional `part` (its index),
   so an entry's identity becomes `(turnId, part, author, reaction)`.
   - It is additive and optional, with no `schemaVersion` bump. An entry
     without `part` belongs to the whole reply, as today.
   - What the persona hears names the part: "reacted ❤️ to your second
     message", never quoting it in a log.
5. **The prompt teaches restraint:** split when answering several things,
   as the writer texts, not for effect. Expression level could set how
   readily, as it sets reaction frequency.
6. **Everything else sees one turn.** Rewind, Branch, recall and context
   all read one turn. Copy, Save and Bookmark act on the whole reply. The
   transcript export draws the parts, and the marker never appears in it.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| S1 | Can the writer react to each part? | Yes; it's the point. |
| S2 | Do Copy and Bookmark act per part? | No, on the whole reply. A part-level bookmark can come later. |
| S3 | Does expression level set how often personas split? | Yes, as with reactions. |

## Completion Criteria

- [ ] A reply with markers draws one bubble per part, grouped, with the name
      on the first and the footer on the last; a reply without markers draws
      as today (tests).
- [ ] A marker in the writer's text or in evidence is neutralized; one inside
      a code fence is text (tests).
- [ ] Reactions attach to a part and reach the persona naming it; an entry
      without `part` reads as today, and the pre-feature session fixture
      still reads (tests).
- [ ] Rewind, recall and export treat the reply as one turn; the export draws
      its parts without the marker (tests).
- [ ] The prompt and its sync test hold the marker and its bounds.

## Related Files

- `packages/core/src/utils/workshopReplyControls.ts`
- `packages/core/src/shared/constants/workshopReactions.ts`, `shared/types/messages/workshop/reactions.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `docs/adr/2026-11-07-workshop-message-reactions.md`
