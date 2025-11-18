# Sprint 04: Polish & Enhancements

**Sprint ID**: 04-polish-enhancements
**Epic**: [Context Search](../epic-context-search.md)
**Status**: Pending
**Estimated Effort**: 0.5 days
**Branch**: `sprint/epic-context-search-2025-11-17-04-polish`
**Depends On**: Sprint 03 (result formatting)
**ADR**: [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)

## Goal

Add polish items: model dropdown, token tracking, Files Summary table, hallucination filtering, and ARIA labels.

## Scope

### In Scope
- Context model dropdown (like Dictionary/Analysis)
- Token usage tracking from API response
- Files Summary table (new view between summary and details)
- Filter out 0-result words (AI hallucinations)
- ARIA labels (where used elsewhere)

### Out of Scope (Moved to separate epic)
- ~~Pagination for large word lists~~ (tested with 90K words - not needed)
- ~~Subtab persistence~~ (moved to [UI Cross-Cutting Epic](../../epic-ui-cross-cutting-2025-11-18/))
- ~~Cancel button on loading~~ (moved to [UI Cross-Cutting Epic](../../epic-ui-cross-cutting-2025-11-18/))
- ~~Token cost estimation display~~
- ~~Keyboard shortcuts~~

## Tasks

### 1. Context Model Dropdown
**Files**: `SearchTab.tsx`, `useSearch.ts`, `App.tsx`

Add model selector at top of Category Search UI (pattern from Dictionary/AnalysisTab):

- [ ] Add `contextModel` prop to SearchTab
- [ ] Wire up ModelSelector component in Category Search section
- [ ] Label: **"Category Model: *shared with Context Model*"**
- [ ] Connect to existing `proseMinion.contextModel` setting
- [ ] Pass model selection in search request message

**Note**: Future epic may separate Category Model from Context Model, but shared setting is fine for now.

### 2. Token Usage Tracking
**Files**: `CategorySearchService.ts`, `search.ts` (types)

Track tokens from API response:

- [ ] Extract `usage` from OpenRouter response in CategorySearchService
- [ ] Add to result interface:
  ```typescript
  export interface CategorySearchResult {
    // existing...
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
  }
  ```
- [ ] Display in result metadata (optional - or just track for cost widget)

### 3. Filter Hallucinated Words
**File**: `CategorySearchService.ts`

Remove words with 0 occurrences before returning result:

- [ ] After WordSearchService returns results, filter out targets with `totalOccurrences === 0`
- [ ] Update `matchedWords` array to only include words that were actually found
- [ ] Log filtered words to Output Channel for debugging

```typescript
// Filter out hallucinated words (0 occurrences)
const validTargets = wordSearchResult.targets.filter(t => t.totalOccurrences > 0);
const validWords = matchedWords.filter(word =>
  validTargets.some(t => t.normalized === word.toLowerCase())
);

return {
  query,
  matchedWords: validWords,
  wordSearchResult: { ...wordSearchResult, targets: validTargets },
  timestamp: Date.now()
};
```

### 4. Files Summary Table
**File**: `resultFormatter.ts`

Add new table between summary and details:

```markdown
## Files Summary

| Word | Count | Clusters | Files | Files w/ Clusters |
|------|-------|----------|-------|-------------------|
| cloud | 13 | 3 | chapter-1.1.md, chapter-3.4.md | chapter-3.4.md |
| clouds | 8 | 7 | chapter-1.1.md, chapter-3.4.md | chapter-1.1.md, chapter-3.4.md |
| fog | 4 | 0 | chapter-1.1.md | - |
```

- [ ] Add `formatFilesSummary()` function in resultFormatter.ts
- [ ] Calculate per-word: total count, total clusters, file list, files with clusters
- [ ] Insert between summary table and details section in `formatCategorySearchAsMarkdown()`

### 5. ARIA Labels
**File**: `SearchTab.tsx`

Add accessibility labels where used in other components:

- [ ] Audit other tabs for ARIA patterns
- [ ] Add `aria-label` to query input
- [ ] Add `aria-label` to scope selector
- [ ] Add `aria-label` to search button
- [ ] Add `role` attributes where appropriate

## Acceptance Criteria

- [ ] Model dropdown shows at top of Category Search, changes persist
- [ ] Token usage tracked in result (visible in cost widget or metadata)
- [ ] Words with 0 results are not shown in output
- [ ] Files Summary table appears with correct data
- [ ] ARIA labels present on main interactive elements

## Testing Checklist

**Test Case 1: Model Dropdown**
- Input: Select different context model, run search
- Expected: Search uses selected model
- Result: /

**Test Case 2: Hallucination Filtering**
- Input: Search that returns some AI hallucinations
- Expected: 0-count words don't appear in results
- Result: /

**Test Case 3: Files Summary Table**
- Input: Multi-file search with clusters
- Expected: Table shows correct file lists and cluster counts
- Result: /

**Test Case 4: Token Tracking**
- Input: Run search, check result
- Expected: tokensUsed populated with prompt/completion/total
- Result: /

## Implementation Notes

### Files Summary Table Data Extraction

```typescript
function formatFilesSummary(result: CategorySearchResult): string {
  const rows = result.wordSearchResult.targets.map(target => {
    const files = target.perFile.map(f => f.relative);
    const filesWithClusters = target.perFile
      .filter(f => f.clusters.length > 0)
      .map(f => f.relative);
    const totalClusters = target.perFile.reduce((sum, f) => sum + f.clusters.length, 0);

    return {
      word: target.target,
      count: target.totalOccurrences,
      clusters: totalClusters,
      files: files.join(', '),
      filesWithClusters: filesWithClusters.length > 0 ? filesWithClusters.join(', ') : '-'
    };
  });

  // Format as markdown table
  // ...
}
```

### Token Usage from OpenRouter

```typescript
// In CategorySearchService after API call
const response = await this.openRouterClient.chat(messages, options);
const tokensUsed = response.usage ? {
  prompt: response.usage.prompt_tokens,
  completion: response.usage.completion_tokens,
  total: response.usage.total_tokens
} : undefined;
```

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] No TypeScript errors
- [ ] PR ready for review
- [ ] Epic ready to close

## References

- [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
- [useSearch Hook](../../../src/presentation/webview/hooks/domain/useSearch.ts)
- [CategorySearchService](../../../src/infrastructure/api/services/search/CategorySearchService.ts)
- [resultFormatter](../../../src/presentation/webview/utils/resultFormatter.ts)
- [UI Cross-Cutting Epic](../../epic-ui-cross-cutting-2025-11-18/) (subtab persistence, cancel button)

## Outcomes

*To be filled after sprint completion*

- **PR**: #[number]
- **Completion Date**: YYYY-MM-DD
- **Actual Effort**: [hours/days]
- **Discoveries**: [any tech debt, blockers, or insights]
