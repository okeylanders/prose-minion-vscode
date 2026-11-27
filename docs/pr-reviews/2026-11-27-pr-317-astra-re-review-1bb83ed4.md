# Astra 6.2 re-review: PR #317

- Code head: `1bb83ed4df7e699672e93054da1db0f1c0dc5a86`
- Base: `epic/workshop-persona-highlights` at `49164024c506a4155b1a25c636362a2fa6b7fabb`
- Verdict: No blockers. Both prior P2 findings are resolved.

Project and recall reads now charge the delivered-body allowance only once the engine admits the result, and a withheld result does not prevent a narrower retry. Recall still enforces its independent attempt cap. The replacement notice retains the warning that sibling native calls did not run; if the full replacement cannot fit, the engine doesn't dispatch it.

Astra independently passed 218 tests across six relevant suites, core typecheck, and a diff whitespace check in a source-equivalent tree with the changed blobs verified. The mocked integration covered admission, retries, attempt limits and native warning delivery. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/46026037969). No live provider or native UI test.
