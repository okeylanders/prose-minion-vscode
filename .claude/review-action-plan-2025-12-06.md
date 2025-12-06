# TypeScript/React VSCode Extension Review - Action Plan

**Generated**: 2025-12-06
**Branch**: `sprint/epic-ahp-v1.3-sub4-03-streaming-cancel`
**Mode**: PR Review (34 files changed, 2,454 insertions, 1,348 deletions)
**Commits**: 8 commits focused on streaming responses and cancellation UI

**Total Issues**: 3 Critical, 7 Moderate, 5 Minor, 2 Future Sprint

---

## Summary

This PR implements streaming responses for analysis, context, and dictionary operations with request cancellation support. The implementation demonstrates **excellent architecture** (9+ scores across all layers) with proper abort signal propagation, Strategy pattern routing, and clean separation of concerns.

**Key Strengths**:
- AbortSignal threads cleanly through entire stack (UI → handlers → services → OpenRouter)
- Smart first-token detection prevents streaming of internal protocol messages
- Robust resource cleanup with guaranteed disposal in finally blocks
- Consistent Strategy pattern implementation in message routing
- Strong type safety in message contracts

**Areas Requiring Attention**:
- Race conditions on rapid double-clicks (wasted API tokens)
- Missing behavioral test coverage for streaming (currently 0%)
- Inconsistent abort error handling across services
- Accessibility gaps (ARIA live regions)
- Code duplication across domain hooks (~180 lines)

---

## Critical Priority Steps (Address Before Merge)

### Step 1: Add race condition protection to startStreaming

**Why**: Rapid double-clicks can create orphaned streaming sessions that waste API tokens

**Files**:
- [useAnalysis.ts:151-157](src/presentation/webview/hooks/domain/useAnalysis.ts#L151-L157)
- [useContext.ts:149-155](src/presentation/webview/hooks/domain/useContext.ts#L149-L155)
- [useDictionary.ts:213-219](src/presentation/webview/hooks/domain/useDictionary.ts#L213-L219)

**Action**:
1. In each domain hook's `startStreaming`, cancel existing stream first:
```typescript
const startStreaming = React.useCallback((requestId: string) => {
  // Cancel any existing stream first
  if (currentRequestId) {
    ignoredRequestIdsRef.current.add(currentRequestId);
    streaming.reset();
  }

  ignoredRequestIdsRef.current.delete(requestId);
  setCurrentRequestId(requestId);
  streaming.startStreaming();
  setLoading(true);
  setResult('');
}, [currentRequestId, streaming]);
```
2. Run: `npm run typecheck && npm test`
3. Verify: Rapid clicking "Analyze" doesn't create duplicate streams

**Expected outcome**: Only one active stream per domain at any time

---

### Step 2: Add abort error handling to AssistantToolService

**Why**: Users see "Error: Aborted" instead of graceful "Cancelled" message when they cancel

**Files**:
- [AssistantToolService.ts:186-191](src/infrastructure/api/services/analysis/AssistantToolService.ts#L186-L191)
- [AssistantToolService.ts:246-250](src/infrastructure/api/services/analysis/AssistantToolService.ts#L246-L250)
- [ContextAssistantService.ts:185-194](src/infrastructure/api/services/analysis/ContextAssistantService.ts#L185-L194)

**Action**:
1. Add abort error check in catch blocks:
```typescript
} catch (error) {
  // Handle abort separately for graceful UX
  if (error instanceof Error && error.name === 'AbortError') {
    return AnalysisResultFactory.createAnalysisResult(
      'dialogue_analysis',
      '(Cancelled)'
    );
  }
  return AnalysisResultFactory.createAnalysisResult(
    'dialogue_analysis',
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
}
```
2. Apply same pattern to all catch blocks in both services
3. Run: `npm run typecheck && npm test`
4. Verify: Cancel shows "(Cancelled)", not "Error: Aborted"

**Expected outcome**: Consistent, user-friendly cancellation messaging

---

### Step 3: Add ARIA live region to StreamingContent

**Why**: Screen reader users not notified of streaming updates (accessibility gap)

**Files**:
- [StreamingContent.tsx:42-72](src/presentation/webview/components/shared/StreamingContent.tsx#L42-L72)

**Action**:
1. Add ARIA attributes to streaming container:
```tsx
<div className={`streaming-content ${className}`} aria-live="polite" aria-atomic="false">
  {isStreaming && (
    <div className="streaming-header" role="status">
      <span className="streaming-indicator">
        <span className="streaming-dot"></span>
        Streaming...
      </span>
      {tokenCount > 0 && <span className="token-count">{tokenCount} tokens</span>}
      {onCancel && currentRequestId && (
        <button
          className="cancel-button"
          onClick={onCancel}
          title="Cancel"
          aria-label="Cancel streaming"
        >✕</button>
      )}
    </div>
  )}
```
2. Run: `npm run typecheck`
3. Verify: Use screen reader to confirm updates announced

**Expected outcome**: Streaming content accessible to screen reader users

---

## Moderate Priority Steps (Address in Follow-up)

### Step 4: Add abort signal to parallel dictionary generation

**Why**: Parallel dictionary requests (14 concurrent) cannot be cancelled, wasting API tokens

**Files**:
- [DictionaryService.ts:269-340](src/infrastructure/api/services/dictionary/DictionaryService.ts#L269-L340)

**Action**:
1. Add signal parameter:
```typescript
async generateParallelDictionary(
  word: string,
  context?: string,
  onProgress?: ParallelGenerationProgressCallback,
  signal?: AbortSignal  // Add this
): Promise<FastGenerateDictionaryResultPayload> {
```
2. Pass signal through to `executeWithoutCapabilities`:
```typescript
const result = await orchestrator.executeWithoutCapabilities(
  `dictionary-fast-${blockName}`,
  systemMessage,
  userMessage,
  {
    temperature: 0.4,
    maxTokens: 3500,
    timeoutMs: this.BLOCK_TIMEOUT,
    signal  // Add this
  }
);
```
3. Run: `npm run typecheck && npm test`

**Expected outcome**: Parallel dictionary requests cancellable

---

### Step 5: Add logging to silent catch in OpenRouterClient

**Why**: Malformed SSE chunks silently discarded, impossible to debug streaming issues

**Files**:
- [OpenRouterClient.ts:214-216](src/infrastructure/api/providers/OpenRouterClient.ts#L214-L216)

**Action**:
1. Add debug logging:
```typescript
} catch (error) {
  // Log for debugging but don't fail the stream
  console.debug(
    `[OpenRouter] Skipped malformed JSON chunk: ${error instanceof Error ? error.message : String(error)}`
  );
}
```
2. Run: `npm run typecheck`

**Expected outcome**: SSE parsing issues visible in console

---

### Step 6: Add stream body cancel on abort

**Why**: HTTP connections may stay open until server timeout when aborted

**Files**:
- [OpenRouterClient.ts:161-221](src/infrastructure/api/providers/OpenRouterClient.ts#L161-L221)

**Action**:
1. Add stream cancellation in catch before finally:
```typescript
try {
  // ... streaming logic
} catch (error) {
  // Cancel the underlying stream body on abort
  if (response.body) {
    await response.body.cancel().catch(() => {});
  }
  throw error;
} finally {
  reader.releaseLock();
}
```
2. Run: `npm run typecheck && npm test`

**Expected outcome**: HTTP connections closed immediately on abort

---

### Step 7: Add truncated parameter to ContextHandler

**Why**: Inconsistent API surface - Analysis/Dictionary support truncated flag, Context does not

**Files**:
- [ContextHandler.ts:143](src/application/handlers/domain/ContextHandler.ts#L143)

**Action**:
1. Add truncated parameter to match AnalysisHandler pattern:
```typescript
private sendStreamComplete(requestId: string, content: string = '', cancelled: boolean = false, truncated: boolean = false): void {
  this.postMessage({
    type: MessageType.STREAM_COMPLETE,
    source: 'extension.context',
    payload: {
      requestId,
      domain: 'context' as const,
      content,
      cancelled,
      truncated
    },
    timestamp: Date.now()
  });
}
```
2. Run: `npm run typecheck && npm test`

**Expected outcome**: Consistent handler API surface

---

### Step 8: Remove duplicate request ID check

**Why**: Redundant check wastes cycles and adds cognitive load

**Files**:
- [useAnalysis.ts:170,174](src/presentation/webview/hooks/domain/useAnalysis.ts#L170-L174)
- [useContext.ts:168,172](src/presentation/webview/hooks/domain/useContext.ts#L168-L172)
- [useDictionary.ts:232,236](src/presentation/webview/hooks/domain/useDictionary.ts#L232-L236)

**Action**:
1. Remove second redundant check in each handleStreamChunk:
```typescript
const handleStreamChunk = React.useCallback((message: StreamChunkMessage) => {
  const { domain, token, requestId } = message.payload;
  if (domain !== 'analysis') return;
  if (ignoredRequestIdsRef.current.has(requestId)) return;
  if (currentRequestId && requestId !== currentRequestId) return;  // Remove duplicate check below

  // ... rest of handler
}, [currentRequestId, startStreaming, streaming]);
```
2. Run: `npm run typecheck && npm test`

**Expected outcome**: Cleaner guard logic

---

### Step 9: Extract token usage accumulator (DRY)

**Why**: Token accumulation pattern duplicated 3 times in AIResourceOrchestrator

**Files**:
- [AIResourceOrchestrator.ts:249-262,549-560,609-620](src/infrastructure/api/orchestration/AIResourceOrchestrator.ts)

**Action**:
1. Extract private method:
```typescript
private accumulateUsage(total: TokenUsage | undefined, turn: TokenUsage | undefined): TokenUsage | undefined {
  if (!turn) return total;
  if (!total) return { ...turn };

  return {
    promptTokens: total.promptTokens + turn.promptTokens,
    completionTokens: total.completionTokens + turn.completionTokens,
    totalTokens: total.totalTokens + turn.totalTokens,
    costUsd: (total.costUsd || 0) + (turn.costUsd || 0)
  };
}
```
2. Replace 3 duplicate blocks with `totalUsage = this.accumulateUsage(totalUsage, turnUsage);`
3. Run: `npm run typecheck && npm test`

**Expected outcome**: DRY token accumulation

---

### Step 10: Add error/failure state to StreamCompletePayload

**Why**: No standard way to communicate stream failure (vs cancellation) in message contract

**Files**:
- [streaming.ts:45-52](src/shared/types/messages/streaming.ts#L45-L52)

**Action**:
1. Add optional error field:
```typescript
export interface StreamCompletePayload {
  requestId: string;
  domain: StreamingDomain;
  content: string;
  cancelled?: boolean;
  truncated?: boolean;
  error?: {
    message: string;
    code?: string;
  };
}
```
2. Update handlers to populate on failure (optional - can document that ERROR messages used instead)
3. Run: `npm run typecheck && npm test`

**Expected outcome**: Clear error communication in stream complete

---

## Minor Priority Steps (Nice to Have)

### Step 11: Fix type safety for usage cost fields

**Files**: [OpenRouterClient.ts:105-107](src/infrastructure/api/providers/OpenRouterClient.ts#L105-L107)

**Action**: Extend `OpenRouterResponse` interface to include optional cost fields instead of `as any`

---

### Step 12: Extract UI_UPDATE_DELAY constant

**Files**: [AnalysisHandler.ts:201](src/application/handlers/domain/AnalysisHandler.ts#L201), [ContextHandler.ts:182](src/application/handlers/domain/ContextHandler.ts#L182)

**Action**: Replace magic number `100` with named constant

---

### Step 13: Add JSDoc to streaming message interfaces

**Files**: [streaming.ts:71-93](src/shared/types/messages/streaming.ts#L71-L93)

**Action**: Add one-line JSDoc to each message interface

---

### Step 14: Remove unused content parameter

**Files**: [useDictionary.ts:248](src/presentation/webview/hooks/domain/useDictionary.ts#L248)

**Action**: Remove destructured but unused `content` from handleStreamComplete

---

### Step 15: Consolidate normalization logic

**Files**: [UtilitiesTab.tsx:35-58](src/presentation/webview/components/tabs/UtilitiesTab.tsx#L35-L58)

**Action**: Merge `normalizePhrase` and `enforceWordLimit` into single function with behavior parameter

---

## Future Sprint: Test Coverage

### Step 16: Add streaming behavior tests (Tier 4)

**Why**: Streaming functionality has 0% behavioral test coverage

**Recommended Tests** (15-20 tests):

1. **Cancellation Flow**:
   - User cancels during streaming → abort propagates → cleanup occurs
   - Rapid cancel/restart cycles don't leak state
   - Cancelled request tokens ignored after cancel

2. **Stream Lifecycle**:
   - Started event → UI enables cancel button
   - Chunks accumulate correctly
   - Complete event → final content displayed

3. **Error Scenarios**:
   - Network error during streaming → user sees error, not partial content
   - Abort error → user sees "Cancelled", not "Error: Aborted"

4. **RequestId Logic**:
   - Chunks with wrong requestId → ignored
   - Start event creates new requestId → old ignored

**Target**: 50% streaming-specific coverage

---

## Future Sprint: Extract Shared Streaming Hook

### Step 17: Create useDomainStreaming helper

**Why**: 180 lines duplicated across useAnalysis, useContext, useDictionary

**Files**: All domain hooks

**Action**: Extract shared hook per architecture debt document `.todo/architecture-debt/2025-12-05-streaming-hook-duplication.md`

**Estimated Effort**: 0.5-1 day

---

## Positive Findings

**Patterns Working Well** (Reinforce These):

1. **AbortSignal Threading** - Clean propagation through entire stack from UI to HTTP layer
2. **Strategy Pattern** - MessageRouter with map-based routing, no switch statements
3. **First-Token Detection** - Smart pattern to detect resource requests vs final content
4. **Resource Cleanup Discipline** - Guaranteed disposal in finally blocks
5. **Tripartite Hook Interface** - Clear State/Actions/Persistence separation
6. **Message Envelope Pattern** - Consistent source tracking and typed payloads
7. **Graceful Degradation** - Friendly messages when API key missing
8. **Progressive Token Reporting** - Real-time cost tracking via callbacks
9. **Domain Ownership** - Handlers own complete message lifecycle

**Architecture Scores**:
- Infrastructure Layer: 9.2/10
- Message Contracts: 9.2/10
- Presentation Hooks: 8/10
- UI Components: 9/10
- Application Handlers: 9/10
- Tools & Tests: B- (structure good, behavioral coverage missing)

---

## Summary

**Total steps**: 17 (3 Critical, 7 Moderate, 5 Minor, 2 Future Sprint)

**Recommended merge criteria**:
- ✅ Steps 1-3 (Critical) completed
- ⚠️ Steps 4-10 (Moderate) tracked as follow-up issues
- ℹ️ Steps 11-15 (Minor) optional polish
- 📅 Steps 16-17 (Future) scheduled for dedicated sprint

**Next action**: Review Step 1 (race condition fix) and decide whether to proceed.

---

## Architecture Debt Validation

The following documented debt items were validated as **accurate and complete**:

| Debt Document | Status | Notes |
|---------------|--------|-------|
| `2025-12-05-cancel-message-duplication.md` | ✅ Accurate | Add ContextHandler to scope |
| `2025-12-05-streaming-hook-duplication.md` | ✅ Accurate | 180 lines duplicated |

**Additional debt identified**: Handler cancellation logic also duplicated (same pattern across AnalysisHandler, ContextHandler, DictionaryHandler) - consider documenting.
