# Epic: Context Search (AI-Powered Semantic Search)

**Epic ID**: epic-context-search-2025-11-17
**Status**: Complete (4/4 Sprints Complete)
**Created**: 2025-11-17
**Updated**: 2025-11-18
**Owner**: okeylanders
**ADR**: [ADR-2025-11-17: Context Search Component](../../../docs/adr/2025-11-17-context-search-component.md)
**Branch**: `epic/context-search-2025-11-17`

## Overview

Add AI-powered semantic search to the Search tab, enabling writers to find words by **category or concept** rather than exact string matching.

**Example Queries**:
- `[clothing]` → finds: coat, pants, jeans, shirt, jacket...
- `[color red]` → finds: crimson, maroon, scarlet, ruby, burgundy...
- `[angry]` → finds: pissed, upset, furious, livid, irate...

**Use Case**: Writers analyzing vocabulary patterns by semantic category (e.g., "How often do I use weather-related words?" or "Do I overuse anger synonyms?")

## Goals

1. **Semantic Discovery**: Enable category-based word search using AI
2. **Consistent UX**: Match existing Word Search patterns (UI, output format)
3. **Performance**: Handle large texts (novels with 10K+ distinct words)
4. **Cost-Effective**: Minimize token usage via efficient batching
5. **Exportable Results**: Markdown reports for external analysis

## Success Criteria

- ✅ User can search by natural language category (e.g., "clothing", "color red")
- ✅ AI accurately matches words to category
- ✅ Results display in familiar Word Search format (summary, expanded, details)
- ✅ Handles large texts without token limit errors (pagination)
- ✅ Export to markdown report works
- ✅ <$0.02 per search for 50K word novel (using Haiku)
- ✅ No architectural anti-patterns (god components, dependency violations)

## Scope

### In Scope

- Backend ContextSearchService (word extraction, AI matching, **delegates to WordSearchService for occurrence counting**)
- Message contracts (CONTEXT_SEARCH_REQUEST, CONTEXT_SEARCH_RESULT)
- SearchHandler integration (route registration)
- Frontend useSearch hook extension (state, actions, persistence)
- UI in SearchTab (query input, scope selector, results display, **reuse existing Word Search settings**)
- System prompts for AI matching
- Result export (markdown format, **reuse existing export patterns**)
- Pagination strategy for large word lists (**AI calls only**, file processing already handled by WordSearchService)
- **Multi-file batch processing** (FREE via WordSearchService delegation)
- **Cluster analysis & context snippets** (FREE via WordSearchService)
- **Chapter detection & breakdown** (FREE via WordSearchService)

### Out of Scope (Deferred)

- ❌ Multi-category search (e.g., "clothing OR colors") → Phase 2 (prompt-based, easy add)
- ❌ Negative queries (e.g., "clothing NOT formal") → Phase 2 (prompt-based, easy add)
- ❌ Trigram mode for context disambiguation → Phase 2 (optional accuracy enhancement)
- ❌ Custom word filters beyond min length / stopwords → Phase 2
- ❌ AI model selection per search (uses dedicated `proseMinion.categoryModel` with a curated thinking model subset) → Phase 2
- ❌ Offline mode / local lexical database → Not planned

## Architecture Alignment

**Domain**: Search (not Metrics)
**Layer**: Infrastructure → Application → Presentation
**Patterns**:

- Message Envelope (source tracking, echo prevention)
- Strategy Pattern (SearchHandler route registration)
- Domain Hooks (useSearch owns all Search state/actions)
- Tripartite Interface (State, Actions, Persistence)
- **Service Composition** (ContextSearchService delegates to WordSearchService for occurrence counting, clustering, snippets)

**Anti-Pattern Prevention**:

- ✅ Single responsibility (ContextSearchService = "AI matching", WordSearchService = "search & analyze", WordFrequency = "tokenization")
- ✅ No god components (ContextSearchService < 200 lines estimated, delegates heavy lifting)
- ✅ Clear domain boundaries (Search, not scattered)
- ✅ Type-safe (full TypeScript contracts)
- ✅ **DRY via composition** (reuse WordSearchService + WordFrequency instead of duplicating logic)

**Architectural Wins** (Two Major Discoveries):

**Win #1 - WordSearchService Delegation**:

- ✅ Occurrence counting (line numbers, snippets)
- ✅ Cluster detection (proximity analysis)
- ✅ Chapter detection & breakdown
- ✅ Multi-file batch processing
- ✅ Context snippet extraction
- ✅ All existing Word Search settings (contextWords, clusterWindow, minClusterSize)
- ✅ Proven, tested implementation (no new bugs from duplication)

**Win #2 - WordFrequency Tokenization Reuse**:

- ✅ Consistent word extraction across all features (dashes, apostrophes, stopwords)
- ✅ Single source of truth for tokenization logic
- ✅ No custom word extraction implementation needed
- ✅ `WordFrequency.extractUniqueWords()` handles filtering (min length, stopwords)

## Sprints

### Sprint 01: Backend Service + Message Contracts
**Status**: Complete
**Estimated Effort**: 0.5 days | **Actual**: ~0.5 days
**Commit**: `f931356`

**Scope**:

- Define message types (CONTEXT_SEARCH_REQUEST, CONTEXT_SEARCH_RESULT)
- **Add public method to WordFrequency** for unique word extraction
- Implement ContextSearchService (AI prompt, parsing, **delegate to WordFrequency + WordSearchService**)
- Create system prompts for semantic matching
- Register route in SearchHandler
- Unit tests for AI response parsing (word extraction & counting delegated)

**Acceptance**:

- ✅ Backend accepts context search request, returns results
- ✅ AI prompt format tested manually (returns valid JSON)
- ✅ **Delegates to WordFrequency.extractUniqueWords() for word extraction**
- ✅ **Delegates to WordSearchService.searchWords() for occurrence counting**

**Details**: [Sprint 01](sprints/01-backend-service.md)

---

### Sprint 02: Frontend Integration + Basic UI
**Status**: Complete
**Estimated Effort**: 0.5 days | **Actual**: ~0.5 days
**Commit**: `a3f0762`

**Scope**:

- Extend useSearch hook (contextSearch state, actions)
- Add Context Search subtool to SearchTab
- Query input + scope selector (**reuse existing ScopeSelector component**)
- Model dropdown (**reuse existing pattern from Dictionary**)
- Basic result display (summary table only)
- Loading states
- **No new settings needed** (reuse Word Search settings)

**Acceptance**:

- ✅ User can enter category query and trigger search
- ✅ Results display in summary table (word | count)
- ✅ Loading indicator shows during AI processing
- ✅ **Model dropdown uses existing `proseMinion.contextModel` setting**

**Details**: [Sprint 02](sprints/02-frontend-ui.md)

---

### Sprint 03: Result Formatting + Export
**Status**: Complete
**Estimated Effort**: 0.5 days | **Actual**: ~0.5 days
**Commit**: `1424f54`

**Scope**:

- Add category label to results (only new work needed)
- Expanded summary table (word | count | chapter) - **WordSearchService provides chapter data**
- Details & cluster analysis - **WordSearchService provides clusters**
- Export to markdown report (**reuse existing export pattern**)
- Chapter-level breakdown - **WordSearchService detects chapters**

**Acceptance**:

- ✅ Results show chapter-by-chapter breakdown (WordSearchService output)
- ✅ Export button saves markdown report
- ✅ Report format matches Word Search structure
- ✅ **Category label displays in results header**

**Details**: [Sprint 03](sprints/03-result-formatting.md)

---

### Sprint 04: Polish & Enhancements
**Status**: Complete
**Estimated Effort**: 0.5 days | **Actual**: ~1.5 hours
**Commit**: `2f435c8`

**Scope** (revised after user testing):

- Category model dropdown (uses dedicated `proseMinion.categoryModel` so we can enforce thinking, models)
- Token usage tracking from API response
- Filter hallucinated words (0-occurrence results)
- Files Summary table (word | count | clusters | files)
- ARIA labels for accessibility

**Acceptance**:

- ✅ Model dropdown shows at top of Category Search, changes persist
- ✅ Token usage tracked in result (visible in Output Channel)
- ✅ Words with 0 results are not shown in output
- ✅ Files Summary table appears with correct data
- ✅ ARIA labels present on main interactive elements

**Details**: [Sprint 04](sprints/04-performance-polish.md)

---

## Dependencies

**External**:

- OpenRouter API (existing)
- Context model (default: uses `proseMinion.contextModel` setting)

**Internal**:

- **WordSearchService** (existing, **CRITICAL** - provides occurrence counting, clustering, chapter detection)
- **WordFrequency** (existing, **CRITICAL** - provides consistent word extraction/tokenization)
- SearchHandler (existing, extend with new route)
- useSearch hook (existing, extend with context search state)
- ToolOptionsProvider (existing, provides Word Search settings)

**Settings Reused** (ZERO new settings needed):

- `proseMinion.wordSearch.contextWords` - Used by WordSearchService for snippet context
- `proseMinion.wordSearch.clusterWindow` - Used by WordSearchService for cluster detection
- `proseMinion.wordSearch.minClusterSize` - Used by WordSearchService for cluster detection
- `proseMinion.contextModel` - AI model for semantic matching

**None**: No new external dependencies required

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Token limits exceeded | High | Pagination strategy (2K words/batch) |
| AI matching inaccurate | Medium | Prompt iteration, examples in system prompt |
| Slow performance on large texts | Medium | Batch processing, progress indicators, Haiku model |
| High API cost | Low | Default to Haiku ($0.01/search), warn for large texts |
| Word extraction misses variations | Low | Use WordFrequency.extractUniqueWords() (proven, consistent tokenization) |

## Testing Strategy

**Manual Testing** (During Sprints):
- Test with small text (100 words) → verify basic matching
- Test with medium text (5K words) → verify performance
- Test with large text (50K words) → verify pagination
- Test edge cases (empty query, no matches, API errors)

**Automated Testing** (Sprint 04):
- Unit tests: Word extraction, occurrence counting
- Integration tests: SearchHandler route, message flow
- Mock AI responses for predictable testing

**User Acceptance**:
- Writers test with real manuscripts
- Verify category matching accuracy
- Collect feedback on UI/UX

## Documentation Updates

**Required**:
- Update [CLAUDE.md](.ai/central-agent-setup.md) with Context Search reference
- Add system prompts to `resources/system-prompts/context-search/`
- Update SearchTab component docs (inline comments)

**Optional**:
- User guide / tutorial (deferred to v1.0 documentation epic)

## Future Enhancements (Phase 2)

**Easy Adds (Prompt-Based)**:

- Multi-category search (`clothing OR colors`) - Just update system prompt
- Negative queries (`clothing NOT formal`) - Just update system prompt

**Moderate Complexity**:

- Trigram mode for context disambiguation (optional accuracy enhancement, higher cost)
- AI model selection per search (UI dropdown + override default)
- Save/load query presets (state management)
- Integration with Word Frequency (cross-domain comparison)

## References

- [Spec Document](.todo/search-module/2025-10-24-context-search-component.md)
- [ADR-2025-11-17](../../docs/adr/2025-11-17-context-search-component.md)
- [Word Search Service](../../src/infrastructure/api/services/search/WordSearchService.ts) (occurrence counting, clustering, chapters)
- [Word Frequency](../../src/tools/measure/wordFrequency/index.ts) (word extraction/tokenization)
- [Search Handler](../../src/application/handlers/domain/SearchHandler.ts)
- [useSearch Hook](../../src/presentation/webview/hooks/domain/useSearch.ts)

## Changelog

- **2025-11-18**: **TWO MAJOR ARCHITECTURAL WINS** - Service Composition Pattern
  - **Win #1 - WordSearchService delegation**: 50% effort reduction (3.5-4 days → 1.75 days)
    - Multi-file batch processing now FREE (was deferred to Phase 2)
    - Cluster analysis & chapter detection now FREE (WordSearchService provides)
    - ZERO new settings needed (reuse Word Search settings)
    - ContextSearchService delegates to WordSearchService for occurrence counting
  - **Win #2 - WordFrequency tokenization reuse**: Consistency win
    - Use `WordFrequency.extractUniqueWords()` for word extraction
    - Consistent tokenization across all features (dashes, apostrophes, stopwords)
    - Single source of truth for word extraction logic
    - Task added to Sprint 01 to add public method to WordFrequency
  - Sprint estimates updated: 01 (0.5d), 02 (0.5d), 03 (0.5d), 04 (0.25d)
- **2025-11-17**: Epic created (Proposed status)
