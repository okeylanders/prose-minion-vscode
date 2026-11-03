# PR #186 review: Workshop Wayfinding Slice 2, Read in and the reader

**Disposition: changes requested. One independently reproduced P2 reader race. Review is continuing.**

**Reviewed implementation head:** `5932927f6fa3955dd03b251950e22b4088bee478`  
**Base:** `d45d57c2774335186169ba9f7576c4046c99c80e`  
**PR:** [#186](https://github.com/okeylanders/prose-minion-vscode/pull/186) · **Reviewed:** 2026-11-03

This early report is being published while the rest of the implementation and its integration are still under review. It is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: an earlier request for the same file can supply the reopened reader

**Locations:** [`useWorkshopReadIn.ts:64–83`](https://github.com/okeylanders/prose-minion-vscode/blob/5932927f6fa3955dd03b251950e22b4088bee478/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopReadIn.ts#L64-L83), [`WorkshopTextSheet.tsx:223–234`](https://github.com/okeylanders/prose-minion-vscode/blob/5932927f6fa3955dd03b251950e22b4088bee478/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L223-L234).

A response is accepted solely by `{ group, path }`. That pair identifies a resource, not a particular request or reader lifetime. Closing and reopening the same resource creates a second request with the same pair, so a late first response is indistinguishable from the second. The text sheet seeds its displayed value on the first accepted response and does not replace it when the second arrives.

**Independent production-App reproduction:**

1. Open a read-in resource, starting request A. Close the sheet while A is pending.
2. Reopen that same resource, starting request B.
3. Deliver A's old content, then B's newer content.
4. The reopened reader still displays A's content after B completes. The full `WorkshopApp` regression probe fails the expected B-content assertion, showing the old A content.

The reader says it shows the file as it is now, and its editor action can open the newer file. A stale or out-of-order response can therefore mislead the writer even after the current request has completed. The same pair-matching issue applies to A → B → A navigation.

**Requested correction:** give each request a unique correlation identity or equivalent generation that travels through the host response; accept only the currently pending request for the current reader lifetime. Invalidate it on close and replacement, and ensure the displayed sheet body can never be seeded by an earlier request. Cover Close → reopen same resource and A → B → A with both response orders, plus a current-request success control. Consider room replacement and chat-target changes as part of the same lifecycle.

## Verification and limits so far

A full-App independent regression reproduces F-01: **1 expected failure**. Six focused existing suites pass **124 tests**. These are separate observations, not a claim that the full repository suite or native VS Code acceptance has passed. The implementation is still under review, including resource authorization, race isolation, badge state and integration. No implementation change, formal review, merge or paid provider call was made.
