# Token Usage Return Format Standardization

**Date Identified**: 2025-11-18
**Identified During**: Category Search Epic - Sprint 04
**Priority**: Low
**Estimated Effort**: 1-2 hours

## Problem

AI services return token usage in inconsistent formats, requiring manual conversion in handlers and violating DRY principles.

## Current Implementation

### AnalysisHandler / DictionaryHandler Pattern
Uses `TokenUsage` type directly from service result:
```typescript
// Service returns TokenUsage format
const result = await this.dictionaryService.lookupWord(word, contextText);
if ((result as any).usage) {
  this.applyTokenUsage((result as any).usage); // Direct pass-through
}
```

### CategorySearchService Pattern
Returns custom inline type with different field names:
```typescript
// Service returns custom format
tokensUsed?: {
  prompt: number;      // vs promptTokens
  completion: number;  // vs completionTokens
  total: number;       // vs totalTokens
  costUsd?: number;
}

// Handler must convert
this.applyTokenUsageCallback({
  promptTokens: result.tokensUsed.prompt,
  completionTokens: result.tokensUsed.completion,
  totalTokens: result.tokensUsed.total,
  costUsd: result.tokensUsed.costUsd
});
```

## Recommendation

### 1. Standardize on `TokenUsage` Type
All services should return `TokenUsage | undefined` directly:

```typescript
// In CategorySearchService.getAIMatches()
const tokensUsed: TokenUsage | undefined = result.usage ? {
  promptTokens: result.usage.promptTokens,
  completionTokens: result.usage.completionTokens,
  totalTokens: result.usage.totalTokens,
  costUsd: result.usage.costUsd
} : undefined;
```

### 2. Update CategorySearchResult Type
Replace inline type with reference to `TokenUsage`:

```typescript
// In src/shared/types/messages/search.ts
import { TokenUsage } from './base';

export interface CategorySearchResult {
  query: string;
  matchedWords: string[];
  wordSearchResult: WordSearchResult;
  timestamp: number;
  error?: string;
  usage?: TokenUsage;  // Use standard type
}
```

### 3. Simplify SearchHandler
Remove conversion, use direct pass-through like other handlers:

```typescript
if (result.usage && this.applyTokenUsageCallback) {
  this.applyTokenUsageCallback(result.usage);
}
```

## Impact

### Benefits of Fixing
- **Consistency**: All handlers follow same pattern
- **Type Safety**: No `as any` casts needed
- **DRY**: Remove conversion code
- **Maintainability**: Single source of truth for token usage format

### Risks of Not Fixing
- Low risk - code works correctly
- Minor maintenance burden when adding new AI features
- Potential for copy-paste errors with conversion code

## Files to Update

1. **`src/shared/types/messages/search.ts`**
   - Change `tokensUsed` to `usage: TokenUsage`

2. **`src/infrastructure/api/services/search/CategorySearchService.ts`**
   - Import `TokenUsage` type
   - Return `TokenUsage` format from `getAIMatches()`
   - Update `searchByCategory()` return to use `usage` field

3. **`src/application/handlers/domain/SearchHandler.ts`**
   - Remove conversion code
   - Use `result.usage` directly like other handlers

4. **`src/presentation/webview/hooks/domain/useSearch.ts`** (if needed)
   - Update `CategorySearchState` if it references the type

## References

- [TokenUsage Type](../src/shared/types/messages/base.ts#L189)
- [CategorySearchResult Type](../src/shared/types/messages/search.ts#L95)
- [SearchHandler Token Tracking](../src/application/handlers/domain/SearchHandler.ts#L127)
- [DictionaryHandler Pattern](../src/application/handlers/domain/DictionaryHandler.ts#L97)
