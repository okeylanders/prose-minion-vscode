# React.memo Performance Optimization

**Date Identified**: 2025-11-19
**Identified During**: Presentation Layer Architecture Review
**Priority**: Medium
**Estimated Effort**: 2-3 hours

## Problem

Tab components with 30+ props are not wrapped in `React.memo()`, causing full re-renders when any parent state changes. When App.tsx updates `analysis.statusMessage`, the entire `SearchTab` and `MetricsTab` re-render unnecessarily.

## Current Implementation

```tsx
// SearchTab.tsx - no memoization
export const SearchTab: React.FC<SearchTabProps> = ({
  vscode,
  result,
  isLoading,
  // ... 49 more props
}) => {
  // 666 lines of component
};
```

**Impact:**
- Every state change in App.tsx triggers re-render of all visible tabs
- Settings changes cause cascade of re-renders
- Token usage updates trigger re-renders
- Status message updates trigger re-renders

## Recommendation

### 1. Wrap Tab Components in React.memo

```tsx
// SearchTab.tsx
export const SearchTab = React.memo<SearchTabProps>(({
  vscode,
  result,
  isLoading,
  // ...
}) => {
  // Component implementation
});

SearchTab.displayName = 'SearchTab';
```

### 2. Add Custom Comparison for Complex Props

For components with object props that may be referentially different but value-equal:

```tsx
export const SearchTab = React.memo<SearchTabProps>(
  (props) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (should NOT re-render)

    // Quick checks for primitives
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.result !== nextProps.result) return false;
    if (prevProps.pathText !== nextProps.pathText) return false;

    // Deep check for settings objects
    if (!shallowEqual(prevProps.wordSearchSettings, nextProps.wordSearchSettings)) {
      return false;
    }

    // Callbacks should be stable (wrapped in useCallback)
    // so we can skip checking them

    return true;
  }
);
```

### 3. Ensure Callback Stability in App.tsx

For memo to work, callbacks must be stable:

```tsx
// App.tsx - callbacks should use useCallback

// BAD - creates new function every render
<SearchTab
  onLoadingChange={(loading) => search.setLoading(loading)}
/>

// GOOD - stable callback reference
const handleSearchLoadingChange = React.useCallback(
  (loading: boolean) => search.setLoading(loading),
  [search.setLoading]
);

<SearchTab
  onLoadingChange={handleSearchLoadingChange}
/>

// BETTER - pass hook method directly (already stable)
<SearchTab
  onLoadingChange={search.setLoading}
/>
```

### 4. Consider useMemo for Expensive Computations

```tsx
// In components with expensive derived state
const markdownContent = React.useMemo(() => {
  if (!result) return '';
  return formatSearchResultAsMarkdown(result);
}, [result]);
```

## Components to Memoize

| Component | Props | Priority |
|-----------|-------|----------|
| SearchTab | 52 | High |
| AnalysisTab | 34 | High |
| MetricsTab | 29 | High |
| UtilitiesTab | 20 | Medium |
| SettingsOverlay | 15+ | Medium |

## Impact

### Benefits of Fixing

1. **Fewer re-renders** - Components only update when their props change
2. **Better performance** - Especially noticeable with frequent state updates
3. **Smoother UX** - Less jank during typing and interactions
4. **Lower CPU usage** - Important for long editing sessions

### Trade-offs

1. **Memory overhead** - React stores previous props for comparison
2. **Comparison cost** - Custom comparers add some overhead
3. **Debugging complexity** - Memoization can hide bugs

### When NOT to Memoize

- Simple components with few props
- Components that always re-render anyway
- Components with unstable props (new objects/functions every render)

## Verification

Use React DevTools Profiler to verify:
1. Before: Observe all tabs re-rendering on any state change
2. After: Observe only affected tabs re-rendering

Add highlight updates in React DevTools:
- Settings → Highlight updates when components render

## Files to Update

- `src/presentation/webview/components/SearchTab.tsx`
- `src/presentation/webview/components/AnalysisTab.tsx`
- `src/presentation/webview/components/MetricsTab.tsx`
- `src/presentation/webview/components/UtilitiesTab.tsx`
- `src/presentation/webview/components/SettingsOverlay.tsx`
- `src/presentation/webview/App.tsx` (ensure callback stability)

## References

- [React.memo documentation](https://react.dev/reference/react/memo)
- [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
