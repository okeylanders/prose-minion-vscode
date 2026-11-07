# PR #247 Review: Message Reactions Slice 3 (persona reactions)

**PR:** #247, `epic/workshop-message-reactions-slice-3-persona-reactions` → `epic/workshop-message-reactions`
**Reviewed head:** `8e496098` (base `98641f20`)
**Spec:** [ADR 2026-11-07](../adr/2026-11-07-workshop-message-reactions.md): D5, R1, Q8, Q10, D8 (announcement); Slice 2's N4
**Reviewers:** the epic's coordinator, plus an independent review pass

## Resolution ledger

| ID | Severity | Finding | Decision | Resolution |
|---|---|---|---|---|
| M1 | Medium | A dropped reaction still shows "Reacted with heart." as a reactable bubble | Fix || `b63b3d26`: a reaction that doesn't land is never named. A reply of nothing else reads "Replied without a message." with `noMessage: true` (additive, codec-checked). Beside cards, the line is the cards' alone. The predicate and integrity carrier rule are narrowed together. Every drop reason has a test (off, no-target synthesis, unknown, session-full); the old pinned test is replaced. Retention keeps the intent line (L3). |
| M2 | Medium | The live region can announce on a later snapshot, including an Open | Fix || `b63b3d26`: the live set is keyed by `roomRevision` and cleared on replacement, and only replies absent from the previous snapshot are announced. Tests: a live turn then an Open; a reply the previous snapshot already showed. |
| L1 | Low | A reaction that wasn't stored is always logged as `session-full` | Fix || `b63b3d26`: `addPersonaReplyReaction` returns the ledger's change or refusal reason, reported through `completeRun`'s outcome callback and logged verbatim (`reason=session-full`, tested). |
| L2 | Low | The slim line still shows the glyph after Hide | Ask Okey (spec as written) || Open: waiting on Okey. No change; the slim line keeps its glyph after Hide, as specified. |
| L3 | Low | The prompt and retained history disagree about the reaction-only line | Fix || `b63b3d26`: the prompt now says history shows a short note (quoted) and to always write the trailer, never the note. A sync test holds the quote to retention's line. |
| L4 | Low | Other personas read "Reacted with heart." in catch-up with no object | Fix || `b63b3d26`: the line names its object ("Reacted with heart to the writer's message."), in the ledger, catch-up and retention alike. R1's slim line is unchanged. |
| N1 | Nit | An explicit `reactionOnly: undefined` key | Fix || `b63b3d26`: `reactionOnly` is set only when it applies (tested with `'reactionOnly' in reply`). |
| N2 | Nit | An interface declared between import blocks | Fix || `b63b3d26`: the commit types sit below the imports. |
| N3 | Nit | The streaming bubble may flash the host line before the slim line | Fix if small; otherwise note || No change: STREAM_COMPLETE doesn't carry content into the bubble. The live bubble shows the trailer-stripped buffer (empty for a reaction-only reply), so the host line never flashes. At most an empty live bubble shows until WORKSHOP_TURN lands, as for a memory-only reply. |
| N4 | Nit | `personaReplyReactionTarget` checks a guest's target as the host | Fix || `b63b3d26`: the target is checked with the run's real author (a guest as itself). |

## Verification at `8e496098` (coordinator's own run)

The run is recorded in the PR thread once it finishes.

## Verification after the fixes (implementation thread, `b63b3d26`)

- `npm run typecheck`: clean. `npm run lint`: 0 errors, no new warnings in touched files.
- `npx jest`: 815 suites, 11,411 tests, 59 snapshots, all passing (was 815 / 11,400 / 59 at `8e496098`).

## Findings

### M1. A dropped reaction still shows "Reacted with heart." as a reactable bubble

**Where.** `utils/workshopReplyControls.ts` builds the trailers-only line from the reply's text, whatever the judge decided. `WorkshopRunCompletion.ts` then commits that line.

**When it happens.** A reaction is dropped, so nothing is stored, when:
- persona reactions are turned off (`reactions-off`);
- the reply is a tool synthesis (`no-target`);
- the session is full;
- the id is unknown (the line reads "Reacted.").

**What the writer sees.** A host-written bubble claims a reaction, and there is no chip anywhere. Because `reactionOnly` is unset, the writer can also react to that bubble. D5 says a dropped reaction is "not shown", but this shows it, and when the setting is off the writer sees a reaction they turned off.

**Fix.**
- **The ledger and display line** must not claim a reaction that was not stored. Use a neutral host line that names no reaction, such as "No reply.", or one that says nothing was kept.
- **A reply that held only a dropped reaction** is not reactable. Narrow Q10's predicate and the integrity rule together.
- **Retention** may keep the intent line, as the memory-off precedent does, provided L3's prompt wording matches it.
- **Tests.** Cover every drop reason: the stored line, no chip, no `reactionOnly`, and not reactable. Replace the test that pins the current behavior (`WorkshopPersonaReactionCommit.test.ts`, around line 90).

### M2. The live region can announce on a later snapshot, including an Open

**Where.** `useWorkshopReactions.ts`. `liveRepliesRef` holds live persona reply ids until the next `WORKSHOP_SESSION_STATE` arrives.

**Failure.** Suppose a `WORKSHOP_TURN` gets no snapshot of its own, for example because settlement throws before `postSessionState`. The next snapshot may then be an Open or a New. Turn ids come from per-session counters, so a reaction in the opened room can share that `viaTurnId` and be announced, which D8 forbids.

**Fix.** Clear the set on room replacement (key it by live session id), and announce only a reply id that was absent from the previous snapshot's turns. Test a live turn followed directly by an Open snapshot.

### L1. A reaction that wasn't stored is always logged as `session-full`

**Where.** `WorkshopRunCompletion.ts` infers that a reaction landed from `viaTurnId`. `addPersonaReplyReaction` returns false for both `unchanged` and every refusal.

**Fix.** Return the ledger's outcome or refusal reason, and log that.

### L2. The slim line still shows the glyph after Hide

After Hide (Q6), the chip goes but the slim line still reads "Jill reacted ❤️". ADR D5 says the mark outlives a Hide, so this matches the spec. Whether the line should change after a Hide is a product question for Okey. The options:
- keep it as is;
- drop the glyph ("Jill reacted");
- show "Jill reacted (hidden)".

No change until he answers.

### L3. The prompt and retained history disagree about the reaction-only line

`persona-reactions.md` says the trailer is removed from the persona's own history. A reaction-only reply's retained entry, however, is the literal "Reacted with heart.", and models imitate their own history.

**Fix.** Reword the prompt along these lines: "your history shows it as a short note; always write the trailer, never the note." Keep it consistent with M1's retention choice.

### L4. Other personas read "Reacted with heart." in catch-up with no object

A reaction-only reply's line names no object, and guests also receive the reaction through Slice 2's frame.

**Fix.** Make the line name its object ("Reacted with heart to the writer's message."), or have catch-up render `reactionOnly` turns that way.

### N1. An explicit `reactionOnly: undefined` key

`WorkshopSessionService.ts`, around line 1832. Set `reactionOnly` only when it applies, rather than writing the key as `undefined`.

### N2. An interface declared between import blocks

`WorkshopSessionService.ts`. Move `WorkshopReplyReactionCommit` below the imports.

### N3. The streaming bubble may flash the host line before the slim line

The final streamed text of a reaction-only reply is the host line, so the streaming bubble may show it before `WORKSHOP_TURN` swaps in the slim line. Fix it if the fix is small; otherwise note it here.

### N4. `personaReplyReactionTarget` checks a guest's target as the host

It checks a guest's target with `{ kind: 'host' }`. Pass the real author.

## Test gaps to close with the fixes

- A session-full commit leaves no mark.
- An Open snapshot directly after a live turn announces nothing.
- Every drop reason's line and stored state.
- The slim line after Hide, pinning whatever Okey decides for L2.
