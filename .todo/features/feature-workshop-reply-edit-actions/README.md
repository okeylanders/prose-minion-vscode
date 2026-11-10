# Feature: Apply a Reply's Fixes and Rewrites From Its Bubble

**Date Identified:** 2026-11-10
**Status:** Handed to a design and orchestration thread (2026-11-10), on `epic/workshop-reply-edit-actions`. This note is the idea as filed; the epic's ADR and README carry the design.
**Priority:** Medium
**Origin:** Okey, 2026-11-10, as Persona File Edits heads to `main`

## In Okey's words

> If a response has "grammar, spelling, simple fixes", add a button to the
> bubble that tells the model to apply the surgical edits. The instruction
> has to be hard and tell the model it has to respond with the required
> apply-suggestions tool.
>
> If the response has proposed suggested rewrites, a button to apply all
> those as well. It'll get tricky to ensure the model knows which bubble it
> comes from, as the user will click one, wait and then click the other. The
> model should include in the response if either or both exist, so the
> renderer knows to draw the buttons.
>
> Our bubbles are getting busy; hopefully the design can come up with a
> clever UX.

## The problem

A persona's reply often says "three typos here, and two lines I'd rewrite
like this". Today, turning that into edits means asking again in words,
and hoping the persona answers with file-edit proposals rather than more
prose.

## What it builds on

- **Persona File Edits** (ADR 2026-11-05, on `epic/workshop-persona-file-edits`
  until it reaches `main`):
  - a persona proposes an edit with a `<prose-minion-file-edit>` trailer (D2);
  - each proposal becomes a card the writer accepts (D1, D9);
  - writes go through Draft Edit's one door, `DraftEditApplier` (D3, D7);
  - one setting governs it (D11), with a seam for autonomous editing that
    is not built (D12).
- **The reply's trailer section.** `extractWorkshopReplyControls` finds
  every trailer in one pass (`TRAILER_TAGS`) and strips it from display and
  history. Today that's memory proposals and file edits; reactions join on
  their epic.
- **Message Reactions** (`epic/workshop-message-reactions`, ADR 2026-11-07)
  is putting a reaction trailer in the same section, and an "Add reaction"
  corner on every bubble (its Slice 3b). The bubble is already crowded.
- **Proofread** (Draft Edit) is a second possible route for "simple fixes":
  quotes, not offsets, with its own anchoring and guards.

## Requirements as Okey stated them

1. **A Simple fixes button** (grammar, spelling, small fixes) on a reply
   that has them. It sends the persona a *hard* instruction: respond with
   file-edit proposals for those fixes.
2. **An Apply rewrites button** on a reply that proposes rewrites, doing the
   same for the rewrites.
3. **The reply declares what it holds.** The persona says in its reply,
   machine-readably, whether it has fixes, rewrites, both or neither, and
   the renderer draws buttons from that declaration.
4. **The source bubble is never in doubt.** The writer may press one
   button, wait, then press the other, possibly turns later.
5. **A UX that doesn't crowd the bubble further.**

## Questions for the design

- **The declaration.** A new trailer (say, an "offers" control) the host
  strips and stores per turn? Buttons drawn from stored data, never from the
  reply's prose?
- **The hard instruction.**
  - The button posts the source turn's id only. The host reads that reply
    from the ledger and quotes it in a host-framed directive.
  - If the answer holds no file-edit trailers, the engine's correction turn
    asks once more, then the host says so in its own words.
  - A persona that declared fixes and then finds none must answer that
    gracefully.
- **Provenance.** Cards record the reply they came from ("from Jill's reply,
  2:02 pm"), so two presses in a row stay distinct.
- **Simple fixes: persona or Proofread?** Should they run as persona
  proposals, or through Proofread's pass on the quoted passages, with its
  guards?
- **Where the buttons go.** On the bubble, in an overflow menu, as one
  "Apply…" control with choices, or as a strip under the reply only when
  offers exist? Designed together with reactions' corner.
- **The setting and the target file.** Buttons show only while file edits
  are on, and only when there is a file to edit (the excerpt's source, or
  the file the reply discussed).

## Completion Criteria

- [ ] An ADR and an epic, designed with Message Reactions' bubble and
      trailer work in view.
- [ ] Both buttons draw only from the reply's declaration, and each answer's
      cards name their source reply.
- [ ] A press yields file-edit proposals, or a host-worded "nothing to
      apply", never stray prose.

## Related

- [Workshop Message Reactions](../feature-workshop-message-reactions/README.md):
  the same bubble and trailer section.
- [Send the Editor Selection With Each Message](../feature-workshop-send-selection-with-message/README.md)
  and [`@` in the composer](../feature-workshop-composer-at-mentions/README.md):
  other Workshop surfaces getting new controls.
