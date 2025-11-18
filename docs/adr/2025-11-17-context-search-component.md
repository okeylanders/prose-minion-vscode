# ADR-2025-11-17: Context Search Component (AI-Powered Semantic Search)

**Status**: Proposed
**Date**: 2025-11-17
**Deciders**: okeylanders
**Epic**: [Epic: Context Search](.todo/epics/epic-context-search-2025-11-17/epic-context-search.md)

## Context and Problem Statement

Writers need to find words in their prose by **semantic category** rather than exact string matching. For example:
- `[clothing]` should find: coat, pants, jeans, shirt, etc.
- `[color red]` should find: crimson, maroon, scarlet, ruby
- `[angry]` should find: pissed, upset, furious, livid

Current Word Search requires exact target words. Context Search leverages AI to match words by meaning, enabling category-based discovery.

## Decision Drivers

- **Writer need**: Discover vocabulary patterns by semantic category
- **AI leverage**: Use LLM semantic understanding for fuzzy matching
- **Performance**: Word lists can be large (10K+ distinct words in a novel)
- **Token cost**: Minimize API calls while maintaining accuracy
- **UX consistency**: Match existing Word Search UX patterns
- **Output utility**: Enable export, cluster analysis, chapter-level detail

## Considered Options

### Option 1: Two-Phase AI Processing (SELECTED)
1. Extract distinct word list from scope (backend, local)
2. Pass word list + category query to AI → get matches
3. Re-scan scope to count occurrences and locations

**Pros**:
- Efficient: Single AI call per search
- Accurate: AI has full word list context for matching
- Scalable: Local extraction + single API call

**Cons**:
- Large word lists may hit token limits (need pagination strategy)
- Single point of failure (if AI call fails, entire search fails)

### Option 2: Incremental AI Processing
- Process text in chunks, ask AI to match category in each chunk
- Aggregate results

**Pros**:
- No token limit concerns
- Graceful degradation (partial results on failure)

**Cons**:
- Multiple AI calls → higher cost
- Inconsistent matching (AI might miss context across chunks)
- Slower (serial API calls)

### Option 3: Hybrid Local + AI
- Use local lexical database (WordNet) for common categories
- Fall back to AI for complex queries

**Pros**:
- Lower cost for common queries
- Fast local fallback

**Cons**:
- Adds dependency (WordNet)
- Complex implementation
- Limited category coverage (WordNet doesn't know "microbeat" or "dialogue tags")

## Decision Outcome

**Chosen**: Option 1 (Two-Phase AI Processing) + **Service Composition Pattern**

**Rationale**:

- Simplest implementation aligned with spec
- Single AI call minimizes cost and latency
- Accurate semantic matching with full context
- Token limit manageable with pagination/truncation strategy
- **ARCHITECTURAL WIN**: Delegate to WordSearchService for occurrence counting, clustering, chapter detection
  - Eliminates duplication (DRY principle)
  - Reuses proven, tested implementation
  - Gets multi-file processing, clusters, snippets for FREE
  - ZERO new settings needed (reuse Word Search settings)

## Architecture

### Message Contracts

```typescript
// src/shared/types/messages/search.ts

export interface ContextSearchRequest extends BaseMessage {
  type: MessageType.CONTEXT_SEARCH_REQUEST;
  payload: {
    query: string;          // Category/concept to search for (e.g., "clothing", "color red")
    scope: {
      mode: 'selection' | 'file' | 'glob';
      content?: string;
      path?: string;
      globPattern?: string;
    };
    options?: {
      minWordLength?: number;       // Filter short words (default 2)
      excludeStopwords?: boolean;   // Filter common words (default true)
      caseSensitive?: boolean;      // Case-sensitive matching (default false)
    };
  };
}

export interface ContextSearchResult extends BaseMessage {
  type: MessageType.CONTEXT_SEARCH_RESULT;
  payload: {
    query: string;
    matches: Array<{
      word: string;
      count: number;
      chapters?: Array<{
        chapterName: string;
        count: number;
        locations: Array<{ line: number; context: string }>;
      }>;
    }>;
    summary: {
      totalMatches: number;
      uniqueWords: number;
      wordsAnalyzed: number;  // Total distinct words in scope
      truncated: boolean;     // If word list was truncated
    };
    timestamp: number;
  };
}
```

### Backend Architecture

#### 1. ContextSearchService
**Location**: `src/infrastructure/api/services/search/ContextSearchService.ts`

**Responsibilities**:

- Extract distinct word list from text
- Build AI prompt for semantic matching
- Parse AI response to get matched words
- **Delegate to WordSearchService for occurrence counting, clustering, chapter detection**
- Format results for frontend (add category metadata wrapper)

**Key Methods**:

```typescript
class ContextSearchService {
  constructor(
    private openRouterClient: OpenRouterClient,
    private wordSearchService: WordSearchService,  // NEW: Composition
    private textProcessor: TextProcessorService
  );

  async searchByContext(
    query: string,
    text: string,
    files?: string[],
    sourceMode?: string,
    options: ContextSearchOptions
  ): Promise<ContextSearchResult>;

  private extractDistinctWords(text: string, options: WordFilterOptions): string[];
  private buildMatchingPrompt(query: string, words: string[]): string;
  private parseAIMatches(aiResponse: string): string[];
  // REMOVED: countOccurrences → delegates to WordSearchService instead
  private formatResults(wordSearchResult: MetricsResult, query: string): ContextSearchResult;
}
```

**Service Composition Flow**:

```typescript
async searchByContext(query, text, files, sourceMode, options) {
  // 1. Extract unique words
  const allWords = this.extractDistinctWords(text, options);

  // 2. AI matching
  const matchedWords = await this.queryAIForMatches(query, allWords);

  // 3. Delegate to WordSearchService for occurrence counting
  const wordSearchResult = await this.wordSearchService.searchWords(
    text,
    files,
    sourceMode,
    {
      wordsOrPhrases: matchedWords,  // AI-matched words become search targets
      contextWords: options.contextWords,      // From existing settings
      clusterWindow: options.clusterWindow,    // From existing settings
      minClusterSize: options.minClusterSize,  // From existing settings
      caseSensitive: options.caseSensitive
    }
  );

  // 4. Wrap result with category metadata
  return this.formatResults(wordSearchResult, query);
}
```

#### 2. SearchHandler Extension
**Location**: `src/application/handlers/domain/SearchHandler.ts`

**Changes**:
- Add route for `MessageType.CONTEXT_SEARCH_REQUEST`
- Instantiate `ContextSearchService` (inject OpenRouterClient)
- Handle context search requests, send results

#### 3. System Prompts
**Location**: `resources/system-prompts/context-search/`

**Prompt Strategy**:
```markdown
# 00-role.md
You are a semantic word matcher. Given a list of words and a category/concept,
identify which words belong to that category.

# 01-instructions.md
Input format:
- Category: [category description]
- Words: [comma-separated list]

Output format:
Return ONLY the matching words as a JSON array. No explanations.

Example:
Category: clothing
Words: coat, tree, pants, river, jeans, mountain, shirt
Output: ["coat", "pants", "jeans", "shirt"]

# 02-constraints.md
- Be inclusive: if a word might reasonably fit the category, include it
- Consider synonyms, related terms, and variations
- Ignore case differences
- Return empty array if no matches
```

### Frontend Architecture

#### 1. useSearch Hook Extension
**Location**: `src/presentation/webview/hooks/domain/useSearch.ts`

**State Additions**:
```typescript
interface SearchState {
  // ... existing word search state
  contextSearch: {
    query: string;
    result: ContextSearchResult | null;
    isLoading: boolean;
    error: string | null;
  };
}

interface SearchActions {
  // ... existing actions
  performContextSearch: (query: string, scope: SearchScope, options?: ContextSearchOptions) => void;
  clearContextSearch: () => void;
}
```

#### 2. UI Component
**Location**: `src/presentation/webview/components/SearchTab.tsx`

**New Subtool**: "Context Search" (similar to Word Search)

**UI Elements**:
- Query input (text field, placeholder: "Enter category or concept, e.g., 'clothing', 'color red'")
- Scope selector (Selection / Current File / Glob Pattern)
- Options toggles (Min word length, Exclude stopwords, Case sensitive)
- Search button
- Results display (mirrors Word Search format):
  - Summary table (word | count)
  - Expanded summary (word | count | chapter)
  - Details & cluster analysis
- Export button (saves markdown report)

### Performance & Token Management

#### Word List Pagination Strategy

**Problem**: Large novels may have 10K+ distinct words → exceed token limits

**Solution**: Paginate word list in batches

```typescript
const MAX_WORDS_PER_BATCH = 2000;

async searchByContext(query: string, text: string): Promise<ContextSearchResult> {
  const allWords = this.extractDistinctWords(text);
  const batches = chunk(allWords, MAX_WORDS_PER_BATCH);

  const allMatches: string[] = [];
  for (const batch of batches) {
    const matches = await this.queryAIForMatches(query, batch);
    allMatches.push(...matches);
  }

  // Re-scan text for matched words
  return this.countOccurrences(text, allMatches);
}
```

**Trade-offs**:
- Multiple AI calls if word count > 2000
- Increased cost (linear with batches)
- Transparent to user (show "Analyzing batch 2 of 5..." in UI)

#### Token Cost Estimation

**Example**: 50K word novel, 8K distinct words, 4 batches
- Per batch: ~500 tokens (word list) + 50 tokens (prompt) = 550 tokens
- Total: 2,200 input tokens, ~200 output tokens
- Cost: ~$0.01 per search (Claude Haiku)

**Mitigation**:
- Default to Haiku for context search (fast, cheap)
- Allow model override in settings
- Show estimated cost before large searches (optional)

### Data Flow

```
1. User enters category query (e.g., "clothing")
   ↓
2. Frontend (useSearch) → postMessage(CONTEXT_SEARCH_REQUEST)
   ↓
3. MessageHandler → SearchHandler.handleContextSearch()
   ↓
4. SearchHandler → ContextSearchService.searchByContext()
   ↓
5. ContextSearchService:
   a. Extract distinct words from text
   b. Paginate word list into batches
   c. For each batch:
      - Build AI prompt
      - Query OpenRouter
      - Parse JSON response
   d. Aggregate all matches
   e. Re-scan text to count occurrences per chapter
   f. Format results
   ↓
6. SearchHandler → postMessage(CONTEXT_SEARCH_RESULT)
   ↓
7. Frontend (useSearch) → update state, display results
```

## Consequences

### Positive

- ✅ **Semantic discovery**: Writers find vocabulary patterns by meaning, not exact strings
- ✅ **AI-powered**: Leverages LLM semantic understanding
- ✅ **Consistent UX**: Matches Word Search patterns (familiar to users)
- ✅ **Flexible queries**: Natural language categories ("clothing", "angry", "color red")
- ✅ **Exportable**: Markdown reports for external analysis
- ✅ **Scalable**: Pagination handles large word lists

### Negative

- ❌ **Token cost**: Multiple AI calls for large texts (mitigated by Haiku model)
- ❌ **Latency**: Batch processing adds wait time (mitigated by progress indicators)
- ❌ **AI variability**: Different models may match differently (document model used in results)
- ❌ **No offline mode**: Requires API access (unlike lexical word search)

### Neutral

- ⚠️ **New dependency**: Adds AI call pathway (but already established pattern)
- ⚠️ **Prompt tuning**: May need iteration to get matching accuracy right
- ⚠️ **Edge cases**: Ambiguous categories (e.g., "bank" → river bank or money bank?)

## Anti-Pattern Prevention

### God Component Check
- ✅ ContextSearchService: Single responsibility (semantic matching)
- ✅ SearchHandler: Owns Search domain, delegates to service
- ✅ useSearch: Contains all Search state/actions (Context Search is part of Search domain)

### Dependency Inversion
- ✅ Flow: Presentation → Application → Infrastructure → OpenRouter
- ✅ No upward dependencies

### Domain Boundaries
- ✅ Clear ownership: Search domain (not Metrics, not Analysis)
- ✅ Mirrors Word Search architecture (same domain, similar flow)

### Type Safety
- ✅ Full TypeScript interfaces for messages, state, actions
- ✅ No `any` types (AI response parsed with validation)

### Use Case Clustering
- ✅ All context search logic in ContextSearchService
- ✅ State/actions/persistence in useSearch hook
- ✅ UI in SearchTab component

## Implementation Plan

See [Epic: Context Search](.todo/epics/epic-context-search-2025-11-17/epic-context-search.md) for sprint breakdown.

**Estimated Effort**: 1.75 days (was 3-4 days) - **50% reduction via WordSearchService reuse**

**Sprint Breakdown**:

- Sprint 01: Message contracts + backend service (0.5 days)
- Sprint 02: Frontend integration + basic UI (0.5 days)
- Sprint 03: Result formatting + export (0.5 days)
- Sprint 04: Performance optimization + testing (0.25 days)

**Effort Savings**:

- ✅ No occurrence counting logic (WordSearchService)
- ✅ No cluster detection logic (WordSearchService)
- ✅ No chapter detection logic (WordSearchService)
- ✅ No snippet extraction logic (WordSearchService)
- ✅ No multi-file processing logic (WordSearchService)
- ✅ No new settings to create (reuse Word Search settings)

## References

- [Spec Document](.todo/search-module/2025-10-24-context-search-component.md)
- [Word Search Architecture](src/infrastructure/api/services/search/WordSearchService.ts)
- [Search Handler](src/application/handlers/domain/SearchHandler.ts)
- [useSearch Hook](src/presentation/webview/hooks/domain/useSearch.ts)

## Revision History

- **2025-11-18**: **MAJOR UPDATE** - Service Composition Pattern
  - Added WordSearchService delegation strategy (50% effort reduction)
  - Updated architecture to reflect composition over duplication
  - Multi-file batch processing moved from Phase 2 to Phase 1 (FREE)
  - ZERO new settings needed (reuse Word Search settings)
  - Revised effort estimate: 3-4 days → 1.75 days
- **2025-11-17**: Initial draft (Proposed)
