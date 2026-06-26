# MessageHandler Self-Heal Cleanup

**Date Identified**: 2026-06-26
**Source**: PR #64 review, findings 8-10
**Status**: Identified
**Priority**: Low
**Estimated Effort**: 2-4 hours

## Problem

The PR #64 self-heal path is correct, but a few small cleanup items remain:

- the self-heal test still relies on queued async work settling rather than an
  explicitly awaitable refresh seam;
- `disposeSecretListener` has a different shape than nearby listener cleanup
  because the secret listener returns a `PlatformDisposable`;
- the constructor comment explains motivation that mostly belongs in PR/docs
  prose rather than inline code.

None of these are blockers. Together they are a readability and test-shape
cleanup opportunity.

## Recommendation

If `refreshServiceConfiguration()` becomes an explicit seam for observability or
refresh ownership work, make it directly awaitable in tests at the same time.
Consider a tiny disposable-to-callback helper only if it makes the constructor
read more consistently without adding ceremony.

Trim comments down to intent once the surrounding code makes the lifecycle
obvious.

## Related Files

- `packages/core/src/application/handlers/MessageHandler.ts`
- `packages/core/src/__tests__/application/handlers/MessageHandler.test.ts`

## Completion Criteria

- Self-heal tests do not depend on scheduler timing
- Listener teardown code reads consistently
- Inline comments explain only the non-obvious lifecycle intent
