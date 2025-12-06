# Streaming Hook Duplication

**Date Identified**: 2025-03-01  
**Identified During**: Streaming/cancel hardening review  
**Priority**: Medium  
**Estimated Effort**: 0.5-1 day

## Problem
Streaming orchestration logic (start events, requestId guards, ignore lists, cancel reset, shared state shape) is duplicated across `useAnalysis`, `useContext`, and `useDictionary`. This repetition increases maintenance overhead and raises the risk of divergence if we add another streaming domain or tweak the lifecycle.

## Current Implementation
- `src/presentation/webview/hooks/domain/useAnalysis.ts`
- `src/presentation/webview/hooks/domain/useContext.ts`
- `src/presentation/webview/hooks/domain/useDictionary.ts`

Each hook independently implements:
- `handleStreamStarted/chunk/complete` with similar requestId checks and ignore-set handling.
- `currentRequestId` + `ignoredRequestIdsRef`.
- Start/cancel wiring to `useStreaming`.

## Recommendation
Extract a shared streaming helper/hook (e.g., `useDomainStreaming` or `createStreamingHandlers`) that:
- Accepts `domain` and callbacks to clear/set domain-specific state.
- Owns `currentRequestId`, ignored-set handling, and event guards.
- Exposes `handleStreamStarted/chunk/complete`, `startStreaming`, `cancelStreaming`, and derived UI booleans.
Ensure the helper remains lightweight and composable with existing domain state/persistence patterns.

## Impact
- Lower maintenance burden; consistent behavior across streaming domains.
- Faster onboarding for future streaming domains.
- Reduced risk of subtle divergence in cancel/guard behavior.

## References
- Current duplication: `useAnalysis.ts`, `useContext.ts`, `useDictionary.ts`
