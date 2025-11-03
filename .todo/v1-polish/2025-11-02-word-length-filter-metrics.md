# Word Length Filter for Word Frequency

**Date**: 2025-11-02
**Priority**: MEDIUM-HIGH (Nice-to-have for v1.0)
**Status**: ✅ Complete
**Estimated Time**: 2-3 hours
**Actual Time**: 7.5 hours (includes 8 enhancements beyond sprint scope)

## Problem

In Word Frequency results:
- Repetition of small common words (it, is, an, the, a) creates noise
- Longer, more distinctive words are harder to spot
- No way to filter for words of specific lengths
- Writers care more about multi-syllable word repetition (very, just, really, actually, suddenly)

## Solution

Add a word length filter dropdown to Word Frequency subtool.

### Proposed Filter Options

| Filter | Description | Use Case |
|--------|-------------|----------|
| **All** | No filter (current behavior) | Complete picture |
| **1** | Single-character words only | Catch "I", "a" overuse |
| **2+** | 2 or more characters | Remove single letters |
| **3+** | 3 or more characters | Remove "it", "is", "an", etc. |
| **4+** | 4 or more characters | Focus on substantial words |
| **5+** | 5 or more characters | Multi-syllable words |
| **6+** | 6+ characters | Distinctive vocabulary |

### Rationale

Longer words typically:
- Stand out more in prose (readers notice repetition)
- Indicate stylistic tics (suddenly, actually, really, just)
- Should be used more sparingly
- Are harder to notice from noise of short word repetition

Example: "just" appears 47 times in a chapter - very noticeable when filtered to 4+ char words, but lost in noise when viewing all words.

## Implementation

### 1. UI Component (Dropdown Filter)

Add dropdown in Word Frequency subtool header:

```tsx
// In MetricsTab.tsx, Word Frequency section
<div className="word-frequency-controls">
  <label htmlFor="word-length-filter">Show words:</label>
  <select
    id="word-length-filter"
    value={wordLengthFilter}
    onChange={(e) => setWordLengthFilter(e.target.value)}
  >
    <option value="all">All</option>
    <option value="1">1 character only</option>
    <option value="2+">2+ characters</option>
    <option value="3+">3+ characters</option>
    <option value="4+">4+ characters</option>
    <option value="5+">5+ characters</option>
    <option value="6+">6+ characters</option>
  </select>
</div>
```

### 2. Filter State Management

Add to `useMetrics` hook or MetricsTab state:

```typescript
const [wordLengthFilter, setWordLengthFilter] = React.useState<string>('all');

// Filter word lists before rendering
const filteredTopWords = React.useMemo(() => {
  if (wordLengthFilter === 'all') return topWords;

  const minLength = wordLengthFilter === '1'
    ? 1
    : parseInt(wordLengthFilter.replace('+', ''));

  return topWords.filter(([word]) => {
    if (wordLengthFilter === '1') {
      return word.length === 1;
    }
    return word.length >= minLength;
  });
}, [topWords, wordLengthFilter]);
```

### 3. Apply Filter to Sections

Filter should apply to:

✅ **Top Words Table**
- Filter `topWords` array by word length
- Recalculate percentages based on filtered results

✅ **Hapax List**
- Filter hapax words by length
- Update count/percentage in header

✅ **Bigrams/Trigrams**
- Filter component words by minimum length
- E.g., for "3+", exclude bigrams like "it was" but keep "very much"

❌ **Top Stopwords** (Don't filter)
- Stopwords are inherently short
- Filtering them doesn't make sense

❓ **POS Breakdown**
- Could filter per POS category
- Probably not necessary for v1.0

❌ **Length Histogram** (Don't filter)
- The histogram IS the length breakdown
- Filtering would be redundant

✅ **Top Lemmas** (if enabled)
- Apply same filter to lemmatized words

### 4. Backend Changes (Minimal)

Option A: **Filter in UI only** (Recommended for v1.0)
- Backend sends full word frequency data
- UI filters before rendering
- Simpler, works with existing data

Option B: **Filter in backend**
- Add `minWordLength` parameter to wordFrequency tool
- Backend filters before sending
- Smaller payload, more efficient
- Requires new message parameter

**Recommendation**: Start with Option A (UI-only filtering) for v1.0

### 5. Persistence

Save filter preference:
- In `usePersistence` state
- User's selection persists across sessions
- Default: "All"

## Affected Files

### Frontend
- `src/presentation/webview/components/MetricsTab.tsx`
  - Add filter dropdown UI
  - Add filter state
  - Apply filtering to word lists before rendering

- `src/presentation/webview/hooks/domain/useMetrics.ts`
  - Add `wordLengthFilter` to persisted state
  - Maybe add helper: `filterWordsByLength()`

- `src/presentation/webview/utils/metricsFormatter.ts`
  - If filtering affects formatting logic
  - Probably no changes needed (filter happens before formatting)

### Styling
- `src/presentation/webview/styles/index.css`
  - Style filter dropdown to match other controls
  - Ensure consistent with Metrics tab styling

### Backend (Optional for v1.1)
- `src/tools/measure/wordFrequency.ts`
  - Add optional `minWordLength` parameter
  - Filter during processing instead of in UI
  - More efficient for large texts

## Testing Checklist

- [ ] Dropdown renders correctly
- [ ] "All" shows complete results (current behavior)
- [ ] "1" shows only single-character words (I, a)
- [ ] "3+" excludes "it", "is", "an", includes "the", "and"
- [ ] "6+" shows only longer words
- [ ] Top Words recalculates percentages correctly
- [ ] Hapax list filters correctly
- [ ] Hapax count/percentage updates in header
- [ ] Bigrams/Trigrams respect filter
- [ ] Filter preference persists across reload
- [ ] Stopwords table NOT filtered
- [ ] Length histogram NOT filtered
- [ ] Works with content-words-only toggle
- [ ] Works with lemmas view (if enabled)

## Example Use Cases

### Use Case 1: Find Overused Modifiers
```
Filter: 4+ characters
Look for: very (34), just (28), really (19), actually (15), suddenly (12)
Action: Reduce or replace repetitive modifiers
```

### Use Case 2: Check Single-Letter Word Overuse
```
Filter: 1 character
Results: I (487), a (234), A (12)
Action: Ensure "I" isn't overused in 1st person narrative
```

### Use Case 3: Identify Stylistic Tics
```
Filter: 5+ characters
Look for: somehow (23), slightly (18), perhaps (16), almost (14)
Action: Address hedge words and qualifiers
```

## UI Mockup (Text)

```
┌─ Word Frequency ─────────────────────────────────┐
│                                                   │
│ Show words: [3+ characters ▼]                    │
│                                                   │
│ Top 100 Words (Content Words Only)               │
│ ┌──────┬───────┬──────────┐                      │
│ │ Rank │ Word  │ Count    │                      │
│ ├──────┼───────┼──────────┤                      │
│ │ 1    │ said  │ 47 (2.1%)│                      │
│ │ 2    │ like  │ 34 (1.5%)│                      │
│ │ 3    │ just  │ 28 (1.2%)│                      │
│ │ 4    │ time  │ 23 (1.0%)│                      │
│ └──────┴───────┴──────────┘                      │
│                                                   │
│ Hapax Legomena: 1,234 unique words (23.4%)       │
│ (Filtered to 3+ characters: 1,089 words)         │
└───────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Filter dropdown renders above Word Frequency results
- [ ] All filter options work correctly
- [ ] Top Words table filters and recalculates percentages
- [ ] Hapax list filters correctly
- [ ] Bigrams/Trigrams respect filter
- [ ] Filter state persists across sessions
- [ ] Default is "All" (current behavior)
- [ ] No impact on other Metrics subtools
- [ ] Clear labeling so users understand the filter

## Future Enhancements (v1.1+)

- [ ] Backend filtering for efficiency (large texts)
- [ ] Multiple length ranges: "3-5 characters", "6-8 characters", etc.
- [ ] Combine with POS filter: "Show 5+ character verbs"
- [ ] Highlight words in length histogram that match filter
- [ ] "Show me words I'm overusing" (auto-detect based on standard deviation)
- [ ] Export filtered results to CSV

## Success Metrics

- Users discover problematic word repetition faster
- Positive feedback on discoverability of longer word overuse
- Filter used frequently (track via telemetry in v1.1+)
- Reduces manual scanning of word lists
