# Tech Debt: Extract widget-local persisted codecs when the second widget lands

**Date Identified**: 2026-07-30
**Reviewed**: 2026-07-30
**Status**: Deferred
**Priority**: Medium
**Estimated Effort**: Medium

## Problem

`WorkshopSessionStateV1Shape.ts` currently validates the Gesture Playground
draft/config directly. That is appropriate for one widget, but adding twelve
to fifteen widgets would make the session codec a cross-widget junk drawer.
The top-level Workshop session version must remain the single public
compatibility clock because launch/config and committed pills are both records
inside the same persisted session aggregate.

## Recommendation

When the second persisted widget is implemented, extract a sibling local codec
for Gesture Playground and introduce the same seam for the new widget. The
top-level session codec should retain envelope validation, aggregate wiring,
and release-version migration sequencing; dispatch by `widgetId` to the local
codec for persisted draft/config details.

A widget-local codec owns:

- bounded shape validation and defensive cloning of its draft/config;
- deterministic development-checkpoint normalization of its own evolving
  fields; and
- widget-local transformation helpers invoked by a formal session release
  migration, when that widget's stored contract changes.

Do not add an independent widget `schemaVersion` while widget records exist
only within Workshop session JSON. Reconsider only if a widget is separately
stored, imported/exported, or decoded outside a session.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionCheckpointNormalization.ts`
- `packages/core/src/shared/types/messages/workshop.ts`
- `docs/adr/2026-07-30-workshop-session-codec-evolution.md`

## Completion Criteria

- [ ] A second persisted widget exists; do not extract solely in anticipation.
- [ ] Gesture Playground and the new widget each own a semantic local codec.
- [ ] The session codec dispatches widget validation without importing
      widget-specific field rules beyond the registry/wiring seam.
- [ ] Session-level release migrations delegate changed widget payloads to
      their local helper and leave unaffected widgets untouched.
- [ ] Existing session round-trip, normalization, and widget tests pass.
