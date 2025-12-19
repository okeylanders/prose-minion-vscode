# Feature: N-gram Mode for Category Search

**Date**: 2025-12-12
**Status**: Proposed
**Priority**: Medium

## Overview

Enhance Category Search with an **n-gram mode selector** that switches between analyzing words, bigrams, or trigrams. The AI model is instructed to return matches at any granularity level—if given trigrams, it can return the full trigram, a bigram subset, or individual words.

## Problem Statement

Currently, Category Search sends only individual unique words to the AI model:

```
Category: emotions related to fear
Words: dark, shadow, trembling, cold, heart, racing, sweat, ...
```

The model lacks phrasal context—it doesn't know that "racing heart" and "cold sweat" appear together in the text. This limits its ability to identify semantically related terms that co-occur in meaningful patterns.

## Proposed Solution

Replace word extraction with a **mode selector** (Words | Bigrams | Trigrams):

```
Mode: Trigrams
Category: emotions related to fear
Phrases: racing heart beats, cold sweat forming, trembling hands shook, ...
```

The AI can return matches at **any granularity**:

- Full phrase: "racing heart beats" (trigram)
- Partial phrase: "racing heart" (bigram from trigram)
- Single word: "trembling" (word from phrase)

### Key Design Decisions

1. **Mutually Exclusive Modes**: One mode at a time (not additive)
2. **Hierarchical Matching**: Higher n-grams contain lower ones—trigrams provide richest context
3. **Smart Decomposition**: Model extracts words/bigrams from n-grams as needed
4. **Full Distinct Lists**: Include all unique n-grams meeting frequency threshold

---

## Data Flow

### Current Flow (Words Mode)

```
Text → extractUniqueWords() → words[] → batch(400) → AI → matched words
```

### Proposed Flow (Mode-Based)

```
Mode: Words    → extractUniqueWords()    → words[]    → batch(400) → AI → matches
Mode: Bigrams  → extractUniqueBigrams()  → bigrams[]  → batch(200) → AI → matches
Mode: Trigrams → extractUniqueTrigrams() → trigrams[] → batch(150) → AI → matches
```

### Batching by Mode

Each mode has its own batch size (phrases are longer, fewer per batch):

| Mode | Batch Size | Rationale |
|------|-----------|-----------|
| Words | 400 | Current default, ~600 tokens |
| Bigrams | 200 | ~600 tokens (2 words each) |
| Trigrams | 150 | ~600 tokens (3 words each) |

```typescript
// Pseudo-code for mode-based extraction
const extractByMode = (text: string, mode: NGramMode): string[] => {
  switch (mode) {
    case 'words': return extractUniqueWords(text);
    case 'bigrams': return extractUniqueNGrams(text, 2, minOccurrences);
    case 'trigrams': return extractUniqueNGrams(text, 3, minOccurrences);
  }
};

// Same batching loop, mode-aware batch size
const batchSize = mode === 'words' ? 400 : mode === 'bigrams' ? 200 : 150;
for (const batch of chunk(phrases, batchSize)) {
  await getAIMatches(query, batch, mode);
}
```

---

## Scale Analysis (90K Word Manuscript)

| Metric | Count | Batches (100/batch) |
|--------|-------|---------------------|
| Unique words | ~15,000 | 38 batches |
| Unique bigrams | ~40,000-60,000 | 400-600 batches |
| Unique trigrams | ~70,000-85,000 | 700-850 batches |

**Implication**: With full distinct lists, n-gram processing adds significant batches. Consider:
- Frequency threshold (only include bigrams/trigrams appearing 2+ times)
- Separate batch stream (n-grams processed independently)
- Progressive disclosure (process words first, n-grams on demand)

### Recommended Approach: Frequency Threshold

Filter to n-grams appearing 2+ times:

| Metric | Raw Count | After 2+ Filter | Reduction |
|--------|-----------|-----------------|-----------|
| Bigrams | ~50,000 | ~5,000-8,000 | ~85% |
| Trigrams | ~75,000 | ~2,000-4,000 | ~95% |

This dramatically reduces batch count while preserving meaningful patterns.

---

## UI Integration

### Current UI Layout

```
┌─ Category Search ─────────────────────────────────────┐
│  Category Query                                        │
│  [fear verbs                                    ]      │
│                                                        │
│  Relevance:                                           │
│  [ Broad ] [ Focused ] [ Specific ] [ Synonym ]       │
│                                                        │
│  Limit to:                                            │
│  [ 20 ] [ 50 ] [ 75 ] [100] [ 250 ] [ 350 ] [ 500 ]  │
│                                                        │
│  Context words    Cluster window    Min cluster size  │
│  [ 3         ]    [ 75         ]    [ 2          ]    │
│                                                        │
│              [⚡ Run Category Search]                  │
└────────────────────────────────────────────────────────┘
```

### Proposed Addition

Add **Search Mode** button group directly above the Run button, with conditional **Min occurrences** appearing when Bigrams/Trigrams selected:

```
┌─ Category Search ─────────────────────────────────────┐
│  Category Query                                        │
│  [fear verbs                                    ]      │
│                                                        │
│  Relevance:                                           │
│  [ Broad ] [ Focused ] [ Specific ] [ Synonym ]       │
│                                                        │
│  Limit to:                                            │
│  [ 20 ] [ 50 ] [ 75 ] [100] [ 250 ] [ 350 ] [ 500 ]  │
│                                                        │
│  Context words    Cluster window    Min cluster size  │
│  [ 3         ]    [ 75         ]    [ 2          ]    │
│                                                        │
│  Search mode:                                         │
│  [ Words ] [ Bigrams ] [ Trigrams ]                   │
│                                                        │
│              [⚡ Run Category Search]                  │
└────────────────────────────────────────────────────────┘
```

**When Bigrams or Trigrams selected**, show Min occurrences:

```
│  Search mode:                                         │
│  [ Words ] [Bigrams] [ Trigrams ]                     │
│                                                        │
│  Min occurrences:                                     │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5+ ]                      │
│                                                        │
│              [⚡ Run Category Search]                  │
```

### Interaction Behavior

| Mode Selected | Min Occurrences Visible | Default |
|---------------|------------------------|---------|
| Words | Hidden | N/A |
| Bigrams | Shown | 2 |
| Trigrams | Shown | 2 |

### Implementation Notes

- Reuse existing button group component style (matches Relevance/Limit buttons)
- `5+` means "5 or more" (value: 5, effectively filtering rare phrases)
- Conditional render: `{ngramMode !== 'words' && <MinOccurrencesSelector />}`
- Default to "Words" mode (backward compatible, no behavior change)

---

## System Prompt Updates

### Current Prompt Structure

```
resources/system-prompts/category-search/
├── 00-role.md          # AI's role as word categorizer
├── 01-instructions.md  # Input format, task, examples
└── 02-constraints.md   # Relevance modes, word limits
```

### New Section in 01-instructions.md

```markdown
## Input Modes

You will receive input in one of three modes:

### Words Mode (default)
Input: Individual words
Output: Return matching words as-is

### Bigrams Mode
Input: Two-word phrases (e.g., "racing heart", "cold sweat")
Output: You may return:
- The full bigram if both words relate to the category
- Individual words from the bigram if only one word relates

Example:
- Input phrase: "racing heart"
- Category: "speed/urgency"
- Valid outputs: "racing heart" OR "racing"

### Trigrams Mode
Input: Three-word phrases (e.g., "heart pounding faster", "cold dark night")
Output: You may return:
- The full trigram if all words relate
- A bigram subset (adjacent words only): "heart pounding" or "pounding faster"
- Individual words if only one relates

Example:
- Input phrase: "cold dark night"
- Category: "temperature"
- Valid outputs: "cold dark night" OR "cold dark" OR "cold"

**Important**: Only return adjacent subsets. From "cold dark night":
- ✅ "cold dark" (adjacent)
- ✅ "dark night" (adjacent)
- ❌ "cold night" (not adjacent)
```

---

## Implementation Checklist

### Phase 1: Message & Type Layer

- [ ] Add `NGramMode` type and extend `CategorySearchOptions` in [search.ts](src/shared/types/messages/search.ts):

  ```typescript
  export type NGramMode = 'words' | 'bigrams' | 'trigrams';

  export interface CategorySearchOptions {
    // ... existing fields
    ngramMode?: NGramMode;  // default: 'words'
  }
  ```

- [ ] Add setting type for frequency threshold (applies to bigrams/trigrams only)

### Phase 2: Backend Service

- [ ] Add n-gram extraction method to [CategorySearchService.ts](src/infrastructure/api/services/search/CategorySearchService.ts):

  ```typescript
  private extractUniqueNGrams(
    text: string,
    n: number,
    minOccurrences: number
  ): string[]
  ```

- [ ] Modify `searchByCategory()` to branch on mode
- [ ] Adjust batch sizes based on mode (400/200/150)
- [ ] Update `getAIMatches()` to pass mode to prompt

### Phase 3: Frontend State

- [ ] Add `ngramMode` to category search state in [useSearch.ts](src/presentation/webview/hooks/domain/useSearch.ts)
- [ ] Add persistence for mode selection
- [ ] Wire settings sync for threshold via ConfigurationHandler

### Phase 4: UI Controls

- [ ] Add mode selector (radio group) to [CategorySearchPanel.tsx](src/presentation/webview/components/search/CategorySearchPanel.tsx)
- [ ] Add threshold setting to Settings Overlay (advanced)
- [ ] Update request payload to include mode

### Phase 5: Configuration

- [ ] Add to [package.json](package.json) `contributes.configuration`:

  ```json
  "proseMinion.categorySearch.ngramMode": {
    "type": "string",
    "enum": ["words", "bigrams", "trigrams"],
    "default": "words",
    "description": "Search mode: individual words, 2-word phrases, or 3-word phrases"
  },
  "proseMinion.categorySearch.minPhraseOccurrences": {
    "type": "number",
    "default": 2,
    "minimum": 1,
    "maximum": 10,
    "description": "Minimum times a phrase must appear (bigram/trigram modes only)"
  }
  ```

- [ ] Add keys to MessageHandler config watcher
- [ ] Extend ConfigurationHandler.getAllSettings()

### Phase 6: Prompt Engineering

- [ ] Update [01-instructions.md](resources/system-prompts/category-search/01-instructions.md) with mode instructions
- [ ] Add examples for hierarchical matching
- [ ] Test prompt effectiveness with sample manuscripts

---

## Technical Considerations

### Token Budget

Current limit: 7500 tokens per batch

| Component | Tokens (est.) |
|-----------|---------------|
| System prompt | ~500 |
| Words (400) | ~600 |
| Bigrams (100) | ~300 |
| Trigrams (100) | ~400 |
| **Total** | ~1800 |

Headroom is sufficient. If needed, reduce n-gram batch size.

### N-gram Extraction Algorithm

Reuse pattern from [wordFrequency/index.ts:295-307](src/tools/measure/wordFrequency/index.ts#L295-L307):

```typescript
private extractUniqueNGrams(
  text: string,
  n: number,
  minOccurrences: number
): string[] {
  const tokens = text.toLowerCase().split(/\s+/);
  const counts = new Map<string, number>();

  for (let i = 0; i <= tokens.length - n; i++) {
    const phrase = tokens.slice(i, i + n).join(' ');
    counts.set(phrase, (counts.get(phrase) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([_, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);
}
```

### Result Processing

When the AI returns mixed results (phrases and words), the occurrence counter needs to handle both:

```typescript
// For phrase matches: search for exact phrase
"racing heart" → find occurrences of "racing heart" in text

// For word matches from phrase mode: search for word
"cold" (extracted from "cold dark night") → find occurrences of "cold"
```

The existing WordSearchService handles both patterns—no special handling needed.

---

## Testing Plan

### Manual Testing

1. **Small text (~1K words)**: Verify n-grams extracted and included in prompt
2. **Medium text (~10K words)**: Verify batching works correctly
3. **Large text (~90K words)**: Verify performance acceptable, frequency threshold effective
4. **Edge cases**: Text with no repeated phrases, single-word text

### Validation Criteria

- [ ] N-grams appear in AI prompt (check via Output Channel logging)
- [ ] Settings persist across sessions
- [ ] Toggle states reflect in UI
- [ ] Frequency threshold filters appropriately
- [ ] Results improve with n-gram context (subjective evaluation)

---

## Related Files

| File | Purpose |
|------|---------|
| [CategorySearchService.ts](src/infrastructure/api/services/search/CategorySearchService.ts) | Main service to modify |
| [CategorySearchPanel.tsx](src/presentation/webview/components/search/CategorySearchPanel.tsx) | UI for toggles |
| [search.ts](src/shared/types/messages/search.ts) | Message types |
| [wordFrequency/index.ts](src/tools/measure/wordFrequency/index.ts) | Reference implementation for n-gram extraction |
| [ConfigurationHandler.ts](src/application/handlers/domain/ConfigurationHandler.ts) | Settings sync |

---

## Open Questions

1. **Frequency threshold default**: Is 2 the right default, or should it be higher for large texts?
2. **Result parsing**: How to handle mixed returns (words + phrases) in occurrence counting?
3. **Display format**: Should matched phrases be displayed differently than matched words?

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Message types | 20 min |
| Backend service | 2 hours |
| Frontend state | 45 min |
| UI controls | 30 min |
| Configuration | 20 min |
| Prompt engineering | 1 hour |
| Testing | 1.5 hours |
| **Total** | **~6-7 hours** |

*Reduced from original estimate due to simplified mode-based approach (no combinatorial complexity).*

---

*Feature proposed for Prose Minion v1.x*
