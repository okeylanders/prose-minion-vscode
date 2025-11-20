# Subtab Panel Extraction

**Date Identified**: 2025-11-19
**Identified During**: Code Review
**Priority**: Medium
**Estimated Effort**: 3-4 hours

## Problem

SearchTab.tsx (666 lines) and MetricsTab.tsx (413 lines) contain inline subtab content that should be extracted into separate panel components. This makes the parent components hard to read and maintain.

## Current Implementation

### SearchTab.tsx (666 lines)

| Section | Lines | Size |
|---------|-------|------|
| Shared (ScopeBox, subtab selector) | 1-203 | ~200 lines |
| Word Search subtab | 204-405 | ~202 lines |
| Category Search subtab | 406-657 | ~252 lines |

### MetricsTab.tsx (413 lines)

| Section | Lines | Size |
|---------|-------|------|
| Shared (ScopeBox, tool selector, Publishing) | 1-299 | ~300 lines |
| Prose Stats button | 300-342 | ~40 lines |
| Word Frequency filter | 343-352 | ~10 lines |
| Results display per tool | 353-413 | ~60 lines |

## Recommendation

### Extract Subtab Panels

Create dedicated panel components for each subtab:

```
src/presentation/webview/components/
├── SearchTab.tsx              (~150 lines - orchestrator)
├── search/
│   ├── WordSearchPanel.tsx    (~210 lines)
│   └── CategorySearchPanel.tsx (~260 lines)
├── MetricsTab.tsx             (~150 lines - orchestrator)
└── metrics/
    ├── ProseStatsPanel.tsx
    ├── StyleFlagsPanel.tsx
    └── WordFrequencyPanel.tsx
```

### SearchTab Refactor

**Before** (666 lines):
```tsx
export const SearchTab: React.FC<SearchTabProps> = ({ /* 20+ props */ }) => {
  // 200 lines of shared logic
  // 200 lines of Word Search UI
  // 250 lines of Category Search UI
};
```

**After** (~150 lines):
```tsx
export const SearchTab: React.FC<SearchTabProps> = (props) => {
  const [activeSubtool, setActiveSubtool] = useState<SearchSubtool>('word');

  return (
    <div className="tab-content">
      <h2>Search</h2>

      {/* Subtab selector */}
      <SubtabSelector active={activeSubtool} onChange={setActiveSubtool} />

      {/* Shared scope - could also be extracted */}
      <ScopeBox {...scopeBoxProps} />

      {/* Subtab content */}
      {activeSubtool === 'word' && (
        <WordSearchPanel
          vscode={props.vscode}
          isLoading={props.isLoading}
          targets={props.wordSearchTargets}
          onTargetsChange={props.onWordSearchTargetsChange}
          settings={props.wordSearchSettings}
          sourceSpec={buildSourceSpec()}
          onLoadingChange={props.onLoadingChange}
        />
      )}

      {activeSubtool === 'category' && (
        <CategorySearchPanel
          vscode={props.vscode}
          isLoading={props.isLoading}
          sourceSpec={buildSourceSpec()}
          onLoadingChange={props.onLoadingChange}
          // ... category-specific props
        />
      )}

      {/* Results display */}
      <SearchResults result={props.result} />
    </div>
  );
};
```

### Panel Props Interface

Each panel gets a focused props interface:

```tsx
interface WordSearchPanelProps {
  vscode: VSCodeAPI;
  isLoading: boolean;
  targets: string;
  onTargetsChange: (targets: string) => void;
  settings: {
    contextWords: number;
    clusterWindow: number;
    minClusterSize: number;
    caseSensitive: boolean;
    updateSetting: (key: string, value: any) => void;
  };
  sourceSpec: TextSourceSpec;
  onLoadingChange: (loading: boolean) => void;
}

interface CategorySearchPanelProps {
  vscode: VSCodeAPI;
  isLoading: boolean;
  sourceSpec: TextSourceSpec;
  onLoadingChange: (loading: boolean) => void;
  relevance: CategoryRelevance;
  wordLimit: CategoryWordLimit;
  onRelevanceChange: (r: CategoryRelevance) => void;
  onWordLimitChange: (l: CategoryWordLimit) => void;
  // model selection props
}
```

## Impact

### Benefits

1. **Readable parent components** - SearchTab becomes ~150 lines
2. **Explicit dependencies** - Props interface documents what each panel needs
3. **Easier to test** - Can test panels in isolation
4. **Parallel development** - Different devs can work on different panels
5. **Focused files** - Each panel file is 200-260 lines, easy to understand

### Trade-offs

1. **More prop drilling** - But this clarifies data flow
2. **More files** - But each file is focused
3. **State split** - Parent owns shared state, children own specific state

## Dependencies

This refactor should happen **after**:
1. ScopeBox extraction (panels would use shared ScopeBox)
2. LoadingIndicator extraction (panels would use shared LoadingIndicator)

## Implementation Order

1. Extract `WordSearchPanel` from SearchTab
2. Extract `CategorySearchPanel` from SearchTab
3. Verify SearchTab works correctly
4. Extract `ProseStatsPanel` from MetricsTab
5. Extract `StyleFlagsPanel` from MetricsTab
6. Extract `WordFrequencyPanel` from MetricsTab
7. Verify MetricsTab works correctly

## Related Files

- [src/presentation/webview/components/SearchTab.tsx](../../src/presentation/webview/components/SearchTab.tsx)
- [src/presentation/webview/components/MetricsTab.tsx](../../src/presentation/webview/components/MetricsTab.tsx)

## References

- [ScopeBox extraction](.todo/architecture-debt/2025-11-19-scope-box-component-extraction.md)
- [LoadingIndicator extraction](.todo/architecture-debt/2025-11-19-loading-widget-status-integration.md)
- [ADR: Cross-Cutting UI Improvements](../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md)
