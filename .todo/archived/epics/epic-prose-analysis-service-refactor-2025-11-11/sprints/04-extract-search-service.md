# Sprint 04: Extract Search Service

**Status**: Pending Sprint 03
**Estimated Effort**: 2-3 hours
**Risk Level**: Medium
**Branch**: `sprint/epic-prose-analysis-service-refactor-2025-11-11-04-search-service`

---

## Goal

Extract word search logic (the heaviest method in ProseAnalysisService) into a focused WordSearchService. This includes 200+ lines of search logic plus 12 helper functions.

---

## Scope

### Service to Create

1. **WordSearchService** (~250-300 lines)
   - Deterministic word search across files and text
   - 12 helper functions (prepareTargets, tokenizeContent, findOccurrences, detectClusters, etc.)
   - Extract from lines 372-494 + 740-916 (helper functions)

### Files to Create

```
src/infrastructure/api/services/
└── search/
    └── WordSearchService.ts
```

---

## Tasks

- [ ] **Create WordSearchService**
  - [ ] Define class structure and constructor
  - [ ] Inject ToolOptionsProvider (for config)
  - [ ] Inject OutputChannel (for logging)
  - [ ] Implement `searchWords(text, files?, sourceMode?, options?)` main method
  - [ ] Implement `prepareTargets(targets)` helper
  - [ ] Implement `tokenizeContent(content)` helper
  - [ ] Implement `findOccurrences(words, tokens)` helper
  - [ ] Implement `detectClusters(occurrences, threshold)` helper
  - [ ] Implement `buildCooccurrenceMatrix(occurrences)` helper
  - [ ] Implement `findNearbyWords(occurrences, distance)` helper
  - [ ] Implement `getWordIndex(word, words)` helper
  - [ ] Implement `readFileContent(filePath)` helper
  - [ ] Implement `processFilesBatch(files)` helper
  - [ ] Implement `aggregateResults(fileResults)` helper
  - [ ] Implement `sortResults(results)` helper
  - [ ] Implement `applyFilters(results, options)` helper
  - [ ] Add JSDoc comments
  - [ ] Test word search on selection
  - [ ] Test word search on files
  - [ ] Test word search on manuscript

- [ ] **Update ProseAnalysisService** (Temporary)
  - [ ] Inject WordSearchService in constructor
  - [ ] Replace word search calls with WordSearchService
  - [ ] Remove all helper functions (now in WordSearchService)

- [ ] **Update extension.ts**
  - [ ] Instantiate WordSearchService
  - [ ] Inject service into ProseAnalysisService

- [ ] **Test Word Search Across All Modes**
  - [ ] Selection mode
  - [ ] Files mode
  - [ ] Manuscript mode
  - [ ] Cluster detection
  - [ ] Case sensitivity toggle

---

## Acceptance Criteria

- [ ] WordSearchService created and functional
- [ ] Word search returns identical results to before
- [ ] Search tab functions correctly
- [ ] Cluster detection works as expected
- [ ] ProseAnalysisService line count reduced ~250 lines
- [ ] Extension loads without errors
- [ ] Manual tests pass (see testing checklist)

---

## Critical Preservation Requirements

### Word Search Behavior

**Must preserve exact behavior**:
- Target word preparation (normalization, case handling)
- Content tokenization (word boundaries, punctuation)
- Occurrence finding (exact matches, case sensitivity)
- Cluster detection (proximity threshold, grouping)
- Cooccurrence matrix (word relationships)
- Nearby words detection (distance calculation)
- File reading and batch processing
- Result aggregation and sorting
- Filter application (case, min occurrences)

---

## Testing Checklist

### Manual Tests (After Sprint)

1. **Word Search - Selection Mode**:
   - [ ] Single target word
   - [ ] Multiple target words
   - [ ] Case sensitive search
   - [ ] Case insensitive search
   - [ ] Results display correctly

2. **Word Search - Files Mode**:
   - [ ] Search across multiple files
   - [ ] Results grouped by file
   - [ ] File paths displayed correctly
   - [ ] Total occurrences correct

3. **Word Search - Manuscript Mode**:
   - [ ] Search across all manuscript files
   - [ ] Chapter-level aggregation
   - [ ] Manuscript-level totals

4. **Cluster Detection**:
   - [ ] Clusters identified correctly
   - [ ] Proximity threshold respected
   - [ ] Cluster size accurate

5. **Nearby Words**:
   - [ ] Cooccurrence matrix correct
   - [ ] Distance calculation accurate
   - [ ] Top nearby words shown

---

## Implementation Notes

### WordSearchService Structure

```typescript
export class WordSearchService {
  constructor(
    private toolOptions: ToolOptionsProvider,
    private outputChannel: vscode.OutputChannel
  ) {}

  async searchWords(
    text: string,
    files?: string[],
    sourceMode?: string,
    options?: WordSearchOptions
  ): Promise<any> {
    // Main search logic
    const targets = this.prepareTargets(options?.targets || []);
    const tokens = this.tokenizeContent(text);
    const occurrences = this.findOccurrences(targets, tokens);

    if (files?.length) {
      const fileResults = await this.processFilesBatch(files);
      return this.aggregateResults([{ text, occurrences }, ...fileResults]);
    }

    return {
      occurrences,
      clusters: this.detectClusters(occurrences, options?.clusterThreshold || 50),
      nearby: this.findNearbyWords(occurrences, options?.nearbyDistance || 10)
    };
  }

  // 12 helper methods...
}
```

### Helper Functions

Extract all helper functions from ProseAnalysisService:
- Lines 740-916 contain 12 helper functions
- Each should become a private method in WordSearchService
- Preserve exact logic (no refactoring during extraction)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Word search breaks | Low | High | Test all search modes, careful extraction |
| Cluster detection breaks | Low | Medium | Test cluster logic extensively |
| File reading breaks | Low | Medium | Test multi-file search |
| Performance regression | Low | Low | Search is deterministic, no overhead expected |

---

## Definition of Done

- [ ] WordSearchService created with JSDoc comments
- [ ] All 12 helper functions extracted
- [ ] ProseAnalysisService uses new service
- [ ] Line count reduced by ~250 lines
- [ ] All search modes work identically
- [ ] All manual tests pass
- [ ] No errors in Output Channel
- [ ] Extension loads without errors
- [ ] Git commit with clear message
- [ ] Memory bank entry created

---

## Future Extension Point

After this sprint, **ContextSearchService** can be added as a sibling to WordSearchService for semantic search features. This will enable hybrid search (deterministic + semantic).

---

## Previous Sprint

[Sprint 03: Extract Analysis Services](03-extract-analysis-services.md)

## Next Sprint

[Sprint 05: Update Handlers, Delete Facade](05-update-handlers-delete-facade.md)

---

**Created**: 2025-11-11
**Status**: Pending Sprint 03
**ADR**: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../../docs/adr/2025-11-11-prose-analysis-service-refactor.md#phase-4-extract-search-service-medium-risk)
