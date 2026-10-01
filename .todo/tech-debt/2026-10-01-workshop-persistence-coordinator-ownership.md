# Workshop persistence coordinator carries four room replacements

**Date Identified**: 2026-10-01
**Reviewed**: 2026-10-01
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Medium (one collaborator extraction behind the coordinator, no behavior change)
**Found by**: Workshop Rewind and Branch, Sprint 03 kickoff ([epic](../archive/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem

`WorkshopSessionPersistenceCoordinator` grew from 1,364 lines before Rewind
to 1,574 after Sprint 02 and about 1,709 after Branch. It owns:

- the autosave queue and its revisions;
- named-file authority and identity checks;
- the rolling `current.json` mirror and recovery;
- the session browser operations;
- four whole-room replacements: New, Open (and refresh), Rewind and Branch.

At the Sprint 03 kickoff, Okey chose to keep Branch in the coordinator. The
replacements now share one private transaction (`replaceLiveRoom`) instead of
four hand-rolled copies, so the duplication is gone. The concentration
remains. Line count is pressure evidence, not a defect by itself (see the
[resolved god-files record](2026-07-25-workshop-god-files.md)).

## Recommendation

Extract the room-replacement mechanics when the next operation needs them,
for example Side Quest state, or any further whole-room operation:

- `replaceLiveRoom`;
- `installRoom`;
- `exportLiveRoom`;
- `captureRollback` and `restoreRollback`.

They would move into one collaborator beside the coordinator. The coordinator
keeps the persistence transaction itself: queue ordering, named authority, the
mirror and recovery notices. Handlers keep depending on the coordinator only.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionBranch.ts`
- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts`

## Completion Criteria

- Room replacement lives in one named collaborator; the coordinator delegates
  to it.
- The Rewind, Branch and persistence coordinator suites pass unchanged,
  including the Branch key proof and every rollback injection.
