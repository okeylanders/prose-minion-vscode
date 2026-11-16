# Feature: Collapse the Workshop's Side Pane

**Date Identified:** 2026-11-07
**Status:** Idea. Small, presentation only: no host change, no ADR.
**Priority:** Medium
**Origin:** Okey, 2026-11-07 ("collapsing side pane in Workshop")

## Problem

The Workshop's rail (participants, context, directives, to-dos and the rest
of its tabs) is a fixed 372px column that can't be hidden:

```css
/* styles/fulltab/shell.css */
[data-pm-frame="fulltab"] .pm-ws-split {
  grid-template-columns: 372px 1fr;
}
```

The Workshop has no narrow-width rule either; only tabs with an aside (the
Lightbox) reflow at 1240px and 760px. A writer who keeps the Workshop split
beside the manuscript gives the rail a large share of a half-width column,
and the thread gets squeezed. Even at full width, a writer deep in a
conversation often doesn't need the rail.

## Idea

A collapse control on the rail.

- **Collapsed,** the rail becomes a thin strip of its tab icons, which
  already exist (`TAB_ICONS` in `WorkshopRail`), with their counts and
  badges. Clicking an icon reopens the rail on that tab.
- **Expanded** is today's rail, unchanged.
- **Remembered for the window,** as a UI preference through the webview's
  persisted state, never the session.
- **A narrow tab can start collapsed.** Below a width (say 900px), the rail
  starts collapsed and can still be opened. Opened that way, it lays over
  the thread rather than squeezing it.

## Design notes

- **In the shared shell, not the Workshop.** `FullTabShell` owns the rail
  region, so the collapse belongs there as an opt-in prop. The Lightbox can
  take it too, and its rail and inspector already reflow at narrow widths.
  The shared-component rule applies: without the opt-in, the Workshop's and
  the Lightbox's markup stay identical (their tests run unchanged).
- **Accessibility.**
  - The control is a button with `aria-expanded` and `aria-controls` naming
    the rail.
  - Collapsing while focus is inside the rail moves focus to the control,
    never to nowhere.
  - Each strip icon's name is its tab name with its count ("Context, 4").
  - The tab icons' existing `aria-label`s carry over.
- **Badges must still be seen.** A rail tab that announces something (a new
  to-do, a pending memory card) shows its badge on the collapsed strip, so
  collapsing never hides news.
- **The Chromium 114 floor.** Plain grid and a transition only.
  `webviewCssFloor.test.ts` holds it, and the transition honors
  `prefers-reduced-motion`.

## Open questions

- **Where the control sits.** At the rail's top edge, or in the header's
  actions? And is a keyboard shortcut wanted?
- **A drag-resizable rail too?** Collapse covers the narrow case. Resizing
  is a separate, larger ask.
- **The Lightbox.** Should it take the same collapse for its rail? What about
  its inspector aside?

## Completion Criteria

- [ ] The rail collapses to an icon strip and expands back, from the control
      and from any strip icon (which opens that tab).
- [ ] The choice survives a reload. Below the narrow width, the rail starts
      collapsed.
- [ ] Badges and counts show on the collapsed strip.
- [ ] Focus never drops: collapsing from inside the rail lands on the
      control. Names and `aria-expanded` are tested.
- [ ] Without the opt-in, `FullTabShell`'s markup is unchanged (the
      Workshop's and Lightbox's existing tests pass as they are).
- [ ] `webviewCssFloor.test.ts` passes.

## Related Files

- `packages/core/src/presentation/webview/components/fulltab/FullTabShell.tsx`
  (the rail region)
- `packages/core/src/presentation/webview/styles/fulltab/shell.css`
  (`.pm-ws-split`, `.pm-ws-rail`)
- `packages/core/src/presentation/webview/components/workshop/WorkshopRail.tsx`
  (`TAB_ICONS`, the tab strip)
- `packages/core/src/presentation/webview/hooks/fulltab/useFullTabChrome.ts`
  (generic chrome state, a home for the preference)
