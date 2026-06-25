# Sprint 02: Loading Indicator Integration

**Sub-Epic**: [Component Decomposition](../epic-component-decomposition.md)
**Status**: 🟢 Ready to Start
**Priority**: HIGH
**Duration**: 2-3 hours
**Branch**: `sprint/component-decomposition-02-loading-indicator`
**Depends on**: Sprint 01 (Scope Box) ✅ Complete

---

## Problem

Loading states are **inconsistent across 4 tabs** with duplicated JSX, scattered status wiring, and separate LoadingWidget component that should be integrated:

### 1. Duplicated Loading UI Structure (~40 lines)

Each tab component duplicates nearly identical loading indicator JSX:

| Component | Lines | Message | Status |
|-----------|-------|---------|--------|
| AnalysisTab.tsx | 434-449 | "Analyzing..." | Has guide ticker |
| UtilitiesTab.tsx | 295-304 | "Generating dictionary entry..." | Has progress bar |
| SearchTab.tsx | 268-276 | "Running search..." | No ticker/progress |
| MetricsTab.tsx | 370-378 | "Calculating metrics..." | No ticker/progress |

**Pattern**: Spinner + loading text + LoadingWidget, repeated with minor variations.

### 2. Fragmented Status Message Wiring

Status rendering scattered across layers:
- App routes STATUS messages to domain hooks
- Each tab manually renders status text: `{statusMessage || fallback}`
- LoadingWidget doesn't receive or render status
- Guide ticker (AnalysisTab) hardcoded in component

**Result**: Hard to add features like cancel buttons, progress tracking, error recovery.

### 3. Missing Progress Bar Component

Fast Dictionary (UtilitiesTab) has inline progress bar pattern (PR #31) that:
- Only exists in one place
- Can't be reused by Context Search or Metrics
- Blocks unified progress feedback across tools

### 4. Separate LoadingWidget Component

`LoadingWidget.tsx` (2.2 KB) exists separately as an animated GIF component:
- Shows randomized assistant-working animation
- Not integrated with status messages or spinner
- Requires separate import and rendering
- Should be part of unified loading component, not separate

**Impact**: Two loading components (`LoadingWidget` + inline loading JSX) instead of one unified component.

---

## Solution

Create **unified `LoadingIndicator` component** that integrates:

1. ✅ Status message display
2. ✅ Spinner animation
3. ✅ Progress bar (from Fast Dictionary pattern)
4. ✅ Animated GIF (consolidate LoadingWidget.tsx functionality)
5. ✅ Guide ticker (for Analysis tab)
6. ✅ Optional cancel button (extensible for future)

**Goal**: All loading states travel together as one component, not scattered pieces.

**Key Change**: **Consolidate LoadingWidget into LoadingIndicator**
- Merge LoadingWidget's animated GIF functionality into LoadingIndicator
- Delete LoadingWidget.tsx (no longer needed as separate component)
- LoadingIndicator becomes the single, unified loading component

### Component Specification

```typescript
// src/presentation/webview/components/shared/LoadingIndicator.tsx

interface LoadingIndicatorProps {
  isLoading: boolean;
  statusMessage?: string;
  defaultMessage: string;
  guideNames?: string;           // Analysis tab guide ticker
  progress?: {
    current: number;             // Items processed
    total: number;               // Total items to process
    label?: string;              // Optional custom label
  };
  onCancel?: () => void;         // For cancellable operations
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

  // Animated GIF selection (consolidated from LoadingWidget)
  const pickRandomGif = () => {
    const assets = window.proseMinonAssets;
    const arr = assets?.loadingGifs?.length > 0
      ? assets.loadingGifs
      : (assets?.vhsLoadingGif ? [assets.vhsLoadingGif] : []);
    if (arr.length === 0) return { src: '', creditLabel: '', creditHref: '' };
    const idx = Math.floor(Math.random() * arr.length);
    const src = arr[idx];
    // Derive filename for credit lookup
    let creditLabel = '', creditHref = '';
    try {
      const url = new URL(src, window.location.origin);
      const filename = url.pathname.split('/').pop() || '';
      const entry = assets?.loadingGifCredits?.[filename];
      if (entry) {
        if (typeof entry === 'string') {
          creditLabel = entry;
        } else {
          creditLabel = entry.label;
          creditHref = entry.href;
        }
      }
    } catch { /* ignore */ }
    return { src, creditLabel, creditHref };
  };

  const { src, creditLabel, creditHref } = pickRandomGif();

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

      {/* Progress bar (optional) */}
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

      {/* Animated GIF (consolidated from LoadingWidget.tsx) */}
      <div className="loading-vhs-container">
        <img
          src={src}
          alt="Assistant processing"
          className="loading-vhs-animation"
        />
      </div>
      {(creditLabel || creditHref) && (
        <div className="loading-credit">
          {creditHref ? (
            <a href={creditHref} target="_blank" rel="noopener noreferrer">
              {creditLabel || creditHref}
            </a>
          ) : (
            <>{creditLabel}</>
          )}
        </div>
      )}
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

// SearchTab.tsx - simple with optional cancel
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Running search..."
  onCancel={() => handleCancelSearch()}
/>

// MetricsTab.tsx - minimal
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Calculating metrics..."
/>
```

---

## Tasks

### Part 1: Create LoadingIndicator Component (45 min)

- [ ] Create file: `src/presentation/webview/components/shared/LoadingIndicator.tsx`
- [ ] **Consolidate LoadingWidget functionality**:
  - [ ] Copy animated GIF logic from `LoadingWidget.tsx`
  - [ ] Copy `pickRandomGif()` function (with window.proseMinonAssets logic)
  - [ ] Copy GIF rendering JSX (loading-vhs-container + credit)
  - [ ] Add global type declaration for window.proseMinonAssets
- [ ] Implement LoadingIndicatorProps interface
- [ ] Implement unified component structure:
  - [ ] Return null when `!isLoading`
  - [ ] Render spinner + status message
  - [ ] Conditionally render guide ticker
  - [ ] Conditionally render progress bar
  - [ ] Conditionally render cancel button
  - [ ] Render animated GIF (integrated, not separate LoadingWidget)
  - [ ] Render GIF credits if available
- [ ] Add CSS classes (reuse existing spinner/loading styles from tabs)
- [ ] Export from barrel: `src/presentation/webview/components/shared/index.ts`
- [ ] Verify TypeScript compilation succeeds

### Part 2: Update AnalysisTab (15 min)

- [ ] Import LoadingIndicator from shared components
- [ ] Remove old loading JSX (lines ~434-449)
- [ ] Replace with LoadingIndicator:
```tsx
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Analyzing..."
  guideNames={guideNames}
/>
```
- [ ] Verify guide ticker still renders
- [ ] Verify LoadingWidget displays

### Part 3: Update SearchTab (15 min)

- [ ] Import LoadingIndicator from shared components
- [ ] Remove old loading JSX (lines ~268-276)
- [ ] Replace with LoadingIndicator:
```tsx
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Running search..."
/>
```
- [ ] Verify status messages display correctly
- [ ] Verify LoadingWidget displays

### Part 4: Update MetricsTab (15 min)

- [ ] Import LoadingIndicator from shared components
- [ ] Remove old loading JSX (lines ~370-378)
- [ ] Replace with LoadingIndicator:
```tsx
<LoadingIndicator
  isLoading={isLoading}
  statusMessage={statusMessage}
  defaultMessage="Calculating metrics..."
/>
```
- [ ] Verify status messages display correctly
- [ ] Verify LoadingWidget displays

### Part 5: Update UtilitiesTab (20 min)

- [ ] Import LoadingIndicator from shared components
- [ ] Remove old loading JSX (lines ~295-304)
- [ ] **Extract progress tracking state** (completedBlocks, totalBlocks):
  - Verify these values come from the UI state
  - If inline, extract to component state
  - Document where progress values come from
- [ ] Replace with LoadingIndicator with progress:
```tsx
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
```
- [ ] Remove inline progress bar JSX (if any)
- [ ] Verify progress bar renders correctly

### Part 6: Delete LoadingWidget.tsx (5 min)

- [ ] **Delete obsolete component**: `git rm src/presentation/webview/components/shared/LoadingWidget.tsx`
- [ ] **Update barrel export**: Remove LoadingWidget from `src/presentation/webview/components/shared/index.ts`
- [ ] **Verify no remaining imports**:
```bash
grep -r "LoadingWidget" src/presentation/webview/
```
- [ ] Should only find references in LoadingIndicator (as comments/consolidated code)
- [ ] TypeScript compilation should succeed with zero errors

**Rationale**: LoadingWidget functionality is now fully integrated into LoadingIndicator. The separate component is no longer needed.

### Part 7: Cleanup & Testing (15 min)

- [ ] Verify all 4 tabs use LoadingIndicator
- [ ] Run: `npm run build`
- [ ] Run: `npm test`
- [ ] Manual testing:
  - [ ] Analysis tab: Trigger loading, verify spinner + status + guide ticker
  - [ ] Search tab: Trigger loading, verify spinner + status
  - [ ] Metrics tab: Trigger loading, verify spinner + status
  - [ ] Utilities tab: Trigger loading, verify spinner + progress + status
- [ ] Verify no regressions (all loading states work as before)

---

## Acceptance Criteria

### Code Quality
- ✅ LoadingIndicator component created with all props
- ✅ Component handles all variants (guide ticker, progress, cancel button)
- ✅ Exported from shared components barrel
- ✅ No code duplication in tabs
- ✅ TypeScript types correct

### Functionality
- ✅ All 4 tabs render LoadingIndicator
- ✅ Status messages display correctly
- ✅ Guide ticker (AnalysisTab) renders
- ✅ Progress bar (UtilitiesTab) renders with correct values
- ✅ Animated GIF renders in all tabs (consolidated from LoadingWidget)
- ✅ GIF credits display when available
- ✅ No regressions in loading behavior

### Files
- ✅ New file: `src/presentation/webview/components/shared/LoadingIndicator.tsx` (~120 lines, includes GIF logic)
- ✅ **Deleted file**: `src/presentation/webview/components/shared/LoadingWidget.tsx` (functionality consolidated)
- ✅ Updated: `src/presentation/webview/components/shared/index.ts` (removed LoadingWidget, added LoadingIndicator)
- ✅ Updated: AnalysisTab.tsx (removed ~15 lines loading JSX)
- ✅ Updated: SearchTab.tsx (removed ~8 lines loading JSX)
- ✅ Updated: MetricsTab.tsx (removed ~8 lines loading JSX)
- ✅ Updated: UtilitiesTab.tsx (removed ~9 lines loading JSX)

### Tests
- ✅ TypeScript compilation succeeds
- ✅ `npm test` passes
- ✅ No new warnings or errors
- ✅ Build succeeds: `npm run build`

---

## Files to Create

```
src/presentation/webview/components/shared/
└─ LoadingIndicator.tsx (~80 lines)
```

## Files to Update

```
src/presentation/webview/components/shared/
├─ index.ts (add barrel export)

src/presentation/webview/components/
├─ AnalysisTab.tsx (replace loading JSX, ~15 lines removed)
├─ SearchTab.tsx (replace loading JSX, ~8 lines removed)
├─ MetricsTab.tsx (replace loading JSX, ~8 lines removed)
└─ UtilitiesTab.tsx (replace loading JSX + extract progress state, ~9 lines removed)
```

---

## Testing Checklist

### Manual Testing
- [ ] Open Analysis tab → trigger analysis → verify:
  - [ ] Spinner renders
  - [ ] Status message displays (or default "Analyzing...")
  - [ ] Guide ticker displays craft guide names
  - [ ] LoadingWidget shows token cost
- [ ] Open Search tab → trigger search → verify:
  - [ ] Spinner renders
  - [ ] Status message displays (or default "Running search...")
  - [ ] LoadingWidget shows token cost
- [ ] Open Metrics tab → trigger metrics → verify:
  - [ ] Spinner renders
  - [ ] Status message displays (or default "Calculating metrics...")
  - [ ] LoadingWidget shows token cost
- [ ] Open Utilities tab → trigger dictionary generation → verify:
  - [ ] Spinner renders
  - [ ] Status message displays
  - [ ] Progress bar renders with correct current/total
  - [ ] Progress bar updates as generation proceeds
  - [ ] LoadingWidget shows token cost

### Automated Testing
- [ ] Run: `npm test`
- [ ] Verify: All tests pass
- [ ] Check: No new TypeScript errors
- [ ] Check: No console warnings
- [ ] Build: `npm run build` succeeds

### Component Integration
- [ ] LoadingIndicator renders when isLoading=true
- [ ] LoadingIndicator doesn't render when isLoading=false
- [ ] All props are optional (component handles missing props)
- [ ] Progress bar only renders when progress prop provided
- [ ] Guide ticker only renders when guideNames provided
- [ ] Cancel button only renders when onCancel provided

---

## Architecture Notes

### Why Unified?

Keeping loading states fragmented across tabs leads to:
- **Maintenance burden**: Fix bug in one loading state, miss others
- **Feature parity issues**: Cancel button in SearchTab? Add to 3 other places
- **Inconsistent UX**: Different loading indicators for same operations

Loading Indicator component ensures:
- ✅ Single place to maintain loading UX
- ✅ Easy to add features (error states, retry buttons, etc.)
- ✅ Consistent experience across all tools

### Extensibility

Current design enables future features:
- **onCancel callback**: Request cancellation (Sprint 04)
- **progress.label**: Custom progress text (e.g., "Analyzing chapter 3 of 12")
- **errorMessage prop**: Error handling in loading state
- **variant prop**: Different visual styles (overlay, inline, sidebar)

### Pattern Alignment

Follows existing shared component pattern:
- Exported from `shared/index.ts` barrel
- Props interface for clear contract
- Optional props for flexibility
- Composes existing LoadingWidget

---

## References

**Architecture Debt**:
- [2025-11-19-loading-widget-status-integration.md](../../../architecture-debt/2025-11-19-loading-widget-status-integration.md)

**Related Components**:
- [src/presentation/webview/components/LoadingWidget.tsx](../../../../src/presentation/webview/components/LoadingWidget.tsx) (token cost tracking)
- [src/presentation/webview/components/AnalysisTab.tsx](../../../../src/presentation/webview/components/AnalysisTab.tsx)
- [src/presentation/webview/components/SearchTab.tsx](../../../../src/presentation/webview/components/SearchTab.tsx)
- [src/presentation/webview/components/MetricsTab.tsx](../../../../src/presentation/webview/components/MetricsTab.tsx)
- [src/presentation/webview/components/UtilitiesTab.tsx](../../../../src/presentation/webview/components/UtilitiesTab.tsx)

**Related Sprint**:
- [Sprint 01: Scope Box Extraction](01-scope-box.md) (must complete first)

**Related Sprints** (depend on this):
- [Sprint 03: Subtab Panels](03-subtab-panels.md) (requires clean components)

---

## Outcomes (Post-Sprint)

**Status**: ✅ Complete
**Completion Date**: 2025-11-22
**Actual Duration**: ~2 hours (as estimated)
**Branch**: sprint/component-decomposition-02-loading-indicator
**Commit**: 0cf8b30

**Deliverables**:

- ✅ LoadingIndicator component created (145 lines)
- ✅ All 4 tabs refactored to use LoadingIndicator
- ✅ ~28 lines of loading JSX eliminated across tabs
- ✅ Progress bar integrated (UtilitiesTab Fast Dictionary)
- ✅ LoadingWidget.tsx deleted (functionality merged into LoadingIndicator)
- ✅ All 244 tests passing

**Code Reduction**:
- AnalysisTab: 17 → 8 lines (9 lines saved)
- SearchTab: 2 loading sections consolidated (4 lines saved)
- MetricsTab: 11 → 6 lines (5 lines saved)
- UtilitiesTab: 40+ → 20 lines (~50% reduction)

**Lessons Learned**:

- **Parallel subagents highly effective**: Updating 4 tabs simultaneously (~3x faster than sequential)
- **Foundation-first approach**: Creating LoadingIndicator before tab updates enabled clean parallel work
- **Optional props pattern**: Enables progressive enhancement (guide ticker, progress bar, cancel button)
- **Consolidation value**: LoadingWidget elimination (75 lines) merged into unified component

**Architecture Debt Resolved**:

- ✅ Closed: `.todo/architecture-debt/2025-11-19-loading-widget-status-integration.md`

**Memory Bank Entry**:

- [Sprint 02 Complete Summary](../../../../.memory-bank/20251122-1530-sprint-02-loading-indicator-complete.md)

---

**Created**: 2025-11-22
**Status**: ✅ Complete (2025-11-22 15:30)
**Next Sprint**: [03-subtab-panels.md](03-subtab-panels.md) 🟢 Now Ready
