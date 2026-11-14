# Files over 500 lines that Everyday Conveniences had to touch

**Date Identified**: 2026-11-14
**Status**: Identified
**Priority**: Low
**Source**: [Everyday Conveniences](../epics/epic-everyday-conveniences-2026-11-14/README.md), closing pass; noted in the reviews of PRs #260, #261 and #262

## Problem

Slices B, C, D and E added lines (about 110 in all) to four files already
past the 500-line bound. None was created by the epic, and none was split in it.
Measured on `epic/everyday-conveniences-close`:

| File | Lines | Tracked already? |
|---|---|---|
| `presentation/webview/WorkshopApp.tsx` | 1,949 | Yes: [2026-11-03](2026-11-03-workshop-app-root-size.md) (it was 1,671 then) |
| `application/handlers/domain/workshop/WorkshopRoomHandler.ts` | 1,842 | Resolved as a boundary question in [2026-07-25](2026-07-25-workshop-god-files.md); it has grown by about 325 lines since |
| `presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts` | 957 | No |
| `shared/types/messages/index.ts` | 525 | No |

(Paths are under `packages/core/src/`.)

`WorkshopTurnBubble.tsx` (838 lines) is also over the bound; this epic did
not touch it.

## Recommendation

- `useWorkshopRoom.ts`: move the excerpt and scope actions (Continue,
  re-read, set scope) into their own hook, as `useWorkshopSessions` was
  split out of the old facade.
- `messages/index.ts`: give the Dictionary and Workshop routing unions
  their own barrels, as `lightboxBarrel.ts` did for the Lightbox.
- Take each as its own behavior-preserving commit, before the next feature
  that touches the file.

## Completion Criteria

- Each of the two untracked files is under 500 lines, or its size is
  justified in a note here.
- Their existing tests pass unchanged.
