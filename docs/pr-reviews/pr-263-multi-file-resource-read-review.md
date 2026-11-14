# PR #263 review: Multi-file resource reads

- Reviewed: 2026-11-14
- Code head: `206aa837dfbfe38bdea742f05000dabdab272d65`
- Base: `08542fad95390ce70bc6738f28d56eb2d67813e0`
- PR: https://github.com/okeylanders/prose-minion-vscode/pull/263
- Outcome: **No blocking findings in the reviewed scope.** Scoped code-review clearance, not an instruction to merge.

## Scope and assessment

Reviewed the #259 ADR implementation: XML forms and refusals, per-file resolution and failure isolation, whole-line packing and fair allocation, known-window evidence fit, unknown-window per-turn total, continuation progress, persona integration, and host-private per-file provenance. An independent second inspection covered the codec/persona/provenance seam.

Continuation calls advance the starting line or reduce the number of named files. The long-line case does not repeat its own request; a short line followed by an oversized line deliberately takes an ordinary continuation before the next result explains skipping the unreadable line, as D2a specifies. Default 400-line stops also offer continuation. Failed files have no delivered-source row; successful files retain their own ranges and fingerprints linked to the single card. Fingerprints are not exposed in model evidence or card metadata. The production resource provider catches individual filesystem read failures, allowing the other files to succeed.

The fit measures escaped rendered text and metadata. Known windows use the half-window fit without a cumulative byte total; unknown windows share the 256 KiB per-turn payload ceiling. Minimums based on readable selected windows avoid refusing tiny files or charging missing ones a full minimum.

## Answer to the per-file cap question

**Keep the current shared-budget semantics for this PR.** ADR D5 reserves 64 KiB for a one-path read and explicitly gives a multi-file read a shared 256 KiB limit with unused shares redistributed. It does not impose a separate 64 KiB cap on each multi-file member. Adding such a cap would change the agreed throughput model, not repair a demonstrated safety defect; the context fit and source ceiling still apply.

The asymmetry is real: a 70 KiB whole line can be delivered with another small file but is refused alone. A temporary independent regression witness confirmed both outcomes. Consider preserving that witness as a permanent contract test or explicitly documenting the asymmetry before a future budget change. It was removed after verification; this review changes no product code or tests.

## Independently executed verification

- Focused resource, persona, codec, recall-read and shared-fit/allocation Jest run: **14 suites / 205 tests passed**.
- Architecture boundaries, prompt-budget and prompt-sync suites plus the temporary cap witness: **4 suites / 108 tests passed** (107 existing tests and 1 temporary witness).
- `npm run typecheck`: passed for core, webview and extension.
- `npm run lint`: passed, **0 errors / 1,170 warnings**. Warning delta from base was not independently established.
- `npm run build`: passed locally.
- GitHub CI succeeded on the reviewed code SHA, including install, typecheck, tests, lint and build: https://github.com/okeylanders/prose-minion-vscode/actions/runs/43631486359.

## Limits

The full suite count in the PR body was not independently rerun locally. No live model/provider or VS Code Extension Development Host smoke test was performed. In particular, multi-file continuation behavior across real engine turns, round-trip count improvement, and capability-card continuation rendering remain useful manual release checks. The fits-alone estimate is intentionally not a guarantee that the next read will fit after all intervening turn overhead; its progress invariant prevents a repeated identical continuation.

No merge performed. This report is the only branch change made by this review.
