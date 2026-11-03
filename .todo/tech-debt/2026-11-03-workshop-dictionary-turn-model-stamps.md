# Workshop dictionary capability turns carry no model stamp

**Status:** Identified (needs a decision)
**Priority:** Low
**Source:** Workshop Wayfinding Slice 6, [ADR 2026-11-03](../../docs/adr/2026-11-03-workshop-wayfinding.md) D7

## Problem

D7 stamps host and guest replies, tool-sidecar replies, tool reports
(persona-run analyses included), and syntheses. A persona's Writer's Dictionary
call (`dictionary.lookup`, `dictionary.full-entry`) also commits an assistant
turn that a provider call produced, on the `dictionary` model scope. D7 doesn't
name it, so Slice 6 leaves it unstamped.

Resource and session-recall capability turns make no provider call and rightly
carry nothing.

## Options

1. **Leave dictionary turns unstamped.** Model slices (D8) then ignore them,
   which matches "same-scope change" if the writer only ever cares about the
   room's model.
2. **Stamp them with scope `dictionary`.** D8's same-scope rule already keeps a
   dictionary stamp from starting an assistant slice.
   - `DictionaryService` returns served `modelIds` today, but it has no
     requested model.
   - Its `lookupWordStreaming` and `generateParallelDictionary` results would
     carry `ExecutionResult.models`.
   - `WorkshopPersonaCapability` would pass them beside the result, as the
     analysis path does.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts` (`lookupDictionary`, `generateFullEntry`, `fulfill`)
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`
- `packages/core/src/application/services/workshop/WorkshopTurnModel.ts`

## Completion Criteria

- The coordinator or the writer picks an option.
- For option 2, each dictionary path is stamped, with a test, and the ADR's
  D7 list names it.
