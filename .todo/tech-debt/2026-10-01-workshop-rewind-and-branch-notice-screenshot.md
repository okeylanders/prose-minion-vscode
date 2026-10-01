# The Rewind and Branch notice page draws its actions instead of showing them

**Date Identified**: 2026-10-01
**Reviewed**: 2026-10-01
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one screenshot, one notice entry and its tests)
**Found by**: Workshop Rewind and Branch, Sprint 03 delivery ([epic](../archive/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem

The Workshop startup notice (`v4`) opens on a new page, "New: rewind, edit, and branch". No screenshot of the bubble actions existed when Sprint 03 shipped, so the page draws them inline. `NoticeActions` in `WorkshopNoticeModal.tsx` renders two rows of buttons, "Under a reply" and "Under a message you sent", with the notice's call-out badges.

Every other page shows a real screenshot from `apps/vscode-extension/assets/workshop-notices/`. This page alone shows an approximation of the room instead of the room.

## Recommendation

Capture both footers in a real Workshop room: a reply's (Copy, Rewind to here, Branch from here) and a writer message's (Edit from here, Branch from here). Add the shot to `WORKSHOP_NOTICE_SHOTS` and show it on the page with the same call-outs and legend. Then remove `NoticeActions` if nothing else uses it. The copy doesn't change, so the notice can probably stay at `v4`.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx`: the page and `NoticeActions`.
- `packages/core/src/shared/constants/workshopNotices.ts`: `WORKSHOP_NOTICE_SHOTS` and `WORKSHOP_STARTUP_NOTICE_VERSION`.
- `apps/vscode-extension/assets/workshop-notices/`: the screenshots.
- `packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopNoticeModal.test.tsx`: the notice tests.

## Completion Criteria

- The page shows a real screenshot of both footers, with the same call-outs and legend.
- The notice tests cover the new shot.
- This item moves to `.todo/archive/tech-debt/`.
