# Sprint 02: React.memo Performance Optimization

**Status**: 🟡 Ready
**Estimated Time**: 2-3 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub4-02-react-memo-performance`

---

## Problem

Tab components with 30+ props are not wrapped in `React.memo()`, causing full re-renders when any parent state changes. When App.tsx updates `analysis.statusMessage`, the entire `SearchTab` and `MetricsTab` re-render unnecessarily.

**Current Behavior**:
- Every state change in App.tsx triggers re-render of all visible tabs
- Settings changes cause cascade of re-renders
- Token usage updates trigger re-renders
- Status message updates trigger re-renders

**Impact**: Sluggish UX during interactions, unnecessary CPU usage

**Desired Behavior**: Components only re-render when their props actually change

---

## Tasks

- [ ] Wrap `AnalysisTab` in `React.memo()` with displayName
- [ ] Wrap `SearchTab` in `React.memo()` with displayName
- [ ] Wrap `MetricsTab` in `React.memo()` with displayName
- [ ] Wrap `UtilitiesTab` in `React.memo()` with displayName
- [ ] Wrap `SettingsOverlay` in `React.memo()` with displayName
- [ ] Add custom comparison function for components with complex object props
- [ ] Ensure callback stability in App.tsx (verify all callbacks use `useCallback`)
- [ ] Add `useMemo` for expensive computations in components (if needed)
- [ ] Verify with React DevTools Profiler (before/after comparison)

---

## Implementation Details

### 1. Wrap Tab Components in React.memo

**Pattern** (for all tabs):

```tsx
// SearchTab.tsx (before)
export const SearchTab: React.FC<SearchTabProps> = ({
  vscode,
  result,
  isLoading,
  // ... 49 more props
}) => {
  // Component implementation
};

// SearchTab.tsx (after)
export const SearchTab = React.memo<SearchTabProps>(({
  vscode,
  result,
  isLoading,
  // ... 49 more props
}) => {
  // Component implementation
});

SearchTab.displayName = 'SearchTab';
```

**Apply to**:
- `AnalysisTab` (34 props) - High priority
- `SearchTab` (52 props) - High priority
- `MetricsTab` (29 props) - High priority
- `UtilitiesTab` (20 props) - Medium priority
- `SettingsOverlay` (15+ props) - Medium priority

---

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

**Helper Function** (create if needed):

```tsx
// src/presentation/webview/utils/shallowEqual.ts
export function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}
```

---

### 3. Ensure Callback Stability in App.tsx

**Audit pattern**: Verify all callbacks passed to tabs are stable

**Bad** (creates new function every render):
```tsx
<SearchTab
  onLoadingChange={(loading) => search.setLoading(loading)}
/>
```

**Good** (stable callback reference):
```tsx
const handleSearchLoadingChange = React.useCallback(
  (loading: boolean) => search.setLoading(loading),
  [search.setLoading]
);

<SearchTab
  onLoadingChange={handleSearchLoadingChange}
/>
```

**Better** (pass hook method directly - already stable):
```tsx
<SearchTab
  onLoadingChange={search.setLoading}
/>
```

**Action**: Audit all callbacks in App.tsx and ensure they use `useCallback` or are hook methods

---

### 4. Add useMemo for Expensive Computations

**Pattern** (if components have expensive derived state):

```tsx
// In components with expensive computations
const markdownContent = React.useMemo(() => {
  if (!result) return '';
  return formatSearchResultAsMarkdown(result);
}, [result]);
```

**Apply to**:
- Any component formatting large markdown
- Any component with complex data transformations
- Any component with expensive filtering/sorting

**Note**: Don't over-optimize - only add `useMemo` for genuinely expensive operations

---

### 5. Verify with React DevTools Profiler

**Before Optimization**:
1. Open React DevTools Profiler
2. Enable "Highlight updates when components render"
3. Trigger state change (e.g., update token usage)
4. Observe: All tabs re-render (highlighted)

**After Optimization**:
1. Same setup
2. Trigger state change
3. Observe: Only affected tabs re-render

**Profiler Comparison**:
- Record flame graph before/after
- Compare render counts for each component
- Verify fewer renders after optimization

---

## Acceptance Criteria

- ✅ All 5 components wrapped in `React.memo()` with displayName
- ✅ Custom comparison functions added for components with complex props
- ✅ All callbacks in App.tsx are stable (useCallback or hook methods)
- ✅ `useMemo` added for expensive computations (if applicable)
- ✅ React DevTools Profiler shows fewer re-renders after optimization
- ✅ Manual testing: UI remains responsive and correct
- ✅ No regressions: All features still work as expected

---

## Testing Strategy

### React DevTools Profiler Testing

1. **Before Optimization**:
   - Record profiler session
   - Update token usage → observe all tabs re-render
   - Update status message → observe all tabs re-render
   - Count total renders

2. **After Optimization**:
   - Record profiler session
   - Same state changes → observe only affected tabs re-render
   - Compare render counts (should be significantly lower)

3. **Flame Graph Analysis**:
   - Before: Deep re-render cascades
   - After: Shallow re-render (only changed components)

### Manual Testing Checklist

- [ ] Analysis tab: Analyze text → verify results display correctly
- [ ] Search tab: Search word → verify results display correctly
- [ ] Metrics tab: Run metrics → verify results display correctly
- [ ] Utilities tab: Context generation → verify results display correctly
- [ ] Settings overlay: Change settings → verify only settings re-render
- [ ] Token usage update → verify only token widget re-renders (not all tabs)
- [ ] Status message update → verify only status area re-renders (not all tabs)

---

## Components to Memoize (Priority Order)

| Component | Props | Priority | Complexity |
|-----------|-------|----------|------------|
| SearchTab | 52 | High | Custom comparer needed |
| AnalysisTab | 34 | High | Custom comparer needed |
| MetricsTab | 29 | High | Custom comparer needed |
| UtilitiesTab | 20 | Medium | Simple memo |
| SettingsOverlay | 15+ | Medium | Custom comparer needed |

---

## Files to Create/Update

### Create (if needed)
- `src/presentation/webview/utils/shallowEqual.ts` (helper for custom comparison)

### Update
- `src/presentation/webview/components/tabs/AnalysisTab.tsx`
- `src/presentation/webview/components/tabs/SearchTab.tsx`
- `src/presentation/webview/components/tabs/MetricsTab.tsx`
- `src/presentation/webview/components/tabs/UtilitiesTab.tsx`
- `src/presentation/webview/components/SettingsOverlay.tsx`
- `src/presentation/webview/App.tsx` (audit callback stability)

---

## Trade-offs and Considerations

### Benefits
- ✅ Fewer re-renders → better performance
- ✅ Smoother UX during interactions
- ✅ Lower CPU usage in long sessions

### Costs
- ⚠️ Memory overhead (React stores previous props)
- ⚠️ Comparison cost (custom comparers add overhead)
- ⚠️ Debugging complexity (memoization can hide bugs)

### When NOT to Memoize
- Simple components with few props
- Components that always re-render anyway
- Components with unstable props (new objects/functions every render)

**Decision**: Tab components are large, expensive to render, and have stable props → memoization appropriate

---

## References

**Architecture Debt**:
- [React.memo Performance](./../../../architecture-debt/2025-11-19-react-memo-performance.md)

**React Documentation**:
- [React.memo](https://react.dev/reference/react/memo)
- [useCallback](https://react.dev/reference/react/useCallback)
- [useMemo](https://react.dev/reference/react/useMemo)

**External Resources**:
- [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools#profiler)

---

**Created**: 2025-12-03
