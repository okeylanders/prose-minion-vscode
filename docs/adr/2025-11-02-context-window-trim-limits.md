# ADR: Context Window Trim Limits

**Date**: 2025-11-02
**Status**: Accepted
**Implemented**: Complete (PR #14)
**Implementation Date**: 2025-11-02
**Deciders**: Development Team
**Related Epics**: [Epic: Context Window Safety (2025-11-02)](.todo/epics/epic-context-window-safety-2025-11-02/)

---

## Context

Non-technical users may not understand context window limitations, potentially:
- Sending huge files that exceed token limits (128K+ tokens)
- Incurring unexpected API costs from oversized requests
- Receiving API errors or degraded responses due to limit violations
- Becoming frustrated when they don't understand why requests fail

Current state:
- No limits or warnings on input size
- Users can paste unlimited text into excerpts and context requests
- Backend sends full content to API without validation
- No feedback on input size or token consumption before API call

## Decision

Implement **settings-based context window trimming** with two layers:

### Layer 1: UI Word Counter (Presentation Layer)
- **500-word soft limit** for excerpt inputs (Analysis, Context, Dictionary tabs)
- Real-time word counter with visual feedback:
  - Green: 0-399 words
  - Yellow: 400-499 words
  - Red: 500+ words with warning indicator
- **Non-blocking**: Users can still send larger excerpts (informed choice)
- Educates users about appropriate input sizes

### Layer 2: Backend Silent Trimming (Application Layer)
- **Setting**: `proseMinion.applyContextWindowTrimming` (default: `true`)
- **Context Agent**: 50K word limit (≈66K tokens, leaving ~60K for output)
- **Analysis Agents**: 75K word limit with prioritization:
  1. **Excerpt** (never trim in backend - UI counter handles user awareness)
  2. **Incoming context** (trim only if guides exhausted)
  3. **Guides** (trim first - least critical)
- **Silent operation**: No popups or user-facing warnings
- **Transparency**: Logs trim operations to Output Channel
- **Escape hatch**: Power users can disable for models with larger context windows (200K+)

### Rationale for Limits

**Target: 128K token context window** (lowest common denominator across modern models)

| Agent Type | Word Limit | Token Estimate | Output Budget | Margin |
|------------|-----------|----------------|---------------|--------|
| Context | 50,000 words | ~66,000 tokens | ~60,000 tokens | Safe |
| Analysis | 75,000 words | ~100,000 tokens | ~28,000 tokens | Tight but adequate |

**Token estimation**: 1.33 tokens/word (conservative average for prose)

## Architectural Principles

This implementation adheres to Clean Architecture principles established in the [Presentation Layer Review](../architectural-reviews/2025-11-02-presentation-layer-review.md):

### 1. Single Responsibility Principle (SRP)
- **UI Layer**: Word counter component responsible only for user feedback
- **Application Layer**: AIResourceOrchestrator responsible for trimming logic
- **Each layer has one reason to change**

### 2. Open/Closed Principle (OCP)
- Trimming logic is **open for extension** (can add per-model limits)
- Trimming logic is **closed for modification** (setting toggle doesn't change core logic)
- New trim strategies can be added without modifying existing code

### 3. Dependency Inversion Principle (DIP)
- High-level orchestration depends on **abstractions** (word counting utilities)
- Implementation details (whitespace splitting) are **encapsulated**
- Easy to swap word counting strategy (e.g., for token counting in future)

### 4. Clear Layer Separation
```
┌─────────────────────────────────────┐
│  UI Components (WordCounter)        │ ← Presentation Layer
│  - Visual feedback only             │
│  - No business logic                │
└─────────────────────────────────────┘
              ↓ sends data
┌─────────────────────────────────────┐
│  App.tsx (Message Orchestrator)     │ ← Orchestration Layer
│  - Routes messages to handlers      │
└─────────────────────────────────────┘
              ↓ delegates to
┌─────────────────────────────────────┐
│  AIResourceOrchestrator             │ ← Application Layer
│  - Applies trimming logic           │
│  - Reads configuration              │
│  - Logs trim operations             │
└─────────────────────────────────────┘
              ↓ uses
┌─────────────────────────────────────┐
│  Word Counting Utilities            │ ← Domain/Infrastructure
│  - Pure functions                   │
│  - No side effects                  │
└─────────────────────────────────────┘
```

### 5. Type Safety
- All utilities have explicit TypeScript interfaces
- Return types document exactly what information is available
- No implicit `any` types

### 6. Domain Separation
- **Frontend Domain**: User awareness and education (word counter)
- **Backend Domain**: Resource management and cost control (trimming)
- Clear boundary: UI handles user choice, backend handles limits

## Implementation Details

### Word Counting Utilities

```typescript
/**
 * Count words in text using simple whitespace splitting
 * Matches typical word processor counts
 */
export function countWords(text: string): number;

/**
 * Trim text to maximum word count, preserving sentence boundaries
 * Returns detailed metadata about the trim operation
 */
export function trimToWordLimit(
  text: string,
  maxWords: number
): TrimResult;

export interface TrimResult {
  trimmed: string;
  originalWords: number;
  trimmedWords: number;
  wasTrimmed: boolean;
}
```

### Configuration Schema

```json
{
  "proseMinion.applyContextWindowTrimming": {
    "type": "boolean",
    "default": true,
    "markdownDescription": "Apply context window trimming to prevent token limit errors. **Limits**: UI recommends 500-word excerpts; Context Agent (50K words), Analysis Agents (75K words total: excerpt + context + guides). Targets 128K token context window. Disable if using models with larger context windows (e.g., 200K+).",
    "order": 35
  }
}
```

### UI Word Counter Component Pattern

Following the hook composition pattern from the architectural review:

```tsx
// Shared utility hook (can be infrastructure hook if needed)
function useWordCounter(text: string) {
  const wordCount = useMemo(() => countWords(text), [text]);

  const color = useMemo(() => {
    if (wordCount >= 500) return 'red';
    if (wordCount >= 400) return 'yellow';
    return 'green';
  }, [wordCount]);

  return { wordCount, color };
}

// Component usage
function ExcerptInput({ value, onChange }) {
  const { wordCount, color } = useWordCounter(value);

  return (
    <div className="excerpt-input-container">
      <textarea value={value} onChange={onChange} />
      <div className={`word-counter ${color}`}>
        {wordCount} / 500 words
        {wordCount > 500 && ' (⚠️ Large excerpt)'}
      </div>
    </div>
  );
}
```

## Consequences

### Positive
- ✅ **Prevents token limit errors** for typical users
- ✅ **Reduces unexpected API costs** from oversized requests
- ✅ **Educates users** about input size via real-time feedback
- ✅ **Invisible to most users** - defaults just work
- ✅ **Escape hatch for power users** - can disable for large context models
- ✅ **Transparent operation** - Output Channel logging shows what's happening
- ✅ **Follows Clean Architecture** - maintains principles from presentation refactor
- ✅ **Type-safe implementation** - explicit interfaces throughout
- ✅ **Testable design** - pure functions, clear dependencies

### Negative
- ⚠️ **Word count is approximate** - not exact token count (future enhancement)
- ⚠️ **May trim valuable context** - guides removed first in analysis (acceptable trade-off)
- ⚠️ **One more setting to understand** - mitigated by good defaults and clear description
- ⚠️ **Power users must manually disable** - rare use case, easy to do

### Neutral
- 📝 **Sentence boundary preservation** - best effort, not guaranteed
- 📝 **Conservative limits** - better safe than sorry approach

## Alternatives Considered

### 1. Token Counting Instead of Word Counting
**Rejected**: Requires tokenizer library (large dependency), slower performance, added complexity. Word counting is "good enough" for v1.0.

**Future Enhancement**: Can add token estimation in v1.1+ using lightweight approximations.

### 2. Hard Blocking at UI Level
**Rejected**: Frustrating for users who want to send large excerpts. Soft limit with visual feedback is more user-friendly.

### 3. Per-Model Context Limits
**Rejected for v1.0**: Requires maintaining model metadata, complex lookup logic. Simple 128K target is adequate for alpha.

**Future Enhancement**: Can add in v1.1+ when we have model capability database.

### 4. User Prompts/Warnings Before Trimming
**Rejected**: Interrupts workflow, annoying for repeat use. Silent trimming with Output Channel logging is better UX.

### 5. No Limits (Status Quo)
**Rejected**: Leaves users vulnerable to errors and unexpected costs. Not acceptable for v1.0 release.

## Testing Strategy

### Unit Tests
- Word counting utility accuracy
- Trim function preserves sentence boundaries
- TrimResult metadata is correct
- Edge cases: empty text, single word, no sentence boundaries

### Integration Tests
- Setting controls trimming behavior
- Context agent respects 50K limit
- Analysis agents respect 75K limit with prioritization
- Output Channel receives trim logs
- Word counter UI updates in real-time

### Manual Testing
- Create 60K word file, verify context agent trims
- Create 100K word test (excerpt + guides), verify guides trimmed first
- Verify excerpt never trimmed by backend
- Toggle setting, verify behavior changes
- Check Output Channel for trim logs
- Verify word counter colors (green/yellow/red)

## Migration Path

**No migration needed** - new feature, backward compatible.

- Existing users get trimming enabled by default (safe, non-breaking)
- No changes to message contracts
- No changes to API interfaces
- Works with existing codebase

## Success Metrics

- ✅ Zero "token limit exceeded" errors reported by users
- ✅ Feature is invisible to most users (default just works)
- ✅ Power users can easily disable if needed
- ✅ Output Channel provides transparency for those who want it
- ✅ No user complaints about unexpected API costs
- ✅ Word counter helps users understand input size before sending

## Future Enhancements (v1.1+)

1. **Token counting** - More accurate than word counting
2. **Per-model limits** - Based on known context windows
3. **Smart truncation** - Keep beginning + end, summarize middle
4. **Significant trim notifications** - Alert user when >30% trimmed
5. **Configurable limits** - Power user customization
6. **Input size estimator** - Visual progress bar showing current vs. limit

## References

- [Presentation Layer Architectural Review](../architectural-reviews/2025-11-02-presentation-layer-review.md)
- [Epic: Context Window Safety](../.todo/epics/epic-context-window-safety-2025-11-02/)
- OpenAI Token Limits: https://platform.openai.com/docs/models
- Anthropic Context Windows: https://docs.anthropic.com/claude/docs/models-overview

---

**Status**: Approved for implementation
**Target Release**: v1.0
**Implementation Branch**: `sprint/epic-context-window-safety-2025-11-02-01-trim-limits`
