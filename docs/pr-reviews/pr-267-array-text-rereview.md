# PR #267 follow-up review: lists written as text

Reviewed code: `a02b8aa5775e29ce8cfc4f4d5edab28ccf457a55`
Date: 2026-11-17
Reviewer: Chatty

## Verdict

**Review clear for this follow-up. No new blocking findings.** F-01 remains fixed. This is scoped technical clearance, not merge authorization; no merge performed.

## Scope and findings

Inspected every change since the preceding report commit `c2d7e4e6`. The production change is confined to the translator's repeatable-field normalization. A string is expanded only when it parses completely as a JSON array and the mapped field is repeatable. Items then enter the same element construction, XML escaping and codec validation as actual arrays. Non-repeating fields and strings with bracket prefixes or trailing non-JSON text stay literal. Nested arrays and invalid items fail rather than partially executing a list. The earlier provider fault gate still runs before this conversion.

The live-pass account in the PR reports Opus emitted a multi-file `resource.read.path` as a string containing a JSON array. The new tests exercise that translator shape and whole/streamed multi-session execution. This reviewer did not independently perform the live pass.

### Explicit compatibility tradeoff (non-blocking)

A scalar filename that is itself exactly a valid JSON-array string is now interpreted as a list. This is real but narrowly scoped and documented by the author. It does not expand resource authorization: each resulting path remains validated. Local probe verified a literal JSON-array-looking filename survives when explicitly wrapped in a one-element actual array. No recursive decoding of array items is introduced. The standard XML route also remains unchanged.

## Independent validation

- Combined native adapter, provider, engine, codec/persona, visibility-guard and architecture regression run: **12 suites / 436 tests passed**, exit 0.
- Additional local probes: **6 tests passed** for literal-filename escape hatch, textual-list item attributes/unmapped keys, and rejection of null, boolean, object-without-text and nested-array items. One initial probe omitted the codec-required top-level resource group; it was corrected to match the existing grammar, not treated as a product regression. Probes were local only, not production/test changes on the branch.
- Full `npm run typecheck`: **passed**, exit 0 (core, webview, extension).
- Reviewed-head CI run [44082336655](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44082336655) was **in progress**, not yet a verified pass, at publication preparation.
- Existing reviews and author follow-up checked; code head reconfirmed before publication.

## Limits

Reused installed workspace dependencies. Did not independently rerun the entire author-reported suite, lint, package/build, interactive VS Code, or live provider calls. The author reports a live pass for operation names and the new string-encoded multi-path shape; real-array wire emission and memory.read remain unverified live. This report adds documentation only; its CI is distinct from reviewed-code CI.
