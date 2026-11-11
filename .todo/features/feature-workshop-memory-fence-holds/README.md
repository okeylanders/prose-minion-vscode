# Feature: The Memory Privacy Fence Holds a Note for Review Instead of Dropping It

**Date Identified:** 2026-11-11
**Status:** Idea. Small: an amendment to [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md) D9 (and D8's list of holds).
**Priority:** High. It silently loses notes in ordinary fiction work.
**Origin:** Okey, 2026-11-11

## In Okey's words

> We need to fix the memory blocker. For writing fiction, this is
> problematic. Just let the fence indicate that the memory needs to be
> approved, like we do if web search is on.

## What happened

Jill proposed two project notes about a story's relationship arc ("I've
kept Ava's release separate from the unresolved relationship question").
The writer saw no cards. Asked, Jill apologized for not sending them, but
she had sent them: the host's phrasing fence withheld both. The log said
only `Memory proposal withheld (reason=personal-inference)`.

## Why

`WorkshopMemoryProposalPhrasing` (ADR 2026-11-04 D9) is an English word
fence. A sentence of a note's title, summary or body that speaks to or of
the writer ("you", "your", "the writer", "the author", the About-you name)
*and* holds a word from `WORKSHOP_MEMORY_PERSONAL_WORDS` withholds the
whole proposal.

- **The list is the vocabulary of fiction:** family, relationship, marriage,
  mother, grief, trauma, faith, emotional, afraid.
- **"You" is everywhere in a persona's craft notes:** "you want the family
  scenes tighter".
- **The module says so plainly:** "A listed word used about the work in a
  sentence that names the writer … is withheld. That's the safe failure;
  the writer can still save it with Save to memory…."
- **In practice the failure isn't safe:**
  - no card appears;
  - the writer isn't told;
  - the persona isn't told either, so it argues with the writer about what
    it sent;
  - the note's text is gone from everywhere but the persona's reply prose.

The same withholding happens to a proposed **edit** of a saved note
(`WorkshopReplyMemoryEdit.ts`: `Memory edit withheld`).

## Idea

The fence **flags, never withholds**: Okey's "like we do if web search is
on".

- **The precedent: holds.** Under Save and tell me, a reply whose run had
  web research attached is *held* (`held: 'web-research'`): its card shows,
  with a reason, and it waits for the writer rather than saving
  automatically (`WorkshopMemoryAutoSave.ts`). Holds already exist for
  `web-research`, `edit`, `supersedes` and `room-cap`
  (`WORKSHOP_MEMORY_HOLDS`), each with its line in
  `workshopMemoryHeldReason`.
- **A new hold, `personal`.** A proposal the fence catches becomes a card
  held `personal`, with a line like:

  > This note speaks of you near a word about personal life
  > ("relationship"), so it waits for you to check it before saving.

  Naming the word helps the writer see it's a false alarm. It's the
  writer's own text, shown to the writer, and never logged.
- **In both modes.** Today holds are recorded only under Save and tell me;
  under Ask first, a card simply waits. The `personal` hold is the
  exception: its note shows under Ask first too, so the writer knows why to
  look twice. Under Save and tell me, it's never saved automatically.
- **It comes first.** A proposal holds one reason. `personal` is the
  strongest, so it wins over `web-research`, `supersedes` and `room-cap`.
- **The persona's own rule stays.** The prompt's "What a note may never
  record" section is unchanged: the persona is still told never to record
  the writer's feelings, health, relationships or private life. The host
  check stops being a gate and becomes a second pair of eyes.

## What changes

1. `WORKSHOP_MEMORY_HOLDS` gains `'personal'`, and
   `workshopMemoryHeldReason` gains its line, naming the matched word. The
   fence returns that word along with its fault.
2. `WorkshopReplyMemory`: on a fault, settle the proposal held `personal`
   in every mode, instead of `continue`. The log says
   `Memory proposal held (reason=personal-inference)`.
3. `WorkshopReplyMemoryEdit`: the same for an edit, which already always
   waits. It gains the note.
4. The session codec (`WorkshopMemoryProposalRecords`, `enumAt` over
   `WORKSHOP_MEMORY_HOLDS`) reads the new value, with a round-trip test. It
   is an added value, not a migration (ADR 2026-07-30).
5. ADR 2026-11-04 D9 is amended: the fence flags; it never withholds. The
   module's header and its "safe failure" sentence are updated to match.

## Also worth doing: tell the persona what became of its notes

Jill's false apology came from not knowing. Other drops stay silent too
(malformed, misplaced, duplicate, memory off).

- **The idea:** the persona's next turn carries one host line, counts and
  reasons only: "Your last reply's notes: 2 shown, 1 dropped (malformed)."
- **The precedent:** the room already records writer decisions the persona
  sees ("Saved to project memory: …").
- **The open question:** in this item, or its own?

## Open questions

- **Name the word on the card?** Leaning yes: it turns a vague warning into
  "oh, that's about Ava".
- **Trim the list instead?** Dropping fiction-heavy words (family,
  relationship, mother) would also cut false alarms, but weaken the check.
  With holds, false alarms cost a glance instead of a lost note, so the list
  can stay as it is.

## Completion Criteria

- [ ] A proposal the fence catches shows a card held `personal`, with its
      line, under Ask first and Save and tell me alike. Under Save and tell
      me it's never saved automatically.
- [ ] The same for a proposed edit of a saved note.
- [ ] `personal` takes precedence over the other holds (test).
- [ ] The session codec round-trips a proposal held `personal`.
- [ ] Logs still carry reasons and counts, never a note's text or the
      matched word.
- [ ] A fixture with *Alice*-style fiction ("you've kept Alice's family
      quarrel unresolved") shows a held card, not a withheld proposal.

## Related Files

- `packages/core/src/application/services/workshop/memory/WorkshopMemoryProposalPhrasing.ts`
- `packages/core/src/application/services/workshop/memory/WorkshopReplyMemory.ts` (the `continue` at the fault)
- `packages/core/src/application/services/workshop/memory/WorkshopReplyMemoryEdit.ts`
- `packages/core/src/application/services/workshop/memory/WorkshopMemoryAutoSave.ts` (holds, the precedent)
- `packages/core/src/shared/types/messages/workshop/projectMemory.ts` (`WORKSHOP_MEMORY_HOLDS`)
- `packages/core/src/shared/constants/workshopProjectMemoryWrites.ts` (`workshopMemoryHeldReason`)
- `packages/core/src/application/services/workshop/session/WorkshopMemoryProposalRecords.ts`
- `packages/core/resources/system-prompts/workshop-personas/project-memory-proposals.md` (unchanged)
