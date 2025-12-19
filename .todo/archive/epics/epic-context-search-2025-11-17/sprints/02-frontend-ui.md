# Sprint 02: Frontend Integration + Basic UI

**Sprint ID**: 02-frontend-ui
**Epic**: [Context Search](../epic-context-search.md)
**Status**: Complete
**Estimated Effort**: 0.5 days (was 1 day) - **50% reduction via settings reuse**
**Actual Effort**: ~0.5 days
**Branch**: `epic/context-search-2025-11-17`
**Depends On**: Sprint 01 (backend service)
**ADR**: [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
**Commit**: `a3f0762`

## Goal

Integrate Context Search into the frontend: extend `useSearch` hook, add UI to SearchTab (reuse existing components & settings), implement basic result display.

## Scope

### In Scope
- ✅ Extend `useSearch` hook with context search state/actions
- ✅ Add Context Search subtool to SearchTab component
- ✅ Query input field + scope selector
- ✅ Basic result display (summary table: word | count)
- ✅ Loading states and error handling
- ✅ Trigger search via backend message

### Out of Scope
- ❌ Expanded summary / details (Sprint 03)
- ❌ Export functionality (Sprint 03)
- ❌ Pagination / batch progress (Sprint 04)
- ❌ Settings persistence (Sprint 04)

## Tasks

### 1. Extend useSearch Hook
**File**: `src/presentation/webview/hooks/domain/useSearch.ts`

**State Interface Extension**:
- [ ] Add `contextSearch` to `SearchState`:
  ```typescript
  interface SearchState {
    // ... existing word search state
    contextSearch: {
      query: string;              // User's category query
      result: ContextSearchResult | null;
      isLoading: boolean;
      error: string | null;
    };
  }
  ```

**Actions Interface Extension**:
- [ ] Add to `SearchActions`:
  ```typescript
  interface SearchActions {
    // ... existing actions
    performContextSearch: (query: string, scope: SearchScope, options?: ContextSearchOptions) => void;
    clearContextSearch: () => void;
    setContextSearchQuery: (query: string) => void;
  }
  ```

**Persistence Interface Extension**:
- [ ] Add to `SearchPersistence`:
  ```typescript
  interface SearchPersistence {
    // ... existing
    contextSearchQuery?: string;  // Last query (optional)
  }
  ```

**Implementation**:
- [ ] Add `contextSearch` state with `useState`
- [ ] Implement `performContextSearch()`:
  - Set `isLoading: true`
  - Post `CONTEXT_SEARCH_REQUEST` via vscode API
  - Clear previous errors
- [ ] Implement `handleContextSearchResult()`:
  - Parse result from MessageEnvelope
  - Update `contextSearch.result`
  - Set `isLoading: false`
- [ ] Implement `clearContextSearch()`:
  - Reset result, error, loading
  - Keep query (user might want to retry)
- [ ] Register handler in `useMessageRouter`:
  ```typescript
  useMessageRouter({
    // ... existing handlers
    [MessageType.CONTEXT_SEARCH_RESULT]: handleContextSearchResult
  });
  ```

### 2. SearchTab UI Component
**File**: `src/presentation/webview/components/SearchTab.tsx`

**Add Context Search Subtool**:
- [ ] Add "Context Search" to subtool tabs (after "Word Search")
- [ ] Create `ContextSearchPanel` component (or inline in SearchTab)

**Input Section**:
- [ ] Query input field:
  ```tsx
  <input
    type="text"
    placeholder="Enter category or concept (e.g., 'clothing', 'color red')"
    value={search.contextSearch.query}
    onChange={e => search.setContextSearchQuery(e.target.value)}
  />
  ```
- [ ] Scope selector (reuse existing `ScopeSelector` component from Word Search):
  - Selection
  - Current File
  - Glob Pattern
- [ ] Options toggles:
  - [ ] Min word length (dropdown: 1, 2, 3, 4, 5)
  - [ ] Exclude stopwords (checkbox, default true)
  - [ ] Case sensitive (checkbox, default false)
- [ ] Search button:
  ```tsx
  <button
    onClick={() => search.performContextSearch(query, scope, options)}
    disabled={!query || search.contextSearch.isLoading}
  >
    {search.contextSearch.isLoading ? 'Searching...' : 'Search'}
  </button>
  ```

**Loading State**:
- [ ] Show spinner when `isLoading === true`
- [ ] Show status text: "Analyzing... this may take a moment"

**Error Handling**:
- [ ] Display error message if `error !== null`:
  ```tsx
  {search.contextSearch.error && (
    <div className="error-banner">
      {search.contextSearch.error}
    </div>
  )}
  ```

**Results Section (Basic)**:
- [ ] Show summary table when `result !== null`:
  ```tsx
  <table>
    <thead>
      <tr>
        <th>Word</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      {result.matches.map(match => (
        <tr key={match.word}>
          <td>{match.word}</td>
          <td>{match.count}</td>
        </tr>
      ))}
    </tbody>
  </table>
  ```
- [ ] Show "No matches found" if `matches.length === 0`
- [ ] Show metadata:
  ```tsx
  <div className="summary-stats">
    Total Matches: {result.summary.totalMatches} |
    Unique Words: {result.summary.uniqueWords} |
    Words Analyzed: {result.summary.wordsAnalyzed}
  </div>
  ```

### 3. Styling
**File**: `src/presentation/webview/styles/SearchTab.css` (or similar)

- [ ] Match existing Word Search styling
- [ ] Query input: full width, clear placeholder
- [ ] Options toggles: inline, compact
- [ ] Results table: striped rows, sortable columns (future)
- [ ] Error banner: red background, white text
- [ ] Loading spinner: centered, with status text

### 4. Message Flow Integration
- [ ] Test message flow: Frontend → Backend → Frontend
- [ ] Verify MessageEnvelope source tracking works
- [ ] Verify no echo issues (source filtering)

### 5. Manual Testing
- [ ] Test with selection scope (small text, simple query)
- [ ] Test with file scope (current file)
- [ ] Test with glob scope (e.g., `**/*.md`)
- [ ] Test error handling (invalid query, API failure)
- [ ] Test loading states (verify spinner shows)
- [ ] Test result display (verify table renders correctly)

## Acceptance Criteria

- ✅ Context Search subtool visible in SearchTab
- ✅ User can enter query and trigger search
- ✅ Loading indicator shows during search
- ✅ Results display in summary table (word | count)
- ✅ Metadata shows (total matches, unique words, words analyzed)
- ✅ Error messages display on failures
- ✅ Scope selector works (selection, file, glob)
- ✅ Options toggles work (min length, stopwords, case sensitive)

## Testing Checklist

**Test Case 1: Simple Search**
- Input: "clothing" query, selection scope
- Expected: Results table shows matched words and counts
- Result: ✅ / ❌

**Test Case 2: Empty Query**
- Input: Empty query string
- Expected: Search button disabled
- Result: ✅ / ❌

**Test Case 3: No Matches**
- Input: "animals" query, text with no animals
- Expected: "No matches found" message
- Result: ✅ / ❌

**Test Case 4: Loading State**
- Input: Trigger search
- Expected: Spinner + "Analyzing..." text shows
- Result: ✅ / ❌

**Test Case 5: Error Handling**
- Input: Simulate API error (disconnect network)
- Expected: Error banner shows with message
- Result: ✅ / ❌

**Test Case 6: Scope Switching**
- Input: Switch between selection, file, glob scopes
- Expected: Search uses correct scope
- Result: ✅ / ❌

## Implementation Notes

### Reusable Components

Reuse existing components from Word Search:
- `ScopeSelector` (selection, file, glob)
- `SearchButton` (with loading state)
- `ResultsTable` (if extractable)

### State Management

Keep context search state isolated:
- Don't mix with word search state
- Clear context search when switching to word search tab (optional)

### Error Messages

Provide helpful error messages:
- "No API key configured" → link to Settings
- "Query too short" → suggest min 3 characters
- "No text selected" → suggest selecting text or using file scope

### Performance

For Sprint 02, focus on correctness, not performance:
- No pagination yet (defer to Sprint 04)
- No caching (defer to Sprint 04)
- Simple linear rendering (optimize later if needed)

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] UI matches existing SearchTab style
- [ ] No TypeScript errors
- [ ] Ready for result formatting enhancements (Sprint 03)

## References

- [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
- [useSearch Hook](../../../src/presentation/webview/hooks/domain/useSearch.ts)
- [SearchTab Component](../../../src/presentation/webview/components/SearchTab.tsx)
- [Word Search UI](../../../src/presentation/webview/components/SearchTab.tsx) (reference)

## Outcomes

- **Commit**: `a3f0762`
- **Completion Date**: 2025-11-18
- **Actual Effort**: ~0.5 days
- **Discoveries**:
  - Extended useSearch hook with full CategorySearchState (query, result, isLoading, error)
  - Shared scope selector and path input between Word Search and Category Search
  - Basic table display worked well, enhanced with MarkdownRenderer in Sprint 03
