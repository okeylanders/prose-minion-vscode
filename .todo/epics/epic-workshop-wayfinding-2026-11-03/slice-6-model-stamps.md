# Slice 6: Model Stamps

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D7 and D9
**Status:** Planned (after Slice 5; it doesn't depend on Slices 1–5 and can move earlier)

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

- [ ] Every provider-produced assistant turn carries `model`; failed runs carry
      none.
- [ ] The requested model is captured at start; served models are
      provider-reported.
- [ ] Sessions without stamps are unchanged on read and write.
- [ ] The epic's per-slice verification passes. Counts are recorded.
