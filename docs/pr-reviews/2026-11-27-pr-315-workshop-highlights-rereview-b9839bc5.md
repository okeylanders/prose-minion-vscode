# PR #315: Workshop persona highlights re-review

- Reviewer: independent Astra 6.2
- Target: `epic/workshop-persona-highlights` at `b35bfb5bac685d5e29daa6670586d99aa6364fe5`
- Reviewed head: `b9839bc5145fddbc9ec25b77f648746cbe822222`
- Verdict: **Approved for merge into the epic for this slice.**

Both prior findings are resolved. With #314's gesture-start guard, the service tracks the last source tab across editor groups, cancels the pending gesture even with a cached model, and checks again before draw. A new Show can still reopen the file. Dismiss choices retain exact diagnostic IDs and distinguish overlapping annotations by text or numbered targets.

## Verification

Astra independently inspected the exact-head code, the #314 route contract, and the regression cases. No local regression rerun, native VS Code or live model run. [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45922682601) passed.
