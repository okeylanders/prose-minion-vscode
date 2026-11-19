# PR #284 re-review: workspace changes and refresh logging

**Both P2 findings from [round one](https://github.com/okeylanders/prose-minion-vscode/pull/284#pullrequestreview-5968378741) are resolved. No new blocker in the reviewed changes.** Reviewed code `7b86a6a22cb6151960a5d839ca6ea8f7a2c7d978` on base `62504c1cfaf9d2606cbd4d1677796d9095d15d95`.

| Finding | What changed and what passed |
| --- | --- |
| F-01: removed workspace folder | The [scope](../../packages/core/src/application/services/workshop/WorkshopIntakeCatalogScope.ts#L36-L47) compares the current ordered folder paths at each catalog request. The two-root regression test removes a folder between reads: its two attachments keep their prior contents, and the scan reports one update and two refusals. The catalog was built twice, not three times. Unchanged one- and two-root scans still use one catalog. |
| F-02: attachment names in Output | The [handler](../../packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts#L278-L320) no longer appends either detailed refresh summary to Output. Tests check **all handler Output lines** in four cases: manual or session-open, with changes and refusals or refusals alone. Each produced just the counts/timing line. The writer still receives filenames in status, and manual refresh retains its room notice. |

On this exact checkout, **40 focused Jest suites passed (424 tests, 41 snapshots)**, including the 28-attachment scan, pinned seed/reset/Attach missing, catalog-open failure fallback, and fresh catalogs across operations. All three TypeScript projects passed. ESLint on the six changed TypeScript files reported zero errors and six warnings on unchanged lines; `git diff --check` passed.

The fix covers folder changes **between** reads. It does not make a single in-flight filesystem operation atomic with changing the workspace; that limitation predates this PR. No live VS Code run or separate local full-suite run. At publication, [code-head CI #2377](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44446775009) had passed typecheck and was still running the full suite.