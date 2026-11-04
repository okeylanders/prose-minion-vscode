# PR #187 review: Workshop Wayfinding Slice 3, read-in provenance

**Disposition: changes requested. One reproduced P2 focus regression and one P3 range-scroll concern. Review continues.**

**Reviewed implementation:** `3174e66a54aa2f73928ca15e9f95df8e95c40400`  
**Base:** `d59b6510735dd48fed6d58587193f230749e890d`  
**PR:** [#187](https://github.com/okeylanders/prose-minion-vscode/pull/187) · **Reviewed:** 2026-11-04

The PR is still marked draft; its slice documentation marks implementation built. This early report is offered while the privacy, persistence and remaining integration review continues. It is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: the reader's jump loses focus to the old opener

**Locations:** [`useWorkshopTurnJump.ts:68–84`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopTurnJump.ts#L68-L84), [`useOverlayDismiss.ts:124–143`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/hooks/useOverlayDismiss.ts#L124-L143).

In an independent full-App probe, open a resource reader, choose **Show where it was read**, and allow the overlay-close effects and queued microtask to settle. The jump scrolls and initially focuses the correct capability card, but the overlay cleanup's queued opener restoration then focuses the original Read in row instead. The writer is left at the rail rather than at the card the action promised to show.

Coordinate the jump with overlay focus restoration so a deliberate post-close destination wins. Cover the complete App path through the real overlay cleanup, including microtasks; a hook-only assertion before the cleanup settles misses the regression. Preserve ordinary Close/Escape return-to-opener behavior and the outside-window notice.

## N-01: P3: the initial range scroll runs while the Source pane is hidden

**Locations:** [`WorkshopReadInLines.tsx:33–42`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/components/workshop/WorkshopReadInLines.tsx#L33-L42), [`WorkshopTextSheet.tsx:250–256`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L250-L256), [`WorkshopTextSheet.tsx:358–371`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L358-L371).

With the normal asynchronous reader reply, an independent full-App probe records the range-start line's only `scrollIntoView` call while its Source panel still has `hidden`. The parent then switches Preview to Source, but the line component does not call it again. An element in a hidden pane has no rendered scroll position, so the requested “open at the first line read” behavior is at risk for long files.

Schedule the range scroll after Source is visible, and cover the asynchronous reply path rather than mounting the line component already visible. The hidden-at-call sequencing is reproduced in the App; actual browser scroll geometry was not verified in this environment, so this is a nonblocking concern pending native acceptance.

## Verification so far

Nine existing focused suites pass **115 tests**. Two independent full-App probes reproduce the focus ordering and hidden-at-scroll sequencing above; they are separate from the passing test total. Resource privacy, persistence/rewind, remaining reader states and exact-head CI are still being reviewed. Native VS Code and browser geometry were not exercised. No implementation change, formal approval or merge was made.
