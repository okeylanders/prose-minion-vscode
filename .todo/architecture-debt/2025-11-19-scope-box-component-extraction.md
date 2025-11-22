# Scope Box Component Extraction

**Date Identified**: 2025-11-19
**Identified During**: Code Review
**Priority**: Medium
**Estimated Effort**: 2-3 hours

---

## ✅ RESOLVED

**Resolution Date**: 2025-11-22
**Resolved By**: PR #36 - [Sprint 01: Scope Box Extraction](../epics/epic-architecture-health-pass-v1.3/sub-epic-2-component-decomposition/sprints/01-scope-box-extraction.md)
**Status**: Complete

### Resolution Summary

Successfully extracted ScopeBox as a shared component:

- Created `src/presentation/webview/components/shared/ScopeBox.tsx` (193 lines)
- Eliminated 5 duplicate implementations across SearchTab and MetricsTab
- Reduced SearchTab by 44% (-176 lines)
- Reduced MetricsTab by 18% (-76 lines)
- Message posting consolidated inside ScopeBox component
- Full TypeScript type safety with `ScopeBoxProps` interface

See: [Memory Bank Entry](./.memory-bank/20251122-1434-sprint-01-scope-box-extraction-complete.md)

---

## Problem

The Scope Box UI (source mode selector + path input) is duplicated across SearchTab and MetricsTab with nearly identical code. This violates DRY and makes maintenance harder.

### Duplicated Code

**SearchTab.tsx** (lines 113-166): ~53 lines
**MetricsTab.tsx** (lines 245-297): ~52 lines

Both contain:
- 4 tab buttons (Active File, Manuscripts, Chapters, Selection)
- Path/Pattern text input
- Same onClick handlers pattern
- Same CSS classes and structure
- Same disabled state logic

### Example Duplication

```tsx
// SearchTab.tsx (lines 113-155)
<div className="input-container">
  <label className="block text-sm font-medium mb-2">Scope:</label>
  <div className="tab-bar" style={{ marginBottom: '8px' }}>
    <button
      className={`tab-button ${sourceMode === 'activeFile' ? 'active' : ''}`}
      onClick={() => {
        onSourceModeChange('activeFile');
        onRequestActiveFile();
      }}
      disabled={isLoading}
    >
      <span className="tab-label">Active File</span>
    </button>
    // ... 3 more identical buttons ...
  </div>
  <input ... />
</div>

// MetricsTab.tsx (lines 245-297) - NEARLY IDENTICAL
<div className="input-container">
  <label className="block text-sm font-medium mb-2">Scope:</label>
  <div className="tab-bar" style={{ marginBottom: '8px' }}>
    <button
      className={`tab-button ${sourceMode === 'activeFile' ? 'active' : ''}`}
      onClick={() => {
        onSourceModeChange('activeFile');
        onRequestActiveFile();
      }}
      disabled={isLoading}
    >
      <span className="tab-label">Active File</span>
    </button>
    // ... 3 more identical buttons ...
  </div>
  <input ... />
</div>
```

### Additional Duplication in App.tsx

The `scopeRequester` pattern and message posting is also duplicated:

```tsx
// For MetricsTab (lines 347-373)
onRequestActiveFile={() => {
  setScopeRequester('metrics');
  vscode.postMessage({
    type: MessageType.REQUEST_ACTIVE_FILE,
    source: 'webview.metrics.tab',
    payload: {},
    timestamp: Date.now()
  });
}}

// For SearchTab (lines 399-425) - SAME PATTERN
onRequestActiveFile={() => {
  setScopeRequester('search');
  vscode.postMessage({
    type: MessageType.REQUEST_ACTIVE_FILE,
    source: 'webview.search.tab',
    payload: {},
    timestamp: Date.now()
  });
}}
```

## Recommendation

### 1. Extract ScopeBox Component

Create a shared component:

```tsx
// src/presentation/webview/components/shared/ScopeBox.tsx

interface ScopeBoxProps {
  sourceMode: TextSourceMode;
  pathText: string;
  isLoading: boolean;
  onSourceModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;
  onRequestActiveFile: () => void;
  onRequestManuscriptGlobs: () => void;
  onRequestChapterGlobs: () => void;
  pathPlaceholder?: string;
  inputId?: string;
}

export const ScopeBox: React.FC<ScopeBoxProps> = ({ ... }) => {
  return (
    <div className="input-container">
      <label className="block text-sm font-medium mb-2">Scope:</label>
      {/* Tab buttons */}
      {/* Path input */}
    </div>
  );
};
```

### 2. Consider a useScopeBox Hook

Extract the state and message logic to a hook:

```tsx
// src/presentation/webview/hooks/domain/useScopeBox.ts

interface UseScopeBoxReturn {
  sourceMode: TextSourceMode;
  pathText: string;
  setSourceMode: (mode: TextSourceMode) => void;
  setPathText: (text: string) => void;
  requestActiveFile: () => void;
  requestManuscriptGlobs: () => void;
  requestChapterGlobs: () => void;
  handleActiveFile: (msg: ActiveFileMessage) => void;
  handleManuscriptGlobs: (msg: ManuscriptGlobsMessage) => void;
  handleChapterGlobs: (msg: ChapterGlobsMessage) => void;
  persistedState: ScopeBoxPersistence;
}

export function useScopeBox(
  vscode: VSCodeAPI,
  source: 'metrics' | 'search'
): UseScopeBoxReturn {
  // Consolidate state and message handling
}
```

### 3. Simplify App.tsx

Remove `scopeRequester` pattern and let each domain hook own its scope:

```tsx
// Before: App.tsx manages scopeRequester and routes messages
const [scopeRequester, setScopeRequester] = useState<'metrics' | 'search' | null>(null);

// After: Each domain hook handles its own scope
const metricsScope = useScopeBox(vscode, 'metrics');
const searchScope = useScopeBox(vscode, 'search');
```

## Impact

### Benefits of Fixing

1. **DRY compliance** - ~100 lines of duplication eliminated
2. **Single source of truth** - One component to update for UI changes
3. **Better testability** - Can test ScopeBox in isolation
4. **Easier onboarding** - Clear component purpose
5. **Consistent behavior** - Both tabs guaranteed to behave identically

### Risks of Not Fixing

1. **Divergent behavior** - Tabs may drift apart as changes are made to one but not the other
2. **Double maintenance** - Bug fixes require changes in two places
3. **Increased file sizes** - SearchTab.tsx (666 lines) and MetricsTab.tsx (413 lines) stay bloated

## Implementation Notes

- Component should be in `src/presentation/webview/components/shared/`
- Hook should follow Tripartite Interface pattern (State, Actions, Persistence)
- May need to update message routing in App.tsx to use hook-based approach
- Consider if `buildSourceSpec()` helper can also be shared

## Related Files

- [src/presentation/webview/components/SearchTab.tsx](../../src/presentation/webview/components/SearchTab.tsx) - lines 113-166
- [src/presentation/webview/components/MetricsTab.tsx](../../src/presentation/webview/components/MetricsTab.tsx) - lines 245-297
- [src/presentation/webview/App.tsx](../../src/presentation/webview/App.tsx) - lines 60, 87-95, 347-425
- [src/presentation/webview/hooks/domain/useMetrics.ts](../../src/presentation/webview/hooks/domain/useMetrics.ts)
- [src/presentation/webview/hooks/domain/useSearch.ts](../../src/presentation/webview/hooks/domain/useSearch.ts)

## References

- [ADR: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Large file review: [2025-11-19-large-file-review-needed.md](2025-11-19-large-file-review-needed.md)
