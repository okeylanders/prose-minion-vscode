# Workshop time notices outlive the conversations they were delivered to

**Date Identified**: 2026-09-30
**Reviewed**: 2026-10-01
**Status**: Resolved in Workshop Rewind and Branch, Sprint 03 (kickoff decision 2)
**Priority**: Medium
**Estimated Effort**: Small (a time-service method plus calls at each conversation-ending seam, with tests)
**Found by**: Workshop Rewind and Branch, Sprint 02 ([epic](../epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem

`WorkshopSessionTimeService.personaNotices` records, per persona conversation
key (`host`, `guest:<personaId>`), when that conversation was last given a
`<workshop-time-context>` frame. `prepareNotice` sends a `session_start` frame
only when a key has no entry, and an `hourly` frame only an hour after the
last one. Only `reset()` removes entries.

An entry therefore outlives the conversation it describes. When a new
conversation takes over the same key within the hour, it receives no time
frame at all: no date, no timezone and no session-start grounding.

- **Rewind (new in Sprint 02).** Editing the first writer message ("Edit from
  here") cuts before the host's first reply. The host binding is removed and
  the next host starts fresh, but the `host` entry from the discarded reply
  remains. This is a common flow: editing an opening message right after a
  disappointing first reply. The same applies to a guest a rewind disposes
  that is re-invited.
- **Dismissal (pre-existing).** A dismissed guest re-invited within the hour
  joins with no time frame (`WorkshopRoomHandler` join path →
  `prepareNotice(guest:<id>)`).

The ADR's Sprint 02 kickoff item 2 recorded that a dropped participant keeps
its entry, "as dismissal and generation loss already do". That keeps Rewind
consistent with dismissal, but it also carries dismissal's gap into Rewind.
It is not rewinding temporal state: an entry is per-conversation delivery
state, like a room offset, and it should end with its conversation.

## Recommendation

Add `WorkshopSessionTimeService.forgetNotices(keys)`, and call it wherever a
persona conversation ends without a replacement history:

- Rewind's dropped keys, inside the operation before the durable write, so
  rollback and the written file both cover it;
- guest dismissal.

Leave surviving participants' entries alone. That keeps kickoff decision 2
("temporal state stays current") intact. Amend its last sentence when this
lands.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionTimeService.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts` (`rewindTo`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts` (time notice preparation)
- `docs/adr/2026-09-30-workshop-rewind-and-branch.md` (Sprint 02 kickoff decisions, item 2)

## Completion Criteria

- After a rewind that drops the host, the next host's first envelope carries a
  `session_start` time frame. A regression test proves it.
- A guest re-invited after dismissal gets a `session_start` frame.
- Rollback of a failed rewind restores the forgotten entries.

## Resolution (2026-10-01)

Confirmed at Sprint 03 kickoff and recorded in ADR 2026-09-30, [Sprint 03 kickoff decisions](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#sprint-03-kickoff-decisions), item 2. Sprint 02 kickoff decision 2's last sentence is amended.

- `WorkshopSessionTimeService.forgetNotices(keys)` removes each key's notice entry and any pending resume notice. `forgetAllNotices()` does the same for every persona.
- It is called at three seams where a persona conversation ends with no replacement history:
  - **Rewind:** the persona keys the cut drops, and the keys whose replacement history degrades during installation. The call runs inside the room-replacement transaction, before the durable write, so the written file agrees and rollback restores the entries.
  - **Guest dismissal:** in `WorkshopRoomHandler.handleDismissGuest`.
  - **Generation loss:** in the `ConversationNotFoundError` path, which calls `clearAllConversations`. The recommendation above did not list this seam, but it ends every persona conversation the same way.
- Surviving participants keep their entries, so temporal state otherwise stays current. A branch starts with no persona notices at all.

Regression tests:

- `WorkshopSessionTimeService.test.ts`: forgetting, pending resume notices, forget-all and rollback.
- `WorkshopSessionRewindCoordinator.test.ts`: a fresh host's session-start frame after a cut drops the host; rollback restores the notice; a surviving host's hour stands; the written file agrees.
- `WorkshopRoomHandler.roomAndRun.test.ts`: a guest re-invited after dismissal, and a host after generation loss, each receive a session-start frame within the hour.

Each call site was mutation-checked: removing it fails its test.

**Completed after the PR #120 review (F-03).** As first written, the Rewind seam forgot only the keys the cut drops. A persona can survive the cut but lose its history in installation: the import degrades a key whose current prompt cannot be rebuilt. That persona kept its old notice and missed its first time frame. Rewind now forgets degraded persona keys too. `WorkshopSessionRewindCoordinator.test.ts` covers host and guest degradation, keeps the imported persona's notice, and restores the notice when the write fails. Open, Branch and refresh need no change: they rebuild the time state from the file and queue a resume frame for every retained persona, imported or not. A test pins that, too.
