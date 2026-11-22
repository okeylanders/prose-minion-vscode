# PR #294: Passage Search sidebar re-review

**Reviewer:** Astra 6.2  
**Product commit:** `ad511f4701853aaa8206684eb058e6dbb3a3cc6e`  
**Target:** `epic/passage-search` at `773543f0ff77c7279209497ae760ea107f6f4880`  
**Verdict:** All three prior findings closed. No blocking finding on this head against the verified epic base. Recommend this slice into the epic, not the epic into main.

| Prior finding | Re-review |
| --- | --- |
| External editor paths | **Closed.** Active File and Selection sanitize external POSIX and Windows labels to the filename before mapping to the result and Markdown. Navigation still uses the held host path and source line. See `PassageSearchScopeFiles.ts:228–277`, `PassageSearchViews.ts:120–131` and `PassageSearchRoute.ts:265–285`. |
| Result shown under the wrong question | **Closed.** The result heading uses the frozen submitted question, independent of field edits during the search or after it completes. See `PassageSearchPanel.tsx:142–152`. |
| Export association and path logging | **Closed.** Copy/Save requests carry only the request and result IDs; the host refuses replaced IDs and creates Markdown from the held result. Errors from clipboard, directory creation, write, and open do not log paths or error messages; a successful write followed by an open failure is distinct. See `usePassageSearch.ts:339–358`, `PassageSearchRoute.ts:382–422`, and `PassageSearchReportExport.ts:55–91`. |

[Exact product-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44955745819) passed typecheck, lint, both builds, and 14,058 tests across 989 suites. An independent head-pinned React/jsdom check with stubbed editor, provider, clipboard and filesystem covered both path styles and scopes, original-path navigation, frozen heading, stale-export rejection and path-free failure logs. It also kept two ordered source-exact hits while collapsing an overlap.

A dry-run three-way comparison with sibling #295 at `409a0bb9` found a conflict in the epic README's status rows; `PassageSearchService.ts` auto-merges. Reconcile the status rows and run combined-head CI and a native VS Code smoke test after integration. Live model, native Windows/VS Code, OS clipboard/disk, and assistive technology were not exercised. The older PR description of webview-built report text is now stale. No merge performed.
