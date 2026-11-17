# PR #269 specification re-review

Reviewed revision `b22d1c82162be083c4ea9a17a947c529ea3e84c1` against the previously reviewed spec and report (`adb991b35c67641e032f909aef7588eecaab5648`).

## Verdict

Both original P2 findings are resolved at the specification level. No remaining blocking findings in this documentation revision. This does not validate implementations that will follow, accept Q1–Q7 on the owner's behalf, or merge the PR.

- **F-01 resolved:** D13 now requires typed settlement verdicts as well as extractor rejections, an exhaustive reason mapping, and conservation of frames across cards/refusals/drops. D14 maps settlement drops to fixed phrases. Both normal reply and edit-offer completion paths use one builder. The test plan explicitly exercises settlement drops through the next-message outcome, with privacy and conservation assertions.
- **F-02 resolved:** D10 removes the 50-page ceiling, defines a shared nine-digit positive-decimal page domain, emits a continuation only when a later page exists, and defines past-end behavior. Nine digits cover the maximum array-backed listing at both specified page sizes. Tests explicitly include the 2,001-note walk and decoding each continuation. D17 uses the same parser for lenses.
- The revision also makes stale earlier-turn walks discard old responses and evict removed turns, and marks product defaults as open orchestrator choices rather than owner decisions.

## Validation and limitations

Read both changed documents and compared the settlement design with the current memory-edit implementation. `git diff --check` passed. Independently checked the array/page arithmetic: maximum pages are 107,374,183 at 40 items and 85,899,346 at 50, both within 999,999,999. Exact revised-head CI succeeded: https://github.com/okeylanders/prose-minion-vscode/actions/runs/44100850222

Docs-only: no local application tests or visual runtime pass. The specified tests remain obligations for implementation slices. The report itself is a documentation-only follow-up commit; its CI may run separately.
