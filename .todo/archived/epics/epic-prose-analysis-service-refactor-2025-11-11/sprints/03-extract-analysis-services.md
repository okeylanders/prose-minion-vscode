# Sprint 03: Extract Analysis Services

**Status**: ✅ COMPLETE
**Actual Effort**: ~2 hours
**Risk Level**: Medium
**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`
**Commits**: 12f6ef0, e722a8e
**Completion Date**: 2025-11-13
**All Tests**: ✅ PASSED

---

## Goal

Extract AI-powered analysis services (dialogue, prose, dictionary, context) that wrap assistant tools and handle AI orchestration.

---

## Scope

### Services to Create

1. **AssistantToolService** (~120-150 lines)
   - Wrap DialogueMicrobeatAssistant and ProseAssistant
   - Handle AI orchestration for both assistants
   - Extract from lines 254-290 + 292-322

2. **DictionaryService** (~80-100 lines)
   - Wrap DictionaryUtility
   - Handle dictionary lookups with AI orchestration
   - Extract from lines 616-649

3. **ContextAssistantService** (~100-120 lines)
   - Wrap ContextAssistant
   - Handle context generation with resource providers
   - Extract from lines 651-719

### Files to Create

```
src/infrastructure/api/services/
├── analysis/
│   ├── AssistantToolService.ts
│   └── ContextAssistantService.ts
└── dictionary/
    └── DictionaryService.ts
```

---

## Tasks

- [ ] **Create AssistantToolService**
  - [ ] Define class structure and constructor
  - [ ] Inject AIResourceManager
  - [ ] Inject ResourceLoaderService
  - [ ] Instantiate DialogueMicrobeatAssistant
  - [ ] Instantiate ProseAssistant
  - [ ] Implement `analyzeDialogue(text, context, sourceUri, options)` method
  - [ ] Implement `analyzeProse(text, context, sourceUri, options)` method
  - [ ] Add JSDoc comments
  - [ ] Test dialogue analysis (all focus modes)
  - [ ] Test prose analysis (with/without craft guides)

- [ ] **Create DictionaryService**
  - [ ] Define class structure and constructor
  - [ ] Inject AIResourceManager
  - [ ] Inject ResourceLoaderService
  - [ ] Instantiate DictionaryUtility
  - [ ] Implement `lookupWord(word, contextText?)` method
  - [ ] Add JSDoc comments
  - [ ] Test dictionary lookups (with/without context)

- [ ] **Create ContextAssistantService**
  - [ ] Define class structure and constructor
  - [ ] Inject AIResourceManager
  - [ ] Inject ResourceLoaderService
  - [ ] Instantiate ContextAssistant
  - [ ] Implement `generateContext(request)` method
  - [ ] Implement `createResourceProvider(groups)` helper
  - [ ] Add JSDoc comments
  - [ ] Test context generation (with resources)
  - [ ] Test context streaming behavior

- [ ] **Update ProseAnalysisService** (Temporary)
  - [ ] Inject AssistantToolService in constructor
  - [ ] Inject DictionaryService in constructor
  - [ ] Inject ContextAssistantService in constructor
  - [ ] Replace dialogue analysis calls with AssistantToolService
  - [ ] Replace prose analysis calls with AssistantToolService
  - [ ] Replace dictionary lookup calls with DictionaryService
  - [ ] Replace context generation calls with ContextAssistantService

- [ ] **Update extension.ts**
  - [ ] Instantiate AssistantToolService
  - [ ] Instantiate DictionaryService
  - [ ] Instantiate ContextAssistantService
  - [ ] Inject services into ProseAnalysisService

- [ ] **Test All Analysis Flows**
  - [ ] Dialogue analysis with all focus modes
  - [ ] Prose analysis with craft guides
  - [ ] Dictionary lookups
  - [ ] Context generation with resources

---

## Acceptance Criteria

- [x] All 3 analysis services created and functional
- [x] Dialogue analysis works with all focus modes
- [x] Prose analysis returns correct results
- [x] Dictionary lookups function correctly
- [x] Context generation with resources works
- [x] Extension loads without errors
- [x] Manual tests pass (see testing checklist)

**Status**: All acceptance criteria met ✅

---

## Critical Preservation Requirements

### AssistantToolService

**Must preserve exact behavior**:
- Orchestrator retrieval via AIResourceManager
- Prompt loading via ResourceLoaderService
- Focus mode handling (dialogue, microbeats, both)
- Craft guides integration
- Source file URI handling

### ContextAssistantService

**Must preserve exact behavior**:
- Resource provider creation
- Context path group handling
- Streaming behavior
- Conversation management

---

## Testing Checklist

### Manual Tests (After Sprint)

1. **Dialogue Analysis**:
   - [ ] Focus: dialogue only
   - [ ] Focus: microbeats only
   - [ ] Focus: both (default)
   - [ ] With context text
   - [ ] Without context text
   - [ ] With source file URI
   - [ ] Results display correctly

2. **Prose Analysis**:
   - [ ] With craft guides enabled
   - [ ] With craft guides disabled
   - [ ] With context text
   - [ ] Without context text
   - [ ] Results display correctly

3. **Dictionary**:
   - [ ] Word lookup with context
   - [ ] Word lookup without context
   - [ ] Multiple word lookups in sequence
   - [ ] Results display correctly

4. **Context Generation**:
   - [ ] With file resources
   - [ ] With glob resources
   - [ ] With existing context
   - [ ] Streaming behavior works
   - [ ] Resource pills clickable
   - [ ] Results display correctly

---

## Implementation Notes

### AssistantToolService

Wrap both assistants:
```typescript
export class AssistantToolService {
  private dialogueAssistant: DialogueMicrobeatAssistant;
  private proseAssistant: ProseAssistant;

  constructor(
    private aiResourceManager: AIResourceManager,
    private resourceLoader: ResourceLoaderService
  ) {
    const orchestrator = aiResourceManager.getOrchestrator('assistant');
    const promptLoader = resourceLoader.getPromptLoader();
    const guideRegistry = resourceLoader.getGuideRegistry();

    this.dialogueAssistant = new DialogueMicrobeatAssistant(
      orchestrator,
      promptLoader,
      guideRegistry
    );

    this.proseAssistant = new ProseAssistant(
      orchestrator,
      promptLoader,
      guideRegistry
    );
  }

  async analyzeDialogue(text, context, sourceUri, options) {
    return this.dialogueAssistant.analyze({ text, context, sourceUri }, options);
  }

  async analyzeProse(text, context, sourceUri, options) {
    return this.proseAssistant.analyze({ text, context, sourceUri }, options);
  }
}
```

### ContextAssistantService

Handle resource providers:
```typescript
export class ContextAssistantService {
  private contextAssistant: ContextAssistant;

  constructor(
    private aiResourceManager: AIResourceManager,
    private resourceLoader: ResourceLoaderService
  ) {
    const orchestrator = aiResourceManager.getOrchestrator('context');
    const promptLoader = resourceLoader.getPromptLoader();

    this.contextAssistant = new ContextAssistant(orchestrator, promptLoader);
  }

  async generateContext(request: ContextGenerationRequest) {
    const resourceProvider = await this.createResourceProvider(request.contextPathGroups);
    return this.contextAssistant.generateContext({
      ...request,
      resourceProvider
    });
  }

  private async createResourceProvider(groups: ContextPathGroup[]) {
    // Create ContextResourceResolver and provider
    // ...
  }
}
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI orchestration breaks | Low | High | Test all analysis tools, careful extraction |
| Focus mode handling breaks | Low | Medium | Test all focus modes (dialogue, microbeats, both) |
| Context resource provider breaks | Low | Medium | Test context generation with resources |
| Craft guides integration breaks | Low | Medium | Test prose analysis with guides on/off |

---

## Definition of Done

- [x] All 3 analysis services created with JSDoc comments
- [x] ProseAnalysisService uses new services
- [x] All analysis flows work identically
- [x] All manual tests pass
- [x] No errors in Output Channel
- [x] Extension loads without errors
- [x] Git commit with clear message
- [x] Memory bank entry created

---

## Sprint Outcomes

### Services Created ✅
1. **AssistantToolService** (203 lines) - Wraps DialogueMicrobeatAssistant and ProseAssistant
2. **DictionaryService** (139 lines) - Wraps DictionaryUtility
3. **ContextAssistantService** (205 lines) - Wraps ContextAssistant with resource providers

### ProseAnalysisService Reduction ✅
- **Before**: 711 lines (after Sprint 02)
- **After**: 492 lines
- **Reduction**: **-219 lines (30.8% reduction!)**
- **Cumulative**: 868 → 492 lines (**-376 lines, 43.3% total reduction**)

### Testing Results ✅
All manual tests passed:
- ✅ Extension loads without errors
- ✅ Build succeeds with no TypeScript errors
- ✅ Development build marker shows "SPRINT 03"
- ✅ All analysis tools work correctly (dialogue, prose, dictionary, context)
- ✅ All focus modes work (dialogue only, microbeats only, both)
- ✅ Craft guides integration works
- ✅ Resource provider integration works

### Key Achievements
- ✅ Thin wrapper pattern applied consistently across all analysis services
- ✅ All analysis methods reduced to simple 3-line delegations
- ✅ Removed unused code (getApiKeyWarning, secretsService parameter)
- ✅ Build succeeded on first try (no TypeScript errors)
- ✅ No breaking changes (all functionality preserved)

### Memory Bank Entry
- [20251113-2110-sprint-03-analysis-services-complete.md](../../../.memory-bank/20251113-2110-sprint-03-analysis-services-complete.md)

---

## Previous Sprint

[Sprint 02: Create Measurement Service Wrappers](02-create-measurement-service-wrappers.md)

## Next Sprint

[Sprint 04: Extract Search Service](04-extract-search-service.md)

---

**Created**: 2025-11-11
**Completed**: 2025-11-13
**Status**: ✅ COMPLETE
**All Tests**: ✅ PASSED
**ADR**: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../../docs/adr/2025-11-11-prose-analysis-service-refactor.md#phase-3-extract-analysis-services-medium-risk)
