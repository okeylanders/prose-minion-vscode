# Sprint 02: Cancellable Loading States

**Sprint ID**: 02-cancellable-loading
**Epic**: [UI Cross-Cutting Improvements](../epic-ui-cross-cutting.md)
**Status**: Pending
**Estimated Effort**: 0.5 days
**Branch**: `sprint/epic-ui-cross-cutting-2025-11-18-02-cancellable-loading`
**Depends On**: Sprint 01 (optional, can run in parallel)
**ADR**: [ADR-2025-11-18](../../../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md)

## Goal

Add cancel button to AI-powered feature loading indicators with actual request cancellation.

## Scope

### In Scope
- Extract reusable LoadingIndicator component
- Add AbortController pattern to AI operations
- Apply to: Category Search, Word Search, Prose Analysis, Dialogue Analysis, Context Assistant, Dictionary

### Out of Scope
- Request queuing
- Auto-retry after cancel
- Timeout auto-cancel

## Tasks

### 1. Extract LoadingIndicator Component
**File**: `src/presentation/webview/components/LoadingIndicator.tsx` (new)

- [ ] Create reusable component:
  ```typescript
  interface LoadingIndicatorProps {
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }

  export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    message,
    showCancel = false,
    onCancel
  }) => (
    <div className="loading-indicator">
      <div className="loading-header">
        <div className="spinner"></div>
        <div className="loading-text">
          <div>{message}</div>
        </div>
      </div>
      {showCancel && onCancel && (
        <button
          className="cancel-button"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
      <LoadingWidget />
    </div>
  );
  ```

### 2. Add CSS for Cancel Button
**File**: `src/presentation/webview/styles.css`

- [ ] Style cancel button:
  ```css
  .loading-indicator .cancel-button {
    margin-top: 8px;
    padding: 4px 12px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .loading-indicator .cancel-button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
  ```

### 3. Add AbortController to useSearch
**File**: `src/presentation/webview/hooks/domain/useSearch.ts`

- [ ] Add abort controller ref:
  ```typescript
  const abortControllerRef = useRef<AbortController | null>(null);
  ```
- [ ] Create abort controller before search:
  ```typescript
  const performCategorySearch = useCallback(async () => {
    abortControllerRef.current = new AbortController();
    // ... send message with signal context
  }, []);
  ```
- [ ] Add cancel action:
  ```typescript
  const cancelCategorySearch = useCallback(() => {
    abortControllerRef.current?.abort();
    setContextSearch(prev => ({ ...prev, isLoading: false }));
  }, []);
  ```
- [ ] Export cancel action

### 4. Backend AbortController Support
**File**: `src/infrastructure/api/OpenRouterClient.ts`

- [ ] Add signal support to fetch calls:
  ```typescript
  async chat(messages, options, signal?: AbortSignal) {
    const response = await fetch(url, {
      // ... existing options
      signal
    });
  }
  ```

### 5. Update Message Protocol (if needed)
- [ ] Consider if cancel needs a message type
- [ ] Alternative: Cancel on frontend only (abort + reset state)

### 6. Apply to SearchTab
**File**: `src/presentation/webview/components/SearchTab.tsx`

- [ ] Replace inline loading divs with LoadingIndicator
- [ ] Pass showCancel={true} and onCancel handler

### 7. Apply to Other Components
- [ ] AnalysisTab (Prose/Dialogue Analysis)
- [ ] ContextTab (Context Assistant)
- [ ] DictionaryTab (Dictionary lookup)

## Acceptance Criteria

- [ ] Cancel button appears on all AI loading indicators
- [ ] Clicking cancel stops the loading state immediately
- [ ] Cancelled requests don't update state when they complete
- [ ] No console errors from aborted requests
- [ ] Pattern is reusable for future AI features

## Testing Checklist

**Test Case 1: Cancel Category Search**
- Input: Start category search, click Cancel
- Expected: Loading stops, no result displayed
- Result: /

**Test Case 2: Cancel Doesn't Cause Errors**
- Input: Start search, cancel, check console
- Expected: No errors (AbortError is caught)
- Result: /

**Test Case 3: Cancelled Request Ignored**
- Input: Start search, cancel, wait for response
- Expected: Response doesn't update state
- Result: /

**Test Case 4: Normal Flow Still Works**
- Input: Start search, let complete
- Expected: Results display normally
- Result: /

## Implementation Notes

### AbortController Pattern

```typescript
// In hook
const abortControllerRef = useRef<AbortController | null>(null);

const performSearch = useCallback(() => {
  abortControllerRef.current = new AbortController();

  vscode.postMessage({
    type: MessageType.CATEGORY_SEARCH_REQUEST,
    // ... payload
  });
}, []);

const cancelSearch = useCallback(() => {
  abortControllerRef.current?.abort();
  setIsLoading(false);
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => abortControllerRef.current?.abort();
}, []);
```

### Backend Abort Handling

Since we're using postMessage, true abort requires either:
1. Backend checks abort flag before processing (complex)
2. Frontend ignores response after abort (simpler)

**Recommendation**: Start with option 2 (frontend ignores response after abort).

```typescript
const handleResult = (message) => {
  // Ignore if aborted
  if (abortControllerRef.current?.signal.aborted) return;

  setResult(message.payload.result);
};
```

## Definition of Done

- [ ] All tasks completed
- [ ] LoadingIndicator component extracted
- [ ] Cancel works for all AI features
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] No TypeScript errors
- [ ] PR ready for review

## Outcomes

*To be filled after sprint completion*

- **PR**: #[number]
- **Completion Date**: YYYY-MM-DD
- **Actual Effort**: [hours/days]
- **Components Updated**: [list]
