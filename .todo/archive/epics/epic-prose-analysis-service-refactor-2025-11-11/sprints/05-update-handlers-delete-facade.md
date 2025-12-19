# Sprint 05: Update Handlers, Delete Facade

**Status**: Pending Sprint 04
**Estimated Effort**: 3-4 hours
**Risk Level**: Medium
**Branch**: `sprint/epic-prose-analysis-service-refactor-2025-11-11-05-handlers-direct-injection`

---

## Goal

**THE BIG REFACTOR**: Update all handlers to inject services directly, implement orchestration in handlers (application layer), and **DELETE ProseAnalysisService facade entirely**.

This is the culmination of the refactor - removing the last god component and achieving Clean Architecture.

---

## Scope

### Handlers to Update

1. **AnalysisHandler**
   - Inject AssistantToolService, ContextAssistantService, DictionaryService
   - Delegate to services (thin wrapper, no orchestration)

2. **MetricsHandler** (CRITICAL - includes orchestration)
   - Inject ProseStatsService, StyleFlagsService, WordFrequencyService
   - Inject StandardsService, WordSearchService, ToolOptionsProvider
   - **Orchestrate ProseStats use case** (stats → aggregation → enrichment)

3. **DictionaryHandler**
   - Inject DictionaryService
   - Delegate to service

4. **ContextHandler**
   - Inject ContextAssistantService
   - Delegate to service

5. **SearchHandler**
   - Inject WordSearchService
   - Delegate to service

### Files to Delete

- ❌ `src/infrastructure/api/ProseAnalysisService.ts` (916 lines)
- ❌ `src/domain/services/IProseAnalysisService.ts` (interface)

### Files to Update

- `src/application/handlers/domain/AnalysisHandler.ts`
- `src/application/handlers/domain/MetricsHandler.ts`
- `src/application/handlers/domain/DictionaryHandler.ts`
- `src/application/handlers/domain/ContextHandler.ts`
- `src/application/handlers/domain/SearchHandler.ts`
- `src/extension.ts` (dependency injection)

---

## Tasks

- [ ] **Update AnalysisHandler**
  - [ ] Update constructor to inject services directly
  - [ ] Inject AssistantToolService
  - [ ] Inject ContextAssistantService
  - [ ] Inject DictionaryService
  - [ ] Inject ToolOptionsProvider
  - [ ] Update handleDialogueAnalysis() to use AssistantToolService
  - [ ] Update handleProseAnalysis() to use AssistantToolService
  - [ ] Update handleDictionaryLookup() to use DictionaryService (if in this handler)
  - [ ] Test dialogue and prose analysis

- [ ] **Update MetricsHandler** (CRITICAL ORCHESTRATION)
  - [ ] Update constructor to inject services directly
  - [ ] Inject ProseStatsService
  - [ ] Inject StyleFlagsService
  - [ ] Inject WordFrequencyService
  - [ ] Inject WordSearchService
  - [ ] Inject StandardsService
  - [ ] Inject ToolOptionsProvider
  - [ ] **Implement handleProseStats() orchestration**:
    - [ ] Step 1: Get base stats from ProseStatsService
    - [ ] Step 2: Multi-file aggregation (if needed) via StandardsService
    - [ ] Step 3: Standards enrichment via StandardsService
    - [ ] Step 4: Wrap result and send to panel
  - [ ] Update handleStyleFlags() to use StyleFlagsService
  - [ ] Update handleWordFrequency() to use WordFrequencyService
  - [ ] Test all metrics tools
  - [ ] **Test ProseStats orchestration extensively**

- [ ] **Update DictionaryHandler**
  - [ ] Update constructor to inject DictionaryService
  - [ ] Update handleDictionaryLookup() to use DictionaryService
  - [ ] Test dictionary lookups

- [ ] **Update ContextHandler**
  - [ ] Update constructor to inject ContextAssistantService
  - [ ] Update handleContextGeneration() to use ContextAssistantService
  - [ ] Test context generation

- [ ] **Update SearchHandler**
  - [ ] Update constructor to inject WordSearchService
  - [ ] Update handleWordSearch() to use WordSearchService
  - [ ] Test word search

- [ ] **Update extension.ts Dependency Injection**
  - [ ] Remove ProseAnalysisService instantiation
  - [ ] Update AnalysisHandler instantiation (inject services)
  - [ ] Update MetricsHandler instantiation (inject services)
  - [ ] Update DictionaryHandler instantiation (inject services)
  - [ ] Update ContextHandler instantiation (inject services)
  - [ ] Update SearchHandler instantiation (inject services)
  - [ ] Verify no references to ProseAnalysisService remain

- [ ] **DELETE ProseAnalysisService**
  - [ ] Delete `src/infrastructure/api/ProseAnalysisService.ts`
  - [ ] Delete `src/domain/services/IProseAnalysisService.ts`
  - [ ] Search codebase for remaining references
  - [ ] Remove any imports of IProseAnalysisService

- [ ] **Test All Handlers End-to-End**
  - [ ] All analysis tools work
  - [ ] All metrics tools work
  - [ ] Dictionary lookups work
  - [ ] Context generation works
  - [ ] Word search works
  - [ ] **ProseStats orchestration works (critical test)**

---

## Acceptance Criteria

- [ ] All handlers work identically to before
- [ ] ProseAnalysisService.ts **DELETED** ✅
- [ ] IProseAnalysisService interface **REMOVED** ✅
- [ ] All use cases functional
- [ ] Orchestration logic lives in handlers (application layer)
- [ ] No errors in Output Channel
- [ ] Extension loads without errors
- [ ] All manual tests pass (see testing checklist)

---

## Critical Preservation Requirements

### MetricsHandler ProseStats Orchestration

**Must preserve exact behavior**:

```typescript
async handleProseStats(message: MessageEnvelope) {
  const { text, files, sourceMode } = message.payload;

  // Step 1: Get base stats
  const stats = this.proseStatsService.analyze(text);

  // Step 2: Multi-file aggregation (if needed)
  if (files?.length && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
    const perFileStats = await this.standardsService.computePerFileStats(
      files,
      this.proseStatsService
    );
    Object.assign(stats, { chapterStats: perFileStats });
  }

  // Step 3: Standards enrichment
  const enriched = await this.standardsService.enrichWithStandards(stats);

  // Step 4: Wrap result and send
  const result = AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
  this.panel.postMessage(result);
}
```

**This is the most critical orchestration in the entire refactor.** It must work identically.

---

## Testing Checklist

### Manual Tests (After Sprint) - COMPREHENSIVE

1. **Analysis Tools** (AnalysisHandler):
   - [ ] Dialogue analysis (focus: dialogue)
   - [ ] Dialogue analysis (focus: microbeats)
   - [ ] Dialogue analysis (focus: both)
   - [ ] Prose analysis with craft guides
   - [ ] Prose analysis without craft guides

2. **Metrics Tools** (MetricsHandler):
   - [ ] Prose stats on selection
   - [ ] Prose stats on file
   - [ ] **Prose stats on manuscript (multi-file aggregation)** ⚠️ CRITICAL
   - [ ] **Chapter-by-chapter stats table shows** ⚠️ CRITICAL
   - [ ] **Publishing standards comparison works** ⚠️ CRITICAL
   - [ ] Style flags detection
   - [ ] Word frequency analysis

3. **Dictionary** (DictionaryHandler):
   - [ ] Word lookup with context
   - [ ] Word lookup without context

4. **Context** (ContextHandler):
   - [ ] Context generation with resources
   - [ ] Context streaming behavior

5. **Search** (SearchHandler):
   - [ ] Word search on selection
   - [ ] Word search on files
   - [ ] Word search on manuscript

6. **Configuration**:
   - [ ] Model switching (assistant, dictionary, context)
   - [ ] API key changes
   - [ ] Settings updates

7. **Regression Testing**:
   - [ ] Tab switching preserves state
   - [ ] Token tracking still works
   - [ ] Settings overlay functions correctly

---

## Implementation Notes

### MetricsHandler Orchestration Example

```typescript
export class MetricsHandler {
  constructor(
    private readonly proseStatsService: ProseStatsService,
    private readonly styleFlagsService: StyleFlagsService,
    private readonly wordFrequencyService: WordFrequencyService,
    private readonly wordSearchService: WordSearchService,
    private readonly standardsService: StandardsService,
    private readonly toolOptions: ToolOptionsProvider,
    private readonly panel: ProseToolsViewProvider
  ) {}

  async handleProseStats(message: MessageEnvelope) {
    const { text, files, sourceMode } = message.payload;

    // Handler orchestrates the use case
    const stats = this.proseStatsService.analyze(text);

    if (files?.length && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
      const perFileStats = await this.standardsService.computePerFileStats(
        files,
        this.proseStatsService
      );
      Object.assign(stats, { chapterStats: perFileStats });
    }

    const enriched = await this.standardsService.enrichWithStandards(stats);
    const result = AnalysisResultFactory.createMetricsResult('prose_stats', enriched);

    this.panel.postMessage(result);
  }
}
```

### AnalysisHandler Delegation Example

```typescript
export class AnalysisHandler {
  constructor(
    private readonly assistantToolsService: AssistantToolService,
    private readonly contextAssistantService: ContextAssistantService,
    private readonly dictionaryService: DictionaryService,
    private readonly toolOptions: ToolOptionsProvider,
    private readonly panel: ProseToolsViewProvider
  ) {}

  async handleDialogueAnalysis(message: MessageEnvelope) {
    const { text, contextText, sourceFileUri, focus } = message.payload;
    const options = this.toolOptions.getOptions(focus);

    const result = await this.assistantToolsService.analyzeDialogue(
      text,
      contextText,
      sourceFileUri,
      options
    );

    this.panel.postMessage(result);
  }
}
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ProseStats orchestration breaks | Medium | High | Test extensively, careful implementation |
| Handler bloat (too many params) | Low | Medium | Line count caps, review constructor complexity |
| Missing ProseAnalysisService references | Low | Medium | Search codebase before deletion |
| Extension fails to load | Low | High | Test extension activation after DI changes |

---

## Anti-Pattern Watch: Handlers Becoming God Components

**Mitigation**:
- If MetricsHandler > 200 lines, consider extracting orchestration
- If handler has > 10 responsibilities, split it
- Keep handlers focused on message routing + orchestration only

**Current Status** (post-sprint):
- MetricsHandler: ~150-180 lines (acceptable)
- AnalysisHandler: ~120-150 lines (acceptable)

---

## Definition of Done

- [ ] All handlers updated to inject services directly
- [ ] ProseAnalysisService.ts **DELETED** ✅
- [ ] IProseAnalysisService interface **REMOVED** ✅
- [ ] ProseStats orchestration works identically
- [ ] All use cases functional
- [ ] All manual tests pass
- [ ] No errors in Output Channel
- [ ] Extension loads without errors
- [ ] Git commit with clear message
- [ ] Memory bank entry created

---

## Previous Sprint

[Sprint 04: Extract Search Service](04-extract-search-service.md)

## Next Sprint

[Sprint 06: Documentation and Cleanup](06-documentation-and-cleanup.md)

---

**Created**: 2025-11-11
**Status**: Pending Sprint 04
**ADR**: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../../docs/adr/2025-11-11-prose-analysis-service-refactor.md#phase-5-update-handlers-to-inject-services-directly-medium-risk)
