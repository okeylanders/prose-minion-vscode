# Sprint 01: Backend Service + Message Contracts

**Sprint ID**: 01-backend-service
**Epic**: [Context Search](../epic-context-search.md)
**Status**: Pending
**Estimated Effort**: 1 day
**Branch**: `sprint/epic-context-search-2025-11-17-01-backend-service`
**ADR**: [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)

## Goal

Build the backend infrastructure for Context Search: message contracts, service implementation, and SearchHandler integration.

## Scope

### In Scope
- ✅ Define message types (CONTEXT_SEARCH_REQUEST, CONTEXT_SEARCH_RESULT)
- ✅ Implement ContextSearchService
  - Word extraction (distinct words from text)
  - AI prompt construction
  - OpenRouter integration
  - AI response parsing (JSON validation)
  - Occurrence counting per chapter
- ✅ Create system prompts (`resources/system-prompts/context-search/`)
- ✅ Register route in SearchHandler
- ✅ Basic error handling (AI failures, invalid responses)

### Out of Scope
- ❌ Frontend UI (Sprint 02)
- ❌ Export functionality (Sprint 03)
- ❌ Pagination (Sprint 04)
- ❌ Advanced filtering options

## Tasks

### 1. Message Contracts
**File**: `src/shared/types/messages/search.ts`

- [ ] Add `MessageType.CONTEXT_SEARCH_REQUEST` to enum in `base.ts`
- [ ] Add `MessageType.CONTEXT_SEARCH_RESULT` to enum in `base.ts`
- [ ] Define `ContextSearchRequest` interface
  ```typescript
  export interface ContextSearchRequest extends BaseMessage {
    type: MessageType.CONTEXT_SEARCH_REQUEST;
    payload: {
      query: string;
      scope: { mode: 'selection' | 'file' | 'glob'; content?: string; path?: string; globPattern?: string; };
      options?: { minWordLength?: number; excludeStopwords?: boolean; caseSensitive?: boolean; };
    };
  }
  ```
- [ ] Define `ContextSearchResult` interface (see ADR for full schema)
- [ ] Export from `search.ts` and `index.ts` barrel

### 2. System Prompts
**Directory**: `resources/system-prompts/context-search/`

- [ ] Create `00-role.md` (semantic word matcher role)
- [ ] Create `01-instructions.md` (input/output format, examples)
- [ ] Create `02-constraints.md` (matching guidelines)
- [ ] Test prompt manually via OpenRouter playground

### 3. ContextSearchService
**File**: `src/infrastructure/api/services/search/ContextSearchService.ts`

**Methods to implement**:
- [ ] `constructor(openRouterClient, textProcessor)`
- [ ] `async searchByContext(query, text, options): Promise<ContextSearchResult>`
  - [ ] Call `extractDistinctWords()` to get word list
  - [ ] Call `buildMatchingPrompt()` to create AI prompt
  - [ ] Call `openRouterClient.chat()` to get AI response
  - [ ] Call `parseAIMatches()` to validate and extract matched words
  - [ ] Call `countOccurrences()` to find word locations
  - [ ] Call `formatResults()` to build result object
- [ ] `private extractDistinctWords(text, options): string[]`
  - Filter by `minWordLength` (default 2)
  - Filter stopwords if `excludeStopwords === true`
  - Return sorted unique words (case-insensitive)
- [ ] `private buildMatchingPrompt(query, words): string`
  - Load system prompts from `resources/system-prompts/context-search/`
  - Format: `Category: {query}\nWords: {words.join(', ')}`
- [ ] `private parseAIMatches(aiResponse): string[]`
  - Parse JSON array from response
  - Validate format (throw error if invalid)
  - Return matched words
- [ ] `private countOccurrences(text, words): WordCountMap`
  - Scan text for each matched word
  - Count occurrences (case-insensitive if option set)
  - Track locations (line number, context snippet)
- [ ] `private formatResults(matches, metadata): ContextSearchResult`
  - Build summary (totalMatches, uniqueWords, wordsAnalyzed)
  - Format chapter breakdowns
  - Add timestamp

### 4. SearchHandler Integration
**File**: `src/application/handlers/domain/SearchHandler.ts`

- [ ] Instantiate `ContextSearchService` in constructor (inject OpenRouterClient)
- [ ] Add `handleContextSearchRequest()` method
  - Extract payload from MessageEnvelope
  - Call `contextSearchService.searchByContext()`
  - Wrap result in MessageEnvelope
  - Post result to webview
- [ ] Register route in `registerRoutes()`:
  ```typescript
  this.messageRouter.set(MessageType.CONTEXT_SEARCH_REQUEST,
    this.handleContextSearchRequest.bind(this));
  ```
- [ ] Add error handling (try/catch, send error result on failure)

### 5. Error Handling
- [ ] Handle AI API failures (network errors, rate limits)
- [ ] Handle invalid AI responses (non-JSON, wrong format)
- [ ] Handle empty word lists (no distinct words found)
- [ ] Handle invalid queries (empty string)
- [ ] Log errors to Output Channel

### 6. Testing
- [ ] Manual test: Small text (100 words), simple query ("clothing")
- [ ] Manual test: Medium text (1K words), compound query ("color red")
- [ ] Manual test: Edge cases (empty query, no matches)
- [ ] Verify AI response format (valid JSON array)
- [ ] Verify word extraction filters stopwords, short words

## Acceptance Criteria

- ✅ Backend accepts `CONTEXT_SEARCH_REQUEST` message
- ✅ ContextSearchService extracts distinct words from text
- ✅ AI prompt returns valid JSON array of matched words
- ✅ Service counts occurrences and finds locations
- ✅ `CONTEXT_SEARCH_RESULT` message sent to frontend with complete data
- ✅ Error messages logged and sent to frontend on failures
- ✅ System prompts produce accurate semantic matching (manual verification)

## Testing Checklist

**Test Case 1: Simple Category**
- Input: "clothing" query, text with "coat, pants, tree, river, jeans"
- Expected: AI returns `["coat", "pants", "jeans"]`
- Result: ✅ / ❌

**Test Case 2: Compound Category**
- Input: "color red" query, text with "crimson, blue, maroon, green, scarlet"
- Expected: AI returns `["crimson", "maroon", "scarlet"]`
- Result: ✅ / ❌

**Test Case 3: No Matches**
- Input: "animals" query, text with only non-animal words
- Expected: Empty matches array, graceful handling
- Result: ✅ / ❌

**Test Case 4: Stopword Filtering**
- Input: "emotion" query, `excludeStopwords: true`
- Expected: Common words like "the", "and" excluded from word list
- Result: ✅ / ❌

**Test Case 5: AI Error**
- Input: Valid query, but API key invalid
- Expected: Error message in result, logged to Output Channel
- Result: ✅ / ❌

## Implementation Notes

### Word Extraction Strategy
Use existing `TextProcessorService` patterns (from Word Frequency):
- Split on whitespace + punctuation
- Filter by min length
- Use stopword list from `resources/stopwords.txt` (or hardcode common 100)
- Case-insensitive deduplication

### AI Response Validation
```typescript
function parseAIMatches(response: string): string[] {
  try {
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed)) {
      throw new Error('AI response is not an array');
    }
    return parsed.filter(item => typeof item === 'string');
  } catch (e) {
    throw new Error(`Invalid AI response format: ${e.message}`);
  }
}
```

### Occurrence Counting
```typescript
function countOccurrences(text: string, words: string[]): WordCountMap {
  const map = new Map<string, { count: number; locations: Location[] }>();

  words.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = [...text.matchAll(regex)];

    map.set(word, {
      count: matches.length,
      locations: matches.map(m => ({
        index: m.index,
        context: text.slice(m.index - 50, m.index + 50)
      }))
    });
  });

  return map;
}
```

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] Error handling verified
- [ ] No TypeScript errors
- [ ] Output Channel logging works
- [ ] Ready for frontend integration (Sprint 02)

## References

- [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
- [Word Search Service](../../../src/infrastructure/api/services/search/WordSearchService.ts) (reference)
- [Search Handler](../../../src/application/handlers/domain/SearchHandler.ts)
- [OpenRouter Client](../../../src/infrastructure/api/OpenRouterClient.ts)

## Outcomes

*To be filled after sprint completion*

- **PR**: #[number]
- **Completion Date**: YYYY-MM-DD
- **Actual Effort**: [hours/days]
- **Discoveries**: [any tech debt, blockers, or insights]
