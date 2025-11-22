# Loading Indicator & Status Integration

**Date Identified**: 2025-11-19
**Identified During**: Search status wiring + Code Review
**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Updated**: 2025-11-21 (added progress bar requirement)
**Status**: ✅ RESOLVED (2025-11-22)
**Resolved By**: Sprint 02 - Loading Indicator Integration
**PR**: #37
**Branch**: sprint/component-decomposition-02-loading-indicator

## Problem

Multiple related issues with loading indicator pattern:

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

### 3. Missing Progress Bar Integration

Fast Dictionary Generation uses a progress bar pattern (PR #31) that should be available to all loading states:

- Currently progress bar is inline in UtilitiesTab
- No reusable component for progress tracking
- Other features (Context Search, Metrics) could benefit from progress feedback

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

### Create Unified LoadingIndicator Component

**IMPORTANT**: This should be a **single unified component** that integrates:

1. Status message display
2. Spinner animation
3. Progress bar (from Fast Dictionary pattern)
4. Loading widget (token cost tracking)
5. Guide ticker (for Analysis tab)

**Goal**: All loading states travel together as one component, not separate pieces.

```tsx
// src/presentation/webview/components/shared/LoadingIndicator.tsx

interface LoadingIndicatorProps {
  isLoading: boolean;
  statusMessage?: string;
  defaultMessage: string;
  guideNames?: string;
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  onCancel?: () => void;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  statusMessage,
  defaultMessage,
  guideNames,
  progress,
  onCancel
}) => {
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
        {onCancel && (
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar (from Fast Dictionary pattern) */}
      {progress && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="progress-label">
            {progress.label || `${progress.current} / ${progress.total}`}
          </div>
        </div>
      )}

      {/* Token cost tracking widget */}
      <LoadingWidget />
    </div>
  );
};
```

### Usage Examples

```tsx
// AnalysisTab.tsx - with guide ticker
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Analyzing..."
  guideNames={guideNames}
/>

// UtilitiesTab.tsx - with progress bar
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Generating dictionary entry..."
  progress={{
    current: completedBlocks,
    total: totalBlocks,
    label: `${completedBlocks} of ${totalBlocks} blocks complete`
  }}
/>

// SearchTab.tsx - with cancel button
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Running search..."
  onCancel={() => handleCancelSearch()}
/>

// MetricsTab.tsx - simple
<LoadingIndicator
  isLoading={isLoading}
  defaultMessage="Calculating metrics..."
/>
```

## Impact

### Benefits

- ✅ Eliminates ~40 lines of duplicated JSX
- ✅ Unified component: status + spinner + progress + token cost
- ✅ Progress bar available to all features (not just Fast Dictionary)
- ✅ Single place to add features (cancel button, error recovery)
- ✅ Consistent UX across all loading states
- ✅ Easier to add features like ETA, retry, detailed progress

### Trade-offs

- Need to update 4 tab components to use new pattern
- Progress bar optional (not all features need it)
- Component has multiple responsibilities (acceptable for presentation layer)

## Related Work

- See [ADR: Cross-Cutting UI Improvements](../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md) for cancellable loading states
- [LoadingWidget.tsx](../../src/presentation/webview/components/LoadingWidget.tsx) - existing shared component

## Files to Update

- `src/presentation/webview/components/AnalysisTab.tsx`
- `src/presentation/webview/components/UtilitiesTab.tsx`
- `src/presentation/webview/components/SearchTab.tsx`
- `src/presentation/webview/components/MetricsTab.tsx`
- `src/presentation/webview/App.tsx` (if status routing changes)

---

## Resolution (2025-11-22)

**Resolved by**: [Sprint 02: Loading Indicator Integration](../epics/epic-architecture-health-pass-v1.3/sub-epic-2-component-decomposition/sprints/02-loading-indicator-integration.md)

**Implementation**:

- ✅ Created unified `LoadingIndicator` component (145 lines)
- ✅ Consolidated LoadingWidget functionality into LoadingIndicator (animated GIF + status + spinner)
- ✅ **Deleted** LoadingWidget.tsx (75 lines) - no longer needed as separate component
- ✅ Updated all 4 tabs to use LoadingIndicator
- ✅ Eliminated ~28 lines of duplicated loading JSX across tabs
- ✅ Integrated progress bar support (optional prop)
- ✅ Guide ticker support (AnalysisTab)
- ✅ Cancel button support (extensible for future)

**Key Change**: LoadingWidget was not just composed - it was **fully integrated** into LoadingIndicator and then deleted. The animated GIF logic, credit display, and token cost tracking all moved into the unified component.

**Code Reduction**:

- AnalysisTab: 17 → 8 lines (9 lines saved)
- SearchTab: 2 loading sections consolidated (4 lines saved)
- MetricsTab: 11 → 6 lines (5 lines saved)
- UtilitiesTab: 40+ → 20 lines (~50% reduction)

**Benefits Achieved**:

- ✅ Single source of truth for all loading UI
- ✅ Consistent loading experience across all tools
- ✅ Easy to extend (progress bar, cancel button, error states)
- ✅ Maintainable (changes in one place)

**References**:

- **PR**: [#37](https://github.com/okeylanders/prose-minion-vscode/pull/37)
- **Memory Bank**: [20251122-1530-sprint-02-loading-indicator-complete.md](../../.memory-bank/20251122-1530-sprint-02-loading-indicator-complete.md)
- **Commit**: 0cf8b30
