# PR #188 review: Workshop Wayfinding Slice 4, host bookmarks

**Disposition: changes requested. One independently reproduced P2 persistence failure. Review continues.**

**Reviewed implementation:** `21e5f3d3d96412cb5f7af70ee1192f2dff758d8e`  
**Base:** `89d6f26b36ca49e4161a02f5bfeb5fd2af98e341`  
**PR:** [#188](https://github.com/okeylanders/prose-minion-vscode/pull/188) · **Reviewed:** 2026-11-04

This is an early branch report while the remaining persistence, whole-room, export and mutation review continues. It is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: accepted bookmark IDs can poison future saves

**Locations:** [`WorkshopBookmarkLedger.ts:30–31, 130–135, 250–256`](https://github.com/okeylanders/prose-minion-vscode/blob/21e5f3d3d96412cb5f7af70ee1192f2dff758d8e/packages/core/src/application/services/workshop/session/WorkshopBookmarkLedger.ts#L130-L135), [`WorkshopBookmarkRecords.ts:29–33`](https://github.com/okeylanders/prose-minion-vscode/blob/21e5f3d3d96412cb5f7af70ee1192f2dff758d8e/packages/core/src/application/services/workshop/session/WorkshopBookmarkRecords.ts#L29-L33).

The strict bookmark-ID grammar accepts an unlimited decimal sequence, but hydration converts its counter to a JavaScript number and retains the maximum. A validly parsed checkpoint with `bookmark-<400 nines>-2000` produces `Infinity`; one with `bookmark-1000000000000000000000-2000` produces a number formatted in exponential notation. After hydration, bookmarking a second eligible turn mints `bookmark-Infinity-3000` or `bookmark-1e+21-3000`, respectively. Both violate the same codec's ID grammar, so strict save rejects the room.

An independent production parser → checkpoint decode → aggregate hydrate → set → strict-save probe confirms both cases. This requires an abnormal but currently accepted session ID; it is not a claim that ordinary IDs generated today naturally reach these values. Because the ledger deliberately never decreases its counter, the `Infinity` value survives reset and opening a clean fixture in the same aggregate, so subsequent rooms remain affected until that aggregate is recreated.

Bound and validate the parsed counter before installing it, and ensure incrementing can never produce an unrepresentable or invalid ID. Consider the maximum safe-integer boundary and ID uniqueness as well as `Infinity`; reject malformed/out-of-range IDs or use an ID scheme that does not require unsafe numeric conversion. Add real parse/hydrate/set/save regressions and a fresh-room recovery control.

## Verification so far

The real parser/hydration/save witnesses above reproduce the failure; **7 suites / 98 tests** pass including four independent reproduction cases. These are observation tests confirming the bad outcome, not evidence of a corrected build. Exact-head [CI run 41764320845](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41764320845) succeeded; green CI does not cover this boundary. The remainder of the review is in progress. No implementation change, formal approval or merge was made.
