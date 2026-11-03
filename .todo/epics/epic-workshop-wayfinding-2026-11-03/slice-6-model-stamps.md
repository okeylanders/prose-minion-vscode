# Slice 6: Model Stamps

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D7 and D9
**Status:** Built (`7e38081`, `9d86713`, `584a529`); PR into `epic/workshop-wayfinding` pending

## Outcome

Every committed assistant turn produced by a provider call records the model
scope, the model requested at the start, and the models the provider reported
serving. Nothing displays the stamps yet; Slice 7 does.

## Build

### Contract and codec

- In `shared/types/messages/workshop/session.ts`, add `WorkshopTurnModel`
  (`{ scope: ModelScope; requestedModelId: string; servedModelIds: string[] }`)
  and `WorkshopTurn.model?: WorkshopTurnModel`.
- In `assertTurn` (`WorkshopSessionStateV1Shape.ts`):
  - add `model` to the optional keys;
  - validate `scope` against the `ModelScope` values;
  - `requestedModelId` is a non-empty string;
  - `servedModelIds` is an array of non-empty strings with no duplicates.
- Update `cloneTurn`, checkpoint equality, and anything else that copies turn
  fields field by field.
- **Fixtures:** turns without `model` load and save unchanged.

### Capture

- **Requested.** Capture the scope's selected model id when the run starts. Put
  it in the run's context or orchestration input, not in a settings read at
  commit time. A selection change during the run must not change the stamp (the
  lesson of PR #144 F-03).
- **Served.** `AgentRunEngine` already records each request's
  `InferenceRequestObservation`. Collect the distinct `observation.modelId`
  values in order, and return them with the run result. Requests that report no
  observation add nothing.
- **Stamp.** Stamp every assistant-role turn that a provider call produced:
  - host persona replies,
  - guest replies,
  - tool-sidecar replies,
  - tool reports, including persona-run analyses,
  - syntheses.

  Find each commit path (start from `WorkshopRunCompletion` and the session
  service's append methods). Each needs a test.
- A failed, cancelled, or rejected run commits no reply, so it records no
  stamp.
- Stamps never enter prompts, room frames, or provider history. Add a test.

## Tests

- **Engine:** distinct served ids are collected in order across capability
  rounds; a run with no observations has `[]`.
- **Requested capture:** changing the selection mid-run doesn't change the
  stamp.
- **Each commit path:** stamps its turn with the right scope.
- **Codec:** round-trip, invalid shapes rejected, old turns unchanged.
- **Prompt isolation:** the prompt builder and room frames don't contain model
  ids from stamps.

## Completion Criteria

- [x] Every provider-produced assistant turn carries `model`; failed runs carry
      none. (`WorkshopModelStamps.integration.test.ts`,
      `WorkshopPersonaAnalysisModelStamp.test.ts`)
- [x] The requested model is captured at start; served models are
      provider-reported. (`AgentRunEngine.modelStamps.test.ts`)
- [x] Sessions without stamps are unchanged on read and write.
      (`WorkshopTurnModelCodec.test.ts`)
- [x] The epic's per-slice verification passes. Counts are recorded in the
      epic's progress notes.

## Built

**Stamped commit paths.** Every one adopts a provider reply and has a test:

| Turn | Path | Test |
|---|---|---|
| Host reply (first and continued; quick actions take the same path) | `WorkshopRoomHandler.executeMessage` → `completeWorkshopRun` → `completeRun` | integration |
| Guest's first reply | `handleInviteGuest` → `completeWorkshopRun` → `completeRun` | integration |
| Guest reply | `executeMessage` (guest target) → `completeWorkshopRun` → `completeRun` | integration |
| Tool-sidecar reply | `executeMessage` (tool target) → `completeWorkshopRun` → `completeRun` | integration |
| Writer's tool report | `RunWorkshopToolSidePass` → `adoptWriterReport` → `completeToolReport` | integration |
| Host synthesis | `RunWorkshopToolSidePass` → `completeWorkshopRun` → `completeRun` | integration |
| Persona-run analysis | `WorkshopPersonaCapability.runAnalysis` → `adoptPersonaReport` → `recordCapabilityArtifact` | persona analysis test |

**Where each part lives.**

- **Requested** is captured by `AgentRunEngine` at the start of the run, before
  its first request, with nothing awaited between. It is the model that first
  request goes to (`options.model`, else the provider's model then).
- **Served** is collected from each request's `InferenceRequestObservation`.
- Both return as `ExecutionResult.models`.
- `AssistantToolService` adds the scope (`assistant`: every Workshop run goes to
  its assistant-scope engine) and returns `AnalysisResult.model`.
- `WorkshopTurnModel.ts` turns that into the stamp and holds its codec.

**Deviations.**

- **Stamps only on assistant turns.** The codec also refuses a `model` on a
  turn that isn't `role: 'assistant'`, following `widgetRecommendation`'s
  participant check. This makes a stamp on a writer turn unrepresentable.
- **Dictionary capability turns stay unstamped.** A persona's
  `dictionary.lookup` / `dictionary.full-entry` turn is provider-made, on the
  dictionary scope, but D7's list doesn't name it, so it carries no stamp, and
  neither do resource and recall turns, which no provider made. Whether to
  stamp dictionary turns (scope `dictionary`) is a coordinator decision:
  [tech debt](../../tech-debt/2026-11-03-workshop-dictionary-turn-model-stamps.md).
- **A failed persona-run analysis records no stamp,** even though its evidence
  turn commits: its content is a host error, not a provider reply.
