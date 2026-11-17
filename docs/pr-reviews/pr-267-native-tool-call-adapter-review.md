# PR #267 review: native Workshop tool-call adapter

Reviewed code: `39135cdefad47db7e78b12fea4e70c524fbf5895`
Base: `1648b16f97430a434c289346657eedc5c5e47bdb`
Date: 2026-11-17
Reviewer: Chatty
Verdict: Changes recommended for one provider-boundary correctness issue. Not a merge authorization.

## F-01 · P2 · Reject malformed/overflowed argument payloads instead of executing their repaired prefix

Location: `packages/core/src/infrastructure/api/providers/OpenRouterToolCalls.ts:70–73` (also initialization at line 60).

The assembler silently ignores an explicitly present non-string `function.arguments`, leaving the initialized empty string. The translator intentionally accepts empty strings as no arguments. For example, a whole response carrying `transcript.catalog` with `arguments: {match: "6.11"}` becomes a valid unrestricted catalog request, rather than preserving the filter or taking the unsupported-call correction path. This applies to malformed wire payloads, not the normal OpenAI-compatible string representation.

The size bound has the same fail-open class: the comment assumes truncation always makes JSON unparseable, but `'{}'.padEnd(200_000, ' ') + 'invalid tail'` is invalid JSON before assembly and valid `{}` after assembly. The codec then accepts and executes a request that the original payload did not validly specify. A later malformed/oversized streaming fragment must invalidate the entire pending call, not leave an earlier valid prefix executable.

Track invalid/overflow state per pending call and preserve a non-executable failure through to the engine's correction path (including when finish reason is not `tool_calls`). Do not erase explicit invalid values or truncate into potentially executable JSON. Keep the intentional genuinely empty/no-argument convention separate. Add whole-response and fragmented-stream regression cases.

### Reproduction

Two independent local Jest probes passed, demonstrating the current behavior:

1. `readOpenRouterToolCalls([{type: 'function', function: {name: 'transcript.catalog', arguments: {match: '6.11'}}}])` followed by the translator and real XML codec returns `{kind: 'request', request: {capability: 'transcript.catalog'}}`.
2. Replace arguments with `'{}'.padEnd(OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters, ' ') + 'invalid tail'`. Direct `JSON.parse` throws, but the same pipeline returns the unrestricted catalog request above.

These are boundary-hardening/correctness failures; they do not bypass the operation allowlist or grant a write capability. The probes were local review tests, not production changes.

## What was checked

- No prior PR comments or reviews at review start; head rechecked before publication.
- Provider whole/streamed extraction, index assembly, server-tool filtering, name mapping, scalar/plural/attribute argument mappings, XML escaping, codec rejection, retained history, correction and capability budgets, and visibility guard integration.
- Existing tests exercise all operation mappings and repeating `paths`, `sessions`, and `memories` representations. Unsupported shapes are generally rejected by the translator, subject to F-01 at the earlier provider boundary.
- The orchestration seam remains operation-agnostic and the codec remains the validation owner. No additional ordinary-path blocker found.

## Independent validation

- Focused native adapter/client/engine/architecture run: **6 suites, 215 tests passed**.
- Related codec/persona/client/stream-guard/engine regression run: **10 suites, 330 tests passed**. These runs overlap; do not add their totals.
- Two additional boundary repro tests: **2 passed**, reproducing F-01.
- Complete `npm run typecheck`: **passed** (core, webview, extension).
- GitHub CI for reviewed code: **success**, run [44008173049](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44008173049).

## Limits

Reused the workspace's installed dependencies; no fresh install. Did not rerun the full 12,410-test author-reported suite, lint, package build, interactive VS Code smoke, or billable live-provider calls. Actual provider-selected unadvertised function names and repeated-field shapes remain unverified. Tests show behavior for the supported wire shapes, not that every provider emits them. Prose beside an untranslatable call is deliberately left standing by this PR, not retried; this is an explicit documented product choice, not an independently verified user experience.
