# PR #285: Workshop context breakdown, final re-review

**Verdict: F-02 is fixed. No new findings in this patch.** A measured tool request no longer supplies the denominator for an unmeasured final answer. F-01 and F-03 were closed in the [previous review](https://github.com/okeylanders/prose-minion-vscode/pull/285#pullrequestreview-5967169856); the underlying stacked changes were outside this review.

**Scope:** [`d51edeb2` to `fc47f664`](https://github.com/okeylanders/prose-minion-vscode/compare/d51edeb209b03855d935f4a352a8be18f039e916...fc47f66495adca05f40f418beefdb993e09e6268). The only production change is in `AgentRunEngine`; the delta also adds a regression test, an ADR note and the previous review report.

| Independent regression check | Result |
| --- | --- |
| A tool request reports 38 prompt + 2 completion tokens, delivers a 5,000-character dictionary entry, and the final answer reports no usage. | The entry remains visible as 1,250 estimated tokens. The total is absent, the view withholds shares, and overflow is false. The run still reports the 40 tokens actually observed. |
| The next reply in the same conversation reports 1,400 prompt + 5 completion tokens. | The total returns at 1,405; the retained entry is 89.0% of it. No false overflow. |

The [observation tracker](https://github.com/okeylanders/prose-minion-vscode/blob/fc47f66495adca05f40f418beefdb993e09e6268/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L411-L421) updates freshness on every provider call, including retries. The [commit guard](https://github.com/okeylanders/prose-minion-vscode/blob/fc47f66495adca05f40f418beefdb993e09e6268/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L650-L675) uses that final-call freshness to decide whether to store or clear the context budget. It does not discard the committed sources or tally, or reset the separate aggregate used for run usage.

**Verification:** 177 repository tests passed across 16 focused Jest suites (the 15 suites changed by #285 and the main engine suite), plus the independent, uncommitted engine-to-panel-view check above. Core, webview and extension typechecks passed locally. [CI for the reviewed commit](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44425999306) passed typecheck, tests, lint and both bundle builds. No live provider or VS Code UI was used.
