# Sprint 03: Streaming Responses + Cancellation UI

**Status**: 🟡 Ready
**Estimated Time**: 8-10 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub4-03-streaming-cancel`

---

## Problem

1. **No streaming**: Users wait for full response with no feedback (poor UX)
2. **Ineffective cancellation**: AbortController only stops local fetch, server keeps processing/billing
3. **No cancel button**: Users can't abort long-running requests

**Current Behavior**: User starts request → waits in silence → gets full response (or gives up)

**Desired Behavior**:
- Streaming: Progressive response display (5s buffer → 100ms debounce)
- Cancel button: Actually stops server-side generation (saves tokens)
- Smooth UX: Text appears progressively, user feels in control

---

## Scope

### Phase 3A: Streaming API Responses
Add streaming support to single-request AI tools (NOT Fast Dictionary - already has fan-out pattern).

**Tools to update:**
- Dialogue Analysis
- Prose Analysis
- Context Assistant
- Standard Dictionary Lookup

**NOT included:**
- Fast Dictionary (uses fan-out, already has progress bar)
- Category Search (returns structured data, streaming less useful)
- Word Search / Metrics (not AI-based)

### Phase 3B: Cancel UI
Add cancel button to LoadingIndicator, wire to AbortController.

---

## Prerequisites

- ✅ Backend infrastructure complete (PR #31): `AIOptions.signal`, `OpenRouterClient` passes signal to fetch
- ✅ LoadingIndicator component extracted (Sub-Epic 2, Sprint 02)

---

## Tasks

### Phase 3A: Streaming (6-7 hours)

#### Backend: OpenRouterClient Streaming
- [ ] Add `createStreamingChatCompletion()` method to OpenRouterClient
- [ ] Enable `stream: true` in request body
- [ ] Parse Server-Sent Events (SSE) from response
- [ ] Yield tokens via async generator or callback
- [ ] Handle `[DONE]` message for completion
- [ ] Extract token usage from final message

#### Backend: Handler Streaming Support
- [ ] Add streaming option to AnalysisHandler
- [ ] Add streaming option to DictionaryHandler (standard lookup only)
- [ ] Add streaming option to ContextHandler
- [ ] Send `STREAM_CHUNK` messages to webview as tokens arrive
- [ ] Send `STREAM_COMPLETE` message with final result + token usage

#### Frontend: Streaming State Management
- [ ] Add `streamBuffer` state to domain hooks
- [ ] Add `isStreaming` flag (distinct from `isLoading`)
- [ ] Handle `STREAM_CHUNK` messages (accumulate buffer)
- [ ] Handle `STREAM_COMPLETE` messages (finalize result)

#### Frontend: Progressive Rendering
- [ ] Create `StreamingContent` component
- [ ] Implement 5-second initial buffer (wait before first render)
- [ ] Implement 100ms debounce (smooth updates after buffer)
- [ ] Show token count during stream (`Streaming... (142 tokens)`)
- [ ] Render markdown progressively (debounced)

#### Message Contracts
- [ ] Add `STREAM_CHUNK` to MessageType enum
- [ ] Add `STREAM_COMPLETE` to MessageType enum
- [ ] Create `StreamChunkPayload` interface
- [ ] Create `StreamCompletePayload` interface

### Phase 3B: Cancel UI (2-3 hours)

#### UI Components
- [ ] Add `onCancel` prop to LoadingIndicator
- [ ] Add cancel button next to spinner
- [ ] Style cancel button (VSCode-themed)

#### Cancel Wiring
- [ ] Add `cancelRequest()` to useAnalysis hook
- [ ] Add `cancelRequest()` to useDictionary hook
- [ ] Add `cancelRequest()` to useContext hook
- [ ] Wire cancel button in AnalysisTab
- [ ] Wire cancel button in UtilitiesTab (dictionary/context sections)

#### Message Contracts
- [ ] Add `CANCEL_REQUEST` to MessageType enum
- [ ] Create `CancelRequestPayload` interface

---

## Implementation Details

### Phase 3A: Streaming

#### OpenRouterClient Streaming Method

```typescript
// OpenRouterClient.ts
async *createStreamingChatCompletion(
  messages: OpenRouterMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    onToken?: (token: string) => void;
  }
): AsyncGenerator<{ token: string; done: boolean; usage?: TokenUsage }> {
  const response = await fetch(`${this.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { /* ... */ },
    signal: options?.signal,
    body: JSON.stringify({
      model: this.model,
      messages,
      stream: true,  // Enable streaming
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 10000,
    })
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          return;
        }

        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content || '';
        const usage = parsed.usage;  // Available in final chunk

        if (token) {
          yield { token, done: false };
        }
        if (usage) {
          yield { token: '', done: true, usage };
        }
      }
    }
  }
}
```

#### Handler Streaming Pattern

```typescript
// AnalysisHandler.ts
private async handleAnalyzeDialogue(message: AnalyzeDialogueMessage) {
  const requestId = generateRequestId();

  try {
    let fullContent = '';

    for await (const chunk of this.client.createStreamingChatCompletion(
      messages,
      { signal: controller.signal }
    )) {
      if (chunk.done) {
        // Final message with usage
        this.postMessage({
          type: MessageType.STREAM_COMPLETE,
          payload: { requestId, content: fullContent, usage: chunk.usage }
        });
      } else {
        fullContent += chunk.token;
        this.postMessage({
          type: MessageType.STREAM_CHUNK,
          payload: { requestId, token: chunk.token }
        });
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      this.postMessage({
        type: MessageType.STATUS,
        payload: { message: 'Analysis cancelled' }
      });
    }
  }
}
```

#### Frontend: 5s Buffer + 100ms Debounce

```typescript
// useStreaming.ts (new hook)
const INITIAL_BUFFER_MS = 5000;
const DEBOUNCE_MS = 100;

export function useStreaming() {
  const [buffer, setBuffer] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [isBuffering, setIsBuffering] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const appendToken = useCallback((token: string) => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    setBuffer(prev => prev + token);
    setTokenCount(prev => prev + 1);
  }, []);

  // Debounced display update
  useEffect(() => {
    if (!startTimeRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;

    // Still in initial buffer phase
    if (elapsed < INITIAL_BUFFER_MS) {
      return;
    }

    // Past buffer - start debounced updates
    setIsBuffering(false);

    const timer = setTimeout(() => {
      setDisplayContent(buffer);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [buffer]);

  const reset = useCallback(() => {
    setBuffer('');
    setDisplayContent('');
    setIsBuffering(true);
    setTokenCount(0);
    startTimeRef.current = null;
  }, []);

  return {
    buffer,
    displayContent,
    isBuffering,
    tokenCount,
    appendToken,
    reset
  };
}
```

#### StreamingContent Component

```tsx
// StreamingContent.tsx
interface StreamingContentProps {
  content: string;
  isStreaming: boolean;
  isBuffering: boolean;
  tokenCount: number;
  onCancel?: () => void;
}

export const StreamingContent: React.FC<StreamingContentProps> = ({
  content,
  isStreaming,
  isBuffering,
  tokenCount,
  onCancel
}) => {
  if (isBuffering) {
    return (
      <div className="streaming-buffer">
        <div className="spinner" />
        <span>Streaming... ({tokenCount} tokens)</span>
        {onCancel && (
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="streaming-content">
      <div className="streaming-header">
        {isStreaming && (
          <>
            <span className="streaming-indicator">⟳ Streaming ({tokenCount} tokens)</span>
            {onCancel && (
              <button onClick={onCancel} className="cancel-button">
                Cancel
              </button>
            )}
          </>
        )}
      </div>
      <MarkdownRenderer content={content} />
    </div>
  );
};
```

### Phase 3B: Cancel UI

#### LoadingIndicator with Cancel

```tsx
// LoadingIndicator.tsx
interface LoadingIndicatorProps {
  statusMessage?: string;
  defaultMessage?: string;
  onCancel?: () => void;  // NEW
  showCancel?: boolean;   // NEW
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  statusMessage,
  defaultMessage = 'Processing...',
  onCancel,
  showCancel = true
}) => (
  <div className="loading-indicator">
    <div className="loading-header">
      <div className="spinner" />
      <span>{statusMessage || defaultMessage}</span>
      {showCancel && onCancel && (
        <button onClick={onCancel} className="cancel-button" title="Cancel">
          ✕
        </button>
      )}
    </div>
    <LoadingWidget />
  </div>
);
```

---

## Message Contracts

```typescript
// src/shared/types/messages/streaming.ts (new file)
export interface StreamChunkPayload {
  requestId: string;
  token: string;
}

export interface StreamCompletePayload {
  requestId: string;
  content: string;
  usage?: TokenUsage;
}

export interface CancelRequestPayload {
  requestId: string;
  domain: 'analysis' | 'dictionary' | 'context';
}

// Add to MessageType enum
export enum MessageType {
  // ... existing
  STREAM_CHUNK = 'streamChunk',
  STREAM_COMPLETE = 'streamComplete',
  CANCEL_REQUEST = 'cancelRequest',
}
```

---

## Acceptance Criteria

### Phase 3A: Streaming
- [ ] Dialogue analysis streams progressively
- [ ] Prose analysis streams progressively
- [ ] Context assistant streams progressively
- [ ] Standard dictionary lookup streams progressively
- [ ] 5-second buffer before first render
- [ ] 100ms debounce after buffer
- [ ] Token count displayed during stream
- [ ] Markdown renders correctly (debounced)
- [ ] Fast Dictionary unchanged (fan-out pattern preserved)

### Phase 3B: Cancel UI
- [ ] Cancel button appears during all loading/streaming states
- [ ] Cancel actually stops server-side generation (verify token savings)
- [ ] UI shows "Cancelled" status after abort
- [ ] Can start new request immediately after cancel
- [ ] No console errors after cancellation

---

## Files to Create/Update

### Create
- `src/presentation/webview/hooks/useStreaming.ts`
- `src/presentation/webview/components/shared/StreamingContent.tsx`
- `src/shared/types/messages/streaming.ts`

### Update - Backend
- `src/infrastructure/api/providers/OpenRouterClient.ts` (add streaming method)
- `src/application/handlers/domain/AnalysisHandler.ts`
- `src/application/handlers/domain/DictionaryHandler.ts`
- `src/application/handlers/domain/ContextHandler.ts`

### Update - Frontend
- `src/presentation/webview/hooks/domain/useAnalysis.ts`
- `src/presentation/webview/hooks/domain/useDictionary.ts`
- `src/presentation/webview/hooks/domain/useContext.ts`
- `src/presentation/webview/components/shared/LoadingIndicator.tsx`
- `src/presentation/webview/components/tabs/AnalysisTab.tsx`
- `src/presentation/webview/components/tabs/UtilitiesTab.tsx`

### Update - Message Contracts
- `src/shared/types/messages/base.ts` (add new MessageTypes)
- `src/shared/types/messages/index.ts` (export streaming types)

---

## Testing Strategy

### Streaming Tests
1. Start dialogue analysis with medium text
2. Verify 5-second buffer (no content shows immediately)
3. After 5s, verify content appears and updates smoothly
4. Verify token count increases during stream
5. Verify final markdown renders correctly

### Cancel Tests
1. Start long request → click cancel during buffer phase
2. Start long request → click cancel during streaming phase
3. Verify token usage is lower after cancel (vs letting it complete)
4. Verify can start new request after cancel

### Edge Cases
- Very fast response (completes within buffer period)
- Very slow response (user waits longer than buffer)
- Network error during stream
- Cancel after completion (no-op)

---

## Risks and Considerations

### Risks
- ⚠️ SSE parsing edge cases (partial chunks, malformed data)
- ⚠️ Memory with long streams (buffer accumulation)
- ⚠️ Markdown glitches during partial render (mitigated by debounce)

### Mitigations
- ✅ Robust SSE parsing with buffer handling
- ✅ Reset buffer on completion
- ✅ 100ms debounce prevents glitchy renders
- ✅ ErrorBoundary around StreamingContent (from Sprint 01)

---

## References

**Architecture Debt**:
- [Request Cancellation UI Exposure](./../../../architecture-debt/2025-11-21-request-cancellation-ui-exposure.md)

**Related PRs**:
- PR #31: Fast Dictionary Generation (backend cancellation infrastructure)
- PR #37: LoadingIndicator extraction

**External Resources**:
- [OpenRouter Streaming](https://openrouter.ai/docs)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

---

**Created**: 2025-12-03
**Updated**: 2025-12-04 (Combined 3A Streaming + 3B Cancel UI)
