# Feature: Workshop Message Reactions

**Date Identified:** 2026-11-06
**Status:** Idea. Needs an ADR: it touches the session codec, delivery and the reply tail.
**Priority:** Medium
**Origin:** Okey, 2026-11-06

## In Okey's words

> Add emoji reactions to messages: heart, thumbs up, sad face, mind-blown
> face, celebration hands, really like 15+ reactions, even negative. The
> persona should see them on the next turn. And the model should be able to
> react to the user's messages. I think this is a subtle and very effective
> way to communicate between persona and user.

## Problem

Between writer and persona, the only channel is a whole message. A writer
who loved one line, or winced at a note, either writes that out or says
nothing. A persona that is moved by a passage can only say so in prose,
which turns a small signal into a paragraph. Chat apps solved this long ago
with reactions: a signal that costs nothing to send and never interrupts.

## Idea

Two directions, one vocabulary:

- **The writer reacts** to any persona bubble: hover, pick from a palette
  of 15 to 20 reactions, negative ones included. Chips show under the bubble.
- **The persona sees it on its next turn**, in a frame of its own: what was
  reacted to, and with what. No reaction starts a turn or costs a call.
- **The persona reacts** to the writer's message it is answering, with a
  trailer at the end of its reply that the host strips and draws as a chip
  on the writer's bubble.

## What is already in place

- **A mark on a turn.** Bookmarks store one mark per turn id, set or clear,
  idempotent (`WorkshopBookmarkRecords`, `WorkshopBookmarkLedger`,
  `shared/types/messages/workshop/bookmarks.ts`). Reactions are the same
  shape with a value and an author.
- **A reply trailer the host strips.** A persona proposes a memory with
  `<prose-minion-memory-proposal>` at the end of its reply (Project Memory
  ADR D6). One pure extractor, `extractWorkshopReplyControls`
  (`utils/workshopReplyControls.ts`), owns the reply's tail, and its outcome
  table already covers misplaced, duplicate, malformed and "only controls,
  no prose" replies.
- **Delivery of things that are not turns.** The persona already receives
  frames in its next user message (`<workshop-room-catch-up>`,
  `<workshop-time-context>`, and others in `WorkshopRoomFrameRenderer` and
  `WorkshopPromptBuilder`). `WorkshopProjectMemoryDeliveryRecords` already
  records what a persona was given.
- **A ceiling for reading feelings.** Relational Depth (Reserved, Attuned,
  Reflective) is the writer's permission for how far a persona may interpret
  the writer's affect. A reaction is exactly that kind of signal.

## Design direction (for the ADR)

- **Never touch history.** A reaction to an earlier message is delivered as
  a frame in the persona's *next* user message. It never edits the earlier
  message in the retained conversation. That keeps the strict
  user/assistant alternation (room-ledger ADR) and the byte-identical prefix
  that prompt caching needs.
- **A closed vocabulary, by id.** Each reaction has an id, a glyph and a
  short meaning for the model (`mind-blown` → 🤯 "hadn't thought of that").
  The persona writes the id, never the glyph, so the codec checks a closed
  list and never has to read emoji sequences (variation selectors, ZWJ).
- **Read tentatively.** 😢 can mean "your note stung" or "the scene landed
  and I'm moved". The frame gives the target and the reaction, and the
  persona reads it under the room's Relational Depth: Reserved takes it at
  face value, Attuned infers, Reflective may ask.
- **A permission, not a quota.** The persona's prompt says to react rarely,
  when a reaction says something a sentence would overstate. At most one
  reaction per reply. Never on every message.
- **The writer owns their chips.** A writer may add several reactions to one
  bubble and remove any of them. A persona's reaction is shown with the
  persona's name and identity color, and the writer can hide it.

### A starting palette (the ADR fixes the list)

| Warm | Curious | Negative |
|---|---|---|
| ❤️ heart · love this | 🤔 thinking · mulling it | 👎 thumbs-down · not this |
| 👍 thumbs-up · yes, agreed | 👀 eyes · intrigued | 😢 sad · this hurts, or this moved me |
| 🙌 raised hands · celebrate | 😮 surprised · didn't see that coming | 😬 grimace · oof |
| 🎉 party · a milestone | | 😕 confused · lost me |
| 🔥 fire · this is strong | | 🙄 eye-roll · come on |
| 🤯 mind-blown · hadn't thought of that | | 😤 frustrated · annoyed |
| 😂 laughing · that's funny | | |
| ✨ sparkles · delightful | | |
| 💯 hundred · exactly right | | |
| 🙏 thanks | | |

Glyphs render from the OS emoji font, so the list keeps to emoji that
Windows 10, macOS and common Linux fonts all draw. Newer ones (🫠 melting,
Unicode 14) need checking.

## Open questions for the ADR

- **What the persona sees.**
  - The frame's wording.
  - How a target is named: a quoted opening of the bubble, or a turn
    reference.
  - A bound on how many reactions one frame carries.
  - Whether a reaction removed after the persona saw it is said ("the writer
    took back their 🔥"), or simply dropped.
- **Who sees what.** Does a guest see the writer's reaction to the host's
  message? The visibility predicate (room-ledger ADR §2) decides. Tools are
  instruments, not participants (§9): does a reaction to a tool report reach
  the host?
- **Reaction-only replies.** May a persona answer "thanks!" with only a
  reaction and no bubble? Project Memory's "only controls, no prose" path
  writes a host line so retained history is never empty. Reactions would
  need the same rule.
- **Where the trailer sits.** The order on the reply's tail with the widget
  recommendation and the memory proposal, and what a malformed or unknown
  reaction does (dropped, logged by reason).
- **Persistence.** An optional session field during the epic, then the
  codec-evolution ADR's release rule (2026-07-30). Rewind, Branch and Side
  Quests: reactions on cut turns go with them, and whether a reaction was
  delivered must be rewound with the persona's retained history, or the
  persona "remembers" a reaction it never got.
- **Transcripts and recall.** The transcript projection needs an explicit
  include or omit decision for reactions (export ADR). The same goes for
  what `transcript.read` shows a persona of a saved session.
- **Expression.** Does Persona Expression (Subtle, Full, Amplified) change
  how often a persona reacts?
- **Accessibility.** The palette works by keyboard, each chip has a name
  ("You reacted: mind-blown", "Jill reacted: heart"), and a screen reader hears a new persona
  reaction.

## Completion Criteria

- [ ] An ADR settles the questions above and fixes the palette.
- [ ] The writer can add and remove reactions on a persona bubble, by mouse
      and keyboard, and they survive save, open and reload.
- [ ] On its next turn the persona receives the reactions since its last
      reply in a frame. A test shows earlier messages in the retained
      conversation are byte-identical before and after.
- [ ] A persona's reply trailer becomes a chip on the writer's bubble. The
      codec accepts only listed ids, at most one per reply, and removes the
      trailer from display, retention and logs.
- [ ] No reaction starts a model call on its own.
- [ ] Rewind, Branch and Side Quests keep reactions and their delivery
      consistent with the cut.
- [ ] Logs carry reaction ids and counts, never message text.

## Related

- [Workshop Relational Depth](../feature-workshop-relational-depth/README.md):
  the ceiling a persona reads reactions under.
- [Workshop Amplified Expression](../feature-workshop-amplified-expression/README.md)
- [Workshop Participant Identity Colors](../feature-workshop-participant-identity-colors/README.md):
  how a persona's chip is told apart.
- [Workshop Thread Bookmarks](../feature-workshop-thread-bookmarks/README.md):
  the per-turn mark this is shaped like.
- [ADR 2026-11-04: Workshop Project Memory](../../../docs/adr/2026-11-04-workshop-project-memory.md)
  D6: the reply trailer and its outcome table.
- [ADR 2026-07-24: Room Ledger and Delivery Offsets](../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/application/services/workshop/session/WorkshopBookmarkRecords.ts`
  and `WorkshopBookmarkLedger.ts` (the per-turn mark to mirror)
- `packages/core/src/utils/workshopReplyControls.ts` (the reply's tail)
- `packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts`
  and `WorkshopPromptBuilder.ts` (next-turn frames)
- `packages/core/src/application/services/workshop/session/WorkshopProjectMemoryDeliveryRecords.ts`
  (a delivery record to mirror)
- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts`
- `packages/core/src/application/services/workshop/transcript/WorkshopTranscript.ts`
