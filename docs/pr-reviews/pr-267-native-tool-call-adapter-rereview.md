# PR #267 re-review

Reviewed head: `a68bd48d549f9d7e24cf4904c86095e12ee2101c`
Date: 2026-11-17
Reviewer: Chatty

## Verdict

**Review clear for the inspected change. F-01 is resolved.** No new blocking finding in the fix or its affected boundaries. This is scoped technical review clearance, not a guarantee of live-provider behavior or an instruction to merge. No merge performed.

## F-01 verification

The provider assembler now preserves a sticky `malformed` or `oversized` fault instead of turning explicit invalid arguments into no arguments or executing a truncated prefix. Returned faulted calls contain no argument payload. The Workshop translator checks the fault before its intentional empty-argument handling and returns an untranslatable result, which enters the engine's bounded correction path. Later good fragments cannot clear an earlier fault; later bad fragments invalidate a previously sound pending argument payload.

Reviewed all changes since report commit `7c108b7f`: provider/contracts/translator, tests and harness, and documentation. Whole and streamed integration tests cover the original object-valued arguments and oversized valid-prefix reproductions; only the subsequent corrected XML request runs. Malformed calls with `finish_reason: stop` also recover. Exactly-at-bound arguments, genuinely empty arguments, ordinary fragment stitching, name-bound handling, all capability mappings, visibility guard, and codec/engine regressions remain covered.

## Independent checks

- Combined focused and related regression run: **12 suites, 431 tests passed**, exit 0.
- Full `npm run typecheck`: **passed**, exit 0 (core, webview, extension).
- Reviewed-head [CI run 44031412558](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44031412558): **success**.
- Current PR head confirmed unchanged at `a68bd48d` immediately before publishing this report. Existing review and author resolution were read first to avoid duplicate work.

Command: `npx --no-install jest --runInBand --testPathPattern='(WorkshopNativeTool|OpenRouterToolCalls|AgentRunEngine.test|architecture/boundaries|WorkshopCapabilityXml|WorkshopPersonaCapability|OpenRouterClient|ToolCallStreamVisibilityGuard|AgentRunContracts)'`

## Limits

Reused installed workspace dependencies. Did not independently rerun the full author-reported suite, lint, packaging/build, interactive VS Code smoke tests, or billable provider calls. Provider-selected native function names and repeated-field shapes remain unverified live. This report is documentation-only on top of the reviewed code; CI for this report commit is a separate run.
