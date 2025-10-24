# Memory Note — Word Search + Metrics Panel (2025-10-24 12:32 CT)

This note captures last night’s ADRs, commit highlights, what’s implemented, and actionable gaps for the Word Search tool and the Metrics panel overall.

## ADRs (Latest)
- docs/adr/2025-10-24-word-frequency-enhancements.md
  - Status: Accepted. Expands Word Frequency: Top 100, Hapax list (+count/%), stopwords table, POS via wink-pos-tagger (offline), bigrams/trigrams, length histogram, optional lemmas. Settings under `proseMinion.wordFrequency.*`.
- docs/adr/2025-10-24-metrics-word-search.md
  - Status: Proposed. Adds a deterministic/offline Word Search sub-tool with contextual snippets (±N words), cluster detection (sliding window), same source scopes, UI controls, and a gated “Expand word list” (🤖⚡) button showing a “coming soon” message until wired to a dictionary model.
- docs/adr/2025-10-23-metrics-source-selection-and-resolver.md
  - Status: Accepted. Introduces `TextSourceResolver` and a source selector UI (Active File / Manuscripts / Chapters / Selection). Legacy `text` still supported for metrics message contracts.
- docs/adr/2025-10-23-publishing-standards-comparison-and-formatting.md
  - Status: Accepted. Adds publishing standards repository, comparison service, and Publishing Format section (trim size, WPP, est. page count). Normalizes key metrics (e.g., lexical density as %).

## Commits (Last Night)
- 20dc550 Thu Oct 23 19:36:54 2025 docs(adr): record plan for publishing standards metrics (Okey Landers)
- b014a8a Thu Oct 23 19:40:39 2025 feat(publishing-standards and ^stats): add preset and trim selection, add comparions, improve stats. (Okey Landers)
- f79fd71 Thu Oct 23 19:48:39 2025 feat: expose per-chapter prose stats in metrics view (Okey Landers)
- 78bb9e9 Thu Oct 23 20:06:46 2025 feat(metrics): add export actions and hapax count display (Okey Landers)
- f6a3d83 Thu Oct 23 20:32:13 2025 feat: persist prose stats reports and enrich markdown exports (Okey Landers)
- c33ef31 Thu Oct 23 20:39:58 2025 docs: relocate guides to docs folder and fix references (Okey Landers)
- 171e369 Thu Oct 23 20:58:09 2025 feat: allow omitting prose stats chapter breakdown (Okey Landers)
- d7cd370 Thu Oct 23 21:24:01 2025 docs: expand metrics and publishing standards guidance (Okey Landers)
- 809ac95 Thu Oct 23 21:56:31 2025 docs: add ADR for word frequency enhancements (Okey Landers)
- ffd48d6 Thu Oct 23 21:56:47 2025 docs: revise word frequency ADR for wink POS default (Okey Landers)
- cec85f0 Thu Oct 23 22:48:09 2025 feat(proseminion): add optional wink POS tagging support (Okey Landers)
- 390fc66 Thu Oct 23 22:57:53 2025 docs: expand word frequency analysis documentation (Okey Landers)
- bd8d254 Fri Oct 24 00:06:10 2025 docs(adr): record metrics word search tool proposal (Okey Landers)
- 85646a4 Fri Oct 24 00:13:12 2025 fix: improve metrics tab a11y and message handling (Okey Landers)

## Implemented (Highlights)
- Source selection + resolver
  - UI: `src/presentation/webview/components/MetricsTab.tsx:220` (Measure tab-bar + Path/Pattern input)
  - Resolve path/globs/selection: `src/application/handlers/MessageHandler.ts:360`
  - Infrastructure: `src/infrastructure/text/TextSourceResolver.ts:1`
- Publishing standards + comparisons
  - Repository: `src/infrastructure/standards/PublishingStandardsRepository.ts:1`
  - Comparison service: `src/application/services/StandardsComparisonService.ts:1`
  - Enrichment: `src/infrastructure/api/ProseAnalysisService.ts:520`
  - UI preset/trim controls: `src/presentation/webview/components/MetricsTab.tsx:26`
- Word Frequency enhancements
  - Implementation: `src/tools/measure/wordFrequency/index.ts:1`
  - Settings wired: `package.json:200` (under `proseMinion.wordFrequency.*`)
  - Renderer: `src/presentation/webview/utils/metricsFormatter.ts:120`
  - Dependency: `package.json:480` (wink-pos-tagger)
- Word Search (end-to-end path)
  - Message type + options: `src/shared/types/messages.ts:23`, `src/shared/types/messages.ts:163`
  - UI sub-tab + controls: `src/presentation/webview/components/MetricsTab.tsx:319`
  - Handler: `src/application/handlers/MessageHandler.ts:388`
  - Analysis (deterministic): `src/infrastructure/api/ProseAnalysisService.ts:350`
    - Tokenize: `src/infrastructure/api/ProseAnalysisService.ts:710`
    - Line index: `src/infrastructure/api/ProseAnalysisService.ts:729`
    - Gap calc: `src/infrastructure/api/ProseAnalysisService.ts:815`
    - Clusters: `src/infrastructure/api/ProseAnalysisService.ts:827`
  - Markdown renderer: `src/presentation/webview/utils/metricsFormatter.ts:1` (Word Search branch)

## UX/Export Gaps to Address
- Copy/Save actions use hardcoded toolName 'prose_stats'
  - UI: `src/presentation/webview/components/MetricsTab.tsx:187`, `src/presentation/webview/components/MetricsTab.tsx:196`, and invocations `:402`, `:411`
  - Impact: Word Search and Word Frequency reports are rendered but export via Prose Stats channel.
- Save handler only supports a subset of tools
  - `src/application/handlers/MessageHandler.ts:632` (throws “Saving results for tool ... not supported yet.”)
  - Currently supports: dictionary_lookup, prose_analysis, dialogue_analysis, prose_stats (with chapter inclusion prompt at `:221` and `:247`).
- Minor fidelity
  - Word Search scannedFiles currently sets `absolute` == `relative`; consider populating true absolute path (low priority).
  - 🤖⚡ button is present and shows “coming soon”; respect `proseMinion.wordSearch.enableAssistantExpansion` to disable/hide until enabled.

## Proposed Next Steps
1) Dynamic export per active sub-tool
   - UI: pass `toolName` based on `activeTool` for copy/save in `MetricsTab.tsx`.
   - Handler: add save support for `word_search` → `prose-minion/reports/word-search-YYYYMMDD-HHmm.md` and `word_frequency` → `prose-minion/reports/word-frequency-YYYYMMDD-HHmm.md` (keep existing naming for stats).
2) Word Search UX polish
   - Disable/hide 🤖⚡ unless `proseMinion.wordSearch.enableAssistantExpansion` is true; keep tooltip.
   - Show “Scanned N files” and defaults recap above results using the already-present `options` and `scannedFiles.length`.
3) Optional test coverage
   - Unit tests for tokenize/occurrence/averageGap/cluster detection edge cases.

## Notes
- Word Search aligns with ADR: deterministic, offline, multi-file aware via `TextSourceResolver`.
- Word Frequency: wink POS tagging enabled by default; when tagger init fails, renderer shows “POS tagging unavailable”.
- Publishing standards comparison: additive; normalizes percentages; adds Publishing Format table; per-chapter stats preserved and export modal governs inclusion.
