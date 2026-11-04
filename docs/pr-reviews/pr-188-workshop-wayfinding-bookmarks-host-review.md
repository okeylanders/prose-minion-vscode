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

## Author response

F-01 is fixed on `epic/workshop-wayfinding-slice-4-bookmarks-host` in `5d0b5fc`. Its regression test fails without the fix.

| Finding | Status | Commit | What changed | Covered by |
|---|---|---|---|---|
| F-01 (P2) | Fixed | `5d0b5fc` | **Grammar:** `parseWorkshopBookmarkId` (in `WorkshopBookmarkLedger.ts`) accepts `bookmark-<n>-<ms>` only when each part is a canonical decimal from 1 to `Number.MAX_SAFE_INTEGER`: no leading zero, no zero, no sign, no fraction. The codec (`WorkshopBookmarkRecords.ts`) refuses anything else at parse, as an invalid session, the same way `numericIdSuffix` bounds the to-do and turn ids. **Hydration:** `prepareState` installs a parsed counter only when `Number.isSafeInteger` holds, a second guard behind the codec. **Mint:** `mintId` moves the counter only when it takes an id. A set that would pass `MAX_SAFE_INTEGER`, or whose clock would make an id the grammar refuses, is refused as `ids-exhausted`. It makes no change, and the handler logs it without turn content, as it does an ineligible turn. | `WorkshopBookmarkIdBounds.test.ts`, through the real parser, checkpoint decode, aggregate hydration, set and strict save. Both of the review's ids are refused at parse, on open and on save. So are a counter one past the safe maximum, a leading zero, zero, a sign and a fraction, and the same cases for the time part. Both parts at exactly `MAX_SAFE_INTEGER` are accepted. At the maximum counter, the next set is refused with no change and the room still saves. A non-positive clock is refused the same way. The ledger installs no unsafe counter, even from ids given behind the codec's back. **Recovery control**, through the real coordinator and store: the bad checkpoint's Open is refused and nothing is installed. New then sets and saves `bookmark-1-…`, and a clean Open in the same aggregate sets and saves `bookmark-2-…`. |

**Verification at `5d0b5fc`, on a clean tree:**
- 621 suites / 8,814 tests / 59 snapshots, all passing.
- `npm run typecheck` is clean.
- `npm run lint` has 0 errors and 1,140 warnings, unchanged.
- `packages/core/src` has no `from 'vscode'` outside test string literals.



## Independent re-review of `c42abe1` (2026-11-04)

**Disposition: F-01 is resolved; no new actionable defect found in the correction.** This report is not a formal GitHub approval or authorization to merge. Exact-head CI was still running at report time.

The codec now rejects noncanonical or unsafe numeric ID parts before hydration. Allocation checks the safe boundary before changing state, and hydration computes the maximum without an unbounded spread. The original 400-digit and `1e21` witnesses, plus `2^53` and malformed IDs, now fail parsing/checkpoint decoding/direct hydration instead of poisoning the counter. Ordinary existing IDs and the pre-bookmark fixture remain compatible.

Independent controls verify MAX_SAFE−1 allocates MAX_SAFE exactly once; the next set is refused without mutation, while rename, clear and strict save still work. Rejected unsafe hydration preserves an existing room and subsequent normal allocation. A real store invalid-open → reset → clean-open → autosave succeeds, as does rename/autosave after a boundary refusal. Same-clock clear/reset/lower-counter reopening does not reuse IDs.

**Verification:** one independent pass ran **15 suites / 278 tests**, including seven review probes; another ran **11 suites / 165 tests**, including 17 boundary/store controls. These totals overlap. [CI run 41767503387](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41767503387) was still in progress when checked: typecheck and tests passed, lint and build remained. The full suite was not rerun independently. No implementation change, formal approval or merge was made during this re-review.
