# PR #270 review: Lexical Gravity JSON repair

- Reviewed: 2026-11-17
- PR: https://github.com/okeylanders/prose-minion-vscode/pull/270
- Code head: `951923a6ec697a0cc18eef4b76b7fca24eccf151`
- Base: `3f99e73399b490cbfd6be34e40811a31ab65e8aa`
- Verdict: **Review clear: no actionable correctness or security findings in this diff.**
- Publication: report only; no implementation changes or merge.

## Scope and findings

Reviewed all 11 changed files and the connected parser, validation, candidate selection/save and rejection-recovery paths.

| Area | Result |
| --- | --- |
| Shared parser adoption | Both frame-bounded readers delegate to the shared parser; output-limit rejection and semantic validation remain. Missing-closing-bracket inference is not enabled. |
| Feature-local attention repair | The token-based repair handles the reported two-lens failure, preserves scalar content/order, and requires the resulting text to parse. It does not add schema knowledge to the generic parser. Lookalike text within strings and unsupported shapes are left alone. |
| Partial candidate acceptance | Each of the first three candidates is validated independently; invalid/duplicate variants are omitted. Remaining candidates retain their original IDs, and save selection resolves by those IDs rather than dense array positions. Zero usable candidates still follows rejection/recovery. |
| Host/webview contract | Both build paths forward the optional host-generated note; the UI renders it as text with status semantics. Persistence formats and saved lenses are unchanged. Existing abort/stale-result and selection boundaries remain. |
| Logging | New repair and partial-result logs contain repair kinds and counts, not model content. Existing bounded rejected-body logging is unchanged and is not a new finding. |

## Verification

- `npx jest --runInBand --testPathPattern='LexicalGravity|boundaries.test'`: **12 suites, 214 tests, 1 snapshot passed**. Includes parser, model service, handler, hook, repository/config and modal tests, plus architecture boundaries.
- `npm run typecheck`: **passed** for core, webview and extension.
- `npm run lint`: **passed with 0 errors and 1,175 warnings**. This is not a warning-free lint result.
- Exact-code-head GitHub Actions CI: **success**, [run 44089463552](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44089463552).
- An initial broad Jest invocation was stopped after the focused run completed; no local full-suite pass is claimed.

## Limits and intentional behavior

No live model or Extension Development Host run was performed. Modal behavior was checked through jsdom tests and source review, not a visual/manual host session. Balanced replies with `backgrounds` last in `logic` are intentionally not guessed into shape; malformed individual lenses are still subject to validation. Lenses past the third are ignored/count-logged, and partly usable replies are not persisted to rejected-response recovery, as specified.

This is a technical review conclusion for the code SHA above, not a merge action or a claim that repository protection requirements have been independently enumerated. Any subsequent code changes need a new review.
