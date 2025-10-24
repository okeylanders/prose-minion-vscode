# ADR: Word Frequency Enhancements (Top 100, Hapax List, POS via Wink, Stopwords, Length Histogram)

- Status: Proposed
- Date: 2025-10-24

## Context

The current Word Frequency tool (`src/tools/measure/wordFrequency/`) produces a small set of “top words” and naïve parts-of-speech lists using suffix-based heuristics. This is helpful, but it falls short for deeper analysis and export workflows:

- Authors often want a richer “Top N” list (e.g., Top 100) to inspect diction patterns.
- The hapax legomena list (words occurring exactly once) is requested to explore uniqueness and vocabulary dispersion.
- POS breakdowns (nouns/verbs/adjectives) are currently heuristic and frequently inaccurate without a proper tagger or lexicon.
- Stopwords are already surfaced as a ratio in Prose Stats, but the Word Frequency report should present stopword counts and top stopwords explicitly.

Goals:
- Expand and improve word frequency reporting while preserving performance and offline operation.
- Adopt an offline POS tagger for materially better noun/verb/adj/adv detection.
- Redesign output and renderer as needed (backward compatibility not required for this tool’s payload/renderer coupling).

Non-goals:
- Introducing runtime network calls or model usage for POS tagging.
- Changing tokenization for all tools in this ADR (we may refactor to shared helpers opportunistically).

## Decision

Enhance the Word Frequency tool and its renderer to:

1) Include the hapax list at the bottom of the markdown (with sensible caps).
2) Expand Top Words from 20 → 100 (configurable).
3) Use `wink-pos-tagger` for POS tagging by default; evaluate performance in practice. If the tagger fails to initialize, do not use heuristics—mark POS sections as unavailable with a clear note.
4) Add explicit stopword details: top stopwords table + total stopword count alongside the existing ratio.
5) Add a few pragmatic extras that are low-cost and high-value: bigrams (top 20), trigrams (top 20), lemmatized Top Words view (opt‑in), and a proper noun highlighter.

Backward compatibility: not required for this tool’s consumers; we will evolve the output shape to best fit the renderer.

## Proposed Changes

### Domain Types (New/Updated)
- `src/tools/measure/wordFrequency/index.ts`
  - Extend `WordFrequencyOutput` with optional fields:
    - `topWords`: expand default to 100 entries (configurable).
    - `topStopwords?: WordFrequencyEntry[]` (default top 25).
    - `hapaxList?: string[]` (alphabetical, capped; default max 300).
    - `hapaxCount?: number` (absolute), `hapaxPercent?: number` (0–100) for convenience when running this tool standalone.
    - `pos: {
         mode: 'tagger' | 'unavailable';
         topNouns?: WordFrequencyEntry[];
         topVerbs?: WordFrequencyEntry[];
         topAdjectives?: WordFrequencyEntry[];
         topAdverbs?: WordFrequencyEntry[];
       }` (no heuristic mode).
    - `bigrams?: Array<{ phrase: string; count: number }>` (default top 20), `trigrams?: Array<{ phrase: string; count: number }>` (default top 20).
    - `lemmasEnabled?: boolean` and `topLemmaWords?: WordFrequencyEntry[]` (when enabled).
    - Character-length stats:
      - `charLengthCounts: Record<number, number>` // counts for exact token length, at least 1..N
      - `charLengthPercentages?: Record<number, number>` // 0–100 per length (rounded 1 decimal)
      - `charLengthHistogram?: string[]` // pre-rendered textual bars for renderer convenience

Notes:
- Root-level `topVerbs`, `topAdjectives`, `topNouns` can be moved under `pos` (renderer updated in lockstep).

### Application + Infrastructure
- Keep the analysis purely local and deterministic.
- Add dependency: `wink-pos-tagger` (offline). Use it by default; if initialization fails, set `pos.mode = 'unavailable'` and do not attempt heuristic tagging.

- `src/presentation/webview/utils/metricsFormatter.ts`
  - Top Words: render up to 100 rows; if over 50, use compact table styles (already markdown-friendly) and rely on scrolling.
  - Top Stopwords: new section with count and percent columns.
  - Hapax List: new bottom section; show count/percent summary and an alphabetized list. Cap display to `hapaxDisplayMax` (default 300). If truncated, add: “(+ N more)”.
  - POS Sections: if `pos.mode === 'unavailable'`, render a short note under each POS header: “POS tagging unavailable (tagger not initialized).” Skip tables.
  - Bigrams/Trigrams: new sections showing top 20 phrases.
  - Lemmas: show a toggle note when `lemmasEnabled`.
  - Word Length Distribution (1–10 chars): add a slider-style histogram using block characters with proportional bars (e.g., `█`), plus percentages:
    - Example:
      - `1 chars: ██ 5.1%`
      - `2 chars: █████ 11.8%`
      - `3 chars: █████████ 19.5%`
      - ... up to `10 chars` (or the highest bin observed). Scale bar length to a fixed max (e.g., 10 blocks) based on the max percentage across displayed lengths.
  - Also render a compact table version for copy-friendly exports.

### Settings (Contributes → Configuration)
- `proseMinion.wordFrequency.topN`: number (default 100).
- `proseMinion.wordFrequency.includeHapaxList`: boolean (default true).
- `proseMinion.wordFrequency.hapaxDisplayMax`: number (default 300).
- `proseMinion.wordFrequency.includeStopwordsTable`: boolean (default true).
- `proseMinion.wordFrequency.contentWordsOnly`: boolean (default true) — UI toggle for “content words only” vs “all words” in Top Words.
- `proseMinion.wordFrequency.posEnabled`: boolean (default true) — enable/disable POS sections globally (no heuristics).
- `proseMinion.wordFrequency.includeBigrams`: boolean (default true).
- `proseMinion.wordFrequency.includeTrigrams`: boolean (default true).
- `proseMinion.wordFrequency.enableLemmas`: boolean (default false).
- `proseMinion.wordFrequency.lengthHistogramMaxChars`: number (default 10) — upper bound for per-length bars.

All new settings are optional; omit when not in use to keep payloads small.

### Message Contracts
- The `word_frequency` metrics payload will change to include the new structures described above. Since this is the only renderer, we will update it in lockstep.

## Implementation Notes

- Tokenization/Normalization:
  - Reuse the same lowercasing and non-letter stripping as today for consistency.
  - Consider factoring common tokenization helpers from `passageProseStats` into a small shared utility to avoid drift (non-breaking refactor). Not required by this ADR.

- Hapax:
  - Build a frequency map; collect words where count == 1.
  - Provide `hapaxCount` and `hapaxPercent` in `WordFrequencyOutput` for standalone clarity.
  - Alphabetize the `hapaxList` and cap display.

- Top 100 Words:
  - Keep excluding a compact stopword set for “content words” Top Words.
  - Make the limit configurable; default 100.

- POS:
  - Default: `wink-pos-tagger` to produce `topNouns`, `topVerbs`, `topAdjectives`, `topAdverbs`.
  - If the tagger cannot initialize, set `pos.mode = 'unavailable'` and skip POS lists.

- Stopwords:
  - Provide `topStopwords` (word, count, percent) and `totalStopwordCount` (optional).
  - Keep the Stopword Ratio computation in Prose Stats authoritative; this tool just mirrors counts for the frequency report.

- Bigrams/Trigrams:
  - Tokenize; create adjacent pairs and triplets; count and sort; output top 20 each.
  - No PMI/scoring in this phase to keep it lightweight.

- Lemmas (opt‑in):
  - Implement a simple stemmer/lemmatizer (porter-lite) or rely on a tiny stemming heuristic to group inflections for the “lemma view”.
  - Disabled by default to avoid surprises in wording.

## UI/Export Behavior

- The “📈 Word Frequency Analysis” section expands:
  - Overview: Total/Unique/Hapax Count (+%), Stopword Count (+%).
  - 🏆 Top Words (up to 100).
  - 🧹 Top Stopwords.
  - 🎬/🎨/📦 POS sections (visible per `posMode` + disclaimer for heuristics).
  - 🔗 Top Bigrams/Trigrams (if enabled).
  - ▉ Word Length Distribution (1–10 chars) with slider-style bars and percentages.
  - 🌱 Hapax List (alphabetical; capped; placed at bottom).

- Export: Support “Extended Copy/Save” like the Prose Statistics section (include/exclude long sections such as full Hapax list and n‑grams). Files save to `prose-minion/reports/` with timestamped filenames.

## Backward Compatibility
- Not required; we control both producer and renderer. We will migrate renderer and payload together.

## Performance and Size Considerations

- Frequency maps and n-gram counts run in O(n) over tokens and are fast for typical chapter/manuscript lengths.
- Limit and cap lists (Top N, Hapax) to keep payloads and markdown manageable. Defaults: Top 100 words; Hapax display cap 300; Bigrams/Trigrams 20 each.
- POS tagger runs locally (wink-pos-tagger) and should be profiled; if unavailable, POS is marked as unavailable.

## Testing

- Unit tests for:
  - Tokenization consistency with Prose Stats.
  - Hapax count/percent and list stability on a fixture.
  - Top 100 logic and stopword exclusion.
  - POS tagging correctness on a small gold set; proper "unavailable" mode behavior when tagger cannot init.
  - Bigram/Trigram counting correctness.
  - Character-length counts and histogram scaling.

- Manual verification:
  - Rendered markdown sections, especially large Top Words tables, histogram bars, and hapax list truncation note.

## Risks

- Heuristic POS remains noisy under fallback; mitigated by disclosures.
- Large texts can produce long hapax lists; mitigated via display cap and summary counts.

## Decisions on Prior Open Questions

- UI toggle for “content words only” vs “all words”: Yes (default to content words only).
- Extended exports/copying for long sections: Yes — mirror Prose Statistics’ extended export flow.
- Trigrams: Yes — include alongside bigrams (both top 20 by default).

## Acceptance Criteria

- Top Words default to 100 entries (configurable) in the Word Frequency report.
- A Hapax section appears at the bottom, with count, percent, and an alphabetized list (capped) with truncation note when applicable.
- Stopword table appears with top stopwords (word, count, percent) when enabled.
- POS sections use wink-pos-tagger by default; if unavailable, show heuristic POS with a disclaimer.
- Word Length Distribution (1–10) renders slider-style bars with percentages and matches counts.
- Bigrams and Trigrams sections render top 20 each when enabled.
- Extended Copy/Save supports including/excluding long sections (hapax, n‑grams).
