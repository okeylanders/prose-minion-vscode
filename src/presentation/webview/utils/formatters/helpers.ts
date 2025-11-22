/**
 * Shared helper functions for result formatters
 */

/**
 * Builds unified metrics legend with both simple definitions and detailed explanations
 * Used at the bottom of both Prose Stats and Word Frequency outputs
 */
export function buildMetricsLegend(): string {
  return `---

## 📖 Metrics Guide

### Legend

- **Word Count**: Total tokens split by whitespace.
- **Sentence Count**: Heuristic split on . ! ?
- **Paragraph Count**: Blocks split by blank lines.
- **Avg Words per Sentence**: Average words per sentence.
- **Avg Sentences per Paragraph**: Average sentences per paragraph.
- **Dialogue Percentage**: % of tokens inside quotes.
- **Stopword Ratio**: % tokens in a common English stopword list.
- **Hapax %**: % tokens occurring exactly once; Hapax Count is absolute count.
- **Type-Token Ratio**: Unique/total tokens × 100.
- **Readability Score**: Simplified Flesch Reading Ease (0–100, higher is easier).
- **Readability Grade (FKGL)**: Flesch–Kincaid Grade Level (approximate grade).

### 🌈 Vocabulary Diversity

**Formula:** (Unique Words / Total Words) × 100

**What it measures:** Word repetition rate. Higher diversity means more varied vocabulary with fewer repeated words.

**Typical ranges:**
- **Short passages** (< 1,000 words): 30-60% — High diversity expected with minimal repetition
- **Medium passages** (1,000-10,000 words): 15-30% — Natural repetition emerges across scenes/chapters
- **Long works** (10,000+ words): 5-15% — Function words and key terms naturally repeat across the narrative

**Interpretation:**
- **Higher diversity:** More varied vocabulary, potentially more descriptive or technical
- **Lower diversity:** More repetition, potentially more focused or conversational
- **Natural variation:** Dialogue tends to have lower diversity than narrative prose

### 🎨 Lexical Density

**Formula:** (Content Words / Total Words) × 100

**What it measures:** Information richness. Content words (nouns, verbs, adjectives, adverbs) carry meaning, while function words (articles, prepositions, conjunctions) provide grammatical structure.

**Typical ranges:**
- **Conversation/Dialogue**: 40-50% — Natural speech uses more function words
- **Fiction Narrative**: 50-60% — Balanced blend of description and flow
- **Academic/Technical**: 60-80% — Dense with information-carrying words

**Interpretation:**
- **Higher density:** More information-packed, potentially more formal or descriptive
- **Lower density:** More conversational flow, easier to read, more dialogue-heavy
- **Natural variation:** Action scenes often have lower density, while descriptive passages have higher density

`;
}

/**
 * Formats a gap value (average distance between word occurrences)
 * @param value The gap value to format
 * @returns Formatted string like "5.2 words" or "—" if invalid
 */
export function formatGap(value: any): string {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(1);
  return `${s} word${s === '1.0' ? '' : 's'}`;
}

/**
 * Escapes pipe characters in text for markdown tables
 * @param text Text to escape
 * @returns Text with pipes escaped
 */
export function escapePipes(text: string): string {
  return (text || '').replace(/\|/g, '\\|');
}
