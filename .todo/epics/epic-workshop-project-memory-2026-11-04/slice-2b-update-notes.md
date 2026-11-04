# Slice 2b: Update Notes

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D14 (update notes), D8 (mode switches: the whole catalog as a note), D5 (the frame's snapshot), D12 (the turn field)
**Branch:** `epic/workshop-project-memory-slice-2b-update-notes`, from [Slice 2a](slice-2a-read-path.md)'s head
**Status:** Not started. Starts once 2a is pushed and green.

## Outcome

A conversation that falls behind the memory set (a reopen, memory turned on
mid-room, a change from another window or a hand edit) gets one appended
update note with only what changed, and never the same change twice. This
replaces 2a's interim, where turning memory on mid-room gave lookup only.

## Build

- **Versions.** `memory/ProjectMemoryVersion.ts` (pure): the first 12 hex
  characters of a SHA-256 over the canonical id, title, kind, summary, body,
  pinned flag and effective status. The library attaches it on listing; it is
  never stored in the file.
- **The record.**
  - `WorkshopTurn.projectMemoryDelivery?: { participant, kind: 'frame' | 'note',
    memories: { id, version }[] }[]`, with its own codec module
    (`session/WorkshopProjectMemoryDeliveryRecords.ts`), called from the shape
    file.
  - Optional, written only when present, and refused on a turn that can't carry
    it. No `schemaVersion` bump.
  - Covered by a pre-memory fixture that reads and saves byte for byte.
  - A frame records its snapshot on the writer turn (host) or the join turn
    (guest). A note records its snapshot on the turn that carried it. In 2a
    the frame rides the persona capability's `appendContract` (see 2a's
    deviation 1), so the capability reports the snapshot it delivered, and
    the run records it on its own turn.
- **The fold.** `memory/ProjectMemoryDeliveredView.ts` (pure) gives a
  participant's view from the turns in ledger order: the latest snapshot,
  then receipts (Slice 3 adds them) up to that reader's delivery offset.
- **The note.** `memory/ProjectMemoryUpdateNote.ts` (pure) holds the delta
  from the view to the current set: entries, pinned bodies, and `<gone>` with
  reasons. It's held to `pinnedTokens` and `catalogTokens`; past either, it is
  the count line pointing at `memory.catalog`. Nothing changed means
  `undefined`. It uses the frame's renderer and estimator.
- **Where it's appended.** At the end of the next user message each
  conversation receives, when memory is open: the host's
  (`buildWorkshopHostMessage`) and the guest's (`buildWorkshopGuestMessage`).
  A conversation with no record (it started while memory was off) gets the
  whole catalog as its note.
- **When it doesn't send:** memory off (the record stands), an unaccepted
  workspace, or a folder that can't be listed. No record is written then, and
  the failure is logged by reason.

## Tests

- Mid-room switches (D8): Off → on sends each conversation the whole catalog
  as a note on the writer's next message. On → Off sends no note and leaves
  the delivered frame in history. On again sends only what changed since.
- Update notes (D14):
  - reopen after a change, a change from another window, and a hand edit that
    leaves `updated` alone each give exactly one note with only the change;
  - nothing changed gives no note;
  - over budget gives the count line, and the next message gives no repeat;
  - every earlier message is byte-identical after a note.
- A memory under another window's live claim stays in the D14 view, so no note
  calls it gone.
- The record through whole-room operations: Rewind before a note sends it
  again; Branch keeps the records up to the cut; a rolled-back writer turn
  takes its record; New starts with none; a session without the field is
  unchanged on read and write.

## Verification

The epic's per-slice verification, with before and after counts recorded
here: before is 2a's head.

## Deviations

None yet.

## Completion Criteria

- [ ] A conversation behind the memory set gets one update note with only the
      changes, and never the same change twice.
- [ ] Memory turned on mid-room sends the whole catalog as a note.
- [ ] The record is right through Rewind, Branch, rollback and New.
- [ ] The epic's per-slice verification passes, with counts recorded here.
