# Streaming Lifecycle Duplication

**Date Identified**: 2025-12-05
**Reviewed**: 2026-06-25
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: 1 day

## Problem

`useStreaming` centralizes buffering, timers, and token accumulation, but
request lifecycle orchestration remains duplicated across:

- `useAnalysis`
- `useContext`
- `useDictionary`

Each hook owns request correlation, ignored request IDs, preemption, stale-event
guards, completion handling, and loading/status cleanup.

The copies have diverged:

- Analysis preserves partial output on cancellation
- Context and dictionary discard partial output
- Ignored request IDs are removed before an immediate ignored check in each
  completion handler, making that check ineffective
- Behavioral test depth differs substantially by domain

## Recommendation

Extract a lightweight domain-streaming lifecycle hook or helper that owns:

- Current request correlation
- Ignored/stale request guards
- Preemption and cancellation wiring
- Start/chunk/complete event filtering

Keep result preservation and domain-specific loading/status behavior
configurable and explicit.

## Related Files

- `packages/core/src/presentation/webview/hooks/useStreaming.ts`
- `packages/core/src/presentation/webview/hooks/domain/useAnalysis.ts`
- `packages/core/src/presentation/webview/hooks/domain/useContext.ts`
- `packages/core/src/presentation/webview/hooks/domain/useDictionary.ts`

## Completion Criteria

- Shared request lifecycle logic has one implementation
- Partial-content behavior is explicit per domain
- Tests cover stale chunks, stale completion, preemption, cancellation, and
  partial-content policy
- Domain hooks retain only domain-specific state transitions
