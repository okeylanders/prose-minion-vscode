# Workshop session codec refuses sessions saved by newer builds

**Status:** Identified
**Priority:** Low
**Source:** [ADR 2026-11-03: Workshop Wayfinding](../../docs/adr/2026-11-03-workshop-wayfinding.md), D9

## Problem

The Workshop session codec is strict: `exactKeys` throws on any field it doesn't
know. Each release that adds an optional field therefore produces sessions that
every earlier build refuses to open:

- provider cache counts (ADR 2026-07-30),
- read-in provenance, bookmarks, and model stamps (ADR 2026-11-03).

Sessions live in the workspace (`prose-minion/sessions/`). A writer who syncs a
project between two machines running different extension versions hits this.

## Recommendation

Write a codec-policy ADR for a reserved, tolerant extension slot. For example,
a turn-level and session-level `annotations` object:

- A reader checks it only as a JSON object.
- A reader **keeps unknown keys through a save**, never drops them. If it
  dropped them, an older build saving the file would erase a newer build's
  data.
- Later releases add optional, non-semantic fields there instead of at the top
  level.

The slot helps only builds that ship it, so it has to land at least one release
before the first field that relies on it.

## Related Files

- `packages/core/src/application/services/workshop/persistedValidation.ts`: `exactKeys`
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`
- `docs/adr/2026-07-30-workshop-session-codec-evolution.md`

## Completion Criteria

- An accepted ADR defines the slot, its validation, and the rule that unknown
  keys are kept through a save.
- A fixture test shows a build keeping a newer build's unknown slot keys intact
  through a load-and-save cycle.
