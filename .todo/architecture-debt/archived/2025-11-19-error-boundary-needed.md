> **✅ RESOLVED**
> - **PR**: #46
> - **Date**: 2025-12-04
> - **Sprint**: Sub-Epic 4, Sprint 01

# Error Boundary Needed

**Date Identified**: 2025-11-19
**Identified During**: Presentation Layer Architecture Review
**Priority**: Medium
**Estimated Effort**: 1-2 hours

## Problem

No React Error Boundary wraps tab components or critical UI sections. If any component throws (e.g., MarkdownRenderer parsing malformed markdown), the entire UI crashes and user loses all state.

## Current Implementation

```tsx
// App.tsx - no error boundary
return (
  <div className="app">
    {activeTab === TabId.ANALYSIS && <AnalysisTab {...props} />}
    {activeTab === TabId.SEARCH && <SearchTab {...props} />}
    {activeTab === TabId.METRICS && <MetricsTab {...props} />}
    {activeTab === TabId.UTILITIES && <UtilitiesTab {...props} />}
  </div>
);
```

**Risk scenarios:**
- MarkdownRenderer receives malformed markdown → crash
- Component receives undefined prop it expects → crash
- API returns unexpected data structure → crash

## Recommendation

### 1. Create Error Boundary Component

```tsx
// src/presentation/webview/components/shared/ErrorBoundary.tsx

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

### 2. Wrap Critical Sections

```tsx
// App.tsx
import { ErrorBoundary } from './components/shared/ErrorBoundary';

return (
  <div className="app">
    <ErrorBoundary
      fallback={<TabErrorFallback tabName={activeTab} />}
      onError={(error) => {
        // Could send to extension for logging
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
  </div>
);
```

### 3. Create Friendly Fallback UI

```tsx
// src/presentation/webview/components/shared/TabErrorFallback.tsx

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

### 4. Wrap MarkdownRenderer Separately

MarkdownRenderer is high-risk for parsing errors:

```tsx
// In any component using MarkdownRenderer
<ErrorBoundary fallback={<pre>{rawMarkdown}</pre>}>
  <MarkdownRenderer content={markdownContent} />
</ErrorBoundary>
```

## Impact

### Benefits of Fixing

1. **Graceful degradation** - UI doesn't fully crash on errors
2. **User recovery** - Retry button lets user continue
3. **Error logging** - Can send errors to extension for diagnostics
4. **State preservation** - Other tabs remain functional
5. **Better UX** - Friendly error message instead of white screen

### Risks of Not Fixing

1. **Full UI crash** - Single component error kills entire webview
2. **Lost work** - User loses all input and state
3. **Poor UX** - White screen or React error message
4. **No diagnostics** - Errors not logged for debugging

## Implementation Notes

- React Error Boundaries must be class components (can't use hooks)
- Boundaries catch errors in render, lifecycle methods, and constructors
- Boundaries do NOT catch errors in event handlers (use try/catch)
- Consider separate boundaries for each tab if isolation is important

## Files to Create/Update

### Create
- `src/presentation/webview/components/shared/ErrorBoundary.tsx`
- `src/presentation/webview/components/shared/TabErrorFallback.tsx`

### Update
- `src/presentation/webview/App.tsx` - wrap tabs in boundary
- Components with MarkdownRenderer - wrap in boundary

## References

- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- Related: [WEBVIEW_ERROR message type](../../src/shared/types/messages/ui.ts)
