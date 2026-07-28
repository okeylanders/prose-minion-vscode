# Extract Workshop capability-artifact recording from the session aggregate

**Status:** Open
**Priority:** Low
**Source:** PR #74 review, finding #8 (Parker 📖)

## Problem

`WorkshopSessionService` is now roughly 750 lines. The persona-capability work
added turn assembly, sidecar adoption, and clone logic to an aggregate that was
already beyond the project's 500-line review threshold. The behavior belongs
to the session boundary, but the implementation no longer needs to live in one
file.

This was deliberately deferred from PR #74 because extracting the collaborator
would be a structural refactor beside security and correctness fixes, with no
required behavior change.

## Related files

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopAnalysisSidePass.ts`
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`

## Completion criteria

- Capability-artifact turn assembly and sidecar adoption move behind a focused
  collaborator without weakening the session's active-run/excerpt-version guard.
- `WorkshopSessionService` remains the aggregate of record and exposes no mutable
  internal collections.
- Existing stale-artifact, sidecar-replacement, and clone-isolation tests remain
  green, with focused tests added for the extracted collaborator.
