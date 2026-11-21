# PR #293 re-review: Passage Search engine

**Astra 6.2 · November 21, 2026 · Reviewed `33ef5d191e154604959a256b25f4edc6f842de64`.**
Target: `epic/passage-search`. Compared against the prior report-only head `f91329a3e2090aeb1511e6ad05cb39f9a9677bc6`.

**Verdict: changes recommended before merge; one P2 remains.**

## P2 · Rejected in-flight cancellations can present a partial cost as a run total

[PassageSearchService.ts:323–343](https://github.com/okeylanders/prose-minion-vscode/blob/33ef5d191e154604959a256b25f4edc6f842de64/packages/core/src/infrastructure/api/services/search/passage/PassageSearchService.ts#L323-L343) counts a rejection after Stop as a dispatched cancellation, but does not add an unknown usage entry. Resolved cancellations do add an entry, even if usage is absent. [sumTokenUsage](https://github.com/okeylanders/prose-minion-vscode/blob/33ef5d191e154604959a256b25f4edc6f842de64/packages/core/src/utils/tokenUsage.ts#L20-L38) suppresses the optional cost and cache totals only when it sees an unreported call; it cannot account for a missing entry. This can leave the caller with an understated request count and an apparently complete cost or cache total.

The production engine converts a recognized AbortError into a cancellation result. A different transport rejection racing Stop is still a reachable rejected branch; this is not an assertion that every cancellation or unmetered call was charged. See [AgentRunEngine.ts:946–972](https://github.com/okeylanders/prose-minion-vscode/blob/33ef5d191e154604959a256b25f4edc6f842de64/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L946-L972).

A head-pinned synthetic run on real `p-limit` 7.2.0 admitted four reads, then stopped with eight more queued. Two cancelled responses reported usage and two rejected in flight. The recorded cost was `0.002` and the request count was two, while the run correctly reported four cancelled dispatches. Making the two unmetered cancellations resolve instead correctly suppressed cost/cache and counted four requests. The checked-in [four-wide fixture](https://github.com/okeylanders/prose-minion-vscode/blob/33ef5d191e154604959a256b25f4edc6f842de64/packages/core/src/__tests__/infrastructure/api/services/search/passage/PassageSearchFourWide.test.ts#L156-L174) currently expects two metered request entries for the mixed case.

**Repair:** retain an explicit unknown-usage entry for an admitted, thrown cancellation, not a never-admitted or missing-credentials read. Assert four request entries and no complete USD/cache total in the mixed case, while retaining known token counts. When all usage is unavailable, the dispatch counts still report what was attempted.

## Prior findings

- F1 (P1), fixed: one synchronous snapshot of live editor state, not remembered nonempty selection text; a cleared/closed editor scope is refused rather than substituted.
- F2 (P1), fixed: checks the held provider at admission, after reads, and before organizer dispatch. Four concurrent answers survived final-batch retirement and the organizer did not run.
- F3 (P2), partly fixed: dispatched cancellations and unsent reads are now separate; usage accounting above remains.
- F4 (P2), fixed: files distinguish none, partial, and full by answered chunks, even when there are no hits. Cut answers are counted as answered and disclosed separately per the ADR.
- F5 (P2), fixed: an organizer call, when available, reserves one of the 300 places.
- F6 (P2), fixed: chunk and reply-item indices break overlap ties regardless of response order.
- Ceiling follow-up: the plan freezes the ceilings, hashes them, and applies its frozen read ceiling. Carry the frozen organizer ceiling through the eventual Slice 3 dispatch; the production organizer is currently a no-op. This is not a separate Slice 1 blocker.

## Verification

[Exact code-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44838045348). The synthetic exact-head harness used real `p-limit`, deferred fake transport, and a fake organizer. The fifth provider failure stopped further admission (8 of 12 started), kept the three late successes, and skipped the organizer. No live model calls, local full suite, or live VS Code test were performed in re-review.
