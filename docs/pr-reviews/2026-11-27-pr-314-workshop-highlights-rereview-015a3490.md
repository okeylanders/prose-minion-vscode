# PR #314: Workshop persona highlights re-review

- Reviewer: independent Astra 6.2
- Target: `epic/workshop-persona-highlights` at `b35bfb5bac685d5e29daa6670586d99aa6364fe5`
- Reviewed head: `015a3490a06c4013e1a48c069d5811623b9dfe59`
- Verdict: **Approved for merge into the epic for this slice.**

The Show guard starts before asynchronous authorization, tracks the resolved source even when its path changed, and remains active through reveal and draw with #315 at `b9839bc5`. It is disposed in `finally`. Closing the source's last tab invalidates the older Show without blocking a later intentional Show.

## Verification

Astra independently inspected the exact-head guard, the #315 contract and the new regression coverage. No independent native VS Code or live model run. [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45922609051) passed.
