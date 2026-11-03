# Branch review: Workshop Wayfinding Slice 6, model stamps

## Scope and disposition

- **Branch:** `epic/workshop-wayfinding-slice-6-model-stamps`, targeting `epic/workshop-wayfinding`.
- **Reviewed implementation head:** `1aa185808a5eb2adffff710d93f402abb64f5489`.
- **Base and merge-base:** `fddc4849cd7dc418a600116c14752488746b81ff`.
- **Implementation tree:** `da449641bc94369bf4c7af25810645aec9187c50`.
- **Scope:** four commits, 22 changed files, +1,051 / -26. Reviewed 2026-11-03.
- **Disposition: changes requested in this report.** Two P2 provenance findings, F-01 and F-02. N-01 is a separate scope decision.

The additive contract, strict codec, copied arrays and seven listed adoption paths fit the existing ownership boundaries. Existing tests and exact-head CI pass. The two findings concern the meaning of a stamp at the real provider boundary, which the new engine tests mock out.

This is a report-only branch review, not a formal GitHub approval or request-changes submission. No implementation fixes, merges or paid provider calls are part of this review.

## Findings

### F-01: P2: distinguish a reported serving model from the requested-model fallback

**Changed location:** [`AgentRunEngine.ts:392-394`](../../packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L392).

**Supporting boundary:** [`OpenRouterClient.ts:224-232`](../../packages/core/src/infrastructure/api/providers/OpenRouterClient.ts#L224), [`OpenRouterClient.ts:298-320`](../../packages/core/src/infrastructure/api/providers/OpenRouterClient.ts#L298).

The new collector assumes `InferenceRequestObservation.modelId` is always provider-reported. The real client instead uses `data.model || requestedModel` for a non-streaming reply and initializes the streaming `responseModel` to the requested model. Those fallbacks were suitable for existing context telemetry, but are not evidence of which model served a reply.

Reproduction with the real `OpenRouterClient` and `AgentRunEngine`, mocking only HTTP transport:

1. Request `openrouter/auto`.
2. Return an ordinary successful answer and valid usage, but omit the response's `model` field. For streaming, omit `model` from every frame and finish normally with usage.
3. Both modes return `models = { requestedModelId: 'openrouter/auto', servedModelIds: ['openrouter/auto'] }`.

The required served list is empty: the provider named no serving model. The resulting stamp currently persists an invented serving identity, contrary to D7 and the checked completion criterion that served models are provider-reported. A router identifier is particularly misleading as the asserted serving model. Later display/export code cannot recover whether this value was observed or guessed.

**Requested correction:** carry an explicit optional provider-reported identity, or an equivalent reported/unknown distinction, from the client to the collector. Preserve the existing context-budget fallback separately. Only actual reported identities may enter `servedModelIds`. Add real-client/real-engine controls for both streaming modes: model absent with usage present, model present with usage present, and multi-call deduplication.

**Related boundary limitation, not an additional blocking finding:** a model reported on the wire is currently lost if usage is absent, because observations are usage-gated. Both modes reproduce `servedModelIds: []` despite a wire `model: 'vendor/served-model'`. The slice plan explicitly allows requests without observations to add nothing; keep that distinction explicit when choosing the correction. A separate reported-model field could preserve this evidence without making usage mandatory.

### F-02: P2: exclude host-written failure text from provider-reply stamps

**Changed locations:** [`AgentRunEngine.ts:590`](../../packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L590), [`AssistantToolService.ts:201-208`](../../packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts#L201), [`WorkshopRunCompletion.ts:300-312`](../../packages/core/src/application/services/workshop/WorkshopRunCompletion.ts#L300).

The engine now returns models whenever it has a requested model, including when it substitutes its own failure message for an unusable reply. `assistantRunModel` and `completeWorkshopRun` then stamp that host-written message without checking its origin.

Reproduction through the real client, engine, completion function and session aggregate:

1. Return `{ model: 'vendor/selected', usage: ..., choices: [{ message: { content: null }, finish_reason: 'stop' }] }` from mocked HTTP transport.
2. The client normalizes the content to `''`. At [`AgentRunEngine.ts:542-545`](../../packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L542), the engine supplies `The assistant returned no usable final response. Please try again.`
3. Map the execution result into the same `AnalysisResult` fields as `AssistantToolService`, then settle it through `completeWorkshopRun`.
4. The committed error turn carries `{ scope: 'assistant', requestedModelId: 'vendor/selected', servedModelIds: ['vendor/selected'] }`.

No provider wrote that displayed reply. This contradicts the provider-produced-only rule and the slice's own explicit reason for leaving a failed persona-analysis turn unstamped: its content is a host error. The engine's exhausted-correction and exhausted-capability fallbacks have the same unconditional stamp path.

**Requested correction:** preserve an explicit usable-provider-reply versus host-fallback outcome through the result boundary, and apply a turn stamp only to the former. Avoid recognizing host failures by their English text. This finding does not require redesigning the pre-existing decision to retain a host failure turn; it requires that the new provenance not attribute that text to a model. Cover empty/null replies and exhausted recovery, with ordinary and retained partial-provider replies as positive controls.

## Nonblocking decision

### N-01: reconcile Dictionary's exclusion with the completion claim

The author explicitly records that `dictionary.lookup` and `dictionary.full-entry` assistant turns remain unstamped in [the slice's deviations](../../.todo/epics/epic-workshop-wayfinding-2026-11-03/slice-6-model-stamps.md#built) and [a dedicated debt item](../../.todo/tech-debt/2026-11-03-workshop-dictionary-turn-model-stamps.md). `WorkshopPersonaCapability` sends these through `recordCapabilityArtifact` without a model; a new test deliberately pins that behavior.

This is disclosed scope, not an undisclosed implementation omission. It nevertheless conflicts with the broad checked criterion, "Every provider-produced assistant turn carries `model`." Decide whether D7 includes Dictionary turns, then either stamp them with `scope: 'dictionary'` or explicitly narrow the ADR and completion criterion. The same-scope rule planned for Slice 7 already distinguishes them from assistant-scope changes. Resource and recall turns correctly remain unstamped because they make no provider call.

## Architecture, persistence and concurrency review

- **Capture and ownership:** requested identity is captured immediately before the first inference dispatch, not at commit. Served identities are local to each engine invocation and copied into results. Mid-run model changes, initial/continued runs and explicitly pinned models are covered by the focused engine tests. This does not newly pin every later request to the initial selection; the slice deliberately records the first requested model and each observed serving model.
- **Adoption:** host replies, guest admission/replies, direct tool-sidecar replies, writer tool reports, host syntheses and persona-run analyses all thread the model through their existing adoption owners. No independent stamp state or second commit owner was added. Persona-analysis provenance travels beside evidence, not inside it.
- **Persistence:** `cloneTurn` recursively copies record fields, including model arrays. Checkpoint equality compares the fully decoded JSON shape, so stamps are included without a new field-specific comparison. The strict codec permits only known scopes, nonempty requested/served IDs, distinct served IDs, and assistant-role stamps. Released V1/no-stamp fixtures still round-trip without added fields. Forward-only compatibility is the explicitly accepted D9 choice.
- **Isolation:** the supplied integration test exercises prompt, room catch-up and room-frame construction without stamp leakage. Transcript projection still selects fields explicitly. JSON/Markdown/HTML export and visible model slices remain Slice 7 work, not missing Slice 6 implementation.
- **Boundaries:** no production `vscode` imports were introduced into core. Existing oversized modules grow only at the small result/parameter seams documented by the author. No new infrastructure owner or unrelated mutation path was found.

## Independent verification

Reviewed `AGENTS.md`, the Wayfinding ADR, the slice plan and recorded deviations, every changed production/test file, and adjacent provider, persistence, clone, equality and completion code. Tests ran in an isolated exact-head worktree using **Node 24.22.1 / npm 11.9.0 / Jest 29.7.0**. Reused dependencies match the unchanged lockfile; no dependency installation or update was needed.

| Check | Result |
| --- | --- |
| Full repository typed Jest, `--runInBand` | Pass: **595 suites / 8,432 tests / 59 snapshots**, 414.465 seconds, exit 0 |
| New model-stamp suites | Pass: **4 suites / 34 tests**; included in the full total |
| `npm run typecheck` | Pass: core, webview and extension |
| `npm run lint` | Pass: **0 errors / 1,133 warnings** |
| `npm run build`, including `verify:bundle` | Pass, exit 0; three webpack size/performance warnings |
| `git diff --check` for the implementation diff | Pass |
| Exact implementation-head push CI, Node 18 | [Success: run 41724363696](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41724363696) |

Independent probes are separate from repository counts: two positive explicit-model controls pass; two absent-model assertions reproduce F-01; two reported-model/no-usage assertions reproduce its disclosed limitation; one host-fallback assertion reproduces F-02. The five failing probe assertions are expected-behavior counterexamples, not five passing acceptance tests. HTTP responses are synthetic; production provider parsing and orchestration are exercised without a paid call. The F-02 probe uses the production completion/aggregate and an explicit copy of the service's simple result-field mapping.

Native VS Code activation, live-provider response quality and Slice 7 UI/export acceptance were not exercised. Only this review report is to be published; scratch probes/logs remain outside tracked source. Corrections require a fresh delta review and exact-head verification. Green regression tests and CI do not resolve F-01 or F-02.
