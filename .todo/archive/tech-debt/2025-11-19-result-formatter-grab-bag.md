# Result Formatter Grab Bag

**Date Identified**: 2025-11-19
**Identified During**: Epic Branch Grab Bag Evaluation
**Priority**: High
**Estimated Effort**: 3-4 hours

## Problem

`resultFormatter.ts` is a 763-line grab bag mixing formatting logic for 6 unrelated domains. This is the most significant grab bag violation in the codebase.

## Current Implementation

**File**: `src/presentation/webview/utils/resultFormatter.ts`
**Lines**: 763

### Mixed Domains

| Domain | Lines | Functions |
|--------|-------|-----------|
| Shared helpers | 23-75 | `buildMetricsLegend()` |
| Word Search | 87-189 | `formatSearchResultAsMarkdown()` |
| Prose Statistics | 192-299 | `formatMetricsAsMarkdown()` |
| Style Flags | 301-334 | `formatStyleFlagsAsMarkdown()` |
| Word Frequency | 336-555 | `formatWordFrequencyAsMarkdown()` |
| Analysis | 604-611 | Markdown wrapper |
| Category Search | 631-763 | `formatCategorySearchAsMarkdown()` |

### Helper Functions (scattered)

- `buildMetricsLegend()` (lines 23-75) - shared legend for metrics
- `formatGap()` (lines 615-621) - word search helper
- `escapePipes()` (lines 623-625) - markdown table helper

## Architecture Impact

1. **Violates Single Responsibility** - One file handles 6 unrelated domains
2. **Hard to test** - Can't test individual formatters in isolation
3. **Implicit coupling** - Domains implicitly depend on each other
4. **Hard to maintain** - Updates to one domain require navigating 700+ lines
5. **Poor discoverability** - Where is Category Search formatting? In a generic "result formatter"

## Recommendation

Extract into domain-specific formatters:

```
src/presentation/webview/utils/
├── formatters/
│   ├── index.ts                    # Barrel export
│   ├── helpers.ts                  # buildMetricsLegend, formatGap, escapePipes
│   ├── wordSearchFormatter.ts      # formatSearchResultAsMarkdown
│   ├── proseStatsFormatter.ts      # formatMetricsAsMarkdown (prose stats)
│   ├── styleFlagsFormatter.ts      # formatStyleFlagsAsMarkdown
│   ├── wordFrequencyFormatter.ts   # formatWordFrequencyAsMarkdown
│   ├── categorySearchFormatter.ts  # formatCategorySearchAsMarkdown
│   └── analysisFormatter.ts        # Analysis markdown wrapper
```

### File Size Estimates

- `helpers.ts`: ~60 lines
- `wordSearchFormatter.ts`: ~110 lines
- `proseStatsFormatter.ts`: ~120 lines
- `styleFlagsFormatter.ts`: ~40 lines
- `wordFrequencyFormatter.ts`: ~220 lines
- `categorySearchFormatter.ts`: ~140 lines
- `analysisFormatter.ts`: ~20 lines

**Total**: ~710 lines split across 7 focused files

### Import Updates

Components would import from the barrel:
```typescript
import { formatSearchResultAsMarkdown, formatCategorySearchAsMarkdown } from '../utils/formatters';
```

Or domain-specific:
```typescript
import { formatCategorySearchAsMarkdown } from '../utils/formatters/categorySearchFormatter';
```

## Impact

### Benefits of Fixing

1. **Single Responsibility** - Each file owns one domain
2. **Testable** - Unit test formatters in isolation
3. **Maintainable** - Update one domain without navigating 700+ lines
4. **Discoverable** - Clear where each formatter lives
5. **Parallel work** - Different developers can work on different formatters

### Risks of Not Fixing

1. **Growing file** - Each new tool adds 100+ lines
2. **Merge conflicts** - Multiple features touching same file
3. **Test complexity** - Hard to test specific formatting logic
4. **Cognitive load** - 763 lines to understand for any change

## Implementation Notes

1. Extract helpers first (`buildMetricsLegend`, `formatGap`, `escapePipes`)
2. Move each domain formatter to its own file
3. Update imports in components (SearchTab, MetricsTab, AnalysisTab, UtilitiesTab)
4. Delete original `resultFormatter.ts`
5. Run tests to verify no regressions

## Related Files

- [src/presentation/webview/utils/resultFormatter.ts](../../src/presentation/webview/utils/resultFormatter.ts)
- [src/presentation/webview/components/SearchTab.tsx](../../src/presentation/webview/components/SearchTab.tsx) - imports formatter
- [src/presentation/webview/components/MetricsTab.tsx](../../src/presentation/webview/components/MetricsTab.tsx) - imports formatter
- [src/presentation/webview/components/AnalysisTab.tsx](../../src/presentation/webview/components/AnalysisTab.tsx) - imports formatter

## References

- This grab bag grew with each feature: Word Search → Metrics → Category Search
- Category Search epic added `formatCategorySearchAsMarkdown()` (lines 631-763)

---

## ✅ RESOLVED

**Resolution Date**: 2025-11-22
**Resolved By**: Sprint 01 - Result Formatter Decomposition
**Branch**: `sprint/foundation-cleanup-01-result-formatter`
**PR**: #33

### What Was Done

Extracted `resultFormatter.ts` (763 lines) into 7 focused domain formatters:

```
src/presentation/webview/utils/formatters/
├── index.ts                    # Barrel export
├── helpers.ts                  # Shared helpers (60 lines)
├── wordSearchFormatter.ts      # Word search (110 lines)
├── proseStatsFormatter.ts      # Prose statistics (120 lines)
├── styleFlagsFormatter.ts      # Style flags (40 lines)
├── wordFrequencyFormatter.ts   # Word frequency (220 lines)
└── categorySearchFormatter.ts  # Category search (140 lines)
```

**Outcomes:**
- ✅ Single Responsibility restored
- ✅ Each formatter testable in isolation
- ✅ 7 focused files replace 1 grab bag
- ✅ All 244 tests passing
- ✅ Build successful

**Files Modified:** 12 files (7 new formatters + 5 component imports)

**References:**
- Epic: `.todo/archived/epics/epic-architecture-health-pass-v1.3/`
- Sprint: `sub-epic-1-foundation-cleanup/sprints/01-result-formatter-decomposition.md`
- Commit: `01aca66` - "docs: update Sprint 01 completion status"
