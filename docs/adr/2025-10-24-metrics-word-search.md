# ADR: Metrics Word Search (Keyword Context, Clusters, Assistant Expansion)

- Status: Proposed
- Date: 2025-10-24

## Context

Writers want a fast way to inspect how particular words or short phrases are used across the same scopes supported by Metrics (Active File, Manuscripts, Chapters, Selection). Specifically, the feature should:
- Accept a search textbox with one or more target words/phrases (initial default example: `just`).
- Provide contextual snippets around each hit (± N words; default 7).
- Detect and summarize clusters of repeated usage within a sliding window (default 150 tokens; min cluster size 3).
- Stay deterministic and offline like the existing metrics (no model calls).

We already have a working reference implementation and output shape in example code:
- example-code/index.js
- example-code/analyze.js
- example-code/formatters.js

This ADR proposes integrating a production-quality Word Search tool into the extension’s Metrics tab, aligning with Clean Architecture, and updating the Metrics action buttons to match the top TabBar style. It also outlines a forward path to add an optional assistant button that rapidly expands the target list with synonyms and inflectional variants.

## Decision

Add a new Metrics tool: Word Search.
- New UI sub-action in the Metrics tab with a search textbox and a results renderer.
- Reuse the same scope resolution as other Metrics tools.
- Implement deterministic tokenization, occurrence capture with context, and cluster detection (ported from example-code). 
- Style the Metrics button group as a sub TabBar (same look-and-feel as the top tabs) so users can switch between Prose Statistics, Style Flags, Word Frequency, and the new Word Search.
- Prepare an “assistant” affordance next to the target textbox to quickly fetch synonyms and simple morphological variants and append them to the target list. The button label is “Expand word list” with a robot/lightning icon (🤖⚡). Until wired to the dictionary model, clicking it shows a non-blocking inline message: “Auto expand search coming soon”. No confirmation is needed when this is later wired—users can remove unwanted additions inline.

## Proposed Changes

### Domain (types/contracts)
- src/shared/types/messages.ts: Add message contracts for Word Search.
  - MessageType: `MEASURE_WORD_SEARCH` (webview → extension).
  - Payload: `{ text?: string; source?: TextSourceSpec; options?: { wordsOrPhrases: string[]; contextWords: number; clusterWindow: number; minClusterSize: number; caseSensitive?: boolean } }` (defaults below).
  - Result is delivered via existing `METRICS_RESULT` with `toolName: 'word_search'` and a structured JSON payload.

- New result shape (renderer evolved in lockstep):
  - `WordSearchReport`:
    - `scannedFiles: Array<{ absolute: string; relative: string }>`
    - `options: { caseSensitive: boolean; contextWords: number; clusterWindow: number; minClusterSize: number }`
    - `targets: Array<{`
        `target: string;`            // original label
        `normalized: string;`        // normalized tokens joined by space
        `totalOccurrences: number;`
        `overallAverageGap: number | null;` // in tokens
        `filesWithMatches: number;`
        `perFile: Array<{`
          `file: string;`            // absolute
          `relative: string;`        // workspace-relative or basename
          `count: number;`
          `averageGap: number | null;`
          `occurrences: Array<{ index: number; line: number; snippet: string }>;`
          `clusters: Array<{ count: number; spanWords: number; startLine: number; endLine: number; snippet: string }>;`
        `}>;`
      `}>`

### Application
- src/application/handlers/MessageHandler.ts:
  - Add handler `handleMeasureWordSearch(message)` mirroring Prose Stats/Style Flags/Word Frequency handling, using the same source resolution helpers (Active File/Manuscripts/Chapters/Selection).
  - Post back `METRICS_RESULT` with `toolName: 'word_search'` and the report payload.

- src/domain/services/IProseAnalysisService.ts:
  - Add `measureWordSearch(text: string): Promise<MetricsResult>`.

- src/infrastructure/api/ProseAnalysisService.ts:
  - Implement `measureWordSearch(text)` using a deterministic local analyzer (no model calls). Port the tokenization, occurrence capture, and cluster algorithm from example-code/analyze.js.
  - Ensure shared tokenization is consistent with existing metrics where practical.

### Presentation (webview)
- src/presentation/webview/components/MetricsTab.tsx:
  - Convert the Metrics action button group to a tab-like strip styled with `.tab-bar` and `.tab-button` to match top-level tabs. One action is “active” at a time.
  - Add a new Word Search sub-tab that reveals:
    - A search textbox for `wordsOrPhrases` (comma-/newline-separated or space-delimited with quotes to preserve phrases).
    - Compact controls: `contextWords` (default 7), `clusterWindow` (default 150), `minClusterSize` (default 3), `caseSensitive` toggle.
    - Optional “⚡ Expand” icon button to invoke the assistant expansion (see Optional Assistant Expansion) and append suggestions to the target list, with user confirmation.
  - Send `MEASURE_WORD_SEARCH` with the current source mode/path and options.

- src/presentation/webview/utils/metricsFormatter.ts:
  - Add a new renderer section for `toolName: 'word_search'`:
    - Header: `# 🔎 Word Search` with a summary block listing targets, scope, case-sensitivity, and the configured windows.
    - For each target: totals and overall average gap, then per-file tables of occurrences (index, line, snippet) and a concise Clusters section with span distance and line ranges.
    - Keep formatting consistent with the example-code/formatters.js output where reasonable.

- src/presentation/webview/index.css:
  - Reuse `.tab-bar` and `.tab-button` for the Metrics action strip for visual consistency with the top TabBar.
  - Add minor spacing rules if needed to nest this sub-tab bar within Metrics.

### Configuration (package.json)
Add new contributes.configuration keys under `proseMinion.wordSearch.*` with sensible defaults:
- `proseMinion.wordSearch.defaultTargets`: string (e.g., "just")
- `proseMinion.wordSearch.contextWords`: number, default 7
- `proseMinion.wordSearch.clusterWindow`: number, default 150
- `proseMinion.wordSearch.minClusterSize`: number, default 3
- `proseMinion.wordSearch.caseSensitive`: boolean, default false
- `proseMinion.wordSearch.enableAssistantExpansion`: boolean, default false

These populate the UI defaults and are passed into the analyzer unless the UI overrides them.

### Optional Assistant Expansion (future-ready)
- Goal: Add an “assistant” button next to the target textbox to quickly expand the list with synonyms (e.g., red → crimson) and inflectional variants (plural, -ing, etc.).
- Approach:
  - Use the existing dictionary scope orchestrator (see src/tools/utility/dictionaryUtility.ts) to request a compact response with:
    - Synonyms and close variants constrained by part of speech where possible.
    - Basic morphological family (plural, past, present participle, comparative/superlative as applicable).
  - Apply guardrails: hard cap response length, deduplicate, drop multi-word results unless user opts in, show a preview dialog to confirm additions.
  - Preserve privacy/cost: disabled by default; clearly marked as an online action (uses `dictionaryModel`) with shared `maxTokens` and truncation surfacing per standards.
- UI copy example: “⚡ Expand targets (synonyms + inflections)” with a tooltip clarifying the action and model use.

## UI/Export Behavior
- The Metrics tab shows a sub-tab strip: Prose Statistics | Style Flags | Word Frequency | Word Search.
- Word Search view shows the search controls, then renders a markdown summary with:
  - Targets list; Files scanned; Case sensitive; Context words; Cluster window and min cluster.
  - For each target, per-file occurrences table (index, line, context snippet with bolded hits) and Clusters list.
- Copy/Save actions work like other metrics. Saved files go to `prose-minion/reports/` with timestamped filenames and `toolName: 'word_search'`.

## Backward Compatibility
- Non-breaking: existing Metrics tools remain unchanged.
- New message type, new config keys, and a new renderer branch are additive.

## Performance and Size Considerations
- Tokenization and scanning are O(n) over tokens and work well for typical chapters/manuscripts.
- Per-file clustering uses a sliding window; memory usage bounded by occurrence list sizes.
- Context snippets are short (±7 words by default) and markdown-friendly.

## Testing
- Unit tests (where applicable) for:
  - Tokenization normalization and case sensitivity.
  - Occurrence detection for single- and multi-token phrases.
  - Average gap calculation.
  - Cluster detection correctness and edge cases (window edges, exact min cluster).
  - Snippet extraction with multiple highlights, prefix/suffix ellipses, and pipe escaping.
- Manual verification:
  - Matches and clusters against known fixtures.
  - UI: sub-tab styling matches the top TabBar; controls disable while running; defaults honored.

## Risks
- Phrase boundaries and tokenization can differ from author expectations (e.g., hyphenated words). Mitigation: document the tokenization pattern and keep it aligned with example-code.
- Large target lists from assistant expansion may introduce noise; mitigate via preview/confirmation and clear toggles.
- Case sensitivity default may surprise users; default to false with an obvious toggle.

## Acceptance Criteria
- A Word Search sub-tab appears under Metrics with a search textbox and controls.
- Defaults: wordsOrPhrases ["just"], contextWords 7, clusterWindow 150, minClusterSize 3, caseSensitive false.
- The tool scans the same scopes as other Metrics and returns:
  - Per-target totals, overall average gap, per-file occurrences with line numbers, and detected clusters with spans.
- The Metrics action strip is styled like the top tabs and supports an active state per sub-tool.
- Copy/Save exports produce readable markdown and save under `prose-minion/reports/`.
- Optional assistant expansion is documented and gated behind a setting; not required for initial acceptance.

## References
- example-code/index.js:1
- example-code/analyze.js:1
- example-code/formatters.js:1
- src/presentation/webview/components/MetricsTab.tsx:1
- src/presentation/webview/components/TabBar.tsx:1
- src/presentation/webview/index.css:1
- src/tools/utility/dictionaryUtility.ts:1
