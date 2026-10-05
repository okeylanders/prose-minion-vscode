# Workshop session preview can show capability evidence text

**Date Identified**: 2026-10-05
**Reviewed**: 2026-10-05
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one selection rule plus tests)
**Found by**: Workshop Session Recall design ([runway](../../docs/architecture/2026-10-05-workshop-session-recall-runway.md) finding F6)

## Problem

A named session's summary `preview` — shown in the session browser and stored
in its `.summary.json` search index — is the first 180 characters of the
**last non-session turn with content**
(`WorkshopSessionPersistenceCoordinator.ts`, `previewTurn`). When a session's
last turn is a capability artifact, that content is the artifact's evidence
body: dictionary output, a project file's contents, or an analysis report.

The thread collapses those bodies, and the transcript projection
(ADR 2026-10-05) reduces them to one line. The preview is the one place that
surfaces them as if they were the conversation's latest message.

## Recommendation

Choose the preview turn with the same rule as `projectWorkshopTranscript`:
skip capability artifacts, context changes, and other turns the projection
omits or reduces to events, and take the newest writer message or participant
reply. Only newly written summaries change; existing `.summary.json` files are
derived and are rewritten on the next save.

The proposed Session Recall feature does not depend on this fix: its catalog
deliberately never shows `preview`.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`
- `packages/core/src/infrastructure/storage/WorkshopSessionSearchIndexV1.ts`
- `packages/core/src/application/services/workshop/export/WorkshopTranscript.ts`

## Completion Criteria

- A session whose last turn is a capability artifact previews the newest
  visible message instead of the evidence body.
- A test pins the rule, including sessions whose only content is events.
