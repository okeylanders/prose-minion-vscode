# ADR 2026-11-07: Workshop Message Reactions

**Status:** Accepted (2026-11-07). Proposed 2026-11-07. R1–R3 decided by
Okey on 2026-11-06; Q1–Q10 decided by Okey on 2026-11-07, each as
recommended (see [Decisions on the open questions](#decisions-on-the-open-questions-okey-2026-11-07)).
**Date:** 2026-11-07
**Epic:** [Workshop Message Reactions](../../.todo/epics/epic-workshop-message-reactions-2026-11-07/README.md)
**Feature note:** [Workshop Message Reactions](../../.todo/features/feature-workshop-message-reactions/README.md)
(Okey's idea, written up on the idea inbox; carried here unchanged)
**Related:**
- [ADR 2026-07-24: Room Ledger and Delivery Offsets](2026-07-24-workshop-room-ledger-and-delivery-offsets.md):
  §2's visibility predicate, §9's tools as instruments.
- [ADR 2026-09-30: Rewind and Branch](2026-09-30-workshop-rewind-and-branch.md):
  the one transform that cuts a room.
- [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md):
  D6 (the reply trailer and its outcome table), D14 (delivery records on the
  reply turn).
- [ADR 2026-11-05: Workshop Persona File Edits](2026-11-05-workshop-persona-file-edits.md):
  D2, the second trailer kind, read in the same pass.
- [ADR 2026-11-03: Workshop Wayfinding](2026-11-03-workshop-wayfinding.md):
  bookmarks, the per-turn mark this is shaped like.
- [ADR 2026-10-05: Transcript Export](2026-10-05-workshop-transcript-export.md)
  and [Session Recall](2026-10-05-workshop-session-transcript-recall.md).
- [ADR 2026-07-30: Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md).
- [ADR 2026-07-20: Interaction Modes and Expression Profiles](2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md)
  and [Relational Depth](../../.todo/features/feature-workshop-relational-depth/README.md).

## Context

Okey, in his words:

> Add emoji reactions to messages: heart, thumbs up, sad face, mind-blown
> face, celebration hands, really like 15+ reactions, even negative. The
> persona should see them on the next turn. And the model should be able to
> react to the user's messages. I think this is a subtle and very effective
> way to communicate between persona and user.

Between writer and persona the only channel is a whole message. A small
signal ("loved that line", "that note stung") either becomes a paragraph or
goes unsaid. Reactions are the chat-app answer: free to send, never an
interruption.

What the code already has (on this epic's base, `9bfce925`):

- **A per-turn mark.** Bookmarks: an optional session key, one entry per
  turn, exact shape, dropped with their turn on a cut
  (`WorkshopBookmarkRecords`, `WorkshopBookmarkLedger`,
  `workshopBookmarksWithin` in `WorkshopSessionRewind.ts`).
- **A reply tail the host owns.** `extractWorkshopReplyControls`
  (`utils/workshopReplyControls.ts`) finds every trailer frame in one pass
  (`workshopReplyTrailerFrames`, `TRAILER_TAGS`): today the memory proposal
  and the file edit, "in any order" at the very end, after any
  `### Try a widget` section. It already strips trailers from display,
  retention, streaming and logs, and writes a host line when a reply held
  only trailers (`workshopTrailersOnlyReplyLine`).
- **Per-participant delivery that a cut keeps honest.** Project Memory
  records what each persona was told *on that persona's reply turn*
  (`projectMemoryDelivery`, `WorkshopProjectMemoryDeliveryRecords`; PR #198
  F-01): a cut that removes the reply removes the record with the history
  that received it, and the next turn's `<project-memory-update>` note is the
  delta from the folded records (`ProjectMemoryDeliveredView`).
- **Next-turn frames.** Catch-up (`<workshop-room-catch-up>`), time context
  and the memory note already ride the persona's next user message.
- **A ceiling for reading affect.** Relational Depth (Reserved, Attuned,
  Reflective) is the room's permission for how far a persona interprets the
  writer's feelings; it lives on `WorkshopConversationBehavior` beside
  `expressionLevel`.

## Decisions already made (Okey, 2026-11-06)

- **R1. A persona may reply with a reaction alone** (for "thanks!" or "got
  it"). The reply is still a ledger turn with a rewind mark. Retained history
  holds a host line, never an empty message (Project Memory's "only
  controls" path). The thread draws it as a slim line ("Jill reacted ❤️"),
  and Rewind, bookmarks and export can still address it. The prompt allows a
  reaction-only reply only when the writer's message asks for nothing.
- **R2. Guests see reactions too.** A reaction is visible to exactly the
  participants who can see its turn: the room-ledger ADR's §2 predicate
  (`isWorkshopTurnVisibleToParticipant`), unchanged. A guest is told whose
  message it was. Delivery is recorded per participant from the first slice
  that delivers.
- **R3. Rewind, Branch and Side Quests keep delivery honest.** A reaction
  goes with its turn, as a bookmark does. A reaction on a kept turn stays,
  but its delivery stands only if the persona's kept retained history
  recorded it; otherwise it arrives again on the next turn. (D6 below says
  how: the record rides the persona's reply turn, Project Memory's pattern,
  which gives R3 by construction.)

## Decision

### D1. A closed vocabulary, by id

One registry, `shared/constants/workshopReactions.ts`:
`WORKSHOP_REACTIONS`, each `{ id, glyph, label, meaning, tone }`, and the
union `WorkshopReactionId` derived from it. Nothing else names a glyph.

| Tone | id | Glyph | Label | Meaning (the model's gloss) |
|---|---|---|---|---|
| warm | `heart` | ❤️ | heart | love this |
| warm | `thumbs-up` | 👍 | thumbs up | yes, agreed |
| warm | `raised-hands` | 🙌 | raised hands | celebrate this |
| warm | `party` | 🎉 | party | a milestone |
| warm | `fire` | 🔥 | fire | this is strong |
| warm | `mind-blown` | 🤯 | mind-blown | hadn't thought of that |
| warm | `laughing` | 😂 | laughing | that's funny |
| warm | `sparkles` | ✨ | sparkles | delightful |
| warm | `hundred` | 💯 | hundred | exactly right |
| warm | `thanks` | 🙏 | thanks | thank you |
| curious | `thinking` | 🤔 | thinking | mulling it over |
| curious | `eyes` | 👀 | eyes | intrigued |
| curious | `surprised` | 😮 | surprised | didn't see that coming |
| negative | `thumbs-down` | 👎 | thumbs down | not this |
| negative | `sad` | 😢 | sad | this hurts, or this moved me |
| negative | `grimace` | 😬 | grimace | oof |
| negative | `confused` | 😕 | confused | this lost me |
| negative | `eye-roll` | 🙄 | eye roll | come on |
| negative | `frustrated` | 😤 | frustrated | annoyed |

- 19 reactions. Every glyph is Unicode 10 or older (the newest are 🤯 and
  🙄), so Windows 10, macOS and Noto Color Emoji all draw them. ❤️ is written
  with its variation selector.
- **The model writes the id, never the glyph.** The codec compares against
  a closed list of ASCII ids and never reads emoji sequences (variation
  selectors, ZWJ). Ids are lower-case kebab; a test pins the list, and the
  prompt's vocabulary section is generated from, or held by a sync test to,
  the registry.
- Okey's "celebration hands" is read as 🙌 `raised-hands` (**Q1**).

### D2. Storage: one optional session key

`reactions?: WorkshopTurnReaction[]` on the session, beside `bookmarks`:

```ts
interface WorkshopTurnReaction {
  turnId: string;                       // the turn reacted to
  reaction: WorkshopReactionId;
  author: { kind: 'writer' }
        | { kind: 'host' }
        | { kind: 'personaGuest'; personaId: WorkshopPersonaId };
  /** A persona's reaction only: the reply turn that carried its trailer. */
  viaTurnId?: string;
  createdAt: number;
}
```

- **Identity is the triple** `(turnId, author, reaction)`: no minted id. The
  writer may put several different reactions on one bubble, each once; a
  persona puts at most one per reply (D5).
- **What may be reacted to.** The writer reacts to a persona reply (a host
  or guest `assistant` turn). A persona reacts only to the writer's message
  its reply answers. Not tool reports, session dividers, context changes or
  the writer's own messages (**Q4**). One predicate,
  `isWorkshopReactableTurn(turn, author)`, beside the registry, used by the
  codec, the ledger and the webview.
- **Exact shape** (`WorkshopReactionRecords`, mirroring
  `WorkshopBookmarkRecords`): keys exact; `viaTurnId` present exactly when
  the author is a persona, naming a later reply of that same persona; the
  triple unique; a bound on the list (`PROMPT_BUDGETS.workshopReactions`).
- **The ledger** (`WorkshopReactionLedger`, mirroring
  `WorkshopBookmarkLedger`): `add` and `remove` are idempotent, run inside
  the room's mutation gate, and are refused on a turn that is not reactable.
  The writer removes their own chips; "hide" on a persona's chip removes that
  entry too (**Q6**).
- **The codec** (ADR 2026-07-30): optional and additive, no `schemaVersion`
  bump, exactly as `bookmarks` and `projectMemoryDelivery` were. A reaction
  whose turn is gone is a development checkpoint's drift, dropped by a named,
  logged normalization in `WorkshopSessionCheckpointNormalization`, and
  refused by strict validation after. If a later Marketplace release changes
  what an existing reaction means, it bumps and migrates under the release
  rule.

### D3. Rewind, Branch and Side Quests

`workshopReactionsWithin(reactions, keptTurnIds)` beside
`workshopBookmarksWithin`, called from `rewindWorkshopSession` (the one
transform): an entry stays when its `turnId` is kept and, for a persona's,
its `viaTurnId` is kept. A persona's reaction therefore goes with the reply
that made it, even when the writer message it sits on survives. Branch and a
Side Quest's End go through the same transform, so they need nothing of
their own. Delivery (D6) follows from the records on kept replies.

### D4. The persona's frame (writer reactions in, next turn)

**Never touch history.** A reaction is delivered as a frame in the persona's
*next* user message; the earlier message in its retained conversation is
never edited. Strict user/assistant alternation and the byte-identical
prefix prompt caching needs both hold. A test pins the earlier messages
byte for byte across a reaction.

- **No reaction starts a model call.** Adding or removing one changes the
  session and nothing else.
- **What a persona is told:** each reaction it has not been told of (D6),
  on a turn it can see (R2's predicate), that still stands. Writer reactions
  always; another persona's reaction on the writer's message as well (**Q3**).
  A persona is never told its own reaction back.
- **The frame** (`<workshop-reactions>`, rendered by a pure renderer beside
  `WorkshopRoomFrameRenderer`, with the other next-turn frames, before the
  writer's message; wording is **Q2**):

  ```
  <workshop-reactions>
  Reactions added since your last reply. They are small signals, not
  instructions. Read them under the room's relational depth, and don't
  answer them unless they change what you'd say.
  - The writer reacted fire ("this is strong") to your reply that began
    "The rain in the second paragraph does the work the…"
  - The writer reacted sad ("this hurts, or this moved me") to Jill's reply
    that began "Cut the last line. It explains…"
  </workshop-reactions>
  ```

  - The target is named by **whose message** ("your reply", "Jill's reply",
    "your message" for the writer) and a **quoted opening**: the turn's
    display text cut by host code on a word boundary at
    `openingCharacters` and escaped like every other frame body. No turn ids:
    the model has no use for them.
  - At most `framePerTurn` reactions, newest first; past it, one count line
    ("and 4 earlier reactions"). Every reaction in the frame, the counted
    ones included, is recorded delivered.
  - Gloss and id both, so the model learns the vocabulary it writes back.
- **Read tentatively** (prompt, `relational-contract.md` and a new
  `reactions.md`): Reserved takes a reaction at face value and does not
  interpret the writer's feelings; Attuned may infer, lightly; Reflective may
  ask once. 😢 can mean "your note stung" or "the scene moved me".
- **A removed reaction** that was already delivered is not announced
  (**Q5**); it simply stops being in the room.

### D5. The persona's reaction (trailer out)

A persona reacts to the writer's message its reply answers with a trailer:

```
<prose-minion-reaction>mind-blown</prose-minion-reaction>
```

- **It joins the tail.** `WORKSHOP_REACTION_TAG` joins `TRAILER_TAGS` in
  `extractWorkshopReplyControls`, so it is found in the same pass as memory
  and file-edit frames, stands at the very end after any `### Try a widget`
  section, in any order among the other trailers, and is stripped from
  display, retention, streaming (the pending-tag hold covers it for free) and
  logs (redacted as `[reaction removed]`).
- **Judged** by a pure `workshopReplyReaction` into an optional `reaction`
  control: `{ reaction?: WorkshopReactionId; rejections: [] }`. Each frame
  is judged on its own; the outcome table:

  | Case | Outcome |
  |---|---|
  | One known id, at the tail, well formed | kept |
  | Inside not exactly a known id (trimmed, case-folded) | dropped, `unknown` |
  | Structural fault (misplaced, unclosed, unopened, nested, tag) | dropped, the shared structure reason |
  | A second reaction frame | dropped, `over-cap` (the first kept) |
  | The reply answers no writer message (a guest's opening, an auto turn) | dropped, `no-target` |
  | Persona reactions off (**Q8**) | dropped, `reactions-off` |

  Dropped means not shown and not stored; logged by reason and count with the
  reaction id when it is a known one, never with text.
- **R1: a reaction-only reply.** When the trailers were all the reply held,
  retained history and the ledger turn hold the host line
  (`workshopTrailersOnlyReplyLine` gains the reaction kind: "Reacted with
  heart."), so the turn is never empty and keeps its rewind mark. The thread
  draws that turn as a slim line, "Jill reacted ❤️", and the chip lands on
  the writer's bubble. A reply with prose and a reaction keeps its prose
  only; the reaction is not written into retained history.
- **The prompt** (`workshop-personas/reactions.md`, both host and guest
  bases): a permission, not a quota. React rarely, when a reaction says
  something a sentence would overstate; at most one per reply; never on
  every message. A reaction alone only when the writer's message asks for
  nothing. The vocabulary is listed by id and gloss.
- **Expression** (**Q7**) does not change the permission.

### D6. Delivery records ride the reply turn

`reactionDelivery?` on a persona reply turn (`role: 'assistant'`, host or
guest), exactly as `projectMemoryDelivery` is:
`[{ participant, reactions: [{ turnId, author, reaction }] }]`, naming only
that reply's own participant, each triple at most once, bounded.

- It is written when the reply that received the frame commits, so a failed
  or stopped call records nothing and the reactions arrive again.
- **What a participant was told** is the fold of these records over its
  replies in the ledger (`WorkshopReactionDeliveredView`), the shape of
  `ProjectMemoryDeliveredView`. The frame is "reactions standing now, visible
  to this participant, not in its fold".
- **R3 follows.** A cut that removes the reply removes the record with the
  retained history that received it, and the reaction is undelivered again.
  A Branch carries exactly the kept replies' records. Nothing rides the
  host's retained-history mark: marks stay the retained history's own
  bookkeeping, and `hostContextDelivery` stays the one mark-gated delivery.
- **Per participant from the start** (R2): a guest's fold is its own
  replies' records.
- A reaction removed and re-added before the next turn is the same triple
  and is not announced twice.

### D7. Transcripts and recall

- **The shared projection omits reactions.** `projectWorkshopTranscript`
  and `projectWorkshopTranscriptTurn` add nothing for them, with a test,
  as the bookmark-recall ADR decided for bookmarks: what a persona may read
  of a saved session does not grow, and the export's format does not move.
- A reaction-only reply is a turn like any other; it projects as its host
  line.
- Adding reactions to the writer's export (an export-only layer, never the
  shared projection) is a possible follow-up (**Q9**).

### D8. The writer's surface and accessibility

- **The palette.** An "Add reaction" button in each reactable bubble's
  actions opens a popover grid in three labelled groups (warm, curious,
  negative). Arrow keys move, Enter or Space picks, Escape closes and
  returns focus to the button. A reaction the writer already gave shows as
  pressed and removes on pick.
- **Chips** under the bubble: one per reaction, the writer's first. Each is
  a toggle with its name: "You reacted: mind-blown" (press to remove);
  "Jill reacted: heart", with the persona's name and, once Participant
  Identity Colors lands, its color (until then, the persona's name alone).
  A persona chip has a Hide action (**Q6**).
- **A new persona reaction** is announced once through a polite live region
  ("Jill reacted heart to your message"), never on hydration, Open or
  reload.
- The webview posts ids only (turn id and reaction id); the host decides
  what may be reacted to.

### D9. Logs and bounds

- Logs carry reaction ids, counts and rejection reasons, never message text
  or quoted openings. Tests and fixtures use *Alice*.
- `PROMPT_BUDGETS.workshopReactions`: `framePerTurn` (8),
  `openingCharacters` (80), `perSession` (a codec bound on stored entries),
  `deliveredPerReply` (a codec bound on one record). A sync test holds the
  prompt's stated numbers to them.

## Decisions on the open questions (Okey, 2026-11-07)

Okey took every recommendation below. Each Q now reads as decided; the
text is kept as written so the reasoning stays with the decision. Where a
D-section above says "(**Qn**)", that question's recommendation is the
decision.

## The open questions as put (each with its recommendation)

- **Q1. Is "celebration hands" 🙌?** *Recommend yes:* 🙌 `raised-hands`
  ("celebrate this"). 👏 clapping is the other reading; we could add it as a
  20th.
- **Q2. The frame's wording and target naming.** *Recommend* D4's draft:
  whose message plus a quoted opening of up to 80 characters, at most 8
  reactions a frame, then a count line. No turn ids.
- **Q3. Does a persona hear another persona's reaction to the writer?**
  (Jill reacts 🔥 to your message; does Theo learn that?) *Recommend yes*,
  under R2's predicate, in the same frame ("Jill reacted fire to the
  writer's message that began…"). It is cheap and keeps the room one room.
  The alternative is writer reactions only.
- **Q4. Reactions on tool reports?** *Recommend no:* tools are instruments,
  not participants (room-ledger §9), so there is no one to tell. The palette
  appears only on persona replies. A writer who wants to signal about a tool
  report can react to the persona reply that asked for it.
- **Q5. Is a taken-back reaction announced?** *Recommend no*, it is just
  dropped. "The writer took back their 🔥" reads as a bigger event than the
  writer meant. A writer who swaps 👍 for 👎 is still heard: the new one is
  delivered.
- **Q6. Hide a persona's chip: remove it, or keep it hidden?** *Recommend
  remove* (it is the writer's thread, and one fewer stored state). The
  persona is not told (Q5).
- **Q7. Does Persona Expression change how often a persona reacts?**
  *Recommend no* for this epic: one permission at every level, tuned in the
  live pass. If Slice 4's counts show Subtle personas reacting too much or
  Amplified too little, add one line per level then.
- **Q8. A setting to stop persona reactions?** *Recommend yes:*
  `proseMinion.workshop.reactions.personas` (default on). Off drops the
  prompt section and judges any trailer `reactions-off`. The writer's own
  reactions stay; their delivery is not a setting.
- **Q9. Reactions in the writer's export?** *Recommend not in this epic*
  (D7); a follow-up in `.todo` if he wants it.
- **Q10. Can the writer react to a reaction-only reply's slim line?**
  *Recommend no:* there is nothing there to react to but the reaction.

## Consequences

- One more trailer kind on the tail, one more next-turn frame, one more
  optional session key and one more optional turn field. Each follows an
  existing precedent, so no new mechanism enters the room.
- The writer gains a channel that costs nothing and starts nothing. A
  persona gains a signal it must read tentatively: the prompt work, not the
  plumbing, is the risk, and Slice 4 exists for it.
- A model's propensity to react can't be unit-tested. The live pass records
  counts on an *Alice* fixture conversation per persona and expression level.

## Slices

See the [epic README](../../.todo/epics/epic-workshop-message-reactions-2026-11-07/README.md).

| # | Slice | Outcome |
|---|---|---|
| 0 | Spec | This ADR and the epic |
| 1 | Writer reactions | D1, D2, D3, D8: registry, storage, codec, ledger, routes, chips and palette, Rewind/Branch. No model involved. |
| 2 | Delivery | D4, D6: the frame, the per-participant records, R2 and R3 witnessed |
| 3 | Persona reactions | D5: the trailer, R1's slim line, the prompt, Q8's setting |
| 4 | Live pass | Tune the prompt's propensity; record counts on a fixture conversation |
