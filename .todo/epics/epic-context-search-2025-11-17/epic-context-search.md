# Epic: Context Search (AI-Powered Semantic Search)

**Epic ID**: epic-context-search-2025-11-17
**Status**: Proposed
**Created**: 2025-11-17
**Owner**: okeylanders
**ADR**: [ADR-2025-11-17: Context Search Component](../../../docs/adr/2025-11-17-context-search-component.md)

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
- Backend ContextSearchService (word extraction, AI matching, occurrence counting)
- Message contracts (CONTEXT_SEARCH_REQUEST, CONTEXT_SEARCH_RESULT)
- SearchHandler integration (route registration)
- Frontend useSearch hook extension (state, actions, persistence)
- UI in SearchTab (query input, scope selector, results display)
- System prompts for AI matching
- Result export (markdown format)
- Pagination strategy for large word lists

### Out of Scope (Deferred)
- ❌ Multi-category search (e.g., "clothing OR colors") → Phase 2
- ❌ Custom word filters beyond min length / stopwords → Phase 2
- ❌ AI model selection per search (uses default context model) → Phase 2
- ❌ Offline mode / local lexical database → Not planned
- ❌ Batch processing multiple files → Phase 2

## Architecture Alignment

**Domain**: Search (not Metrics)
**Layer**: Infrastructure → Application → Presentation
**Patterns**:
- Message Envelope (source tracking, echo prevention)
- Strategy Pattern (SearchHandler route registration)
- Domain Hooks (useSearch owns all Search state/actions)
- Tripartite Interface (State, Actions, Persistence)

**Anti-Pattern Prevention**:
- ✅ Single responsibility (ContextSearchService does one thing)
- ✅ No god components (service < 300 lines estimated)
- ✅ Clear domain boundaries (Search, not scattered)
- ✅ Type-safe (full TypeScript contracts)

## Sprints

### Sprint 01: Backend Service + Message Contracts
**Status**: Pending
**Estimated Effort**: 1 day
**Branch**: `sprint/epic-context-search-2025-11-17-01-backend-service`

**Scope**:
- Define message types (CONTEXT_SEARCH_REQUEST, CONTEXT_SEARCH_RESULT)
- Implement ContextSearchService (word extraction, AI prompt, parsing, counting)
- Create system prompts for semantic matching
- Register route in SearchHandler
- Unit tests for word extraction and counting logic

**Acceptance**:
- ✅ Backend accepts context search request, returns results
- ✅ AI prompt format tested manually (returns valid JSON)
- ✅ Word extraction filters stopwords, min length

**Details**: [Sprint 01](sprints/01-backend-service.md)

---

### Sprint 02: Frontend Integration + Basic UI
**Status**: Pending
**Estimated Effort**: 1 day
**Branch**: `sprint/epic-context-search-2025-11-17-02-frontend-ui`

**Scope**:
- Extend useSearch hook (contextSearch state, actions)
- Add Context Search subtool to SearchTab
- Query input + scope selector
- Basic result display (summary table only)
- Loading states

**Acceptance**:
- ✅ User can enter category query and trigger search
- ✅ Results display in summary table (word | count)
- ✅ Loading indicator shows during AI processing

**Details**: [Sprint 02](sprints/02-frontend-ui.md)

---

### Sprint 03: Result Formatting + Export
**Status**: Pending
**Estimated Effort**: 1 day
**Branch**: `sprint/epic-context-search-2025-11-17-03-result-formatting`

**Scope**:
- Expanded summary table (word | count | chapter)
- Details & cluster analysis (match Word Search format)
- Export to markdown report
- Chapter-level breakdown

**Acceptance**:
- ✅ Results show chapter-by-chapter breakdown
- ✅ Export button saves markdown report
- ✅ Report format matches Word Search structure

**Details**: [Sprint 03](sprints/03-result-formatting.md)

---

### Sprint 04: Performance + Polish
**Status**: Pending
**Estimated Effort**: 0.5-1 day
**Branch**: `sprint/epic-context-search-2025-11-17-04-performance-polish`

**Scope**:
- Pagination for large word lists (>2K distinct words)
- Progress indicators for batch processing
- Error handling (AI failures, invalid queries)
- Settings persistence (last query, options)
- Token cost estimation display (optional)

**Acceptance**:
- ✅ 50K word novel processes without token errors
- ✅ Progress shows "Analyzing batch 2 of 5..." during pagination
- ✅ Graceful error messages for API failures
- ✅ Settings persist across sessions

**Details**: [Sprint 04](sprints/04-performance-polish.md)

---

## Dependencies

**External**:
- OpenRouter API (existing)
- Context model (default: uses `proseMinion.contextModel` setting)

**Internal**:
- SearchHandler (existing, extend with new route)
- useSearch hook (existing, extend with context search state)
- TextProcessorService (existing, for word extraction)

**None**: No new external dependencies required

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Token limits exceeded | High | Pagination strategy (2K words/batch) |
| AI matching inaccurate | Medium | Prompt iteration, examples in system prompt |
| Slow performance on large texts | Medium | Batch processing, progress indicators, Haiku model |
| High API cost | Low | Default to Haiku ($0.01/search), warn for large texts |
| Word extraction misses variations | Low | Use existing TextProcessorService (proven in Word Frequency) |

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

- Multi-category search (`clothing OR colors`)
- Negative queries (`clothing NOT formal`)
- AI model selection per search
- Batch process multiple files
- Save/load query presets
- Integration with Word Frequency (compare categories)

## References

- [Spec Document](.todo/search-module/2025-10-24-context-search-component.md)
- [ADR-2025-11-17](../../docs/adr/2025-11-17-context-search-component.md)
- [Word Search Service](../../src/infrastructure/api/services/search/WordSearchService.ts) (reference implementation)
- [Search Handler](../../src/application/handlers/domain/SearchHandler.ts)
- [useSearch Hook](../../src/presentation/webview/hooks/domain/useSearch.ts)

## Changelog

- **2025-11-17**: Epic created (Proposed status)
