# Token Usage Centralization & Standardization

**Date Identified**: 2025-11-18
**Identified During**: Category Search Epic - Sprint 04
**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Updated**: 2025-11-21 (expanded to include AIOrchestrator centralization)

## Problem

Token usage tracking is duplicated across services and handlers, violating DRY principles:

1. **Inconsistent return formats** - Services return different token usage structures
2. **Manual parsing in handlers** - Each handler manually extracts and converts token data
3. **Duplicated token parsing** - Token usage parsing happens in multiple places
4. **No centralized emission** - Services are responsible for tracking their own tokens

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

### Strategy: Centralize Token Tracking in AIResourceOrchestrator

**Goal**: Token usage should be parsed and emitted **once** in `AIResourceOrchestrator`, automatically for all AI requests.

### 1. AIResourceOrchestrator Emits Token Messages

All AI execution methods should emit `TOKEN_USAGE` messages automatically:

```typescript
// src/application/services/AIResourceOrchestrator.ts

export class AIResourceOrchestrator {
  constructor(
    private openRouterClient: OpenRouterClient,
    private aiResourceManager: AIResourceManager,
    private postMessageCallback?: (message: MessageEnvelope<any>) => void
  ) {}

  async executeWithCapabilities(...): Promise<string> {
    const result = await this.openRouterClient.createChatCompletion(...);

    // Parse and emit token usage ONCE for all requests
    if (result.usage && this.postMessageCallback) {
      this.postMessageCallback({
        type: MessageType.TOKEN_USAGE,
        source: 'extension.orchestrator',
        payload: {
          promptTokens: result.usage.prompt_tokens,
          completionTokens: result.usage.completion_tokens,
          totalTokens: result.usage.total_tokens,
          costUsd: this.calculateCost(result.usage, modelId)
        },
        timestamp: Date.now()
      });
    }

    return result.choices[0].message.content;
  }

  // Same pattern for executeWithoutCapabilities and executeContextWithResources
}
```

### 2. Remove Token Tracking from Services

Services no longer need to return or track token usage:

```typescript
// BEFORE: Services return usage
export interface DictionaryResult {
  word: string;
  entry: string;
  usage?: TokenUsage;  // ❌ Remove
}

// AFTER: Services return only domain data
export interface DictionaryResult {
  word: string;
  entry: string;
}

// Token usage automatically emitted by AIOrchestrator
```

### 3. Remove Token Conversion from Handlers

Handlers no longer manually parse or emit token messages:

```typescript
// BEFORE: Handlers manually track tokens
const result = await this.dictionaryService.lookupWord(word, contextText);
if ((result as any).usage) {
  this.applyTokenUsage((result as any).usage); // ❌ Remove
}

// AFTER: Handlers just use domain data
const result = await this.dictionaryService.lookupWord(word, contextText);
// Token usage already emitted by AIOrchestrator
```

### 4. Frontend Already Wired

Frontend `useTokenTracking` hook already listens for `TOKEN_USAGE` messages:

```typescript
// src/presentation/webview/hooks/domain/useTokenTracking.ts
const handleTokenUsage = useCallback((message: MessageEnvelope<TokenUsagePayload>) => {
  const { promptTokens, completionTokens, totalTokens, costUsd } = message.payload;
  // Update state
}, []);

// No changes needed - already works with centralized emission
```

## Impact

### Benefits of Fixing

- ✅ **Single source of truth**: Token parsing in one place (AIOrchestrator)
- ✅ **Automatic tracking**: All AI requests emit tokens without manual work
- ✅ **DRY compliance**: No duplication across 10+ services and handlers
- ✅ **Type safety**: No `as any` casts for token extraction
- ✅ **Simpler services**: Services focus on domain logic, not token tracking
- ✅ **Easier to add features**: Cost calculation, rate limiting, budgets all in one place

### Risks of Not Fixing

- ⚠️ **Continued duplication**: Every new AI service must manually track tokens
- ⚠️ **Inconsistent tracking**: Easy to forget token emission in new features
- ⚠️ **Maintenance burden**: Token format changes require updates in 10+ places
- ⚠️ **Error-prone**: Copy-paste errors in token conversion code

## Files to Update

### Phase 1: Add Token Emission to AIResourceOrchestrator

1. **`src/application/services/AIResourceOrchestrator.ts`**
   - Add `postMessageCallback` to constructor
   - Emit `TOKEN_USAGE` messages in all 3 execution methods
   - Add `calculateCost()` helper method

### Phase 2: Wire MessageCallback Through Handlers

2. **`src/application/handlers/MessageHandler.ts`**
   - Pass `this.postMessage` callback to AIResourceOrchestrator constructor
   - Ensure orchestrator can emit messages back to webview

### Phase 3: Remove Token Tracking from Services

3. **All service result interfaces** (remove `usage` field):
   - `DictionaryResult` (DictionaryService)
   - `CategorySearchResult` (CategorySearchService)
   - `ContextResult` (ContextAssistantService)
   - Any other service results with `usage` field

4. **All AI services** (remove token tracking logic):
   - `DictionaryService.ts`
   - `CategorySearchService.ts`
   - `ContextAssistantService.ts`
   - `AssistantToolService.ts`

### Phase 4: Remove Token Extraction from Handlers

5. **All domain handlers** (remove `applyTokenUsage()` calls):
   - `AnalysisHandler.ts`
   - `DictionaryHandler.ts`
   - `ContextHandler.ts`
   - `SearchHandler.ts`
   - Any other handlers manually tracking tokens

### Phase 5: Update Message Types (Cleanup)

6. **`src/shared/types/messages/search.ts`**
   - Remove `usage?` field from `CategorySearchResult`

7. **`src/shared/types/messages/dictionary.ts`** (if exists)
   - Remove `usage?` field from result types

## Implementation Order

1. Add token emission to `AIResourceOrchestrator` (core infrastructure)
2. Wire message callback through `MessageHandler` (plumbing)
3. Remove token fields from service result interfaces (cleanup)
4. Remove token tracking from all services (simplification)
5. Remove token extraction from all handlers (simplification)
6. Test that frontend token tracking still works (verification)

## References

- **AIResourceOrchestrator**: [src/application/services/AIResourceOrchestrator.ts](../../src/application/services/AIResourceOrchestrator.ts)
- **TokenUsage Type**: [src/shared/types/messages/base.ts](../../src/shared/types/messages/base.ts#L189)
- **useTokenTracking Hook**: [src/presentation/webview/hooks/domain/useTokenTracking.ts](../../src/presentation/webview/hooks/domain/useTokenTracking.ts)
- **Related**: Fast Dictionary Generation (PR #31) uses orchestrator pattern

## Notes

- This follows the **orchestrator pattern** established in Fast Dictionary Generation
- AIResourceOrchestrator is the **single point** for all AI API calls
- Frontend `useTokenTracking` hook already listens for `TOKEN_USAGE` messages
- This is a **cross-cutting concern** that benefits from centralization
