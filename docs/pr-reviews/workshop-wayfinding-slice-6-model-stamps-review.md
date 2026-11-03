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


## F-02 correction note: completion-stage widget fallback

The engine is not the only place that can replace a provider response with host-written text. In [`WorkshopRunCompletion.ts:290–312`](../../packages/core/src/application/services/workshop/WorkshopRunCompletion.ts#L290), a widget-only response has its control block stripped; if no display text remains, completion supplies a host-written accepted or rejected widget fallback and then passes `workshopTurnModelOf(result.model)` to `completeRun`. An engine-only usable-reply flag would still stamp that substituted text. Please cover both widget-only outcomes at the completion boundary, alongside a provider-written accompanying note as a positive control. This is another path for F-02, not a separate finding. The correction has not yet landed at `0c987cf6`.

## Author response (2026-11-03)

All three, and the F-02 correction note, are addressed on top of this
report's commits `0c987cf` and `2961283`:

- **`623a4be`** fixes F-01 and F-02. Their changes share the engine's result
  boundary.
- **`7e0b534`** fixes the completion-stage path from the F-02 correction note.
- **`174012c`** resolves N-01. The coordinator decided to stamp Dictionary
  turns. D7 gains one bullet, "Dictionary lookups a persona runs, with scope
  `dictionary`", and the tech-debt item that held the question is removed.
  This report's link to that item is now historical.
- **The commit that adds this response** updates the slice doc and the epic's
  progress notes.

Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** | **Served ids are only models a response named.**<br>• `OpenRouterClient` reports `servedModelId`: the response's `model` when it is a non-empty string, otherwise nothing. Non-streaming returns it on the result. Streaming puts it on every content chunk and the terminal chunk once a frame named it.<br>• The engine fills `servedModelIds` only from `servedModelId`, deduplicated in first-use order.<br>• `InferenceRequestObservation.modelId` keeps its `data.model \|\| requestedModel` fallback, so context-budget telemetry and the cache window are unchanged.<br>**On the related limitation:** the reported model no longer depends on the usage-gated observation, so it survives missing usage. Because it rides on content chunks, it also survives a stream the provider breaks off after content. | `AgentRunEngine.replyProvenance.integration.test.ts` (new, 23): real `OpenRouterClient` and `AgentRunEngine`, only `fetch` mocked, both modes. Each mode covers:<br>• model absent, usage present → `[]`<br>• model present, usage present → `[model]`<br>• model present, usage absent → `[model]`<br>• multi-call de-duplication across capability rounds<br>• two named models in first-use order<br>Streaming also covers an interrupted stream, which keeps its named model.<br>`AgentRunEngine.modelStamps.test.ts`: its mocks now report `servedModelId`, and its "no observations" case is "no response named a model". | `623a4be` |
| F-02 | P2 | **Fixed** | **Only a provider reply is stamped.**<br>• `ExecutionResult` and `AnalysisResult` carry `replySource` (`InferenceReplySource`): `provider`, or `host-fallback`.<br>• The engine marks the turn result it substitutes (`hostFallback`), never its text. It marks three cases: an empty or null reply, exhausted correction turns, and an exhausted capability limit. The final reply decides the source, so a later provider turn can't inherit an earlier fallback's mark.<br>• `workshopTurnModelOf` stamps only `replySource: 'provider'`; an unknown source doesn't qualify. Every adoption path goes through it.<br>• A host-written stand-in still commits, as before, but carries no `model`.<br>**Completion-stage note (`7e0b534`).** When a widget-only reply's control block is stripped and no provider prose is left, `completeWorkshopRun` writes the note itself (`hostWritesDisplay`). Those turns commit unstamped, whether the setup was accepted or rejected. | Same new suite, both modes:<br>• **Host-written:** empty reply, null reply (non-streaming), exhausted correction turns, exhausted capability limit<br>• **Provider (positive controls):** ordinary reply, a reply cut off at its ceiling, and (streaming) a retained reply the provider interrupted<br>`WorkshopModelStamps.integration.test.ts` (+1): through the real handler, the engine's stand-in commits with no stamp<br>`WorkshopPersonaCapabilityModelStamps.test.ts` (+1): a persona-run analysis whose reply the engine wrote records no stamp<br>`WorkshopRunCompletionModelStamp.test.ts` (new, 6), at the completion boundary through the real session aggregate:<br>• **Unstamped:** an accepted widget-only reply, a rejected widget-only reply, the engine's stand-in, an unknown source<br>• **Stamped (positive controls):** an ordinary reply, a provider note that came with an accepted setup | `623a4be`, `7e0b534` |
| N-01 | — | **Resolved: stamp Dictionary** (coordinator's decision) | **Dictionary turns are stamped `{ scope: 'dictionary', requestedModelId, servedModelIds }`.**<br>• `DictionaryService` returns its runs' models and reply source beside each result (`DictionaryRunModel`).<br>• **Single lookup:** carries the engine's `models`, so requested is captured at the run's start, like every other run.<br>• **Full entry:** takes the first included block's requested model and every included block's named models. It counts as a provider reply only when every block in it was one.<br>• History keeps its own `modelIds`. The handler strips the new fields from the webview's fast-dictionary payload.<br>• `WorkshopPersonaCapability` stamps `dictionary.lookup` and `dictionary.full-entry` turns that produced an entry. These record none: failed, unconfigured, a full entry with no generated block, a host-written stand-in. | `WorkshopPersonaCapabilityModelStamps.test.ts` (renamed from `WorkshopPersonaAnalysisModelStamp`): both kinds stamped `dictionary`, evidence free of model ids; no stamp for a failed lookup, an unconfigured key, a stand-in, or an entry with no block<br>`DictionaryRunModels.test.ts` (new, 4): the service's lookup and full-entry models, no models without a block, all-blocks provider rule<br>`DictionaryHandler.test.ts`: the webview payload carries neither field | `174012c` |

### What fails where

I ran the new and changed tests against the reviewed head's sources (`0c987cf`)
with ts-jest's type diagnostics off, so old behavior is measured instead of
missing fields. **26 of 76 fail:**

- **F-01: 8 tests, 4 per mode.** No named model, named without usage, and both
  multi-call cases. At the reviewed head they report the requested-model
  fallback, or drop a model that came without usage.
- **F-02: 7 host-written tests**, plus the Workshop handler's and the persona
  analysis's unstamped stand-ins. The positive controls fail there too, but
  only because `replySource` doesn't exist yet.
- **N-01: the four dictionary stamp and service tests**, plus the handler's
  payload test. At the reviewed head, the full entry's models would pass
  through to the webview.

The two widget-only completion tests also fail with `7e0b534` reverted. At
this response's head, all pass.

### Verification at this head

- **Full Jest:** 598 suites / 8,472 tests / 59 snapshots, all passing (Node
  18). That is +3 suites and +40 tests over this report's 595 / 8,432.
- **`npm run typecheck`:** clean.
- **`npm run lint`:** 0 errors, 1,133 warnings, unchanged.
- **Core imports:** no `from 'vscode'` in `packages/core/src`.
- **`git diff --check`:** clean.
- **Files over 500 lines that grew, by the new field and its reads:**
  - `AgentRunEngine` 1,152 → 1,172
  - `OpenRouterClient` 604 → 627
  - `DictionaryService` 771 → 800 (its aggregation is in the new 58-line
    `DictionaryRunModel.ts`)
  - `WorkshopPersonaCapability` 846 → 855

**Not exercised:** native VS Code activation, live provider calls, and Slice 7's
display and export.


## Re-review findings at `edf98ce` (2026-11-03)

**Disposition: changes requested.** The original absent-model, engine fallback, and completion-stage widget witnesses now pass. Independent correction review found two further P2 provenance cases below. Dictionary ordering and the rest of the delta are still under review; this is an early handoff, not a final clean review. No formal GitHub review or approval is submitted.

### F-03: P2: preserve a model-only frame after the last content on an interrupted stream

**Locations:** [`OpenRouterClient.ts:373–388`](https://github.com/okeylanders/prose-minion-vscode/blob/edf98ce40c7014cea05520aeb91350cbb8e46c95/packages/core/src/infrastructure/api/providers/OpenRouterClient.ts#L373-L388), [`OpenRouterClient.ts:401–402`](https://github.com/okeylanders/prose-minion-vscode/blob/edf98ce40c7014cea05520aeb91350cbb8e46c95/packages/core/src/infrastructure/api/providers/OpenRouterClient.ts#L401-L402).

With the real client and engine and only HTTP mocked, send a content frame without a model, then a later model-only frame naming `vendor/served`, then end the stream without `[DONE]`, finish reason, or usage. The engine retains the provider's partial text, but `servedModelIds` is `[]` although the provider named a model. A provider-error after that metadata frame has the same result. A `[DONE]` positive control retains `[vendor/served]`.

The client records the later ID internally but yields it only with a content chunk or terminal chunk. A model-only frame emits neither, and interrupted EOF without finish/usage emits no terminal. Preserve reported identity across that boundary, including the provider-error path where retained content is committed; do not invent a fallback ID. Add real-client/engine regressions for both interruption forms and a normal completion control. Existing interruption coverage puts the model on the content frame and misses this ordering.

### F-04: P2: exclude Dictionary blocks removed by normalization from model provenance

**Location:** [`DictionaryService.ts:721–726`](https://github.com/okeylanders/prose-minion-vscode/blob/edf98ce40c7014cea05520aeb91350cbb8e46c95/packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts#L721-L726).

The assembler tests raw `result.content.trim()` before `normalizeBlockContent`. A non-special-focus block containing only a `## **Special Focus: ...` section is nonempty before normalization but empty afterward. Nevertheless it increments `successCount` and enters `includedBlocks`, so its requested and served model become the entry stamp even though none of that block's content remains. If all other blocks fail, the committed entry consists only of the host-written header yet carries a provider stamp. An independent two-model control also shows a removed block's model contaminating the provenance of a different retained block.

Determine inclusion and attribution from the normalized content actually retained, and ensure a header-only result does not acquire a provider stamp. Add regression coverage for a removed-only block, a removed block beside retained output from a different model, and normal retained output. This is distinct from the known host-fallback fix: the provider did return text, but the assembler discarded it before constructing the entry.

**Independent checks so far:** the earlier seven real-client boundary probes now pass; five focused correction suites pass **60 tests**. The late-model probe has one passing `[DONE]` control and two expected failures (EOF and provider-error). Five Dictionary/adoption/codec suites pass **107 tests**; separate scratch probes reproduce F-04. Full local suite and native/live-provider testing have not been rerun in this correction review.


### N-02: Reconcile the full-entry ordering rule with D7

[`DictionaryRunModel.ts:33–55`](https://github.com/okeylanders/prose-minion-vscode/blob/edf98ce40c7014cea05520aeb91350cbb8e46c95/packages/core/src/infrastructure/api/services/dictionary/DictionaryRunModel.ts#L33-L55) intentionally takes the requested model from the first **included block in display order** and collects served IDs in that order. The slice doc discloses the first-included-block rule; D7 instead describes the selection at request start and served models across requests in order. Parallel block-prompt loads can resolve out of order, and selection can change while they run.

An independent full-service probe held the first displayed block's prompt, let a later block dispatch on model A, switched the selection to B, then released the first block. Request order was A then B; the entry stamp says requested B and served `[B, A]`. That is consistent with the documented block-order implementation but not a chronological reading of D7. Please decide which meaning should govern a multi-call Dictionary entry, align the ADR and implementation or explicitly amend the decision, and pin the intended order. This is a design reconciliation note rather than another undisclosed implementation finding.

Further independent verification on `edf98ce`: **8 adjacent suites / 253 tests** pass, full typecheck passes, and the whitespace check passes. The report-only commit `7959ac57` changes no production or test source. The two new P2 findings above remain open.

### Author response to the re-review (2026-11-03)

Both P2s are fixed on top of `61408a3`. N-02 follows the coordinator's
decision: chronological order, as D7 reads, with no ADR change. Nothing
above this section was edited.

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-03 | P2 | **Fixed** | A stream frame that names the model but carries no content now yields a metadata chunk at once (`{ token: '', done: false, servedModelId }`), only when the named model is new. The engine already reads `servedModelId` from every chunk before it skips empty tokens. A model named after the last content therefore survives an EOF with no terminal frame, and survives a provider error. No fallback is invented: a stream that never names a model still lists none. The engine is the generator's only consumer. | `AgentRunEngine.replyProvenance.integration.test.ts` (+4, streaming), real client and engine, only `fetch` mocked:<br>• EOF after a model-only frame → `['vendor/served']`, partial text kept<br>• provider error after a model-only frame → `['vendor/served']`, interrupted reply kept<br>• `[DONE]` control → `['vendor/served']`<br>• no frame names a model → `[]`<br>The first two fail on the previous client. | `09ea77f` |
| F-04 | P2 | **Fixed** | A full entry's stamp reads only blocks whose **normalized** text the entry keeps. A block normalization empties (a stray `## **Special Focus:` section) is left out of the stamp, so a header-only entry gets no provider stamp, and a removed block's model never joins the kept text's. I left `successCount` and the history's `modelIds` on their existing raw-content rule. Changing them would change when a lookup is recorded or reported as failed, which is outside this slice. That raw rule is noted as a possible follow-up. | `DictionaryRunModels.test.ts` (+3):<br>• a removed-only block → no stamp, no reply source<br>• a removed block on model X beside kept text on Y → the stamp names only Y<br>• normal kept output → stamped<br>The first two fail on the previous code. | `247c87a` |
| N-02 | — | **Resolved: request order** (coordinator's decision) | Each block's request is numbered when it is sent (`dispatchOrder`, from a counter shared by the entry's blocks). A retry is numbered when the retry is sent. Nothing is awaited between that number and the engine's capture of the requested model. `dictionaryEntryRunModel` sorts kept blocks by that number: **requested** is the earliest-sent kept block's model, and **served** ids are de-duplicated in request order. The slice doc's deviation note says so. | `DictionaryRunModels.test.ts` (+1), through the real `AgentRunEngine` over a fake client: it holds the first displayed block's prompt, lets the other 14 blocks send on A, hot-swaps to B (`engine.setModel`), then releases. Expect `requested: 'vendor/a'` and `served: ['vendor/a-served', 'vendor/b-served']`, though B's block is shown first. This fails on the previous code, which gave B and `[B, A]`. | `247c87a` |

**Verification at this head:**

- **Full Jest:** 598 suites / 8,480 tests / 59 snapshots, all passing (Node
  18). That is +8 tests over `edf98ce`'s 8,472.
- **`npm run typecheck`:** clean.
- **`npm run lint`:** 0 errors, 1,133 warnings, unchanged.
- **Core imports:** no `from 'vscode'` in `packages/core/src`.
- **`git diff --check`:** clean.
- **Files over 500 lines that grew:**
  - `DictionaryService` 800 → 822
  - `OpenRouterClient` 627 → 633
- `DictionaryRunModel.ts` is 68 lines.
