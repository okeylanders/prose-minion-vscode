# Abort Signal Infrastructure Implementation

**Date**: 2025-11-21, 15:30
**Context**: PR-31 Review Response (Fast Dictionary Generation)
**Branch**: `epic/parallel-dictionary-generation-2025-11-20`
**Status**: Backend infrastructure complete, UI exposure deferred

---

## Summary

Implemented comprehensive request cancellation infrastructure in response to PR-31 review findings. Backend wiring is complete; UI exposure deferred to future epic.

---

## Problem Statement (from PR-31 Review)

**Priority**: High
**Finding**: "Fast gen block timeouts don't cancel real requests"

> `DictionaryService.generateSingleBlock` races a timeout against `executeWithoutCapabilities`, but the underlying OpenRouter call is not aborted. A timed-out block will keep burning tokens while the retry runs, so concurrency and cost can double. The stack (`AIResourceOrchestrator.executeWithoutCapabilities` → `OpenRouterClient.createChatCompletion`) does not accept a `signal` or `timeoutMs`, so there's no cancellation support yet.

**Codex Recommendation**:
- Extend `AIOptions` and `OpenRouterClient.createChatCompletion` to accept `signal?: AbortSignal` (and optionally `timeoutMs?: number`)
- Pass `signal` through `executeWithoutCapabilities`
- Use an `AbortController` in `DictionaryService.generateSingleBlock`

---

## Implementation

### 1. AIResourceOrchestrator - Unified Termination Context

**File**: [src/application/services/AIResourceOrchestrator.ts](../src/application/services/AIResourceOrchestrator.ts)

**Changes**:
- Added `signal?: AbortSignal` and `timeoutMs?: number` to `AIOptions` interface
- Implemented `createTerminationContext()` pattern for unified signal management
- Handles both external signals (passed by caller) and internal timeouts
- Proper cleanup via `termination.dispose()` (clears timers, removes event listeners)

**Key Pattern** - `TerminationContext`:
```typescript
interface TerminationContext {
  signal?: AbortSignal;
  dispose: () => void;
}

private createTerminationContext(options: AIOptions): TerminationContext {
  // If no signal or timeout, return no-op
  if (!options.timeoutMs && !options.signal) {
    return { signal: undefined, dispose: () => {} };
  }

  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;
  let externalAbortListener: (() => void) | undefined;

  // Handle external signal (if provided)
  if (options.signal) {
    if (options.signal.aborted) {
      abortWithReason(options.signal.reason ?? new Error('Aborted'));
    } else {
      externalAbortListener = () => abortWithReason(options.signal?.reason ?? new Error('Aborted'));
      options.signal.addEventListener('abort', externalAbortListener, { once: true });
    }
  }

  // Handle internal timeout (if specified)
  if (options.timeoutMs) {
    timeoutId = setTimeout(
      () => abortWithReason(new Error(`Request timed out after ${options.timeoutMs}ms`)),
      options.timeoutMs
    );
  }

  return {
    signal: controller.signal,
    dispose: () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (externalAbortListener && options.signal) {
        options.signal.removeEventListener('abort', externalAbortListener);
      }
    }
  };
}
```

**Applied to All Execution Modes**:
- `executeWithCapabilities()` (multi-turn with guide requests)
- `executeWithoutCapabilities()` (single-turn)
- `executeContextWithResources()` (context generation with multi-file resources)

Each mode:
1. Creates termination context at start
2. Passes signal through to `OpenRouterClient`
3. Calls `termination.dispose()` in `finally` block

### 2. OpenRouterClient - Native Fetch Abort

**File**: [src/infrastructure/api/OpenRouterClient.ts](../src/infrastructure/api/OpenRouterClient.ts)

**Changes**:
- Added `signal?: AbortSignal` parameter to `createChatCompletion()` options
- Passes signal to `fetch()` for native HTTP request abort
- Fixed import order (moved `TokenUsage` import to top)

**Before**:
```typescript
createChatCompletion(messages, { temperature, maxTokens })
```

**After**:
```typescript
createChatCompletion(messages, { temperature, maxTokens, signal })
// Signal passed to fetch(): fetch(url, { ..., signal })
```

### 3. DictionaryService - Using timeoutMs

**File**: [src/infrastructure/api/services/dictionary/DictionaryService.ts](../src/infrastructure/api/services/dictionary/DictionaryService.ts)

**Changes**:
- Removed manual `Promise.race()` pattern with `createTimeout()`
- Uses `timeoutMs` option in `AIOptions` (surfaced through orchestrator)
- Removed `createTimeout()` helper method (no longer needed)

**Before**:
```typescript
const result = await Promise.race([
  orchestrator.executeWithoutCapabilities(toolName, systemMessage, userMessage, {
    temperature: 0.4,
    maxTokens: 3500
  }),
  this.createTimeout(this.BLOCK_TIMEOUT)
]);
```

**After**:
```typescript
const result = await orchestrator.executeWithoutCapabilities(
  toolName,
  systemMessage,
  userMessage,
  {
    temperature: 0.4,
    maxTokens: 3500,
    timeoutMs: this.BLOCK_TIMEOUT // Orchestrator handles abort
  }
);
```

**Benefits**:
- ✅ Cleaner code (no manual race conditions)
- ✅ Proper abort handling (request actually cancelled, not orphaned)
- ✅ Consistent pattern across all services

---

## Architectural Benefits

### 1. Proper Separation of Concerns
- **AIResourceOrchestrator**: Owns timeout logic and signal management
- **OpenRouterClient**: Passes signal to fetch (no business logic)
- **Services**: Use `timeoutMs` option (declarative, no manual racing)

### 2. Composable Signals
- External callers can pass their own `AbortSignal`
- Internal `timeoutMs` creates a managed signal
- Both can be combined (first to fire wins)
- Proper cleanup prevents memory leaks

### 3. Consistent Pattern
- All three execution modes use same `createTerminationContext()` pattern
- Easy to add cancellation to any AI request
- Future UI cancel buttons can pass signals through

### 4. Cost Control
- Timed-out requests no longer burn tokens
- Faster retry cycles (no orphaned requests)
- Concurrency doesn't double during timeouts

---

## Testing

**Manual Testing** (Fast Dictionary Generation):
- ✅ Block timeouts abort OpenRouter request (verified in Output Channel logs)
- ✅ Retry logic works correctly after abort
- ✅ No orphaned requests consuming tokens
- ✅ Error messages surface timeout reason

**Edge Cases Handled**:
- ✅ External signal already aborted when passed
- ✅ Timeout fires before external signal
- ✅ External signal fires before timeout
- ✅ No signal or timeout (no-op path)
- ✅ Cleanup in all code paths (try/finally)

---

## Documentation Updates

**Also Fixed** (from PR-31 Low/Medium findings):
- ✅ `CHANGELOG-DETAILED.md`: Fixed prompt path `dictionary-parallel/` → `dictionary-fast/`
- ✅ `CHANGELOG-DETAILED.md`: Improved model recommendations wording
- ✅ `README.md`: Polished feature description, consistent button label

---

## Future Work

**Architecture Debt Created**: [2025-11-21-request-cancellation-ui-exposure.md](../.todo/architecture-debt/2025-11-21-request-cancellation-ui-exposure.md)

**UI Layer Exposure** (deferred to v1.1+):
1. Domain hooks: Add `cancelAnalysis()` / `cancelDictionary()` actions
2. Backend handlers: Track `AbortController` per request ID
3. Message contracts: Add `CANCEL_REQUEST` message type
4. UI components: Add cancel buttons to loading indicators

**Why Deferred**:
- Backend infrastructure complete and working
- UI exposure requires significant message contract changes
- Not critical for v1.0 release (feature works with timeouts)
- Better UX, but lower priority than testing/polish work

---

## PR-31 Review Status

| Finding | Priority | Status |
|---------|----------|--------|
| Fast gen block timeouts don't cancel real requests | **High** | ✅ **RESOLVED** |
| Docs path + wording mismatch | **Medium** | ✅ **RESOLVED** |
| README copy inconsistency | **Low** | ✅ **RESOLVED** |

**All findings addressed** in this commit batch.

---

## Related Files

**Modified** (this commit):
- [src/application/services/AIResourceOrchestrator.ts](../src/application/services/AIResourceOrchestrator.ts) - Termination context infrastructure
- [src/infrastructure/api/OpenRouterClient.ts](../src/infrastructure/api/OpenRouterClient.ts) - Signal pass-through
- [src/infrastructure/api/services/dictionary/DictionaryService.ts](../src/infrastructure/api/services/dictionary/DictionaryService.ts) - Use `timeoutMs`
- [README.md](../README.md) - Documentation fixes
- [docs/CHANGELOG-DETAILED.md](../docs/CHANGELOG-DETAILED.md) - Documentation fixes

**Created** (this commit):
- [.todo/architecture-debt/2025-11-21-request-cancellation-ui-exposure.md](../.todo/architecture-debt/2025-11-21-request-cancellation-ui-exposure.md) - Future work tracker
- [.memory-bank/20251121-1530-abort-signal-infrastructure.md](20251121-1530-abort-signal-infrastructure.md) - This document

---

## Configuration Note

**Concurrency Limit**: Reverted to `CONCURRENCY_LIMIT = 7` (from 14)
- Conservative limit reduces OpenRouter rate limiting risk
- Still achieves 2-4× speedup over sequential generation
- Can be increased after more production testing

---

**Status**: ✅ Ready to commit and push
