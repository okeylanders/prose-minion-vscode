# Workshop thread dividers have no accessible name

**Status:** Open
**Priority:** Low
**Found in:** Workshop Wayfinding Slice 7 (model slices)

## Problem

The thread's dividers render as `<div role="separator"><span>…</span></div>`
with no `aria-label`. Those are the session start and resume divider, the
excerpt revision, the direct tool-run, the persona-run analysis and the
legacy scope dividers. In ARIA, a separator's children are presentational,
and its name never comes from its content. So a screen reader can announce
these dividers as a bare separator, or skip their text.

The model slice divider (`WorkshopModelSliceDivider`) is named with
`aria-label` set to its visible text. The others should match it.

## Related files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
  (each `role="separator"` branch)
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtml.ts`
  (the exported event dividers)
- `packages/core/src/presentation/webview/components/workshop/WorkshopModelSliceDivider.tsx`
  (the pattern to follow)

## Completion criteria

- Every thread and export separator is named by its visible text.
- Tests query each divider with `getByRole('separator', { name })`.
