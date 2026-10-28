# The Workshop Does Not Reflow at Narrow Widths

**Date Identified**: 2026-10-19 (Lightbox Slice 4 visual evidence; also visible in the PR #147 evidence)
**Reviewed**: 2026-10-20
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to Medium (frame breakpoints for a tab without an aside, plus shots)

## Problem

At 500 px the Workshop tab keeps its rail and its main column side by side.
The main column runs past the window's right edge inside the frame, so the
thread, the participant strip and the composer are cut off; the document
itself reports no horizontal overflow, because an inner container scrolls.

The Lightbox does not have this problem: a full-tab frame with an aside
(`.pm-ws-with-aside`) scrolls as one page at 1240 px and stacks at 760 px
(ADR 2026-10-19 D1–D2). The Workshop has no aside, so neither rule applies
to it.

Evidence:

- `docs/pr-reviews/evidence/lightbox-slice-4-visual/workshop/workshop-composer-500.png`:
  only the left half of the two staged Lightbox pills is visible.
- `docs/pr-reviews/evidence/pr-147-visual/result/empty-500.png`: the same
  clipping before any Lightbox work.

## Recommendation

Give the shared full-tab frame a narrow-width rule that does not depend on
an aside: below roughly 760 px, stack the rail above the main column and
let the tab scroll as one page, as the Lightbox does. Re-shoot the PR #147
and Slice 4 Workshop evidence at 500 px.

## Related Files

- `packages/core/src/presentation/webview/styles/fulltab/`
- `packages/core/src/presentation/webview/components/fulltab/FullTabShell.tsx`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`

## Completion Criteria

- At 500 px the Workshop's composer, its staged attachments and the thread
  are fully visible without sideways scrolling.
- The 1440 and 1000 px layouts are unchanged.
