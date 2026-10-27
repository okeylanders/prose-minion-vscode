# PR Review — Draft Edit reasoning levels

**Disposition: Changes requested — one P2 model-compatibility finding.**

**Author:** okeylanders · **PR:** [#181](https://github.com/okeylanders/prose-minion-vscode/pull/181) · **Reviewer:** Astra · **Reviewed:** 2026-10-27

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Implementation head:** `304d5da646687bc2f51daa47a286e9ac055f4b23`

**Base and merge-base:** `b24bdd04c8368f98d75bd9ddc9c96275bf6269cf`

**Scope:** 38 files · +778 / −56 · implementation tree `877610acd09ba7f9d50fbbe66ea03442c6ec348a`

## Summary

The request-local level, separate output headroom, diagnostic-only reasoning count and unchanged truncation rejection fit the existing architecture. The two pass defaults, manifest enums, command snapshots, estimates and dispatch options agree. No document-writing or persisted-usage format changes are introduced.

The missing piece is model compatibility for `off`: OpenRouter's current contract explicitly distinguishes models that reject disabling reasoning from models that accept it. This PR always sends the disabling request, even for selectable models known to reject it. Green mocked tests do not establish that this setting works across those models.

## Findings

### F-01 · P2 · Do not dispatch `off` to a model that rejects disabling reasoning

**Location:** [`ReasoningRequest.ts:26–30`](../../packages/core/src/infrastructure/api/orchestration/ReasoningRequest.ts#L26), consumed by both Draft Edit services.

`reasoningRequest('off', replyTokens)` always produces `reasoning: { effort: 'none' }`. Neither service nor the engine checks whether the selected model accepts disabling reasoning.

OpenRouter's [per-model reasoning documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#discovering-per-model-reasoning-options) says a model with `reasoning.mandatory: true` rejects `effort: 'none'`; clients should not send it. This is not an ignored preference. The [official model catalog](https://openrouter.ai/api/v1/models), checked 2026-10-27, supplies concrete choices already in this repository:

| Selectable model | Repository entry | Catalog reasoning capability |
| --- | --- | --- |
| `anthropic/claude-sonnet-5.5` | `OpenRouterModels.ts:525–528` | `mandatory: true`; efforts `max`, `xhigh`, `high`, `medium`, `low` |
| `google/gemini-3.5-flash` | `OpenRouterModels.ts:693–696` | `mandatory: true`; efforts `high`, `medium`, `low`, `minimal` |

**Reproduction:** choose either model, set the pass's reasoning setting to `off`, then run Proofread or approve Craft Flags. The production service → engine → client path sends `effort: 'none'` unchanged. A controlled transport implementing the documented rejection yields one interrupted/unsent Proofread chunk, or four interrupted/unsent Craft Flags calls, with no usable findings. The same harness at `light` takes the success path. This confirms the request and error-handling path; it is **not** a claim that a live paid inference was performed. The incompatible provider behavior is established by the official contract and live public metadata.

**Requested correction:** resolve compatibility against the exact selected/approved model before dispatch. For a known mandatory model, either refuse this unsupported combination locally with an actionable explanation, or use an explicitly decided and honestly disclosed supported minimum. Do not silently promise `off` while increasing reasoning, change the consented model, or add an automatic paid retry. Cover both passes, all four Craft Flags calls, model changes during confirmation, and unavailable/missing capability metadata. Update the ADR/setting copy: always-thinking models cannot universally be described as simply ignoring `off`.

The current default models are not examples of this incompatibility; the finding concerns valid selectable alternatives plus the new advertised setting. Approximate conversion of other named levels into provider efforts is an accepted design choice, not a separate finding.

## Architecture and behavioral review

- **Settings ownership:** unknown values, including inherited-property names, normalize to the pass default. Commands read levels at the gesture; Craft Flags carries the same level into pricing and the held run. Its approved model remains pinned.
- **Budgets:** every non-off level adds its budget to the pass's reply allowance; `off` leaves the original allowance. Context preflight receives the complete allowance. Transport serializes the internal `maxTokens` only as `reasoning.max_tokens` and retains the existing effort/exclude behavior.
- **Scope isolation:** a later request on the same engine/client with no reasoning option sends no reasoning field. No mutable model-level thinking setting is introduced; following the Assistant model shares the model id, not a Draft Edit level.
- **Telemetry:** both response paths carry valid whole, nonnegative reasoning counts independently of `TokenUsage`; streamed usage in a separate terminal frame survives fragmented SSE input. The engine returns final-call telemetry. Both Draft Edit policies remain single-call, capability-free, so this count aligns with their output usage.
- **Rejection and recovery:** `finishReason: 'length'` remains rejected, even when its JSON is syntactically complete. Exactly half the output counted as reasoning takes the ordinary wording; more than half takes the thinking explanation. The actual combined ceiling is named. Missing telemetry is not invented; no extra persisted usage fields are added.
- **Cost:** the four-category estimate adds half the named budget to each typical reply, including zero for `off`. This is an explicit estimate, not a cost cap or a claim that every provider consumes that amount.
- **Boundaries:** core gains no VS Code import, adapter imports use the core barrel, and new responsibilities have small shared owners. No newly changed module crosses 500 lines; the four pre-existing oversized modules receive narrow additions.

## Independent verification

Read `AGENTS.md` (the `.ai/central-agent-setup.md` symlink), the Draft Edit ADR amendment, changed implementation/tests and adjacent orchestration/lifecycle contracts. No repository `.agents/skills` directory or dedicated review template exists; this follows the existing `docs/pr-reviews` format.

The isolated cloud worktree matches the exact implementation head/tree. Retained dependencies were reused after matching lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; workspace aliases resolve this checkout. Checks use **Node 18.20.8 / npm 10.8.2**.

| Check | Independent result |
| --- | --- |
| `npm run typecheck` | Pass: core, webview and adapter |
| `npm run lint` | Pass: 0 errors / 1,133 existing warnings |
| `npm run build`, including `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full typed repository Jest (`--runInBand`) | Running at initial report publication; final result will be appended |
| `git diff --check` | Pass |
| Exact implementation-head push CI | [Success, 40534643003](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40534643003) |
| Exact implementation-head PR CI | [Success, 40534779181](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40534779181) |

Additional scratch controls, separate from repository counts: **31 production-path scenarios**, including 36 chunk/category calls across all levels, four estimates, same-engine scope isolation, six streaming fragment sizes with separate terminal usage, four ceiling/telemetry boundaries, and both models × both passes × off/light for F-01's controlled provider contract. The actual installed `p-limit` is used. No live inference is reached: global transport is replaced with controlled responses and public-domain-style synthetic sentences.

The official [reasoning documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) was reachable and confirms `reasoning.max_tokens`, `effort: 'none'` where supported, and `usage.completion_tokens_details.reasoning_tokens`. Thus those field-name checks need not remain an unknown. It also describes Gemini 3 budget-to-level mapping; do not treat a provider family name as proof of an exact thinking cap.

Evidence/logs remain outside the repository in `../pr181-review-evidence/`. Only this report is published. No implementation/test/dependency changes, earlier-report rewrites, formal GitHub reviews/comments, connected-Mac access, merges, releases or paid provider calls were made by the reviewer.

## Integration and remaining acceptance

**Resolve F-01 before integration.** Corrections need delta review and exact final-head CI verification. This report is not a formal GitHub review submission.

Native VS Code setting/Output/recovery presentation and the writer's live `off`/`light` acceptance on supported models remain unrun. Documentation and mocked transport establish the protocol, not model-specific adherence, editorial quality or actual cost. The narrowly accepted native Refactor Preview lifetime race from PR #172 is unrelated to this request-construction issue.
