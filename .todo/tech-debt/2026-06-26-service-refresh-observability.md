# Service Refresh Observability

**Date Identified**: 2026-06-26
**Source**: PR #64 review, finding 5
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: 2-3 hours

## Problem

`MessageHandler.refreshServiceConfiguration()` refreshes several services inside
one broad `try/catch`. If one refresh fails, the log does not identify which
service failed or which later refreshes were skipped. On success, there is no
completion log.

This makes API-key-change recovery harder to diagnose when a user reports that
they added a key but an AI tool still behaves as unconfigured.

## Recommendation

Give each refresh step an observable name and log enough structure to reconstruct
what happened:

- start: key changed, refresh started;
- per-service failure: service name and error message;
- completion: all refresh steps succeeded;
- optional: skipped steps if the implementation intentionally short-circuits.

Keep secret material out of logs. The event should say that a secret changed,
not what it changed to.

## Related Files

- `packages/core/src/application/handlers/MessageHandler.ts`
- `packages/core/src/__tests__/application/handlers/MessageHandler.test.ts`

## Completion Criteria

- Logs identify the failing refresh step when one fails
- Successful refresh emits a completion line
- Tests cover at least one named failure path
- No API key or secret event payload is logged
