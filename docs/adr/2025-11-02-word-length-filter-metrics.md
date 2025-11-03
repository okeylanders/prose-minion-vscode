# ADR: Word Length Filter for Word Frequency Metrics

**Date**: 2025-11-02
**Status**: Proposed
**Priority**: MEDIUM-HIGH (Nice-to-have for v1.0)

## Context

In Word Frequency results, small common words (it, is, an, the, a) create visual noise that makes it harder to spot longer, more distinctive words that writers care about. When analyzing prose, writers often want to focus on:

- Multi-syllable word repetition (very, just, really, actually, suddenly)
- Distinctive vocabulary (6+ character words)
- Stylistic tics that are harder to notice in the full word list
- Single-character word overuse in specific contexts

**Example**: "just" appears 47 times in a chapter - very noticeable when filtered to 4+ char words, but lost in noise when viewing all words alongside hundreds of instances of "it", "is", "a", etc.

Currently, there is no way to filter word frequency results by word length, forcing users to manually scan through long lists dominated by short, common words.

## Decision

Add a **word length filter setting** that filters Word Frequency results by minimum character count. The filter will be:

1. **Setting-based**: Stored in `proseMinion.wordFrequency.minCharacterLength` (default: `1`)
2. **Backend-filtered**: Applied in `wordFrequency.ts` before sending results to frontend
3. **UI-controlled**: Tab bar component in Metrics webview for easy switching

### Filter Options (Character Count)

| Filter | Value | Description | Use Case |
|--------|-------|-------------|----------|
| **1+** | `1` | All words (default) | Complete picture |
| **2+** | `2` | 2+ characters | Remove single letters |
| **3+** | `3` | 3+ characters | Remove "it", "is", "an", etc. |
| **4+** | `4` | 4+ characters | Focus on substantial words |
| **5+** | `5` | 5+ characters | Multi-syllable words |
| **6+** | `6` | 6+ characters | Distinctive vocabulary |

### Filter Application Scope

**✅ Apply filter to:**
- **Top Words** - Filter by word length
- **POS (Part of Speech)** - Filter within each POS category
- **Bigrams/Trigrams** - Filter by minimum component word length
- **Hapax List** - Filter words, update count
- **Lemmas** (if enabled) - Apply same filter

**❌ Do NOT filter:**
- **Stop Words** - Stopwords are inherently short; filtering doesn't make sense
- **Length Histogram** - The histogram IS the length breakdown; filtering would be redundant

### Implementation Approach: Backend Filtering

Unlike typical UI-only filters, this will be **backend-filtered** for consistency and to reduce payload size:

1. **Setting stored in VSCode configuration**: `proseMinion.wordFrequency.minCharacterLength`
2. **Backend reads setting** when running word frequency analysis
3. **Backend filters** results before sending to frontend
4. **Frontend displays** pre-filtered data (no client-side filtering needed)
5. **UI tab bar** provides easy way to change setting and re-run analysis

**Rationale for Backend Filtering**:
- ✅ Smaller payloads (no need to send filtered-out words)
- ✅ Single source of truth (setting controls everything)
- ✅ Consistent with other metric settings (e.g., `contentWordsOnly`, `lemmasEnabled`)
- ✅ Easier to maintain (filter logic in one place)
- ✅ Better for large texts (less data transfer)

## Rationale

### Why Word Length Matters

Longer words typically:
- Stand out more in prose (readers notice repetition)
- Indicate stylistic tics (suddenly, actually, really, just)
- Should be used more sparingly
- Are harder to notice when buried in short word noise

### Why Backend Filtering

1. **Consistency**: Matches existing word frequency settings pattern (`contentWordsOnly`, `lemmasEnabled`)
2. **Efficiency**: Smaller payloads, especially for large texts
3. **Simplicity**: No need for complex UI-side filtering logic
4. **Single Source of Truth**: Setting controls both backend and UI state

### Tab Bar UI Pattern

The tab bar component below the scope box provides:
- **Immediate visibility** of current filter
- **One-click switching** between filters
- **Visual feedback** via active tab highlight
- **No settings overlay needed** for common use case

## Architecture

### Two-Sprint Implementation

#### Sprint 1: Backend Settings Infrastructure
1. Add `proseMinion.wordFrequency.minCharacterLength` to package.json
2. Add setting to Settings overlay UI (Metrics settings block)
3. Wire ConfigurationHandler to handle setting changes
4. Refresh word frequency on setting change

#### Sprint 2a: Frontend Tab Bar UI
1. Create `WordLengthFilterTabs` component
2. Render tab bar below scope box in Metrics tab
3. Read current setting from settings state
4. Update setting on tab click (triggers re-run)
5. Highlight active tab

#### Sprint 2b: Backend Filtering Logic
1. Read `minCharacterLength` setting in `wordFrequency.ts`
2. Apply filter to Top Words, POS, Bigrams, Trigrams, Hapax, Lemmas
3. Skip filtering for Stop Words and Length Histogram
4. Send filtered results to frontend

## Implementation Details

### 1. Setting Schema (package.json)

```json
{
  "proseMinion.wordFrequency.minCharacterLength": {
    "type": "number",
    "default": 1,
    "enum": [1, 2, 3, 4, 5, 6],
    "markdownDescription": "Minimum character length for words in Word Frequency results. Filter helps identify longer, more distinctive word patterns by excluding short common words. **1+** = all words, **3+** = excludes 'it', 'is', 'an', **5+** = multi-syllable words, **6+** = distinctive vocabulary. Applied to Top Words, POS, Bigrams/Trigrams, Hapax List, and Lemmas. Does NOT filter Stop Words or Length Histogram.",
    "order": 72
  }
}
```

### 2. Settings Overlay UI

Add to Settings overlay in Metrics section:

```tsx
<div className="setting-row">
  <label htmlFor="min-char-length">Minimum Word Length</label>
  <select
    id="min-char-length"
    value={settingsData.wordFrequency?.minCharacterLength || 1}
    onChange={(e) => handleSettingChange('wordFrequency.minCharacterLength', parseInt(e.target.value))}
  >
    <option value="1">1+ characters (all words)</option>
    <option value="2">2+ characters</option>
    <option value="3">3+ characters</option>
    <option value="4">4+ characters</option>
    <option value="5">5+ characters</option>
    <option value="6">6+ characters</option>
  </select>
  <p className="setting-help">
    Filter word frequency by minimum character count. Higher values focus on longer,
    more distinctive words (3+ removes "it", "is"; 5+ shows multi-syllable words).
  </p>
</div>
```

### 3. Tab Bar Component (Frontend)

Create segregated component `src/presentation/webview/components/WordLengthFilterTabs.tsx`:

```tsx
interface WordLengthFilterTabsProps {
  activeFilter: number; // 1, 2, 3, 4, 5, 6
  onFilterChange: (length: number) => void;
}

export const WordLengthFilterTabs: React.FC<WordLengthFilterTabsProps> = ({
  activeFilter,
  onFilterChange
}) => {
  const filters = [
    { value: 1, label: '1+' },
    { value: 2, label: '2+' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
    { value: 5, label: '5+' },
    { value: 6, label: '6+' }
  ];

  return (
    <div className="word-length-filter-tabs">
      <span className="filter-label">Include Words of Character Count:</span>
      <div className="filter-tabs">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-tab ${activeFilter === value ? 'active' : ''}`}
            onClick={() => onFilterChange(value)}
            aria-pressed={activeFilter === value}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

### 4. Backend Filtering (wordFrequency.ts)

#### Critical: Filter BEFORE Ranking/Limiting

The character length filter must be applied **before** sorting and limiting to top N, otherwise filtering after taking top 100 words could result in zero results when all top words are short.

```typescript
export async function wordFrequency(
  text: string,
  sourceMetadata?: { uri?: string; relativePath?: string }
): Promise<WordFrequencyResult> {
  const config = vscode.workspace.getConfiguration('proseMinion');
  const minCharLength = config.get<number>('wordFrequency.minCharacterLength', 1);

  // Step 1: Count all word frequencies
  const wordCounts = new Map<string, number>();
  // ... counting logic ...

  // Step 2: FILTER FIRST (before sorting/limiting)
  const filteredWords = Array.from(wordCounts.entries())
    .filter(([word]) => word.length >= minCharLength);

  // Step 3: THEN sort and limit
  const sortedFiltered = filteredWords
    .sort((a, b) => b[1] - a[1]);

  const topWords = sortedFiltered
    .slice(0, topN)
    .map(([word, count]) => ({
      word,
      count,
      percentage: (count / totalWords) * 100
    }));

  // Apply same pattern to POS categories
  const filteredPOS: Record<string, Array<{ word: string; count: number }>> = {};
  for (const [category, wordList] of Object.entries(posCounts)) {
    const filtered = Array.from(wordList.entries())
      .filter(([word]) => word.length >= minCharLength)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word, count]) => ({ word, count, percentage: (count / totalWords) * 100 }));

    filteredPOS[category] = filtered;
  }

  // Apply to bigrams/trigrams (filter by ALL component words)
  const filteredBigrams = bigramCounts
    .filter(({ bigram }) => {
      const [word1, word2] = bigram.split(' ');
      return word1.length >= minCharLength && word2.length >= minCharLength;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  const filteredTrigrams = trigramCounts
    .filter(({ trigram }) => {
      const [word1, word2, word3] = trigram.split(' ');
      return word1.length >= minCharLength &&
             word2.length >= minCharLength &&
             word3.length >= minCharLength;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  // Hapax: filter word pool, then identify hapax from filtered set
  const filteredHapax = Array.from(wordCounts.entries())
    .filter(([word, count]) => word.length >= minCharLength && count === 1)
    .map(([word]) => word);

  return {
    // Filtered sections (filter-before-rank applied)
    topWords: topWords,
    hapaxList: filteredHapax,
    hapaxCount: filteredHapax.length,
    hapaxPercent: totalWords > 0 ? (filteredHapax.length / totalWords) * 100 : 0,
    pos: filteredPOS,
    bigrams: filteredBigrams,
    trigrams: filteredTrigrams,
    topLemmaWords: lemmasEnabled ? filteredLemmaWords : undefined,

    // Unfiltered sections (intentionally preserved)
    topStopwords: topStopwords, // Always show all stopwords
    charLengthHistogram: charLengthHistogram, // Always show full histogram
    charLengthCounts: charLengthCounts,
    charLengthPercentages: charLengthPercentages,

    // ... other fields unchanged
  };
}
```

**Why Filter-Before-Rank?**

❌ **Wrong** (filter after limiting):
```
1. Count frequencies
2. Sort all words → ["the", "and", "it", "is", "a", ...]
3. Take top 100
4. Filter by length (5+) → [] // Empty! All top 100 are short
```

✅ **Correct** (filter before limiting):
```
1. Count frequencies
2. Filter by length (5+) → Remove "the", "it", "is"
3. Sort filtered words → ["really", "suddenly", "something", ...]
4. Take top 100 from filtered list → Meaningful results
```

### 5. Styling (index.css)

```css
.word-length-filter-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
  padding: 10px 12px;
  background: var(--vscode-editor-background);
  border-radius: 4px;
  border: 1px solid var(--vscode-widget-border);
}

.filter-label {
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  font-weight: 500;
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.filter-tab {
  padding: 4px 12px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-button-border);
  border-radius: 3px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.filter-tab.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  font-weight: 600;
  border-color: var(--vscode-focusBorder);
}

.filter-tab:focus {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}
```

## Affected Files

### Backend
- `package.json` - Add setting schema
- `src/tools/measure/wordFrequency.ts` - Add filtering logic
- `src/application/handlers/domain/ConfigurationHandler.ts` - Handle setting updates

### Frontend
- `src/presentation/webview/components/WordLengthFilterTabs.tsx` - NEW: Tab bar component
- `src/presentation/webview/components/MetricsTab.tsx` - Render tab bar, handle filter changes
- `src/presentation/webview/hooks/domain/useSettings.ts` - Expose minCharacterLength setting
- `src/presentation/webview/components/SettingsOverlay.tsx` - Add dropdown in Metrics section
- `src/presentation/webview/styles/index.css` - Style tab bar component

### Message Flow
1. User clicks tab → Frontend updates setting via `UPDATE_SETTING` message
2. ConfigurationHandler updates VSCode config
3. User re-runs Word Frequency (or auto-refresh on setting change)
4. Backend reads new setting, filters results, sends to frontend
5. Frontend displays pre-filtered results

## Use Cases

### Use Case 1: Find Overused Modifiers
```
Filter: 4+ characters (click "4+" tab)
Results: very (34), just (28), really (19), actually (15), suddenly (12)
Action: Reduce or replace repetitive modifiers
```

### Use Case 2: Check Single-Letter Word Overuse
```
Filter: 1 character (click "1" tab)
Results: I (487), a (234), A (12)
Action: Ensure "I" isn't overused in 1st person narrative
```

### Use Case 3: Identify Stylistic Tics
```
Filter: 5+ characters (click "5+" tab)
Results: somehow (23), slightly (18), perhaps (16), almost (14)
Action: Address hedge words and qualifiers
```

## Testing Checklist

### Backend
- [ ] Setting reads correctly from config
- [ ] Default is `1` (all words)
- [ ] Filter applies to Top Words, POS, Bigrams, Trigrams, Hapax, Lemmas
- [ ] Filter does NOT apply to Stop Words or Length Histogram
- [ ] Hapax count updates after filtering
- [ ] Bigrams/Trigrams filter by component word length

### Frontend
- [ ] Tab bar renders below scope box
- [ ] Active tab is highlighted
- [ ] Clicking tab updates setting
- [ ] Setting change triggers re-run of word frequency
- [ ] Setting persists across sessions
- [ ] Settings overlay dropdown shows correct value
- [ ] Tab bar styling works in light and dark themes

### Integration
- [ ] Changing tab re-runs analysis with new filter
- [ ] Results update immediately after setting change
- [ ] No console errors when switching filters
- [ ] Filter works with `contentWordsOnly` toggle
- [ ] Filter works with lemmas enabled/disabled

## Acceptance Criteria

- [ ] Setting appears in package.json with clear description
- [ ] Setting appears in Settings overlay (Metrics section)
- [ ] Tab bar renders in Metrics tab below scope box
- [ ] Active tab is visually distinct (highlight)
- [ ] Clicking tab updates setting and re-runs analysis
- [ ] Backend filters results before sending to frontend
- [ ] Filter applies to: Top Words, POS, Bigrams, Trigrams, Hapax, Lemmas
- [ ] Filter does NOT apply to: Stop Words, Length Histogram
- [ ] Default is `1+` (all words)
- [ ] Setting persists across sessions
- [ ] Tab bar is keyboard accessible
- [ ] Styling works in both themes

## Future Enhancements (v1.1+)

- [ ] Auto-refresh on setting change (don't require manual re-run)
- [ ] "Custom" option for user-defined character length
- [ ] Multiple length ranges: "3-5 characters", "6-8 characters", etc.
- [ ] Combine with POS filter: "Show 5+ character verbs"
- [ ] Export metadata includes active filter
- [ ] Tooltip on hover showing what each filter excludes

## Success Metrics

- Users discover problematic word repetition faster
- "4+" and "5+" filters are most commonly used
- Positive feedback on discoverability of stylistic tics
- Reduces time spent manually scanning word lists
- Tab bar UI is intuitive and discoverable

## Related

- Epic: [.todo/epics/epic-word-length-filter-metrics-2025-11-02/](../../.todo/epics/epic-word-length-filter-metrics-2025-11-02/)
- Original Spec: [.todo/v1-polish/2025-11-02-word-length-filter-metrics.md](../../.todo/v1-polish/2025-11-02-word-length-filter-metrics.md)
