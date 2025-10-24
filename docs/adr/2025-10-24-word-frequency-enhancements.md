# ADR: Word Frequency Enhancements (Top 100, Hapax List, POS, Stopwords)

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
- Keep changes backward compatible with existing message contracts and UI rendering.
- Provide a clear path to better POS accuracy without forcing heavy dependencies.

Non-goals:
- Introducing runtime network calls or model usage for POS tagging.
- Changing tokenization for all tools in this ADR (we may refactor to shared helpers opportunistically).

## Decision

Enhance the Word Frequency tool and its renderer to:

1) Include the hapax list at the bottom of the markdown (with sensible caps).
2) Expand Top Words from 20 → 100 (configurable).
3) Replace brittle POS suffix-heuristics with a two-phase approach:
   - Phase 1 (default): improved heuristics + proper-noun signal; hide POS sections if quality is low.
   - Phase 2 (opt-in): integrate a lightweight offline POS tagger (e.g., `wink-pos-tagger`) behind a setting.
4) Add explicit stopword details: top stopwords table + total stopword count alongside the existing ratio.
5) Add a few pragmatic extras that are low-cost and high-value: bigrams (top 20), lemmatized Top Words view (opt‑in), and a proper noun highlighter.

The output remains additive and backward compatible; existing fields are preserved, and new fields are optional.

## Proposed Changes

### Domain Types (Additive)
- `src/tools/measure/wordFrequency/index.ts`
  - Extend `WordFrequencyOutput` with optional fields:
    - `topWords`: expand default to 100 entries (configurable).
    - `topStopwords?: WordFrequencyEntry[]` (default top 25).
    - `hapaxList?: string[]` (alphabetical, capped; default max 300).
    - `hapaxCount?: number` (absolute), `hapaxPercent?: number` (0–100) for convenience when running this tool standalone.
    - `pos?: {
         mode: 'heuristic' | 'tagger' | 'none';
         topNouns?: WordFrequencyEntry[];
         topVerbs?: WordFrequencyEntry[];
         topAdjectives?: WordFrequencyEntry[];
         topAdverbs?: WordFrequencyEntry[];
       }` (wrap existing fields and add `mode`).
    - `bigrams?: Array<{ phrase: string; count: number }>` (default top 20).
    - `lemmasEnabled?: boolean` and `topLemmaWords?: WordFrequencyEntry[]` (when enabled).

Notes:
- Keep existing `topVerbs`, `topAdjectives`, `topNouns` at the root for backward compatibility; populate them from `pos.*` during Phase 1 and deprecate in a future release.

### Application + Infrastructure
- Keep the analysis purely local and deterministic.
- Optionally add a tiny POS tagger dependency (`wink-pos-tagger`) behind a setting; when disabled, use improved heuristics:
  - Heuristics: suffix patterns + capitalization signal (proper nouns), exclude sentence-initial capitalization when possible.
  - When in heuristic mode, surface a quality disclaimer and allow hiding POS sections in the UI.

### Presentation (Webview Renderer)
- `src/presentation/webview/utils/metricsFormatter.ts`
  - Top Words: render up to 100 rows; if over 50, use compact table styles (already markdown-friendly) and rely on scrolling.
  - Top Stopwords: new section with count and percent columns.
  - Hapax List: new bottom section; show count/percent summary and an alphabetized list. Cap display to `hapaxDisplayMax` (default 300). If truncated, add: “(+ N more)”.
  - POS Sections: if `pos.mode === 'none'` or `heuristic`, add a light note: “Heuristic POS (may be noisy)”. Hide if disabled by setting.
  - Bigrams: new section showing top 20 phrases.
  - Lemmas: show a toggle note when `lemmasEnabled`.

### Settings (Contributes → Configuration)
- `proseMinion.wordFrequency.topN`: number (default 100).
- `proseMinion.wordFrequency.includeHapaxList`: boolean (default true).
- `proseMinion.wordFrequency.hapaxDisplayMax`: number (default 300).
- `proseMinion.wordFrequency.includeStopwordsTable`: boolean (default true).
- `proseMinion.wordFrequency.posMode`: `'none' | 'heuristic' | 'tagger'` (default `'heuristic'`).
- `proseMinion.wordFrequency.includeBigrams`: boolean (default false).
- `proseMinion.wordFrequency.enableLemmas`: boolean (default false).

All new settings are optional; omit when not in use to keep payloads small.

### Message Contracts
- No breaking changes. The `word_frequency` metrics payload adds optional keys listed above. Existing consumers remain compatible.

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
  - Phase 1: improve heuristics; add `pos.mode = 'heuristic'` and surface disclaimer in renderer.
  - Phase 2: if setting is `'tagger'`, use `wink-pos-tagger` locally to produce `topNouns`, `topVerbs`, `topAdjectives`, `topAdverbs`. Fall back gracefully.

- Stopwords:
  - Provide `topStopwords` (word, count, percent) and `totalStopwordCount` (optional).
  - Keep the Stopword Ratio computation in Prose Stats authoritative; this tool just mirrors counts for the frequency report.

- Bigrams:
  - Tokenize; create adjacent pairs; count and sort; output top 20.
  - No PMI/scoring in Phase 1 to keep it lightweight.

- Lemmas (opt‑in):
  - Implement a simple stemmer/lemmatizer (porter-lite) or rely on a tiny stemming heuristic to group inflections for the “lemma view”.
  - Disabled by default to avoid surprises in wording.

## UI/Export Behavior

- The “📈 Word Frequency Analysis” section expands:
  - Overview: Total/Unique/Hapax Count (+%), Stopword Count (+%).
  - 🏆 Top Words (up to 100).
  - 🧹 Top Stopwords.
  - 🎬/🎨/📦 POS sections (visible per `posMode` + disclaimer for heuristics).
  - 🔗 Top Bigrams (if enabled).
  - 🌱 Hapax List (alphabetical; capped; placed at bottom).

- Export: No modal changes. The hapax list appears at the end of the frequency section. Saving still targets `prose-minion/reports/` with timestamped filenames.

## Backward Compatibility

- Existing fields (`topWords`, `topVerbs`, `topAdjectives`, `topNouns`) remain and keep their shapes. Only the Top Words length increases by default (configurable).
- New fields are optional and safely ignored by older renderers. The current renderer will be extended alongside this ADR.

## Performance and Size Considerations

- Frequency maps and bigram counts run in O(n) over tokens and are fast for typical chapter/manuscript lengths.
- Limit and cap lists (Top N, Hapax) to keep payloads and markdown manageable. Defaults: Top 100 words; Hapax display cap 300; Bigrams 20.
- POS tagger (if enabled) runs locally and should be profiled; default mode remains heuristic.

## Testing

- Unit tests for:
  - Tokenization consistency with Prose Stats.
  - Hapax count/percent and list stability on a fixture.
  - Top 100 logic and stopword exclusion.
  - Heuristic POS categorization determinism; graceful fallback when tagger disabled.
  - Bigram counting correctness.

- Manual verification:
  - Rendered markdown sections, especially large Top Words tables and hapax list truncation note.

## Risks

- Heuristic POS remains noisy; mitigated by disclosures and the opt‑in tagger.
- Large texts can produce long hapax lists; mitigated via display cap and summary counts.

## Open Questions

- Should we provide a UI toggle to switch between “content words only” vs “all words” for Top Words? Default proposal: content words only.
- Should we allow exporting the full hapax list to a separate file when truncated? Potential follow-up.
- Should we add trigrams in a later iteration if bigrams prove useful? Likely yes.

## Acceptance Criteria

- Top Words default to 100 entries (configurable) in the Word Frequency report.
- A Hapax section appears at the bottom, with count, percent, and an alphabetized list (capped) with truncation note when applicable.
- Stopword table appears with top stopwords (word, count, percent) when enabled.
- POS sections either:
  - Show with a heuristic disclaimer, or
  - Use an offline tagger when enabled, or
  - Hide entirely if `posMode = 'none'`.
- Renderer updates are additive and do not regress existing metrics displays or exports.

