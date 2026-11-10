# Feature: Personas Propose File Edits Readily

**Date Identified:** 2026-11-10
**Source:** Okey's live pass of [Workshop Persona File Edits](../../archive/epics/epic-workshop-persona-file-edits-2026-11-05/README.md) (Slice 5)
**Status:** Open
**Priority:** Medium
**Related:**
- [ADR 2026-11-05: Personas Propose Edits to Project Files](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md), D2 (the trailer) and D11 (the setting).
- `packages/core/resources/system-prompts/workshop-personas/file-edit-proposals.md`: the persona's teaching.
- `packages/core/src/utils/workshopReplyFileEdits.ts` and `workshopFileEditProtocol.ts`: reading frames out of a reply.
- `packages/core/src/__tests__/architecture/fileEditProposalPromptSync.test.ts`: pins the prompt's numbers to `PROMPT_BUDGETS.workshopFileEdits`.

## Problem

Okey: "The file editing works well when I ask the model specifically to prepare it, but I have to ask several times."
- **Once a card exists,** staging, Apply, Review in editor… and the cards work.
- **The gap is how readily a persona writes the `<prose-minion-file-edit>` trailer.** A writer who asks for an edit should get a card on the first ask.

## Likely causes (unconfirmed; check before changing anything)

1. **The teaching leans away from proposing.** "Most replies suggest none" is right for unprompted edits, but may read as a brake when the writer asks. The section doesn't say plainly that a direct request means a trailer in this reply.
2. **Quoting needs the file.** `<find>` must quote the file exactly. A persona that hasn't read the file may avoid proposing, or answer in prose instead. The teaching could say to read the file first (`resource.read`), then propose in the same turn.
3. **Placement.** Trailers go at the very end, after everything, including `### Try a widget`. A long reply may end before the persona gets there.
4. **Frames dropped silently.** A malformed or over-bound frame is dropped and counted in the log only, so the writer sees no card and asks again. Check the logs for dropped-frame counts during a session like Okey's.

## Completion criteria

- **Diagnosis first.** From logs (dropped-frame counts by kind) and a few recorded replies, say which cause or causes hold.
- **The fix is in the teaching** (and the worked example) or in what the writer sees when a frame is dropped. Code bounds and guards don't change (D13).
- **Tests:** the prompt's sync test still holds its numbers; if dropped frames become visible, that has its own test.
- **Live check:** asking a persona once for a specific edit to a note, and to a chapter, yields a card.
