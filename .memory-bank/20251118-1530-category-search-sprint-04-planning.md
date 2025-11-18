# Category Search Sprint 04 Planning Session

**Date**: 2025-11-18
**Epic**: [Context Search (Category Search)](../.todo/epics/epic-context-search-2025-11-17/epic-context-search.md)
**Branch**: `epic/context-search-2025-11-17`
**Commit**: `baf7185`

## Summary

Revised Sprint 04 scope based on user testing and feedback. Created a separate epic for cross-cutting UI improvements that were identified during planning.

## Key Decisions

### Pagination Not Needed
- User tested with 90K word manuscript (9K unique words)
- KIMI-K2 model responded in ~5 seconds
- 9K words ≈ 16K tokens - easy for models to digest
- **Decision**: Remove pagination from scope

### Scope Trimming
- Token cost estimation: NOT needed
- Keyboard shortcuts: NOT needed
- ARIA labels: YES (where consistent with other components)

### Cross-Cutting Items Moved to New Epic
Two items affect multiple components and warrant their own epic:
1. **Subtab persistence** - Affects SearchTab, MetricsTab, etc.
2. **Cancellable loading states** - Affects all AI-powered features

**New Epic**: [UI Cross-Cutting Improvements](../.todo/epics/epic-ui-cross-cutting-2025-11-18/)

## Revised Sprint 04 Scope

| Task | Notes |
|------|-------|
| Context model dropdown | Label: "Category Model: *shared with Context Model*" |
| Token usage tracking | Extract from API response for cost widget |
| Filter hallucinated words | Remove 0-result words before rendering |
| Files Summary table | New table between summary and details |
| ARIA labels | Where consistent with other components |

### Files Summary Table Format

User specified comma-separated filenames (not counts) since the top table already shows counts:

```markdown
| Word | Count | Clusters | Files | Files w/ Clusters |
|------|-------|----------|-------|-------------------|
| cloud | 13 | 3 | chapter-1.1.md, chapter-3.4.md | chapter-3.4.md |
```

### Model Dropdown Note

Using `proseMinion.contextModel` setting for now. Label indicates it's shared:
> "Category Model: *shared with Context Model*"

Future epic may separate this into its own setting.

## Investigation Findings

| Item | Finding |
|------|---------|
| Token tracking | NOT implemented in CategorySearchService |
| API key error | EXISTS: "OpenRouter API key not configured..." |
| Subtab persistence | NOT persisted (local useState) |
| Tab persistence | Working (activeTab in App.tsx persistence) |

## Files Created/Modified

### New Epic: UI Cross-Cutting Improvements
- [ADR](../docs/adr/2025-11-18-cross-cutting-ui-improvements.md)
- [Epic overview](../.todo/epics/epic-ui-cross-cutting-2025-11-18/epic-ui-cross-cutting.md)
- [Sprint 01: Subtab Persistence](../.todo/epics/epic-ui-cross-cutting-2025-11-18/sprints/01-subtab-persistence.md)
- [Sprint 02: Cancellable Loading](../.todo/epics/epic-ui-cross-cutting-2025-11-18/sprints/02-cancellable-loading.md)

### Updated
- [Sprint 04](../.todo/epics/epic-context-search-2025-11-17/sprints/04-performance-polish.md) - Revised scope

## Next Steps

1. Implement Sprint 04 tasks (0.5 days estimated)
2. Complete Category Search epic
3. Optionally start UI Cross-Cutting epic

## References

- [Category Search Epic](../.todo/epics/epic-context-search-2025-11-17/epic-context-search.md)
- [Sprint 04](../.todo/epics/epic-context-search-2025-11-17/sprints/04-performance-polish.md)
- [UI Cross-Cutting Epic](../.todo/epics/epic-ui-cross-cutting-2025-11-18/epic-ui-cross-cutting.md)
- [Previous Memory Bank Entry](20251118-1400-category-search-sprints-01-03-complete.md)
