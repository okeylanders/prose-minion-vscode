# PR #281 bookmark-jump review

Reviewed `a6e42317992aefd7b885dc9efb1b186dc476e2e9`.

## P2: Selecting a visible bookmark must cancel the previous pending jump

`packages/core/src/presentation/webview/WorkshopApp.tsx:1068–1070` directly scrolls to an in-window bookmark without calling `cancelEarlierJump`. The old walk remains live. Its late page response settles `jumpOutcome`, and the effect at lines 1080–1094 scrolls back to the old bookmark (or opens its reader when refused), overriding the writer's newer choice.

Reproduced with the real WorkshopApp test harness: window turn-5 through turn-8; first click bookmarked turn-2, then click in-window turn-6 before the page returns. Focus correctly moves to turn-6. Delivering the first request's page for turn-1 through turn-4 moves focus back to turn-2. The added regression's final `expect(document.activeElement).toBe(bubble('turn-6'))` fails. A second bookmark is supposed to replace the first jump.

Cancel the pending walk before navigating to an already-drawn bookmark. Apply the same replacement semantics to the Bookmarks screen's direct `jumpAfterClosing` path, which currently has no cancellation callback. Preserve pages already loaded. Add tests for both successful and refused late responses after a newer visible selection.

## Verification

Existing targeted earlier-turns/bookmark suites: 223 tests passed. A separate focused real-App regression failed as described above. The temporary regression was kept local and removed from the checkout after execution; no product code was changed. Checked host distance and malformed-target refusal, webview page limit, replacement/room revision handling, and fallback paths. No full-suite/typecheck rerun or live VS Code/screen-reader test. The known accessibility announcement concern was not independently verified and is not raised as another finding.
