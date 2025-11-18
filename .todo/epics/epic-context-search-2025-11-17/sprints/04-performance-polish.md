# Sprint 04: Performance + Polish

**Sprint ID**: 04-performance-polish
**Epic**: [Context Search](../epic-context-search.md)
**Status**: Pending
**Estimated Effort**: 0.25 days (was 0.5-1 day) - **75% reduction via WordSearchService**
**Branch**: `sprint/epic-context-search-2025-11-17-04-performance-polish`
**Depends On**: Sprint 03 (result formatting)
**ADR**: [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)

## Goal

Add pagination for AI calls (large word lists), progress indicators, and error handling (**file processing performance already handled by WordSearchService**).

## Scope

### In Scope
- ✅ Pagination for large word lists (>2K distinct words)
- ✅ Progress indicators for batch processing
- ✅ Error handling refinements
- ✅ Settings persistence (last query, options)
- ✅ Token cost estimation display (optional)
- ✅ Final testing and polish

### Out of Scope
- ❌ Multi-category search (Phase 2)
- ❌ AI model selection per search (Phase 2)
- ❌ Comprehensive automated test suite (deferred)

## Tasks

### 1. Backend: Pagination Implementation
**File**: `src/infrastructure/api/services/search/ContextSearchService.ts`

**Add Pagination Logic**:
- [ ] Define `MAX_WORDS_PER_BATCH = 2000` constant
- [ ] Update `searchByContext()` to handle pagination:
  ```typescript
  async searchByContext(query, text, options): Promise<ContextSearchResult> {
    const allWords = this.extractDistinctWords(text, options);

    // Paginate if word count exceeds threshold
    if (allWords.length > MAX_WORDS_PER_BATCH) {
      return await this.searchByContextPaginated(query, text, allWords, options);
    }

    // Single batch (existing logic)
    return await this.searchByContextSingleBatch(query, text, allWords, options);
  }
  ```
- [ ] Implement `searchByContextPaginated()`:
  ```typescript
  private async searchByContextPaginated(
    query: string,
    text: string,
    allWords: string[],
    options: ContextSearchOptions
  ): Promise<ContextSearchResult> {
    const batches = this.chunkArray(allWords, MAX_WORDS_PER_BATCH);
    const allMatches: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      // Send progress update to frontend
      this.sendProgress(i + 1, batches.length);

      const batchMatches = await this.queryAIForMatches(query, batches[i]);
      allMatches.push(...batchMatches);
    }

    // Re-scan text for all matched words
    return this.countOccurrences(text, allMatches, options);
  }
  ```
- [ ] Implement `sendProgress()`:
  ```typescript
  private sendProgress(current: number, total: number) {
    this.webviewProvider.postMessage({
      type: MessageType.CONTEXT_SEARCH_PROGRESS,
      source: 'extension.handler.search',
      payload: { current, total, message: `Analyzing batch ${current} of ${total}...` },
      timestamp: Date.now()
    });
  }
  ```
- [ ] Add `chunkArray()` utility function

**Message Type**:
- [ ] Add `MessageType.CONTEXT_SEARCH_PROGRESS` to `base.ts`
- [ ] Define `ContextSearchProgressMessage` interface

### 2. Frontend: Progress Indicators
**File**: `src/presentation/webview/hooks/domain/useSearch.ts`

**State Extension**:
- [ ] Add progress tracking to `contextSearch` state:
  ```typescript
  contextSearch: {
    query: string;
    result: ContextSearchResult | null;
    isLoading: boolean;
    error: string | null;
    progress?: {          // New
      current: number;
      total: number;
      message: string;
    };
  }
  ```

**Handler**:
- [ ] Implement `handleContextSearchProgress()`:
  ```typescript
  function handleContextSearchProgress(message: MessageEnvelope) {
    setContextSearch(prev => ({
      ...prev,
      progress: message.payload
    }));
  }
  ```
- [ ] Register in `useMessageRouter`:
  ```typescript
  [MessageType.CONTEXT_SEARCH_PROGRESS]: handleContextSearchProgress
  ```

**UI Update** (`SearchTab.tsx`):
- [ ] Show progress bar when `progress !== undefined`:
  ```tsx
  {contextSearch.progress && (
    <div className="progress-container">
      <progress value={contextSearch.progress.current} max={contextSearch.progress.total} />
      <span>{contextSearch.progress.message}</span>
    </div>
  )}
  ```

### 3. Settings Persistence
**File**: `src/presentation/webview/hooks/domain/useSearch.ts`

**Persistence Interface Extension**:
- [ ] Add to `SearchPersistence`:
  ```typescript
  interface SearchPersistence {
    // ... existing
    contextSearchQuery?: string;
    contextSearchOptions?: {
      minWordLength: number;
      excludeStopwords: boolean;
      caseSensitive: boolean;
    };
  }
  ```

**Restore from Persistence**:
- [ ] Load last query and options from `vscode.getState()` on mount
- [ ] Populate input fields with saved values

**Save on Change**:
- [ ] Update persistence whenever query or options change
- [ ] Use `usePersistence` hook pattern

### 4. Error Handling Refinements
**Backend** (`ContextSearchService.ts`):
- [ ] Add specific error messages:
  - "API key not configured. Please add your OpenRouter API key in Settings."
  - "AI request timed out. Try reducing the text size or using a glob pattern to exclude files."
  - "Invalid AI response format. Please try again or contact support."
- [ ] Add retry logic for transient failures (rate limits, network errors)
- [ ] Log detailed errors to Output Channel

**Frontend** (`SearchTab.tsx`):
- [ ] Display user-friendly error messages
- [ ] Add "Retry" button for failed searches
- [ ] Link to Settings for API key errors

### 5. Token Cost Estimation (Optional)
**Backend** (`ContextSearchService.ts`):
- [ ] Estimate input tokens before API call:
  ```typescript
  function estimateTokens(words: string[]): number {
    // Rough estimate: ~1 token per 4 characters
    const totalChars = words.join(', ').length;
    return Math.ceil(totalChars / 4) + 50; // +50 for prompt overhead
  }
  ```
- [ ] Add `estimatedCost` to result metadata:
  ```typescript
  summary: {
    totalMatches: number;
    uniqueWords: number;
    wordsAnalyzed: number;
    truncated: boolean;
    estimatedCost?: number;  // In cents
  }
  ```

**Frontend** (`SearchTab.tsx`):
- [ ] Show estimated cost before search (optional toggle in settings):
  ```tsx
  {showCostEstimate && (
    <div className="cost-estimate">
      Estimated cost: ~${(estimatedCost / 100).toFixed(3)}
    </div>
  )}
  ```

### 6. Final Polish
**UI/UX**:
- [ ] Add keyboard shortcuts:
  - Enter to trigger search
  - Cmd/Ctrl+K to focus query input
- [ ] Add clear button (X icon) in query input
- [ ] Add tooltips for options toggles
- [ ] Add placeholder text for empty results
- [ ] Improve responsive layout (mobile-friendly)

**Performance**:
- [ ] Debounce query input (avoid re-rendering on every keystroke)
- [ ] Memoize expensive computations (result formatting)
- [ ] Lazy-load details section (collapse by default)

**Accessibility**:
- [ ] Add ARIA labels to inputs and buttons
- [ ] Ensure keyboard navigation works
- [ ] Add screen reader announcements for loading/results

### 7. Testing
**Manual Testing**:
- [ ] Test with large novel (50K+ words, expect pagination)
- [ ] Verify progress bar shows and updates
- [ ] Verify settings persist across sessions
- [ ] Test error handling (disconnect network, invalid API key)
- [ ] Test keyboard shortcuts
- [ ] Test on different screen sizes (responsive layout)

**Performance Testing**:
- [ ] Measure time to process 50K word novel
- [ ] Verify no memory leaks (check DevTools Memory profiler)
- [ ] Verify UI remains responsive during batch processing

**Edge Cases**:
- [ ] Empty text (no words)
- [ ] Single word text
- [ ] Text with only stopwords
- [ ] Query with special characters (escape properly)

## Acceptance Criteria

- ✅ Large texts (10K+ words) process without token errors
- ✅ Progress bar shows "Analyzing batch X of Y..." during pagination
- ✅ Last query and options persist across sessions
- ✅ Error messages are user-friendly and actionable
- ✅ Retry button works for failed searches
- ✅ Keyboard shortcuts work (Enter, Cmd/Ctrl+K)
- ✅ UI is responsive and accessible
- ✅ No performance degradation on large texts

## Testing Checklist

**Test Case 1: Large Text Pagination**
- Input: 50K word novel (expect 5 batches at 2K words/batch)
- Expected: Progress bar shows "Analyzing batch 1 of 5...", increments to 5
- Result: ✅ / ❌

**Test Case 2: Settings Persistence**
- Input: Set query "clothing", options (min length 3, exclude stopwords), close/reopen webview
- Expected: Query and options restored
- Result: ✅ / ❌

**Test Case 3: Error Handling**
- Input: Disconnect network, trigger search
- Expected: Error message "AI request timed out...", Retry button shows
- Result: ✅ / ❌

**Test Case 4: Keyboard Shortcuts**
- Input: Type query, press Enter
- Expected: Search triggers
- Result: ✅ / ❌

**Test Case 5: Token Cost Estimation**
- Input: 5K word list, enable cost estimate
- Expected: Shows "Estimated cost: ~$0.005" before search
- Result: ✅ / ❌

**Test Case 6: Performance**
- Input: 50K word novel
- Expected: Completes in <30 seconds, UI remains responsive
- Result: ✅ / ❌

## Implementation Notes

### Pagination Strategy

**Batch Size Tuning**:
- Start with 2K words/batch
- Monitor token usage in Output Channel
- Adjust if hitting rate limits or timeouts

**Progress Updates**:
- Send after each batch completes (not during)
- Include estimated time remaining (optional)

### Error Recovery

**Retry Logic**:
```typescript
async function queryAIWithRetry(query: string, words: string[], maxRetries = 3): Promise<string[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.queryAIForMatches(query, words);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Token Cost Calculation

**Model Pricing** (as of 2025-11):
- Claude Haiku: $0.25 per 1M input tokens, $1.25 per 1M output tokens
- GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens

**Estimation Formula**:
```typescript
function estimateCost(inputTokens: number, model: string): number {
  const pricing = {
    'claude-haiku': { input: 0.25, output: 1.25 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 }
  };

  const rates = pricing[model] || pricing['claude-haiku'];
  const outputTokens = 200; // Estimate based on typical response

  const costInDollars =
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output;

  return Math.ceil(costInDollars * 100); // Return in cents
}
```

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] Performance tests passed
- [ ] No TypeScript errors
- [ ] PR ready for review
- [ ] Epic ready to close

## References

- [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
- [useSearch Hook](../../../src/presentation/webview/hooks/domain/useSearch.ts)
- [ContextSearchService](../../../src/infrastructure/api/services/search/ContextSearchService.ts)
- [OpenRouter Pricing](https://openrouter.ai/docs#models)

## Outcomes

*To be filled after sprint completion*

- **PR**: #[number]
- **Completion Date**: YYYY-MM-DD
- **Actual Effort**: [hours/days]
- **Discoveries**: [any tech debt, blockers, or insights]
- **Performance Metrics**: [time to process 50K words, token usage, etc.]
