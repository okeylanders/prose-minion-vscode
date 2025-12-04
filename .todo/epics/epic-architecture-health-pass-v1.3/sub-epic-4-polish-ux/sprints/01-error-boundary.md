# Sprint 01: Error Boundary

**Status**: 🟡 Ready
**Estimated Time**: 1-2 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub4-01-error-boundary`

---

## Problem

No React Error Boundary wraps tab components or critical UI sections. If any component throws (e.g., MarkdownRenderer parsing malformed markdown), the entire UI crashes and user loses all state.

**Risk Scenarios**:
- MarkdownRenderer receives malformed markdown → crash
- Component receives undefined prop it expects → crash
- API returns unexpected data structure → crash

**Current Behavior**: White screen or React error message, all state lost

**Desired Behavior**: Graceful fallback UI with retry button, other tabs remain functional

---

## Tasks

- [ ] Create `ErrorBoundary` component (class component with `getDerivedStateFromError` and `componentDidCatch`)
- [ ] Create `TabErrorFallback` component (friendly error message with retry button)
- [ ] Wrap all tab components in `<ErrorBoundary>` in App.tsx
- [ ] Wrap `MarkdownRenderer` separately (high-risk for parsing errors)
- [ ] Add `WEBVIEW_ERROR` message type for logging errors to extension
- [ ] Test error boundary by throwing intentional error
- [ ] Verify retry button works
- [ ] Verify other tabs remain functional when one crashes

---

## Implementation Details

### 1. ErrorBoundary Component

**File**: `src/presentation/webview/components/shared/ErrorBoundary.tsx`

```tsx
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary-fallback">
          <h3>Something went wrong</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Key Points**:
- Must be class component (Error Boundaries can't use hooks)
- `getDerivedStateFromError` captures error state
- `componentDidCatch` logs error and calls optional `onError` callback
- Retry button resets `hasError` to `false`

---

### 2. TabErrorFallback Component

**File**: `src/presentation/webview/components/shared/TabErrorFallback.tsx`

```tsx
interface TabErrorFallbackProps {
  tabName: string;
  onRetry?: () => void;
}

export const TabErrorFallback: React.FC<TabErrorFallbackProps> = ({ tabName, onRetry }) => (
  <div className="tab-error-fallback">
    <div className="error-icon">⚠️</div>
    <h3>Error in {tabName}</h3>
    <p>Something went wrong rendering this tab.</p>
    <div className="error-actions">
      <button onClick={onRetry}>Retry</button>
      <button onClick={() => window.location.reload()}>Reload Extension</button>
    </div>
  </div>
);
```

---

### 3. Wrap Tabs in App.tsx

```tsx
// App.tsx
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { TabErrorFallback } from './components/shared/TabErrorFallback';

// Inside render
<ErrorBoundary
  fallback={<TabErrorFallback tabName={activeTab} />}
  onError={(error) => {
    vscode.postMessage({
      type: MessageType.WEBVIEW_ERROR,
      source: 'webview.error_boundary',
      payload: { message: error.message, stack: error.stack },
      timestamp: Date.now()
    });
  }}
>
  {activeTab === TabId.ANALYSIS && <AnalysisTab {...props} />}
  {activeTab === TabId.SEARCH && <SearchTab {...props} />}
  {activeTab === TabId.METRICS && <MetricsTab {...props} />}
  {activeTab === TabId.UTILITIES && <UtilitiesTab {...props} />}
</ErrorBoundary>
```

---

### 4. Wrap MarkdownRenderer Separately

In any component using MarkdownRenderer:

```tsx
<ErrorBoundary fallback={<pre>{rawMarkdown}</pre>}>
  <MarkdownRenderer content={markdownContent} />
</ErrorBoundary>
```

**Why**: MarkdownRenderer is high-risk for parsing errors (malformed markdown, large content, etc.)

---

### 5. Add WEBVIEW_ERROR Message Type

**File**: `src/shared/types/messages/ui.ts`

```typescript
export interface WebviewErrorPayload {
  message: string;
  stack?: string;
}

export type WebviewErrorMessage = MessageEnvelope<WebviewErrorPayload>;
```

Add to `MessageType` enum in `base.ts`:

```typescript
export enum MessageType {
  // ... existing types
  WEBVIEW_ERROR = 'webviewError',
}
```

---

### 6. Backend Handler (Optional)

**File**: `src/application/handlers/domain/UIHandler.ts`

```typescript
private handleWebviewError(message: MessageEnvelope<WebviewErrorPayload>): void {
  this.outputChannel.appendLine(`[WEBVIEW ERROR] ${message.payload.message}`);
  if (message.payload.stack) {
    this.outputChannel.appendLine(message.payload.stack);
  }
}
```

Register in `registerRoutes()`:

```typescript
this.messageRouter.set(MessageType.WEBVIEW_ERROR, this.handleWebviewError.bind(this));
```

---

## Acceptance Criteria

- ✅ ErrorBoundary component created with fallback UI
- ✅ TabErrorFallback component created with retry button
- ✅ All tab components wrapped in error boundaries
- ✅ MarkdownRenderer wrapped separately
- ✅ WEBVIEW_ERROR message type added and logged to Output Channel
- ✅ Manual test: Throw error in component → friendly error message appears
- ✅ Manual test: Click "Retry" → component re-renders successfully
- ✅ Manual test: Error in one tab → other tabs remain functional
- ✅ Manual test: MarkdownRenderer error → fallback shows raw markdown

---

## Testing Strategy

### Manual Testing Checklist

1. **Intentional Error**:
   - Add `throw new Error('Test error')` to AnalysisTab
   - Verify TabErrorFallback appears
   - Verify "Retry" button works
   - Verify other tabs (Search, Metrics, Utilities) still functional

2. **MarkdownRenderer Error**:
   - Send malformed markdown to MarkdownRenderer
   - Verify fallback shows raw markdown (not crash)

3. **Error Logging**:
   - Trigger error → check Output Channel for WEBVIEW_ERROR log

4. **Production Behavior**:
   - Remove test errors
   - Verify no performance impact (boundary is lightweight)

---

## Files to Create/Update

### Create
- `src/presentation/webview/components/shared/ErrorBoundary.tsx`
- `src/presentation/webview/components/shared/TabErrorFallback.tsx`

### Update
- `src/presentation/webview/App.tsx` (wrap tabs in ErrorBoundary)
- `src/shared/types/messages/ui.ts` (add WebviewErrorPayload)
- `src/shared/types/messages/base.ts` (add WEBVIEW_ERROR to MessageType enum)
- `src/application/handlers/domain/UIHandler.ts` (handle WEBVIEW_ERROR message)
- Components using MarkdownRenderer (wrap in ErrorBoundary)

---

## References

**Architecture Debt**:
- [Error Boundary Needed](./../../../architecture-debt/2025-11-19-error-boundary-needed.md)

**React Documentation**:
- [Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

**Related**:
- [WEBVIEW_ERROR message type](src/shared/types/messages/ui.ts)

---

**Created**: 2025-12-03
