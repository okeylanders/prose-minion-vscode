# Hyphenated & Compound Words Analysis (Future Enhancement)

**Category**: Metrics Enhancement
**Priority**: v1.1+
**Status**: Backlog
**Date**: 2025-11-02
**Related Feature**: Word Frequency Analysis

## Overview

Add dedicated statistics and analysis for hyphenated compound words to help writers identify patterns in their use of complex, multi-part vocabulary. This would provide insights into writing style, technical vocabulary density, and stylistic consistency.

## Current Behavior

As of v1.0, hyphenated words are:
- **Preserved as single units** (e.g., `"black-and-white"`, `"mother-in-law"`)
- **Included in all standard sections** (Top Words, POS, Hapax, etc.)
- **Counted in character length** (e.g., `"black-and-white"` = 15 characters)

This works well for general analysis, but writers may want specific insights into their compound word usage patterns.

## Proposed Enhancement

### New Section: "🔗 Hyphenated Compounds"

Add a dedicated section in Word Frequency results showing statistics and patterns for hyphenated words.

**Location in Output**: After Length Distribution, before Top Words (or as a separate expandable section)

**Metrics to Include**:

1. **Count & Percentage**
   - Total hyphenated words (tokens)
   - Unique hyphenated words (types)
   - Percentage of total vocabulary

2. **Top Hyphenated Compounds** (table)
   - Most frequently used hyphenated words
   - Count and percentage per compound
   - Similar to Top Words table

3. **Pattern Analysis**
   - Two-part compounds: `"self-aware"`, `"up-to-date"`
   - Three-part compounds: `"mother-in-law"`, `"jack-of-all-trades"`
   - Four+ part compounds: `"happy-go-lucky"`, `"state-of-the-art"`
   - Distribution: X% two-part, Y% three-part, etc.

4. **Compound Type Categories** (optional)
   - Adjective compounds: `"well-known"`, `"self-aware"`
   - Noun compounds: `"mother-in-law"`, `"merry-go-round"`
   - Verb compounds: `"deep-dive"`, `"fact-check"`
   - Adverb compounds: `"matter-of-factly"`

### Example Output

```markdown
## 🔗 Hyphenated Compounds

| Metric | Value |
|:-------|------:|
| 📝 Total Hyphenated Words | **347** |
| 🎯 Unique Compounds | **89** |
| 📊 % of Total Words | **2.3%** |

### Top Compounds

| Rank | Compound | Count | % of Total |
|:----:|:---------|------:|-----------:|
| 1 | `black-and-white` | 12 | 0.08% |
| 2 | `old-fashioned` | 8 | 0.05% |
| 3 | `well-known` | 7 | 0.04% |
| 4 | `up-to-date` | 6 | 0.04% |
| 5 | `mother-in-law` | 5 | 0.03% |

### Pattern Distribution

- Two-part: 67 compounds (75.3%)
- Three-part: 19 compounds (21.3%)
- Four+ part: 3 compounds (3.4%)
```

## Implementation Notes

### Backend Changes (wordFrequency/index.ts)

```typescript
// Add compound word detection
private analyzeCompounds(words: string[]): {
  totalCompounds: number;
  uniqueCompounds: number;
  topCompounds: WordFrequencyEntry[];
  patternDistribution: Record<string, number>;
} {
  const compoundCounts = new Map<string, number>();
  const patternCounts = { 'two-part': 0, 'three-part': 0, 'four-plus': 0 };

  for (const word of words) {
    if (word.includes('-')) {
      compoundCounts.set(word, (compoundCounts.get(word) || 0) + 1);

      const parts = word.split('-').length;
      if (parts === 2) patternCounts['two-part']++;
      else if (parts === 3) patternCounts['three-part']++;
      else patternCounts['four-plus']++;
    }
  }

  const totalCompounds = Array.from(compoundCounts.values()).reduce((a, b) => a + b, 0);
  const uniqueCompounds = compoundCounts.size;

  const sorted = Array.from(compoundCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topCompounds = this.formatTop(sorted, words.length, 25);

  return { totalCompounds, uniqueCompounds, topCompounds, patternDistribution: patternCounts };
}
```

### Frontend Changes (resultFormatter.ts)

Add rendering logic after Word Length Distribution section:

```typescript
// Hyphenated Compounds
if (metrics.compounds) {
  markdown += '## 🔗 Hyphenated Compounds\n\n';
  markdown += '| Metric | Value |\n';
  markdown += '|:-------|------:|\n';
  markdown += `| 📝 Total Hyphenated Words | **${metrics.compounds.totalCompounds.toLocaleString()}** |\n`;
  markdown += `| 🎯 Unique Compounds | **${metrics.compounds.uniqueCompounds.toLocaleString()}** |\n`;
  // ... render top compounds table and pattern distribution
}
```

### Configuration

Add optional setting to enable/disable compound analysis:

```json
"proseMinion.wordFrequency.analyzeCompounds": {
  "type": "boolean",
  "default": false,
  "description": "Include dedicated analysis of hyphenated compound words"
}
```

## User Value

**Writers benefit by:**

1. **Style Consistency**: Identify inconsistent hyphenation (e.g., `"email"` vs `"e-mail"`)
2. **Vocabulary Complexity**: Track use of complex compound vocabulary
3. **Genre Appropriateness**: Adjust compound word density for different audiences
4. **Editing Focus**: Find overused compound phrases to vary

**Example Use Cases:**

- **Technical Writers**: Monitor technical compound terminology (`"state-of-the-art"`, `"real-time"`)
- **Fiction Writers**: Track descriptive compounds (`"storm-tossed"`, `"sun-bleached"`)
- **Academic Writers**: Analyze scholarly compound usage (`"meta-analysis"`, `"cross-sectional"`)

## Alternative Approaches

### Option 1: Separate Subtool (More Complex)
Create a dedicated "Compound Words" subtool under Metrics tab alongside Prose Stats, Style Flags, Word Frequency.

**Pros:**
- Dedicated UI space
- More detailed analysis possible
- Cleaner separation of concerns

**Cons:**
- More UI complexity
- Additional button/tab clutter
- Requires separate analysis run

### Option 2: Inline Section (Recommended)
Add as an expandable/collapsible section within Word Frequency results.

**Pros:**
- No UI changes needed
- Results available in same analysis
- Simpler implementation

**Cons:**
- Limited space for detailed analysis
- May clutter Word Frequency output

### Option 3: Optional Report Export
Generate compound word analysis only when exporting Word Frequency results to file.

**Pros:**
- No UI overhead
- Full report detail possible

**Cons:**
- Not visible in webview
- Requires export action

## Dependencies

- ✅ Hyphen preservation in word extraction (implemented v1.0)
- ✅ Character length filtering (implemented v1.0)
- ⏳ Compound word detection logic (new)
- ⏳ Result formatter updates (new)
- ⏳ Optional: POS tagging integration for compound type categorization

## Related

- **Feature**: Word Frequency Analysis ([wordFrequency/index.ts](../src/tools/measure/wordFrequency/index.ts))
- **Epic**: Word Length Filter ([epic-word-length-filter-metrics](../epics/epic-word-length-filter-metrics-2025-11-02/))
- **ADR**: Word Length Filter ([2025-11-02-word-length-filter-metrics.md](../../docs/adr/2025-11-02-word-length-filter-metrics.md))

## Notes

- Hyphen preservation was implemented in v1.0 as part of the word length filter feature
- This enhancement builds on that foundation to provide specialized compound word insights
- Consider starting with Option 2 (inline section) for v1.1, then expanding to Option 1 if user demand is high
- May want to add setting to filter compound words by component count (e.g., only show 3+ part compounds)
