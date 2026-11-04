# Workshop Modals Don't Contain Focus

**Date Identified**: 2026-11-03 (PR #186 F-02, Workshop Wayfinding Slice 2)
**Reviewed**: 2026-11-04
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small to medium: `inertBehindOverlay` for every overlay, then a modal-stack test pass

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

PR #186 first tried a hand-written focus trap. It re-implemented browser
tabbability, and each review round found another edge: positive `tabindex`
(N-01), background interleaving (N-02), then `<summary>` and
`<fieldset disabled>` (N-03). It was replaced with native semantics:
- While a `WorkshopTextSheet` is open, `WorkshopApp` passes
  `inertBehindOverlay` to `FullTabShell`, which marks the header and the
  split `inert`.
- The Workshop's banners sit in an always-present `display: contents`
  wrapper that carries `inert` too.
- The sheet mounts as an overlay after the split, so it stays live. The
  browser handles tab order inside it.
- Chromium 114, the VS Code 1.82 floor, supports `inert`.

## Smallest credible improvement

Do the same for every other Workshop modal: open the shell's
`inertBehindOverlay` whenever any `WorkshopModalShell` overlay is open, and
put the same treatment on the Lightbox's overlays. Don't write a manual focus
trap.

## Related files

- `packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx`
- `packages/core/src/presentation/webview/hooks/useOverlayDismiss.ts`
- `packages/core/src/presentation/webview/components/fulltab/FullTabShell.tsx`:
  `inertBehindOverlay`.
- `packages/core/src/presentation/webview/WorkshopApp.tsx`: the text sheet's
  use, and the banner wrapper.
- Every caller of `WorkshopModalShell`, including the Lightbox's shared
  project picker.

## Completion criteria

- Every Workshop modal (and the Lightbox's, through the shared picker)
  makes the frame behind it `inert` while open. Each one's existing focus
  capture and return keep working.
- Tests cover the modal stack: a modal opened from a modal, and focus return.
- Native keyboard traversal is checked live in VS Code.
