# ADR: Publishing Standards Comparison + Publishing Format in Metrics

- Status: Proposed
- Date: 2025-10-23

## Context

We want the Prose Metrics tool to compare measured statistics against publishing standards for a selected genre or the generic manuscript format, and add a new Publishing Format section showing page count estimates, selected trim size, and effective words-per-page (WPP). The current schema (resources/repository/publishing_standards_schema.json) covers genre ranges and formatting but does not model trim-size-specific WPP, and several numeric ranges are integers where fractional values are plausible. The existing prose stats compute lexical density as a 0–1 fraction, while the dataset expresses percent-like values.

Goals:
- Load publishing standards and allow the user to select a preset (genre or manuscript format).
- Compute comparisons (in-range/low/high) for key literary stats.
- Derive Publishing Format details: selected trim size, WPP, estimated page count, with range checks.
- Keep changes backward compatible and scoped to metrics.

Non-goals (for this ADR):
- Changing the overall extension architecture or prompt system.
- Validating JSON against the schema at runtime (we’ll trust the curated dataset).

## Decision

Introduce a standards repository and UI selection, extend the stats and renderer to support comparison output, and add a Publishing Format section. Make minimal, backward-compatible schema refinements to support trim-size-specific WPP and fractional ranges.

## Proposed Changes

### Schema (Backward-Compatible Refinements)
- Add optional `slug` (string) to `genres[]` for a stable selection key.
- In `genres[].page_sizes[]`, add optional `words_per_page` object `{ min, max, average }` to model trim-size-specific WPP; fall back to top-level `genres[].words_per_page` when absent.
- Allow fractional targets by using `number` for `min`/`max` in ranges where decimals are likely (e.g., `lexical_density`, `avg_words_per_sentence`, `avg_sentences_per_paragraph`).
- Clarify lexical density units in descriptions (percent 0–100). No breaking changes to structure.
- Keep existing non-standard `optional` flags as documentation; required keys remain authoritative.

No existing fields are removed; dataset remains valid.

### Service and Data Loading
- Add a `PublishingStandardsRepository` to load `resources/repository/publishing_standards.json` using `extensionUri`.
- Define domain types for `PublishingStandards`, `Genre`, `PageSize`, and range objects.
- Cache standards in `ProseAnalysisService` and expose helper getters.

Responsibilities:
- PublishingStandardsRepository (infrastructure)
  - Load/parse JSON, expose arrays of genres and manuscript format.
  - Provide lookups by `slug`/`abbreviation`/`name`.
  - Provide helpers to stringify/resolve page-size keys (e.g., `format` or `WIDTHxHEIGHT`).
- StandardsComparisonService (application)
  - Given metrics + selected preset, compute per-field comparison results (below/within/above).
  - Compute publishing format data (effective WPP, estimated page count, status versus `page_count_range`).
  - Produce a serializable comparison payload for the webview.
- MetricsAggregator (application)
  - When source mode is multi-file (manuscript/chapters), aggregate file-level stats into document-level metrics.
  - Derive chapter metrics (see below) and pass into comparison service.

### Settings and Selection
- Add settings:
  - `proseMinion.publishingStandards.preset`: `'none' | 'manuscript' | 'genre:<slug>'` (default `'none'`).
  - `proseMinion.publishingStandards.pageSizeKey`: optional, last-selected page size key (e.g., `format` or `WIDTHxHEIGHT`).
- Watch for configuration changes (existing config watcher) and thread the selection into metrics requests.

### Stats Extensions and Normalization
- Extend `PassageProseStats` to compute:
  - `uniqueWordCount` and `wordLengthDistribution` buckets (1–3, 4–6, 7+ letters).
  - Reading time in minutes/hours based on a default WPM (e.g., 240 WPM).
- Normalize `lexicalDensity` to percent 0–100 for alignment with standards.

Additional metrics to compute and expose:
- Stopword Ratio (%): (stopword tokens / total tokens) × 100.
  - Source a standard English stopword list (embedded asset) and keep small and static.
- Hapax Legomena %: (count of words with frequency = 1) / total tokens × 100.
- Type-Token Ratio (%): (unique words / total tokens) × 100.
- Readability Grade (Flesch–Kincaid Grade Level, FKGL): 0.39 × (words/sentences) + 11.8 × (syllables/words) – 15.59.
  - Implement a lightweight syllable estimator (heuristic) to avoid heavy deps.
- Optional: Dis Legomena % (frequency = 2) for future analysis; not required for comparison.

Units and formatting:
- Return `lexicalDensity` as percent (0–100) not fraction.
- For ratios/percentages, return numbers; the renderer adds `%` where appropriate.

Chapter metrics (multi-file modes only):
- `chapter_count`: number of files included in analysis.
- `avg_chapter_length`: average words per file (rounded).
- `chapter_length_distribution` (optional for future): min/median/percentiles of chapter word counts.

### Comparison + Publishing Format Calculation
- Comparison helper maps measured metrics to standard ranges:
  - `wordCount` ↔ `word_count_range`
  - `dialoguePercentage` ↔ `dialogue_percentage`
  - `lexicalDensity` ↔ `lexical_density`
  - `averageWordsPerSentence` ↔ `avg_words_per_sentence`
  - `averageSentencesPerParagraph` ↔ `avg_sentences_per_paragraph`
  - `uniqueWordCount` ↔ `unique_word_count`
  - `wordLengthDistribution` buckets ↔ `word_length_distribution`
- Status per metric: below / within / above range.
- Publishing Format calculation:
  - Determine effective WPP: prefer `page_sizes[selected].words_per_page.average`; else fall back to `genres[].words_per_page.average`.
  - `estimatedPageCount = ceil(wordCount / effectiveWPP)`.
  - Report selected trim size (width×height inches), effective WPP, estimated pages, genre `page_count_range`, and in-range status.

Comparison fields mapping (measured → standards):
- `wordCount` → `word_count_range`
- `dialoguePercentage` → `dialogue_percentage`
- `lexicalDensity` → `lexical_density` (as percent)
- `averageWordsPerSentence` → `avg_words_per_sentence`
- `averageSentencesPerParagraph` → `avg_sentences_per_paragraph`
- `uniqueWordCount` → `unique_word_count`
- `wordLengthDistribution.1_to_3_letters` → corresponding bucket
- `wordLengthDistribution.4_to_6_letters` → corresponding bucket
- `wordLengthDistribution.7_plus_letters` → corresponding bucket
- `chapter_count` (multi-file) → `chapter_count`
- `avg_chapter_length` (multi-file) → `avg_chapter_length`

### Webview/UI
- MetricsTab: add dropdown(s):
  - Standards Preset: None, Manuscript Format, and all Genres (label by `name`).
  - If a genre is selected and multiple `page_sizes` exist, show Trim Size dropdown (values by `format` if present; else `WIDTHxHEIGHT`).
- Metrics renderer: add sections:
  - Publishing Standards Comparison: table of Metric | Your Value | Standard | Status.
  - Publishing Format: table of Trim Size | Words/Page | Est. Pages | Page Range | Status.
- Preserve current Prose Statistics and Word Frequency sections.

Summary components (UI):
- Header with current preset + trim size chips.
- “Prose Statistics” table (existing) with normalized values (percentages as `%`).
- “Publishing Standards Comparison” table with status icons (✅ within, ⬇️ below, ⬆️ above).
- “Publishing Format” summary row with trim size, words/page, estimated pages, and in-range status.
- “Chapter Metrics” (visible in multi-file modes): chapter count, average chapter length; optionally min/max.
- Non-blocking hint when comparisons are partial due to missing fields in dataset.

### Message Contracts
- Extend metrics result payload to include `comparison` and `publishingFormat` blocks; old renderers remain compatible (new keys are additive).
- Carry preset selection with the metrics request (either via settings or explicit payload from the webview).

Proposed payload shapes (additive):
```
metrics: {
  // existing fields ...
  lexicalDensity: number, // 0–100
  uniqueWordCount: number,
  stopwordRatio?: number, // 0–100
  hapaxPercent?: number,  // 0–100
  typeTokenRatio?: number,// 0–100
  readabilityGrade?: number,
  chapterCount?: number,
  averageChapterLength?: number,
  comparison?: {
    items: Array<{
      key: string;              // e.g., 'lexical_density'
      label: string;            // UI label
      value: number | string;   // measured (formatted upstream)
      standard?: { min?: number; max?: number };
      status: 'below' | 'within' | 'above' | 'n/a';
    }>;
  };
  publishingFormat?: {
    trimSize: { width_inches: number; height_inches: number; label: string };
    wordsPerPage: number;
    estimatedPageCount: number;
    pageCountRange?: { min?: number; max?: number };
    status: 'below' | 'within' | 'above' | 'n/a';
  };
}
```

## Alternatives Considered
- Separate `publishing_formats[]` pairing trim size with layout and WPP: more explicit but heavier; we prefer enriching `page_sizes[]` with `words_per_page` for simplicity and compatibility.
- Keep lexical density as fraction 0–1: rejected; standards and UI read more naturally as percent.

## Consequences
- Clearer, actionable metrics aligned with industry ranges.
- Minimal schema change surface with strong backward compatibility.
- Slightly more complexity in UI to manage preset and trim size; mitigated by sensible defaults and settings persistence.

## Follow-ups
- Populate `slug` in the dataset for all genres.
- Optionally add `lines_per_page` and `avg_words_per_line` to `page_sizes[]` if later needed for layout-driven WPP derivation.
- Update README/CONFIGURATION to document new settings and the new UI controls.

## Acceptance Criteria
- User can pick a standards preset (None/Manuscript/Genre) and, for a genre, a trim size.
- Prose Statistics show normalized percentages (e.g., lexical density as %).
- Comparison table renders and clearly indicates below/within/above for mapped fields.
- Publishing Format section displays trim size, words/page, estimated page count, and in-range status.
- In multi-file modes, chapter count equals the number of files measured; average chapter length equals mean words per file.
- No regressions for existing metrics tools; legacy requests without presets still work.

## Implementation Notes
- Chapter aggregation: treat each matched file as a chapter for metrics; compute per-file word counts, then aggregate global metrics (sums) and chapter stats (count/average). For single-file modes, omit chapter metrics.
- Syllable estimation: use a small heuristic (vowel group counts with adjustments for silent-e, “le” endings, etc.) sufficient for FKGL stability.
- Stopword list: include a compact English list as a static resource in `resources/` or embed in code to avoid runtime IO.
- Performance: aggregate text once via `TextSourceResolver` for global metrics; additionally stream per-file word counts for chapter metrics without double-tokenizing when possible.
