# TypeScript/React VSCode Extension Review - Action Plan

**Generated**: 2025-12-16
**Scope**: PR #51 - feat(category-search): Add n-gram mode with cancellation support
**Mode**: PR Review
**Total Issues**: 0 Critical, 1 Moderate, 3 Minor

---

## Summary

This PR adds n-gram mode (bigrams/trigrams) to Category Search with cancellation support and partial results preservation. The implementation follows established architectural patterns and is well-structured.

**Critical Issues:** None

**Moderate Issues:**
- N-gram extraction lacks punctuation stripping, which may produce noisy phrases

**Minor Issues:**
- Missing test coverage for cancellation with partial results
- Package.json settings don't sync bidirectionally with webview state
- `extractUniqueNGrams` doesn't apply stopword filtering

---

## Positive Findings

The PR demonstrates several strong patterns that should be reinforced:

### Excellent Architectural Adherence

1. **Strategy Pattern for Routing** - The cancel route follows the established `MessageRouter` pattern:
   ```typescript
   router.register(MessageType.CANCEL_CATEGORY_SEARCH_REQUEST, this.handleCancelCategorySearch.bind(this));
   ```

2. **Tripartite Hook Interface** - `useSearch` properly separates State, Actions, and Persistence interfaces with new n-gram fields in all three.

3. **Domain Mirroring** - Frontend (`useSearch`, `CategorySearchPanel`) and backend (`SearchHandler`, `CategorySearchService`) maintain symmetric organization.

4. **Type Safety** - New types (`NGramMode`, `MinOccurrences`) are properly typed as union literals with const arrays for UI iteration:
   ```typescript
   export type NGramMode = 'words' | 'bigrams' | 'trigrams';
   export const NGRAM_MODE_OPTIONS: readonly NGramMode[] = ['words', 'bigrams', 'trigrams'];
   ```

5. **AbortController Pattern** - Clean cancellation implementation with proper cleanup:
   ```typescript
   private abortController: AbortController | null = null;

   public cancelSearch(): void {
     if (this.abortController) {
       this.abortController.abort();
       this.abortController = null;
     }
   }
   ```

6. **Partial Results Preservation** - Rather than discarding work on cancel, the service returns collected matches with appropriate warnings.

7. **VSCode Theming** - CSS uses VSCode theme variables for consistent appearance:
   ```css
   background-color: var(--vscode-inputValidation-warningBackground);
   border: 1px solid var(--vscode-inputValidation-warningBorder);
   ```

8. **Tests Updated** - Route count test updated, status message expectation updated to match new format.

---

## Moderate Priority Steps

### Step 1: Add punctuation stripping to n-gram extraction

**Why**: N-grams may contain trailing punctuation (e.g., "cold," or "night."), leading to false negatives when searching for occurrences.

**Files**:
- `src/infrastructure/api/services/search/CategorySearchService.ts:498-515`

**Action**:
1. Update token extraction to strip punctuation:

```typescript
private extractUniqueNGrams(
  text: string,
  n: number,
  minOccurrences: number
): string[] {
  // Strip punctuation and normalize whitespace
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')  // Keep apostrophes for contractions
    .split(/\s+/)
    .filter(t => t.length > 0);

  const counts = new Map<string, number>();
  // ... rest unchanged
}
```

2. Run: `npm test -- --testPathPattern="CategorySearchService"`
3. Verify: Search for "cold night" finds "cold night." in source text

**Expected outcome**: Cleaner n-gram extraction without punctuation artifacts.

---

## Minor Priority Steps

### Step 2: Add test for cancellation with partial results

**Why**: The partial results feature is untested - if regression occurs, it won't be caught.

**Files**:
- `src/__tests__/infrastructure/api/services/search/CategorySearchService.test.ts`

**Action**:
1. Add test case:

```typescript
it('returns partial results when cancelled mid-search', async () => {
  // Setup: Mock AI to return results slowly
  const mockOrchestrator = {
    executeWithoutCapabilities: jest.fn()
      .mockImplementationOnce(async () => {
        // First batch returns matches
        return { content: '["match1", "match2"]', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      })
      .mockImplementationOnce(async () => {
        // Second batch - simulate slow response
        await new Promise(resolve => setTimeout(resolve, 100));
        return { content: '["match3"]', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      })
  };

  // Start search
  const searchPromise = service.searchByCategory('test', 'word '.repeat(800), undefined, 'selection');

  // Cancel after brief delay
  await new Promise(resolve => setTimeout(resolve, 50));
  service.cancelSearch();

  const result = await searchPromise;

  // Verify partial results returned
  expect(result.warnings).toContain(expect.stringContaining('cancelled'));
  expect(result.matchedWords.length).toBeGreaterThan(0);
});
```

2. Run: `npm test -- --testPathPattern="CategorySearchService"`

**Expected outcome**: Test coverage for cancellation feature.

### Step 3: Document settings as read-only defaults

**Why**: The `package.json` settings (`proseMinion.categorySearch.ngramMode`, `minPhraseOccurrences`) don't sync bidirectionally with webview state. Users might expect changes in VSCode settings to affect the UI.

**Files**:
- `package.json:457-477`

**Action**:
1. Update setting descriptions to clarify they are defaults:

```json
"proseMinion.categorySearch.ngramMode": {
  "type": "string",
  "enum": ["words", "bigrams", "trigrams"],
  "default": "words",
  "description": "Default search mode for new searches. Changes take effect on panel reload.",
  "order": 36
},
"proseMinion.categorySearch.minPhraseOccurrences": {
  "type": "number",
  "default": 2,
  "minimum": 1,
  "maximum": 10,
  "description": "Default minimum phrase occurrences for new searches. Changes take effect on panel reload.",
  "order": 37
}
```

2. Alternatively, implement full bidirectional sync following the pattern in [ADR-2025-11-03](../docs/adr/2025-11-03-unified-settings-architecture.md) (future epic work).

**Expected outcome**: User expectations are set correctly for settings behavior.

### Step 4: Consider stopword filtering for n-grams (optional enhancement)

**Why**: N-grams like "the cold" or "in the" are less useful than content-focused phrases. However, this is a trade-off as some useful phrases include stopwords ("the end", "in love").

**Files**:
- `src/infrastructure/api/services/search/CategorySearchService.ts:498-515`

**Action** (optional - assess value):
1. Add optional stopword filtering that skips n-grams where ALL words are stopwords:

```typescript
private extractUniqueNGrams(
  text: string,
  n: number,
  minOccurrences: number
): string[] {
  const stopwords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but']);
  // ...

  for (let i = 0; i <= tokens.length - n; i++) {
    const phraseTokens = tokens.slice(i, i + n);
    // Skip if ALL words are stopwords
    if (phraseTokens.every(t => stopwords.has(t))) continue;

    const phrase = phraseTokens.join(' ');
    counts.set(phrase, (counts.get(phrase) || 0) + 1);
  }
  // ...
}
```

**Note**: This is optional - evaluate whether it improves results quality before implementing.

---

## Summary

**Total steps**: 4 (1 moderate, 3 minor)
**Recommendation**: Merge as-is; punctuation stripping (Step 1) recommended for follow-up

The PR is well-implemented and follows established patterns. The moderate issue (punctuation in n-grams) is a quality-of-results concern rather than a correctness issue. All critical architectural patterns are respected.

**Next action**: Review Step 1 (punctuation stripping) and decide whether to address before or after merge.
