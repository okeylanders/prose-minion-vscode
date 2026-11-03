# Workshop Modals Don't Contain Focus

**Date Identified**: 2026-11-03 (PR #186 F-02, Workshop Wayfinding Slice 2)
**Reviewed**: 2026-11-03
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small to medium: turning the trap on everywhere, then a modal-stack test pass

## Problem

`WorkshopModalShell` renders `role="dialog"` with `aria-modal="true"`. Its
backdrop blocks the pointer, and `useOverlayDismiss` handles Escape and
returns focus on close. But by default nothing keeps the keyboard inside the
dialog:
- Tab and Shift+Tab can leave it for the rail, thread and header behind it.
- The background stays enabled; it isn't `inert`.

A writer can then activate controls behind an open modal. In PR #186 that
replaced an open reader in place (F-02).

## What Slice 2 did

It added an opt-in `trapFocus` prop to `WorkshopModalShell`, which wraps Tab
and Shift+Tab at the dialog's first and last tab stops. It's off by default
so every other modal's markup and behavior stay as they were. Only
`WorkshopTextSheet` turns it on.

## Related files

- `packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx`
- `packages/core/src/presentation/webview/hooks/useOverlayDismiss.ts`
- `packages/core/src/presentation/webview/components/fulltab/FullTabShell.tsx`: the
  shared frame, where an `inert` background would belong.
- Every caller of `WorkshopModalShell`, including the Lightbox's shared
  project picker.

## Completion criteria

- Every Workshop modal (and the Lightbox's, through the shared picker)
  contains the keyboard while open: a trap on by default, an `inert`
  background, or both. Each one's existing focus capture and return keep
  working.
- Tests cover the modal stack: a modal opened from a modal, and focus return.
- `trapFocus` either becomes the default or is removed.
