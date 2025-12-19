# ADR: Cross-Cutting UI Improvements

**Date**: 2025-11-18
**Status**: Deferred
**Author**: okeylanders
**Deferral Reason**: Identified during Category Search epic planning but superseded by Architecture Health Pass work

## Context

During the Category Search epic implementation, two UI improvements were identified that affect multiple components across the application:

1. **Subtab persistence**: Modules with subtabs (Search, Metrics, etc.) don't persist the selected subtab across sessions
2. **Cancellable loading states**: AI-powered features have loading states but no way to cancel in-progress requests

These are cross-cutting concerns that should be addressed systematically rather than per-component.

## Decision

### 1. Subtab Persistence

**Problem**: `activeSubtool` and similar subtab state is local `useState` in components, not persisted.

**Solution**:
- Add subtab selection to each domain hook's `persistedState`
- Pattern: `{ activeSubtab: string }` in persistence interface
- Affected modules: SearchTab, MetricsTab, potentially others

**Implementation**:
```typescript
// In useSearch.ts
interface SearchPersistence {
  // existing...
  activeSubtool: 'word' | 'category';
}

// In SearchTab.tsx
const [activeSubtool, setActiveSubtool] = React.useState<SearchSubtool>(
  initialState?.activeSubtool || 'word'
);
```

### 2. Cancellable Loading States

**Problem**: AI requests can take several seconds. Users have no way to cancel and try different input.

**Solution**:
- Add cancel button to loading indicator UI
- Feature flag to show/hide cancel button per component
- Component-specific cancel handler (abort controller or message)
- Backend support for request cancellation via AbortController

**Architecture**:
```typescript
// Loading component with cancel support
interface LoadingIndicatorProps {
  message: string;
  showCancel?: boolean;
  onCancel?: () => void;
}

// In component using AI
const abortController = useRef<AbortController | null>(null);

const handleSearch = async () => {
  abortController.current = new AbortController();
  try {
    await search({ signal: abortController.current.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      // User cancelled
    }
  }
};

const handleCancel = () => {
  abortController.current?.abort();
  setIsLoading(false);
};
```

## Consequences

### Benefits
- Consistent UX across all modules
- Better user control over AI operations
- Reduced frustration from accidental wrong inputs

### Trade-offs
- Need to identify all affected components
- Cancel logic requires backend AbortController support
- Minor complexity increase in loading state management

## Affected Components

### Subtab Persistence
- SearchTab (word/category)
- MetricsTab (if has subtabs)
- Any future modules with subtabs

### Cancellable Loading
- Category Search
- Word Search
- Prose Analysis
- Dialogue Analysis
- Context Assistant
- Dictionary lookup

## Implementation Status

**Status**: Deferred

This ADR was created during Category Search epic planning but was not immediately implemented. Instead, development priorities shifted to the Architecture Health Pass v1.3 epic, which addressed more foundational concerns including:

- Component decomposition (Sub-Epic 2)
- Loading indicator standardization (Sprint 02 of Sub-Epic 2)
- Request cancellation UI (Sprint 03 of Sub-Epic 4)

**Subtab Persistence**: Partially addressed through component decomposition work
**Cancellable Loading**: Addressed in Architecture Health Pass Sub-Epic 4, Sprint 03

The concerns raised in this ADR informed the broader architectural improvements but this specific epic was not created as a standalone effort.

## References

- Identified during: Category Search Epic Sprint 04 planning
- Related: [ADR-2025-10-27: Presentation Layer Domain Hooks](2025-10-27-presentation-layer-domain-hooks.md)
- Superseded by: [Architecture Health Pass v1.3](.todo/epics/epic-architecture-health-pass-v1.3/epic-architecture-health-pass-v1.3.md)

---

**Last Updated**: 2025-12-18
