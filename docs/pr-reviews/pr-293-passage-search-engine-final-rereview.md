# PR #293 final re-review: Passage Search cancellation usage

**Astra 6.2 · November 21, 2026 · Reviewed `6cc49d6690092c706aab4d2edd68e7a6a02697e8`.** Target: `epic/passage-search`. Focused review of the one-commit delta from the previous report-only head `d33d5650`.

**Verdict: F3 is resolved. No remaining review blockers in Slice 1. CI is a separate merge gate.**

[PassageSearchService.ts:323–345](https://github.com/okeylanders/prose-minion-vscode/blob/6cc49d6690092c706aab4d2edd68e7a6a02697e8/packages/core/src/infrastructure/api/services/search/passage/PassageSearchService.ts#L323-L345) now records an unknown usage entry when an admitted call rejects in flight after Stop. Resolved cancellations still contribute any reported usage. Missing-credentials refusals and reads never admitted stay out of the usage sum. [sumTokenUsage](https://github.com/okeylanders/prose-minion-vscode/blob/6cc49d6690092c706aab4d2edd68e7a6a02697e8/packages/core/src/utils/tokenUsage.ts#L21-L41) retains known tokens and counts each recorded request, but withholds complete USD and cache totals when some usage is unknown.

## Verification

- Independent offline comparison with the real `p-limit`, deferred fake provider and head-pinned usage helper: two metered cancellations plus two in-flight rejections. The old code counted two requests and reported incomplete cost and cache totals. The fixed code counted four requests, kept 240 known tokens, and omitted cost, cache reads and cache writes.
- Additional offline controls passed for mixed missing-credentials refusals, pre-aborted execution with no sends, all-metered cancellations (cost/cache retained), and all-unknown cancellations (no usage object; cancellation count preserved).
- The [checked-in four-wide test](https://github.com/okeylanders/prose-minion-vscode/blob/6cc49d6690092c706aab4d2edd68e7a6a02697e8/packages/core/src/__tests__/infrastructure/api/services/search/passage/PassageSearchFourWide.test.ts#L156-L180) also asserts four cancellations, eight unsent, four requests counted for usage, 240 known tokens and no total USD/cache. Its metered fixture does not populate cache fields; the independent test explicitly supplied both.
- [Exact code-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44950398444) was running at write time. No live provider call, local full-suite run, or VS Code smoke test in this re-review.

The previously closed findings remain closed. Slice 3's organizer is outside this delta.
