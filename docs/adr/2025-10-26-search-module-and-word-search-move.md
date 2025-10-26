# ADR: Search Module and Word Search Move

**Status**: Accepted (Implemented 2025-10-26)

**Deciders**: Okey Landers

**Date**: 2025-10-26

---

## Context

Prior to this change, Word Search functionality was housed in the Metrics tab alongside statistical analysis tools (Prose Statistics, Word Frequency, Style Flags). However, Word Search is fundamentally different from these tools:

- **Word Search**: Deterministic, offline search for word/phrase occurrences with contextual snippets and clustering
- **Metrics Tools**: Statistical analysis producing aggregate measurements

This architectural mismatch created several issues:

1. **Conceptual Confusion**: Users and developers expected Metrics to be purely statistical, but Word Search is a search/discovery tool
2. **UI Complexity**: The Metrics tab was becoming crowded with mixed-purpose tools
3. **Future Growth Blocker**: Context Search (AI-assisted semantic search) couldn't be added to Metrics without further confusion
4. **Message Contract Ambiguity**: Word Search results routed through `METRICS_RESULT` even though conceptually distinct

Additionally, the epic plan calls for Context Search (Phase 8), which requires a dedicated Search module as its natural home.

---

## Decision

We will:

1. **Create a dedicated Search module** at the top level of the webview
   - Add `TabId.SEARCH` to the tab bar
   - Create `SearchTab.tsx` in `src/presentation/webview/components/`

2. **Move Word Search UI** from MetricsTab to SearchTab
   - Transfer all Word Search controls (targets, context words, cluster settings)
   - Preserve source selection UX (Scope selector + Path/Pattern input)
   - Keep the same renderer (`formatMetricsAsMarkdown`)

3. **Separate message contracts** for Search and Metrics
   - Add `MessageType.RUN_WORD_SEARCH` for Search tab requests
   - Add `MessageType.SEARCH_RESULT` for Search tab responses
   - Keep deprecated `MessageType.MEASURE_WORD_SEARCH` for backward compatibility

4. **Separate state management** in App.tsx
   - Add dedicated `searchResult` state (separate from `metricsResult`)
   - Remove `word_search` from `metricsActiveTool` union type
   - Add `search` cache to `ResultCache` in MessageHandler

5. **Maintain backward compatibility**
   - Keep `MEASURE_WORD_SEARCH` handler for legacy routes
   - Handler accepts `asSearch` boolean to route results correctly

---

## Alternatives Considered

### Alternative 1: Keep Word Search in Metrics
**Rejected** because:
- Violates separation of concerns (search ≠ statistical measurement)
- Blocks future Context Search from having a natural home
- Continues UI/UX confusion for users

### Alternative 2: Create "Tools" or "Utilities" Module
**Rejected** because:
- Too generic; doesn't communicate purpose
- Context Search + Word Search are both search tools, deserve dedicated space
- Utilities tab already exists for Dictionary/Context generation

### Alternative 3: Separate Message Contracts Only (No UI Move)
**Rejected** because:
- Doesn't solve conceptual confusion in UI
- Still blocks Context Search addition
- Message separation without UI separation is half-measure

---

## Consequences

### Positive

✅ **Clear Separation of Concerns**: Metrics is purely statistical; Search is purely search/discovery

✅ **Unlocks Context Search**: Phase 8 (AI-assisted semantic search) has a natural home

✅ **Improved UX**: Users see clear distinction between "Measure" and "Search" capabilities

✅ **Better Code Organization**: Each module has focused responsibility

✅ **Type Safety**: Can properly type `SearchResultMessage` separately from `MetricsResultMessage`

✅ **Backward Compatible**: Existing integrations using `MEASURE_WORD_SEARCH` continue to work

### Negative

⚠️ **Slight State Complexity**: App.tsx now manages separate `metricsResult` and `searchResult` states

⚠️ **Cache Management**: MessageHandler maintains separate caches for metrics and search results

⚠️ **Shared Formatter**: SearchTab still uses `formatMetricsAsMarkdown` (minor coupling, can refactor later)

### Neutral

- Total LOC slightly increased (new tab component, message types)
- Persistence layer slightly larger (stores both metrics and search results)

---

## Implementation Details

### Commits
- `195ed15`: feat(search): add Search tab and move Word Search UI (Sprint 1)
- `5908d71`: refactor(search): separate Search from Metrics message contracts and cache
- `717c127`: chore(search): use shared SearchResultMessage in handler cache and flush
- `e2cf7f7`: fix(search/metrics): remove leftover word_search guard in MetricsTab props

### Files Modified
- `src/shared/types/messages.ts`: Added RUN_WORD_SEARCH, SEARCH_RESULT, SearchResultMessage
- `src/application/handlers/MessageHandler.ts`: Added search cache, sendSearchResult(), asSearch routing
- `src/presentation/webview/App.tsx`: Added searchResult state, SEARCH_RESULT handler
- `src/presentation/webview/components/SearchTab.tsx`: New component with Word Search UI
- `src/presentation/webview/components/MetricsTab.tsx`: Removed Word Search block
- `src/presentation/webview/components/TabBar.tsx`: Added Search tab entry

### Backend Changes
**None** - Word Search implementation in `ProseAnalysisService.analyzeWordSearch()` unchanged. Only presentation and routing layers affected.

---

## Acceptance Criteria

All criteria from Sprint 1 met:

✅ A "Search" tab appears in the tab bar

✅ Word Search panel runs against the same scopes (Active File, Manuscripts, Chapters, Selection)

✅ Metrics tab no longer shows Word Search UI

✅ Message contracts preserved; results render as before

✅ Source selection UX consistent between Metrics and Search (Scope + Path/Pattern)

---

## Related Documents

- **Epic**: [.todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md](.todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md)
- **Sprint**: [.todo/epics/epic-search-architecture-2025-10-19/sprints/01-search-module-and-move-word-search.md](.todo/epics/epic-search-architecture-2025-10-19/sprints/01-search-module-and-move-word-search.md)
- **Related ADRs**:
  - [2025-10-24-metrics-word-search.md](2025-10-24-metrics-word-search.md) - Word Search implementation details
  - [2025-10-23-metrics-source-selection-and-resolver.md](2025-10-23-metrics-source-selection-and-resolver.md) - Source selection architecture

---

## Future Work

- **Phase 8 (Context Search)**: Add AI-assisted search to Search module with category/synonym expansion
- **Type Safety**: Define proper `WordSearchResult` interface instead of `any` in SearchResultMessage
- **Formatter Refactoring**: Extract shared formatting utilities to reduce coupling between Search and Metrics
- **State Naming**: Rename `metricsWordSearchTargets` → `wordSearchTargets` for clarity
- **Independent Loading**: Separate `searchLoading` from `metricsLoading` for better UX

---

## Notes

- This ADR was authored retrospectively to document Sprint 1 implementation
- Implementation was completed 2025-10-26; ADR written same day
- All Sprint 1 acceptance criteria met and verified
- Clean Architecture principles maintained throughout implementation
