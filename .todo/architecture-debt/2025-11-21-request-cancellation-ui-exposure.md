# Request Cancellation - UI Exposure

**Date Identified**: 2025-11-21
**Identified During**: PR-31 Review (Fast Dictionary Generation)
**Priority**: Medium
**Estimated Effort**: 4-6 hours

## Problem

Backend infrastructure for request cancellation is now implemented, but not exposed to the UI layer. Users cannot cancel long-running AI requests (analysis, dictionary generation, context generation, etc.).

## Current Implementation (Infrastructure Complete)

### ✅ Backend Wiring (PR-31 Changes)

**AIResourceOrchestrator** ([src/application/services/AIResourceOrchestrator.ts](../../src/application/services/AIResourceOrchestrator.ts)):
- Added `signal?: AbortSignal` and `timeoutMs?: number` to `AIOptions` interface
- Implemented `createTerminationContext()` for unified signal management
- Handles both external signals (passed in) and internal timeouts
- Proper cleanup via `termination.dispose()` in all execution paths
- Supports all three execution modes:
  - `executeWithCapabilities()` (multi-turn with guides)
  - `executeWithoutCapabilities()` (single-turn)
  - `executeContextWithResources()` (context with multi-file resources)

**OpenRouterClient** ([src/infrastructure/api/OpenRouterClient.ts](../../src/infrastructure/api/OpenRouterClient.ts)):
- Added `signal?: AbortSignal` parameter to `createChatCompletion()`
- Passes signal to `fetch()` for native HTTP abort

**DictionaryService** ([src/infrastructure/api/services/dictionary/DictionaryService.ts](../../src/infrastructure/api/services/dictionary/DictionaryService.ts)):
- Uses `timeoutMs` option for per-block timeouts (15s) in fast generation
- No longer uses manual `Promise.race()` pattern

### ❌ Missing: UI Layer Exposure

Users have no way to:
- Cancel an in-progress analysis
- Stop a long-running dictionary generation
- Abort a context generation request
- Cancel a word search

## Recommendation

### Phase 1: Domain Hooks State Management

Add cancellation state to domain hooks:

```typescript
// Example: useAnalysis.ts
export interface AnalysisActions {
  // ... existing actions
  cancelAnalysis: () => void;
}

const useDictionaryReturn = () => {
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const cancelAnalysis = useCallback(() => {
    if (abortController) {
      abortController.abort(new Error('User cancelled'));
      setAbortController(null);
    }
  }, [abortController]);

  const handleAnalyzeRequest = useCallback((msg: MessageEnvelope<AnalyzeRequest>) => {
    const controller = new AbortController();
    setAbortController(controller);

    // Send to backend with signal metadata
    postMessage({
      type: MessageType.ANALYZE,
      payload: {
        ...msg.payload,
        abortSignalId: generateId() // backend tracks this
      }
    });
  }, []);

  return {
    // ... state
    cancelAnalysis,
    // ... other actions
  };
};
```

### Phase 2: Backend Signal Registry

Message handlers need to track signals by request ID:

```typescript
// MessageHandler or domain handlers
private abortControllers = new Map<string, AbortController>();

private handleAnalyzeRequest(message: MessageEnvelope<AnalyzeRequest>) {
  const controller = new AbortController();
  const requestId = message.payload.abortSignalId || generateId();

  this.abortControllers.set(requestId, controller);

  // Pass signal to orchestrator
  orchestrator.executeWithCapabilities(toolName, systemPrompt, userMessage, {
    signal: controller.signal,
    // ... other options
  }).finally(() => {
    this.abortControllers.delete(requestId);
  });
}

private handleCancelRequest(message: MessageEnvelope<CancelRequest>) {
  const controller = this.abortControllers.get(message.payload.requestId);
  if (controller) {
    controller.abort(new Error('User cancelled'));
  }
}
```

### Phase 3: UI Components

Add cancel buttons to loading indicators:

```tsx
// LoadingIndicator.tsx (or inline in tabs)
<div className="loading-indicator">
  <div className="loading-header">
    <div className="spinner"></div>
    <div className="loading-text">
      <div>{statusMessage || defaultMessage}</div>
    </div>
    {onCancel && (
      <button onClick={onCancel} className="cancel-button">
        Cancel
      </button>
    )}
  </div>
  <LoadingWidget />
</div>
```

### Phase 4: Message Contracts

Add cancellation message types:

```typescript
// src/shared/types/messages/base.ts or domain-specific files
export interface CancelRequest {
  requestId: string;
  domain: 'analysis' | 'dictionary' | 'context' | 'search' | 'metrics';
}

// Add to MessageType enum
export enum MessageType {
  // ... existing types
  CANCEL_REQUEST = 'cancelRequest',
}
```

## Impact

### Benefits
- ✅ Better UX: users can stop expensive/long requests
- ✅ Cost control: avoid burning tokens on unwanted requests
- ✅ Infrastructure ready: backend wiring complete
- ✅ Clean architecture: proper signal propagation through layers

### Risks
- ⚠️ Complexity: need to track request IDs across webview ↔ extension boundary
- ⚠️ State management: ensure cleanup on abort (no orphaned promises)
- ⚠️ Race conditions: cancel arriving after completion

## Related Work

- **PR-31 Review** ([docs/pr/pr-31-review-codex.md](../../docs/pr/pr-31-review-codex.md)): Identified missing cancellation support
- **Loading Widget Status Integration** ([2025-11-19-loading-widget-status-integration.md](2025-11-19-loading-widget-status-integration.md)): Proposes extracting `LoadingIndicator` component (good place for cancel button)
- **ADR: Cross-Cutting UI Improvements** (if exists): May cover cancellation UX patterns

## Files to Update

### Domain Hooks (add cancellation actions)
- `src/presentation/webview/hooks/domain/useAnalysis.ts`
- `src/presentation/webview/hooks/domain/useDictionary.ts`
- `src/presentation/webview/hooks/domain/useContext.ts`
- `src/presentation/webview/hooks/domain/useSearch.ts`
- `src/presentation/webview/hooks/domain/useMetrics.ts`

### Backend Handlers (add signal registry + cancel handler)
- `src/application/handlers/domain/AnalysisHandler.ts`
- `src/application/handlers/domain/DictionaryHandler.ts`
- `src/application/handlers/domain/ContextHandler.ts`
- `src/application/handlers/domain/SearchHandler.ts`
- `src/application/handlers/domain/MetricsHandler.ts`

### Message Contracts
- `src/shared/types/messages/base.ts` (add `CANCEL_REQUEST` type)
- Create `CancelRequest` interface in appropriate domain file

### UI Components
- `src/presentation/webview/components/AnalysisTab.tsx`
- `src/presentation/webview/components/UtilitiesTab.tsx`
- `src/presentation/webview/components/SearchTab.tsx`
- `src/presentation/webview/components/MetricsTab.tsx`

## When to Fix

**Medium priority** - Nice UX improvement, infrastructure ready, but not critical for v1.0.

**Suggested Timing**: v1.1 or v1.2 after higher-priority items (Settings Hooks Unit Tests, StandardsService refactor).

---

## Implementation Notes

**Backend Infrastructure Complete** (2025-11-21):
- ✅ `AIOptions` supports `signal` and `timeoutMs`
- ✅ `AIResourceOrchestrator.createTerminationContext()` handles both external signals and timeouts
- ✅ `OpenRouterClient.createChatCompletion()` passes signal to fetch
- ✅ Proper cleanup with `termination.dispose()` in all execution paths
- ✅ DictionaryService uses `timeoutMs` for fast generation block timeouts

**Remaining Work**: UI layer exposure only (Phases 1-4 above).
