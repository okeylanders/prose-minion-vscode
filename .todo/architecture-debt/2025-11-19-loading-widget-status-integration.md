# Loading Indicator & Status Integration

**Date Identified**: 2025-11-19
**Identified During**: Search status wiring + Code Review
**Priority**: Medium
**Estimated Effort**: 2-3 hours

## Problem

Two related DRY violations in the loading indicator pattern:

### 1. Duplicated Loading UI Structure

The loading indicator JSX is duplicated across 4 tab components with nearly identical structure:

| Component | Lines | Default Message |
|-----------|-------|-----------------|
| AnalysisTab.tsx | 434-449 | "Analyzing..." |
| UtilitiesTab.tsx | 295-304 | "Generating dictionary entry..." |
| SearchTab.tsx | 268-276 | "Running search..." |
| MetricsTab.tsx | 370-378 | "Calculating metrics..." |

**~40 lines duplicated across 4 files**

### 2. Duplicated Status Message Wiring

Each tab manually renders status text and routes STATUS messages through App.tsx:
- App routes STATUS to domain hooks (analysis/dictionary/search)
- Each tab renders its own status text above LoadingWidget (`statusMessage || fallback`)
- LoadingWidget does not receive or render status

## Current Implementation

```tsx
// Duplicated in each tab component
{isLoading && (
  <div className="loading-indicator">
    <div className="loading-header">
      <div className="spinner"></div>
      <div className="loading-text">
        <div>{statusMessage || 'Default message...'}</div>
        {/* Optional: guide ticker in AnalysisTab only */}
      </div>
    </div>
    <LoadingWidget />
  </div>
)}
```

## Recommendation

### Extract LoadingIndicator Component

Create a shared component that handles both UI structure and status:

```tsx
// src/presentation/webview/components/shared/LoadingIndicator.tsx

interface LoadingIndicatorProps {
  isLoading: boolean;
  statusMessage?: string;
  defaultMessage: string;
  guideNames?: string;
  statusSource?: string;  // e.g., 'extension.search' for auto-registration
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  statusMessage,
  defaultMessage,
  guideNames,
  statusSource
}) => {
  // Optional: auto-register STATUS handler if statusSource provided
  // useEffect to register/unregister with useMessageRouter

  if (!isLoading) return null;

  return (
    <div className="loading-indicator">
      <div className="loading-header">
        <div className="spinner"></div>
        <div className="loading-text">
          <div>{statusMessage || defaultMessage}</div>
          {guideNames && (
            <div className="guide-ticker-container">
              <div className="guide-ticker">{guideNames}</div>
            </div>
          )}
        </div>
      </div>
      <LoadingWidget />
    </div>
  );
};
```

### Usage

```tsx
// AnalysisTab.tsx
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Analyzing..."
  guideNames={guideNames}
/>

// SearchTab.tsx - simpler
<LoadingIndicator
  isLoading={isLoading}
  defaultMessage="Running search..."
  statusSource="extension.search"  // auto-register STATUS handler
/>
```

## Impact

### Benefits
- Eliminates ~40 lines of duplicated JSX
- Reduces duplicated status wiring per tab
- Lowers risk of missing STATUS display for new tools
- Centralizes UX for loading + ticker effects
- Single place to add features (cancel button, progress bar)

### Trade-offs
- Need to update 4 components to use new pattern
- Optional status auto-registration adds complexity

## Related Work

- See [ADR: Cross-Cutting UI Improvements](../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md) for cancellable loading states
- [LoadingWidget.tsx](../../src/presentation/webview/components/LoadingWidget.tsx) - existing shared component

## Files to Update

- `src/presentation/webview/components/AnalysisTab.tsx`
- `src/presentation/webview/components/UtilitiesTab.tsx`
- `src/presentation/webview/components/SearchTab.tsx`
- `src/presentation/webview/components/MetricsTab.tsx`
- `src/presentation/webview/App.tsx` (if status routing changes)
