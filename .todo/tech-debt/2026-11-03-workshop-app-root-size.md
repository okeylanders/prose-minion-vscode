# WorkshopApp.tsx is over three times the 500-line limit

**Status:** Identified
**Priority:** Medium
**Source:** Workshop Wayfinding Slice 1 ([epic](../archive/epics/epic-workshop-wayfinding-2026-11-03/README.md)), found while extracting the rail

## Problem

`packages/core/src/presentation/webview/WorkshopApp.tsx` is 1,671 lines after
Slice 1 moved the rail into `WorkshopRail` (it was 1,743). It is the Workshop's
composition root, but it still holds whole surfaces inline:

- the thread's empty states and live-turn rendering (`mainContent`),
- the composer region and its scope-aware affordances,
- the modal and sheet stack (tools, widgets, sessions, persona, text sheet),
- dozens of `useCallback` glue handlers between hooks.

Every Wayfinding slice that touches the thread (bookmarks, model slices) will
add to it unless the thread region moves out first.

## Related Files

- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopRail.tsx` (the pattern: props grouped per panel, state kept above)
- [2026-08-04 Workshop modal workflow ownership](2026-08-04-workshop-modal-workflow-ownership.md)

## Recommendation

Extract presentational regions the way Slice 1 extracted the rail, one per
commit, behavior-preserving:

1. The thread region (empty states, `WorkshopThread`, the live turn) into a
   `WorkshopThreadRegion`, before Slice 5 adds bookmark toggles.
2. The overlay stack (modals and sheets) into a `WorkshopOverlays` component.

## Completion Criteria

- `WorkshopApp.tsx` is under 500 lines, or each remaining region is justified.
- The `WorkshopApp.*` test files pass unchanged.
