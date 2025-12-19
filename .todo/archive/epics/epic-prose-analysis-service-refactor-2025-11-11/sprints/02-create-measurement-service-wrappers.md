# Sprint 02: Create Measurement Service Wrappers

**Status**: ✅ COMPLETE
**Actual Effort**: ~1.5 hours
**Risk Level**: Low
**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`
**Commits**: a4a30bb, e0b5ee9, 7128540
**Completion Date**: 2025-11-12
**All Tests**: ✅ PASSED

---

## Goal

Create thin service wrappers for measurement tools (ProseStats, StyleFlags, WordFrequency) for architectural consistency. All handlers will depend on services, not tools directly.

---

## Scope

### Services to Create

1. **ProseStatsService** (~80-100 lines)
   - Wrap PassageProseStats measurement tool
   - Thin wrapper, mostly delegation
   - Provides clean extension point for future orchestration

2. **StyleFlagsService** (~60-80 lines)
   - Wrap StyleFlags measurement tool
   - Thin wrapper, pure delegation

3. **WordFrequencyService** (~80-100 lines)
   - Wrap WordFrequency measurement tool
   - Handles configuration retrieval via ToolOptionsProvider

### Files to Create

```
src/infrastructure/api/services/
└── measurement/
    ├── ProseStatsService.ts
    ├── StyleFlagsService.ts
    └── WordFrequencyService.ts
```

---

## Tasks

- [ ] **Create ProseStatsService**
  - [ ] Define class structure and constructor
  - [ ] Inject PassageProseStats tool
  - [ ] Implement `analyze(text: string)` method
  - [ ] Add JSDoc comments
  - [ ] Test prose stats analysis

- [ ] **Create StyleFlagsService**
  - [ ] Define class structure and constructor
  - [ ] Inject StyleFlags tool
  - [ ] Implement `analyze(text: string)` method
  - [ ] Add JSDoc comments
  - [ ] Test style flags detection

- [ ] **Create WordFrequencyService**
  - [ ] Define class structure and constructor
  - [ ] Inject WordFrequency tool
  - [ ] Inject ToolOptionsProvider (for config)
  - [ ] Implement `analyze(text: string, options?)` method
  - [ ] Add JSDoc comments
  - [ ] Test word frequency analysis with options

- [ ] **Update ProseAnalysisService** (Temporary)
  - [ ] Inject ProseStatsService in constructor
  - [ ] Inject StyleFlagsService in constructor
  - [ ] Inject WordFrequencyService in constructor
  - [ ] Replace direct PassageProseStats calls with ProseStatsService
  - [ ] Replace direct StyleFlags calls with StyleFlagsService
  - [ ] Replace direct WordFrequency calls with WordFrequencyService

- [ ] **Update extension.ts**
  - [ ] Instantiate ProseStatsService
  - [ ] Instantiate StyleFlagsService
  - [ ] Instantiate WordFrequencyService
  - [ ] Inject services into ProseAnalysisService

- [ ] **Test All Metrics Tools**
  - [ ] Prose stats on selection, file, manuscript
  - [ ] Style flags detection
  - [ ] Word frequency with all options
  - [ ] Publishing standards comparison (ProseStats integration)

---

## Acceptance Criteria

- [ ] All 3 measurement service wrappers created
- [ ] Service wrappers follow consistent pattern
- [ ] All metrics tools work identically to before
- [ ] Metrics tab shows correct results
- [ ] Extension loads without errors
- [ ] Manual tests pass (see testing checklist)

---

## Rationale: Why Create Wrappers?

**For consistency and architectural symmetry**:

- ✅ Analysis tools are wrapped (AssistantToolService, ContextAssistantService, DictionaryService)
- ✅ Measurement tools should also be wrapped
- ✅ All handlers depend on services, not tools directly
- ✅ Provides clean extension points for future orchestration
- ✅ Consistent abstraction level across codebase

**Key distinction**: These are **service → tool** wrappers (infrastructure abstraction), not a facade. Each service wraps one tool.

---

## Testing Checklist

### Manual Tests (After Sprint)

1. **Prose Stats**:
   - [ ] Analysis on selection (< 300 words)
   - [ ] Analysis on file (single chapter)
   - [ ] Analysis on manuscript (multi-file with chapter aggregation)
   - [ ] Publishing standards comparison works
   - [ ] Chapter-by-chapter stats table shows

2. **Style Flags**:
   - [ ] Detects adverb overuse
   - [ ] Detects passive voice
   - [ ] Detects dialogue tags
   - [ ] Results display correctly

3. **Word Frequency**:
   - [ ] Top 100 words list
   - [ ] Stopwords analysis
   - [ ] Hapax legomena
   - [ ] Bigrams/trigrams
   - [ ] Word length histogram
   - [ ] POS tagging (wink)
   - [ ] Optional lemmas view
   - [ ] Min character length filter works

---

## Implementation Notes

### ProseStatsService

Simple wrapper:
```typescript
export class ProseStatsService {
  private proseStats: PassageProseStats;

  constructor() {
    this.proseStats = new PassageProseStats();
  }

  analyze(text: string): any {
    return this.proseStats.analyze({ text });
  }
}
```

### StyleFlagsService

Simple wrapper:
```typescript
export class StyleFlagsService {
  private styleFlags: StyleFlags;

  constructor() {
    this.styleFlags = new StyleFlags();
  }

  analyze(text: string): any {
    return this.styleFlags.analyze({ text });
  }
}
```

### WordFrequencyService

Wrapper with configuration:
```typescript
export class WordFrequencyService {
  private wordFrequency: WordFrequency;
  private toolOptions: ToolOptionsProvider;

  constructor(toolOptions: ToolOptionsProvider) {
    this.wordFrequency = new WordFrequency((msg) => console.log(msg));
    this.toolOptions = toolOptions;
  }

  analyze(text: string, options?: WordFrequencyOptions): any {
    const wfOptions = options || this.toolOptions.getWordFrequencyOptions();
    return this.wordFrequency.analyze({ text }, wfOptions);
  }
}
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wrappers add overhead | Very Low | Very Low | Wrappers are thin, negligible overhead |
| Tests fail due to wrapper issues | Low | Medium | Test each tool individually |
| Configuration changes break word frequency | Low | Medium | Test with all word frequency options |

---

## Definition of Done

- [ ] All 3 service wrappers created with JSDoc comments
- [ ] ProseAnalysisService uses new services
- [ ] All metrics tools work identically
- [ ] All manual tests pass
- [ ] No errors in Output Channel
- [ ] Extension loads without errors
- [ ] Git commit with clear message
- [ ] Memory bank entry created

---

## Sprint Outcomes

### Services Created ✅
1. **ProseStatsService** (48 lines) - Wraps PassageProseStats
2. **StyleFlagsService** (49 lines) - Wraps StyleFlags
3. **WordFrequencyService** (63 lines) - Wraps WordFrequency with configuration

### ProseAnalysisService Updated ✅
- **Before**: 702 lines (after Sprint 01)
- **After**: 711 lines
- **Change**: +9 lines (expected for service injection overhead)
- **Pattern**: Constructor injection with 3 measurement services

### Testing Results ✅
All manual tests passed:
- ✅ Extension loads without errors
- ✅ Build succeeds with no TypeScript errors
- ✅ Development build marker shows "SPRINT 02"
- ✅ All metrics tools work correctly (prose stats, style flags, word frequency)
- ✅ Manuscript mode with chapter aggregation works
- ✅ Publishing standards comparison works

### Architecture Debt Identified 🔍
**Issue**: StandardsService responsibility violation
- `computePerFileStats()` is in StandardsService but should be in ProseStatsService
- Document: `.todo/architecture-debt/2025-11-13-standards-service-responsibility-violation.md`
- Priority: Medium
- Fix timing: Sprint 04 or 05

### Key Achievements
- ✅ Thin wrapper pattern applied consistently across all measurement services
- ✅ All handlers now depend on services, not tools directly
- ✅ No breaking changes (all functionality preserved)
- ✅ Build succeeds on first try (one minor constructor bug fixed)
- ✅ Architecture review during implementation identified responsibility violation

### Memory Bank Entry
- [20251112-2050-sprint-02-measurement-services-complete.md](../../../.memory-bank/20251112-2050-sprint-02-measurement-services-complete.md)

---

## Previous Sprint

[Sprint 01: Extract Resource Services](01-extract-resource-services.md)

## Next Sprint

[Sprint 03: Extract Analysis Services](03-extract-analysis-services.md)

---

**Created**: 2025-11-11
**Completed**: 2025-11-12
**Status**: ✅ COMPLETE
**All Tests**: ✅ PASSED
**ADR**: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../../docs/adr/2025-11-11-prose-analysis-service-refactor.md#phase-2-create-measurement-service-wrappers-low-risk)
