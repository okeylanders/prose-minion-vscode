# Sprint 03: Request Cancellation UI

**Status**: 🟡 Ready
**Estimated Time**: 4-6 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub4-03-request-cancellation-ui`

---

## Problem

Backend infrastructure for request cancellation is now implemented (PR #31), but not exposed to the UI layer. Users cannot cancel long-running AI requests (analysis, dictionary generation, context generation, word search, metrics).

**Current Behavior**: User starts long request → must wait for completion (no cancel option)

**Impact**:
- Expensive requests burn tokens even if user changes mind
- No way to stop accidental large context generation
- Poor UX for users who want to refine query mid-request

**Desired Behavior**: Cancel button appears during loading → user can abort → clean cleanup

---

## Prerequisites

- ✅ Backend infrastructure complete (PR #31):
  - `AIOptions` supports `signal` and `timeoutMs`
  - `AIResourceOrchestrator.createTerminationContext()` handles both external signals and timeouts
  - `OpenRouterClient.createChatCompletion()` passes signal to fetch
  - Proper cleanup with `termination.dispose()` in all execution paths
- ✅ LoadingIndicator component extracted (Sub-Epic 2, Sprint 02)

---

## Tasks

### Phase 1: Domain Hooks State Management
- [ ] Add `cancelRequest()` method to `useAnalysis` hook
- [ ] Add `cancelRequest()` method to `useDictionary` hook
- [ ] Add `cancelRequest()` method to `useContext` hook
- [ ] Add `cancelRequest()` method to `useSearch` hook
- [ ] Add `cancelRequest()` method to `useMetrics` hook
- [ ] Add `abortController` state management to each hook
- [ ] Create new AbortController when request starts
- [ ] Cleanup AbortController when request completes/aborts

### Phase 2: Backend Signal Registry
- [ ] Add `abortControllers` map to AnalysisHandler (track by request ID)
- [ ] Add `abortControllers` map to DictionaryHandler
- [ ] Add `abortControllers` map to ContextHandler
- [ ] Add `abortControllers` map to SearchHandler
- [ ] Add `abortControllers` map to MetricsHandler
- [ ] Register AbortController when request starts
- [ ] Pass `signal` to orchestrator in all handlers
- [ ] Cleanup AbortController after request completes
- [ ] Handle `CANCEL_REQUEST` message in all handlers

### Phase 3: UI Components
- [ ] Add `onCancel` prop to LoadingIndicator component
- [ ] Add cancel button to LoadingIndicator UI (next to spinner)
- [ ] Wire cancel button to domain hook `cancelRequest()` method
- [ ] Update AnalysisTab to pass `onCancel` callback
- [ ] Update UtilitiesTab (dictionary/context) to pass `onCancel` callback
- [ ] Update SearchTab to pass `onCancel` callback
- [ ] Update MetricsTab to pass `onCancel` callback

### Phase 4: Message Contracts
- [ ] Add `CANCEL_REQUEST` to `MessageType` enum
- [ ] Create `CancelRequestPayload` interface with `requestId` and `domain`
- [ ] Add to message barrel export
- [ ] Generate unique request IDs for all AI requests
- [ ] Include request ID in all AI request payloads

---

## Implementation Details

### Phase 1: Domain Hooks State Management

**Pattern** (apply to all domain hooks):

```typescript
// useAnalysis.ts
export interface AnalysisActions {
  // ... existing actions
  cancelAnalysis: () => void;
}

const useAnalysis = (vscode: VSCodeAPI) => {
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const cancelAnalysis = useCallback(() => {
    if (abortController) {
      abortController.abort(new Error('User cancelled analysis'));
      setAbortController(null);
      setIsLoading(false);
      setStatusMessage('Analysis cancelled');
    }
  }, [abortController]);

  const handleAnalyzeDialogue = useCallback((msg: MessageEnvelope<AnalyzeDialoguePayload>) => {
    const controller = new AbortController();
    const requestId = generateRequestId();

    setAbortController(controller);
    setIsLoading(true);

    vscode.postMessage({
      type: MessageType.ANALYZE_DIALOGUE,
      source: 'webview.analysis.tab',
      payload: {
        ...msg.payload,
        requestId
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  // Cleanup on completion
  const handleAnalysisResult = useCallback((msg: MessageEnvelope<AnalysisResultPayload>) => {
    setAbortController(null);
    setIsLoading(false);
    // ... handle result
  }, []);

  return {
    // ... state
    cancelAnalysis,
    // ... other actions
  };
};
```

**Helper Function** (create in utils):

```typescript
// src/presentation/webview/utils/requestId.ts
let requestCounter = 0;

export function generateRequestId(): string {
  return `${Date.now()}-${++requestCounter}`;
}
```

---

### Phase 2: Backend Signal Registry

**Pattern** (apply to all domain handlers):

```typescript
// AnalysisHandler.ts
export class AnalysisHandler {
  private abortControllers = new Map<string, AbortController>();

  private async handleAnalyzeDialogue(message: MessageEnvelope<AnalyzeDialoguePayload>) {
    const controller = new AbortController();
    const requestId = message.payload.requestId || this.generateRequestId();

    this.abortControllers.set(requestId, controller);

    try {
      const result = await this.orchestrator.executeWithCapabilities(
        toolName,
        systemPrompt,
        userMessage,
        {
          signal: controller.signal,
          // ... other options
        }
      );

      // Send result to webview
      this.sendToWebview(MessageType.ANALYSIS_RESULT, {
        result,
        requestId
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        this.sendToWebview(MessageType.STATUS, {
          message: 'Analysis cancelled',
          type: 'info'
        });
      } else {
        this.handleError(error);
      }
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  private handleCancelRequest(message: MessageEnvelope<CancelRequestPayload>) {
    const controller = this.abortControllers.get(message.payload.requestId);
    if (controller) {
      controller.abort(new Error('User cancelled'));
      this.abortControllers.delete(message.payload.requestId);
    }
  }

  registerRoutes() {
    // ... existing routes
    this.messageRouter.set(MessageType.CANCEL_REQUEST, this.handleCancelRequest.bind(this));
  }
}
```

---

### Phase 3: UI Components

**Update LoadingIndicator**:

```tsx
// LoadingIndicator.tsx
interface LoadingIndicatorProps {
  statusMessage?: string;
  defaultMessage?: string;
  onCancel?: () => void; // NEW
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  statusMessage,
  defaultMessage = 'Processing...',
  onCancel
}) => (
  <div className="loading-indicator">
    <div className="loading-header">
      <div className="spinner"></div>
      <div className="loading-text">
        <div>{statusMessage || defaultMessage}</div>
      </div>
      {onCancel && (
        <button onClick={onCancel} className="cancel-button" title="Cancel request">
          ✕ Cancel
        </button>
      )}
    </div>
    <LoadingWidget />
  </div>
);
```

**Wire in AnalysisTab**:

```tsx
// AnalysisTab.tsx
{isLoading && (
  <LoadingIndicator
    statusMessage={statusMessage}
    defaultMessage="Analyzing..."
    onCancel={cancelAnalysis} // from useAnalysis hook
  />
)}
```

**Apply to all tabs**: SearchTab, MetricsTab, UtilitiesTab (dictionary/context sections)

---

### Phase 4: Message Contracts

**Add to `MessageType` enum** (src/shared/types/messages/base.ts):

```typescript
export enum MessageType {
  // ... existing types
  CANCEL_REQUEST = 'cancelRequest',
}
```

**Create `CancelRequestPayload`** (src/shared/types/messages/base.ts or domain-specific file):

```typescript
export interface CancelRequestPayload {
  requestId: string;
  domain: 'analysis' | 'dictionary' | 'context' | 'search' | 'metrics';
}

export type CancelRequestMessage = MessageEnvelope<CancelRequestPayload>;
```

**Update all AI request payloads** to include `requestId?`:

```typescript
// Example: AnalyzeDialoguePayload
export interface AnalyzeDialoguePayload {
  text: string;
  sourceUri?: string;
  relativePath?: string;
  requestId?: string; // NEW
}
```

---

## Acceptance Criteria

- ✅ Cancel button appears during all loading states
- ✅ Domain hooks manage AbortControllers (create on request, cleanup on complete/abort)
- ✅ Backend handlers track signals by request ID
- ✅ Users can cancel analysis, dictionary, context, search, and metrics requests
- ✅ Cancel button sends `CANCEL_REQUEST` message to backend
- ✅ Backend aborts fetch via AbortController
- ✅ Proper cleanup (no orphaned promises)
- ✅ UI shows "Cancelled" status message after abort
- ✅ No errors in console after cancellation
- ✅ Manual test: Start long request → click cancel → request aborts cleanly

---

## Testing Strategy

### Manual Testing Checklist

1. **Analysis Cancellation**:
   - Start dialogue analysis (long text)
   - Click cancel button
   - Verify loading stops
   - Verify status message shows "Analysis cancelled"
   - Verify no errors in console
   - Verify can start new analysis immediately

2. **Dictionary Cancellation**:
   - Start fast dictionary generation (6 blocks)
   - Click cancel button during first block
   - Verify loading stops
   - Verify subsequent blocks don't execute
   - Verify status message shows "Dictionary generation cancelled"

3. **Context Cancellation**:
   - Start context generation with multiple resources
   - Click cancel button
   - Verify loading stops
   - Verify status message shows "Context generation cancelled"

4. **Search Cancellation**:
   - Start word search on large corpus
   - Click cancel button
   - Verify loading stops
   - Verify status message shows "Search cancelled"

5. **Metrics Cancellation**:
   - Start metrics calculation (if applicable for AI metrics)
   - Click cancel button
   - Verify loading stops

6. **Edge Cases**:
   - Click cancel after request completes (should be no-op)
   - Click cancel multiple times (should handle gracefully)
   - Start new request after cancelling (should work normally)

---

## Files to Create/Update

### Create
- `src/presentation/webview/utils/requestId.ts` (request ID generation)

### Update - Domain Hooks (Phase 1)
- `src/presentation/webview/hooks/domain/useAnalysis.ts`
- `src/presentation/webview/hooks/domain/useDictionary.ts`
- `src/presentation/webview/hooks/domain/useContext.ts`
- `src/presentation/webview/hooks/domain/useSearch.ts`
- `src/presentation/webview/hooks/domain/useMetrics.ts`

### Update - Backend Handlers (Phase 2)
- `src/application/handlers/domain/AnalysisHandler.ts`
- `src/application/handlers/domain/DictionaryHandler.ts`
- `src/application/handlers/domain/ContextHandler.ts`
- `src/application/handlers/domain/SearchHandler.ts`
- `src/application/handlers/domain/MetricsHandler.ts`

### Update - UI Components (Phase 3)
- `src/presentation/webview/components/shared/LoadingIndicator.tsx`
- `src/presentation/webview/components/tabs/AnalysisTab.tsx`
- `src/presentation/webview/components/tabs/SearchTab.tsx`
- `src/presentation/webview/components/tabs/MetricsTab.tsx`
- `src/presentation/webview/components/tabs/UtilitiesTab.tsx`

### Update - Message Contracts (Phase 4)
- `src/shared/types/messages/base.ts` (add CANCEL_REQUEST enum, CancelRequestPayload)
- `src/shared/types/messages/analysis.ts` (add requestId to payloads)
- `src/shared/types/messages/dictionary.ts` (add requestId to payloads)
- `src/shared/types/messages/context.ts` (add requestId to payloads)
- `src/shared/types/messages/search.ts` (add requestId to payloads)
- `src/shared/types/messages/metrics.ts` (add requestId to payloads)

---

## Implementation Phases

**Phase 1** (1-1.5 hours): Domain hooks state management
- Add AbortController state to hooks
- Add cancel methods
- Generate request IDs

**Phase 2** (1.5-2 hours): Backend signal registry
- Add AbortController maps to handlers
- Pass signals to orchestrator
- Handle CANCEL_REQUEST messages

**Phase 3** (1 hour): UI components
- Add onCancel prop to LoadingIndicator
- Wire cancel buttons in all tabs

**Phase 4** (30-45 minutes): Message contracts
- Add CANCEL_REQUEST type
- Update payloads with requestId

**Testing** (1 hour): Manual testing all scenarios

**Total**: 4-6 hours

---

## Risks and Considerations

### Risks
- ⚠️ Race conditions: Cancel arriving after completion (handled by checking controller existence)
- ⚠️ Orphaned promises: Need cleanup in all code paths (use `finally` blocks)
- ⚠️ State management complexity: Need to track request IDs across boundary

### Mitigations
- ✅ Use `finally` for cleanup (guaranteed execution)
- ✅ Check controller existence before aborting (prevent errors)
- ✅ Generate unique request IDs (timestamp + counter)
- ✅ Clean up maps in handlers (delete after completion)

---

## References

**Architecture Debt**:
- [Request Cancellation UI Exposure](./../../../architecture-debt/2025-11-21-request-cancellation-ui-exposure.md)

**Related PRs**:
- PR #31: Fast Dictionary Generation (backend cancellation infrastructure)
- PR #37: LoadingIndicator extraction

**Web APIs**:
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)

---

**Created**: 2025-12-03
