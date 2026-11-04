# Slice 2b: Update Notes

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D14 (update notes), D8 (mode switches: the whole catalog as a note), D5 (the frame's snapshot), D12 (the turn field)
**Branch:** `epic/workshop-project-memory-slice-2b-update-notes`, from [Slice 2a](slice-2a-read-path.md)'s head (`7ec50ba4`)
**Status:** Built, verified and pushed. Stacked on 2a; its PR follows 2a's.

## Outcome

A conversation that falls behind the memory set (a reopen, memory turned on
mid-room, a change from another window, a hand edit) gets one appended update
note with only what changed, and never the same change twice. This replaces
2a's interim: memory turned on mid-room now sends the whole catalog as a note.

## Built

| Piece | Where |
|---|---|
| Versions | `memory/ProjectMemoryVersion.ts`: the first 12 hex of a SHA-256 over the canonical id, title, kind, summary, body, pinned flag and standing (active, superseded, archived). `listProjectMemories` attaches it as `ProjectMemoryListed.version`; it's never stored in the file |
| The record | `WorkshopTurn.projectMemoryDelivery?: { participant, kind: 'frame' \| 'note', memories: { id, version }[] }[]` (`participant` is the capability principal: host, or a persona guest) |
| Its codec | `session/WorkshopProjectMemoryDeliveryRecords.ts`, called from the shape file: refused on any turn but a writer turn; each participant once per turn; ids `mem-` + 6 hex, each once; versions 12 hex; at most 4,096 memories a snapshot. Optional and additive, so there's no `schemaVersion` bump |
| When it's written | `WorkshopSessionService.stageProjectMemoryDelivery(requestId, delivery)` stages it on the active run. `completeRun` writes it onto the run's writer turn when the reply commits (for a host synthesis, the tool request before its report). A rolled-back, abandoned, cancelled or overtaken run leaves no record |
| The fold | `memory/ProjectMemoryDeliveredView.ts`: per participant, the latest snapshot in ledger order. No record is an empty view, so a conversation that started with memory off, or before this epic, gets the whole catalog as its first note |
| The note | `memory/ProjectMemoryUpdateNote.ts`: new or moved versions as `<entry>` (or `<pinned>` with the whole body), and `<gone>` with its reason (archived, superseded by …, no longer among the project's notes). It renders with the frame's own element renderers and `estimateTextTokens`. Past `pinnedTokens` or `catalogTokens` it's the count line, and its snapshot still records the whole set |
| Snapshots | `projectMemorySnapshot(set)` (in the frame module): every memory in effect with its version, by id. A frame records it, empty or not; a note records it too |
| Library | `frame()` returns the snapshot with the frame; `update(view)` returns a note, `current`, or the refusal (memory off, an unaccepted or unavailable workspace, a folder that can't be listed) |
| Capability | `WorkshopProjectMemoryCapability.frame()` stages the frame's snapshot. `updateNote()` folds the room's ledger for the turn's owner, asks the library, and stages the note's snapshot. `WorkshopPersonaCapability.appendTurnContract` appends the note at the end of every follow-up user message, the host's and each guest's |

### The note, as built

```xml
<project-memory-update note="Changes to this project's notes since this conversation last saw them. A later entry replaces an earlier entry with the same id, and a gone note is no longer in effect; the same framing as project-memory applies.">
  <pinned id="mem-1a9e04" kind="preference" updated="2026-11-04" title="Structure before line edits">…whole body…</pinned>
  <entry id="mem-9b21d0" kind="decision" updated="2026-11-04">Line edits wait until structure settles: …</entry>
  <gone id="mem-7f3c2a">No longer in effect: superseded by mem-9b21d0.</gone>
</project-memory-update>
```

Past either budget:

```xml
<project-memory-update note="…" count="3">3 memories changed since this conversation last saw them; call memory.catalog.</project-memory-update>
```

## Tests

| Area | Where |
|---|---|
| Nothing changed gives no note; another window's save gives one note with only it, then nothing; a hand edit that leaves `updated` alone moves the version; a pinned body arrives whole | `memory/ProjectMemoryUpdateNotes.test.ts` |
| `<gone>` reasons: archived, superseded by …, gone from the folder | same |
| A live claim (PR #194 N-02) is never announced as gone | same |
| Over budget: the count line, the whole set recorded, no repeat | same |
| A folder that can't be listed sends no note and writes no record; the next message catches up | same |
| Each conversation on its own record: a guest who joins after a change gets it in its frame; a later change reaches host and guest once each | same |
| Mid-room (D8): Off → on sends the whole catalog; on → Off sends nothing and keeps the record; on again sends only what changed while off. An empty folder at the start still records a frame | same |
| Every earlier message byte-identical after a note; the frame is never sent again, and the second turn's note carries only the change | `memory/ProjectMemoryFrameStability.test.ts` |
| The record through Open, Rewind (before a note, the note is owed again), Branch (kept up to the cut; source untouched), New (none), the rewind transform itself, rollback, abandon, an overtaken run, participants apart, a session without the field saved byte for byte, and the codec's refusals | `session/WorkshopProjectMemoryDeliveryWholeRoom.test.ts` (the scripted room's `hostMessage` takes a `projectMemory` delivery to stage) |
| Boundaries: the three new modules join `WORKSHOP_MEMORY_MODULES` | `architecture/boundaries.test.ts` |

## Verification

- `npm run typecheck`: clean.
- `npm run lint`: 0 errors; 1,158 warnings, unchanged from 2a.
- `npx jest`: before (2a's head, `7ec50ba4`) **652 suites / 9,228 tests / 59
  snapshots**. After: **654 suites / 9,246 tests / 59 snapshots**, all
  passing (2 new suites, 18 new tests). After merging the updated 2a (the
  epic at `c7f738b`, PR #194 merged): **654 suites / 9,257 tests / 59
  snapshots**, all passing.
- No `from 'vscode'` in core. No new file over 500 lines. Touched files
  already past 500 grew a little: `WorkshopSessionService.ts` 2,610 → 2,655
  (staging and the commit-time write), `session.ts` 957 → 982 (the record's
  types), `WorkshopSessionStateV1Shape.ts` 1,061 → 1,067, `WorkshopPersonaCapability.ts`
  922 → 925, and the test helpers `ScriptedWorkshopRoom.ts` 700 → 706 and
  `boundaries.test.ts`.
- Fixtures use *Alice* and made-up ids. No live provider calls.

## Deviations

1. **The record is written when the reply commits, not when the message is
   sent.** D14 puts the record "on the turn that carried it". Built: staged on
   the active run and written onto that writer turn in `completeRun`. A run
   that's cancelled, abandoned or overtaken keeps its writer turn visible, but
   the participant never retained that message. Writing the record at send
   time would mark a note delivered that the conversation never kept, and the
   change would never be told. Rollback, Rewind, Branch and New are still
   right by construction, since the record lives on the turn.
2. **A synthesis's record goes on the tool request.** A host synthesis run has
   no writer turn of its own, so the frame or note it carried is recorded on
   the tool request before the report.
3. **An empty folder records an empty frame.** A conversation that started
   with memory on and nothing saved still has a record, so its first note is
   a delta like any other. That's identical in content to "no record means
   the whole catalog".
4. **The note follows the turn reminder,** at the very end of the follow-up
   message, through `appendTurnContract`, not inside `buildWorkshopHostMessage`
   / `buildWorkshopGuestMessage`. This is the same seam as 2a's frame, for the
   same reason: one place covers host messages, a host synthesis and guest
   deliveries, and it's last in the message, as D14 asks.
5. **`<gone>` for a memory whose file was deleted or no longer reads** says
   "it is no longer among this project's notes": the folder can't say which.

## Completion Criteria

- [x] A conversation behind the memory set gets one update note with only the
      changes, and never the same change twice.
- [x] Memory turned on mid-room sends the whole catalog as a note.
- [x] The record is right through Rewind, Branch, rollback and New.
- [x] The epic's per-slice verification passes, with counts recorded here.
