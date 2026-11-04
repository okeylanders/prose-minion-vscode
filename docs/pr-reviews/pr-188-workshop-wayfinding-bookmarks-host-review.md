# PR #188 review: Workshop Wayfinding Slice 4, host bookmarks

**Disposition: changes requested. One independently reproduced P2 persistence failure. Review continues.**

**Reviewed implementation:** `21e5f3d3d96412cb5f7af70ee1192f2dff758d8e`  
**Base:** `89d6f26b36ca49e4161a02f5bfeb5fd2af98e341`  
**PR:** [#188](https://github.com/okeylanders/prose-minion-vscode/pull/188) · **Reviewed:** 2026-11-04

This is an early branch report while the remaining persistence, whole-room, export and mutation review continues. It is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: accepted bookmark IDs can poison future saves

**Locations:** [`WorkshopBookmarkRecords.ts:34–37`](https://github.com/okeylanders/prose-minion-vscode/blob/21e5f3d3d96412cb5f7af70ee1192f2dff758d8e/packages/core/src/application/services/workshop/session/WorkshopBookmarkRecords.ts#L34-L37), [`WorkshopBookmarkLedger.ts:139–143`](https://github.com/okeylanders/prose-minion-vscode/blob/21e5f3d3d96412cb5f7af70ee1192f2dff758d8e/packages/core/src/application/services/workshop/session/WorkshopBookmarkLedger.ts#L139-L143), [`174–178`](https://github.com/okeylanders/prose-minion-vscode/blob/21e5f3d3d96412cb5f7af70ee1192f2dff758d8e/packages/core/src/application/services/workshop/session/WorkshopBookmarkLedger.ts#L174-L178), [`262–265`](https://github.com/okeylanders/prose-minion-vscode/blob/21e5f3d3d96412cb5f7af70ee1192f2dff758d8e/packages/core/src/application/services/workshop/session/WorkshopBookmarkLedger.ts#L262-L265).

The strict bookmark-ID grammar accepts an unlimited decimal sequence, but hydration converts its counter to a JavaScript number and retains the maximum. A validly parsed checkpoint with `bookmark-<400 nines>-2000` produces `Infinity`; one with `bookmark-1000000000000000000000-2000` produces a number formatted in exponential notation. After hydration, bookmarking a second eligible turn mints `bookmark-Infinity-3000` or `bookmark-1e+21-3000`, respectively. Both violate the same codec's ID grammar, so strict save rejects the room.

An independent production parser → checkpoint decode → aggregate hydrate → set → strict-save probe confirms both cases. This requires an abnormal but currently accepted session ID; it is not a claim that ordinary IDs generated today naturally reach these values. Because the ledger deliberately never decreases its counter, the `Infinity` value survives reset and opening a clean fixture in the same aggregate, so subsequent rooms remain affected until that aggregate is recreated.

Bound and validate the parsed counter before installing it, and ensure incrementing can never produce an unrepresentable or invalid ID. Consider the maximum safe-integer boundary and ID uniqueness as well as `Infinity`; reject malformed/out-of-range IDs or use an ID scheme that does not require unsafe numeric conversion. Add real parse/hydrate/set/save regressions and a fresh-room recovery control.

## Verification so far

The real parser/hydration/save witnesses above reproduce the failure; **7 suites / 98 tests** pass including four independent reproduction cases. These are observation tests confirming the bad outcome, not evidence of a corrected build. Exact-head [CI run 41764320845](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41764320845) succeeded; green CI does not cover this boundary. The remainder of the review is in progress. No implementation change, formal approval or merge was made.


## Completed review and verification

No additional actionable defect was established in the mutation gate, route eligibility, normal persistence, snapshot ordering/window membership, recovery equality, rewind/branch or transcript export/recall isolation. A real coordinator/store witness also confirms F-01's practical effect: a named checkpoint with the accepted oversized ID opens, but the next bookmark reports an autosave error and the saved file retains only the prior bookmark.

Independent checks on `21e5f3d`:

- **16 production suites / 273 tests** pass across bookmark, persistence, rewind, branch and export coverage. This includes five separate real-coordinator probes: failed durable writes during New, Open, Rewind and Branch restore bookmark records and summaries without changing source/current checkpoints; a bookmark-only rename flushes to named and rolling files.
- Additional route/gate/export review found no new TOCTOU window: mutation and its dirty/snapshot effects are synchronous under the existing gate. Export reads the full ledger and bookmark IDs before file I/O; recall and prompts do not read the bookmark state.
- The separate F-01 observations confirm the bad outcome and are not counted as a fix. Report-only commit `42155dce` changes no implementation.

F-01 remains open despite green CI. Correct it and re-review the new exact head. No formal approval or merge was made.
