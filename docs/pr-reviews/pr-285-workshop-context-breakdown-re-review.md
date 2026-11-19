# PR #285: Workshop context breakdown, re-review

**Verdict: one P2 remains.** F-01 and F-03 are fixed. F-02 now handles a whole turn without telemetry, but a turn with a measured tool request and an unmeasured final answer still shows an outdated total.

**Scope:** reviewed fix `8f0c9004` at head [`d51edeb2`](https://github.com/okeylanders/prose-minion-vscode/commit/d51edeb209b03855d935f4a352a8be18f039e916). The only difference between those trees is the first review report. This is a re-review of #285 only; neither underlying stacked PR was reviewed.

### F-02 · P2 · A tool request can supply the wrong denominator for the final answer

[Observation tracking](https://github.com/okeylanders/prose-minion-vscode/blob/d51edeb209b03855d935f4a352a8be18f039e916/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L409-L418) retains the previous call’s token counts when the next call has no observation; it clears only cache timing. [The commit guard](https://github.com/okeylanders/prose-minion-vscode/blob/d51edeb209b03855d935f4a352a8be18f039e916/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L647-L672) checks that retained observation and cumulative usage. Both can be present even though the *final* call supplied neither. The new clear-on-no-usage branch never runs in that case.

**Independent witness:** a mocked Workshop persona requested a dictionary entry on a measured call (38 prompt + 2 completion tokens). The host then delivered 5,000 characters and the provider’s second call returned final prose without usage or observation. The real engine committed the read, and the production breakdown and view returned **40 total, 1,250 requested, overflow true**. The panel tells the writer estimates exceed a measured total, but the 40-token reading predates the entry. No provider was contacted.

**What to change:** distinguish the observation for the final call from the aggregate usage/peak for the turn. If the final call has no observation, keep the source and tally, and take the existing no-total UI path. Keep the aggregate for billing/processed-token reporting. Add a witness with a measured capability request and unmeasured final, then verify that a later measured reply restores shares.

### Closed findings

- **F-01 (reopened rooms):** verified the legacy fixture import now projects known parts without a fresh total. The expandable table keeps known counts, omits Share and the bar, and leaves Conversation’s remainder unmeasured. Tool sidecars still skip the persona breakdown.
- **F-03 (apportioned reads):** the displayed count retains the supplied delta and respects `isEstimate`. Two apportioned 49-token rows give 98 estimated; combining an apportioned 49 with an exact 300 gives 349 partly estimated. Splitting a read across Memory and Requested keeps both estimated.
- The original F-02 sequence passes: a measured 30-token turn, a continuation with no observations (total clears), then a measured turn (1,405 tokens).

**Verification:** three local workspace typechecks passed; all 15 Jest suites changed within #285 passed (96 tests). A separate temporary, uncommitted regression witness failed the expected no-total assertion on the mixed-telemetry sequence above. [GitHub CI on the reviewed code](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44422431483) passed typechecks, tests, lint and both-bundle build. The author separately [reported](https://github.com/okeylanders/prose-minion-vscode/pull/285#issuecomment-6994886177) 13,295 passing tests; that is not a local re-review count. No live UI test or product change.
