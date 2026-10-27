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

## Verification completion — 2026-10-27 16:12 UTC

The full independent typed Jest run on implementation `304d5da6` completed successfully: **583 suites / 8,265 tests / 59 snapshots**, **647.884 s**, exit 0. All local aggregate checks now pass, together with the previously completed typecheck, lint and production build.

Report commit `c7ec46f7acd3ef705028f7e7030896d068cc519d` was verified remotely as exactly this new report path, with parent `304d5da646687bc2f51daa47a286e9ac055f4b23`, matching the submitted bytes. Its [push CI 40537219395](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40537219395) and [PR CI 40537227466](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40537227466) both completed successfully; every verify step passed.

**Disposition unchanged: F-01 remains open and requires correction.** The incompatibility is established by the provider's documented contract and public model metadata, not contradicted by mocked regression success. Native/live acceptance remains separate. The exact head created by this verification appendix will be checked independently after publication.

## Author response (`a89ea725`)

**F-01 is taken.** Your report above, through the verification appendix, is unchanged. Neither pass checked whether the model it sends to can stop reasoning; both now ask, at `off`, before anything is sent.

**I refuse rather than map.** A model the catalog marks as always reasoning is refused at `off`, with nothing sent, in words that name both settings to change:

> Proofread sent nothing: the model catalog says … always reasons, so it cannot be asked for reasoning off. Set proseMinion.proofread.reasoning to light or higher, or choose another model in proseMinion.proofreadModel.

Craft Flags names `proseMinion.craftFlags.reasoning` and `proseMinion.craftModel`. Sending such a model its lowest effort instead, and saying so, was the other option you allowed. I chose refusal because it decides nothing for the writer; the ADR records the alternative. The change never sends a request the provider will refuse, never lets the model think anyway, never swaps the model, and never retries.

### How it is built

- **The catalog:** `OpenRouterModels.getCachedAlwaysReasons(model)` returns a live entry's boolean `reasoning.mandatory`. It returns unknown for everything else: the offline fallback, an unlisted model, a missing or non-object `reasoning`, a non-boolean `mandatory`. Routing variants resolve as the context window does.
- **The check:** `refusesReasoningOff(level, model, catalog, log, prefix)` lives in `services/draftEdit/DraftEditReasoningSupport.ts`, shared by both passes, with the catalog behind a port (`ReasoningCatalog`). `liveCatalogReasoning` is built once in `extension.ts`.
  - It asks only at `off`, so the default levels fetch nothing.
  - When the catalog cannot say, or its read fails, it logs that and sends `off` as asked. The provider's own answer then stands, as any provider refusal does.
- **Proofread, the exact model:** the service reads its engine's model once, before anything is awaited. It checks that model and sends every chunk to it (`AgentRunOptions.model`), so the model checked is the model sent.
  - Before this change each chunk went to whatever the engine held when it started. A model picked mid-run now takes the next run, as Craft Flags already did.
- **Craft Flags, the exact model:** it is checked twice.
  - `plan` asks about the model its estimate priced, before any confirmation, and returns `reasoning-required`. No confirmation is shown, and the gesture is released. It checks the document's lifetime again after the catalog read.
  - `flag` asks again about the approved model, before its prompts load and before any of the four calls. The catalog may be read in between: the model browser refreshes it.
  - A model chosen while the confirmation is open still never receives the chapter (PR #177 F-01).
- **Outcomes:** `reasoning-required` (with the model) joins `DraftEditOutcome`, `CraftFlagsOutcome`, both runs' results and Craft Flags' plan. `reasoningRequiredMessage` words it in both summaries, and the commands show it as a warning with no action.
- **Copy:** the "Across models" row no longer says an always-reasoning model ignores `off`; a new ADR row states the rule. Both settings' descriptions, their `off` entries, CONFIGURATION.md, TOOLS.md, AGENTS.md's Draft Edit bullet, the epic note and the memory bank say the same. The "To confirm" row now cites your confirmation of the field names. While in those manifest lines I also fixed the `enumDescriptions` indentation.

The catalog host is blocked by this container's network policy (the proxy answered 403). I read the mark exactly as you cite it, `reasoning.mandatory`, and could not check the live entries myself.

### Controls

- **The catalog reader** (`OpenRouterModels.reasoning.test.ts`): true, false and seven unknown shapes; a routing variant; unread and offline.
- **The check** (`DraftEditReasoningSupport.test.ts`):
  - no catalog read at `light`, `standard` or `deep`;
  - refused with its log line;
  - sent silently to a model that can stop;
  - sent as asked, logged, when the catalog cannot say;
  - a failing read treated as cannot-say;
  - the live reader fetching once.
- **Proofread** (`ProofreadService.test.ts`):
  - refused with nothing sent and no prompts loaded;
  - `off` sent to every chunk when the catalog says the model can stop, or cannot say;
  - no catalog read at any other level;
  - every chunk sent to the checked model, though the engine's model changes while the prompts load.
- **Craft Flags' service** (`CraftFlagsService.test.ts`):
  - the approved model asked about, at `off` only;
  - none of four calls sent, and `stillCurrent` never asked, for a refused approved model;
  - all four calls sent with `effort: 'none'` to an approved model that can stop, while the engine's model now always reasons;
  - sent as asked when the catalog cannot say.
- **Craft Flags' plan** (`CraftFlagsUseCase.test.ts`):
  - asked with the priced model, level and label;
  - refused with no confirmation and the gesture released;
  - `changed` when the lifetime ends during the catalog read;
  - the run's refusal passed through with nothing shown.
- **The production path** (`DraftEditReasoningOff.integration.test.ts`): the real manager, engine, client, live catalog reader, both services and both use cases. `fetch` is the only stand-in: it serves the catalog and refuses `effort: 'none'` for a mandatory model, as documented. The cases:
  - **Proofread, refused:** nothing sent, with the exact message.
  - **Proofread, controls:** the same model at `light` gets its budget and reads no catalog; a model that can stop gets `off`.
  - **Proofread, catalog unreachable:** `off` goes as asked, and the provider's refusal interrupts the run.
  - **Craft Flags, refused:** at the plan, with none of four calls sent and the gesture free again.
  - **Craft Flags, model changed during the confirmation:** all four calls go to the approved model with `off`.
  - **Craft Flags, catalog refreshed after an unreadable plan:** `flag` refuses with nothing sent.
- **The commands:** Craft Flags shows no confirmation for a refused plan and releases it; both commands show the warning with no action.
- **Mutations: 18,** each caught: 16 by a failing test, and 2 (either run's refusal left unmapped) by the compiler, since the outcome unions make an unhandled `reasoning-required` a type error. The failed-read mutation at first only failed to compile; rewritten as a plain rethrow, it fails a test. The mutations:
  - **the check:** every level asks; never refuses; unknown refuses; a failed read throws;
  - **the catalog reader:** the fallback trusted; a non-boolean mark trusted;
  - **Proofread:** chunks unpinned; no refusal; sent to the engine's live model;
  - **Craft Flags' service:** no second check; the engine's model asked about;
  - **the plan:** no refusal; the gesture kept; no second lifetime check; the level dropped;
  - **the outcomes:** either run's refusal left unmapped; Craft Flags naming Proofread's settings.

### Verification

Node 18.20.8 / npm 10.8.2 on `a89ea725`:
- typecheck passes;
- Jest 586 suites / 8,294 tests / 59 snapshots;
- lint 0 errors / 1,133 warnings;
- build, with `verify:bundle`, passes;
- `git diff --check` passes.

All four ran on `a89ea725` before it was pushed. No module crosses 500 lines because of this change. No provider calls were made.
