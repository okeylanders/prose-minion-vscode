# Sprint 01: Extract Resource Services

**Status**: Ready to Start
**Estimated Effort**: 2-3 hours
**Risk Level**: Low
**Branch**: `sprint/epic-prose-analysis-service-refactor-2025-11-11-01-resource-services`

---

## Goal

Extract foundational resource services that other services depend on. These services manage prompts, guides, configuration, AI resources, and publishing standards.

---

## Scope

### Services to Create

1. **ResourceLoaderService** (~100-120 lines)
   - Load and manage prompts, guides, and guide registry
   - Lazy initialization pattern
   - Extract from lines 196-208

2. **ToolOptionsProvider** (~60-80 lines)
   - Centralize configuration option retrieval
   - Extract from lines 244-252 + scattered config calls

3. **AIResourceManager** (~200-250 lines)
   - Manage OpenRouterClient and AIResourceOrchestrator lifecycle per model scope
   - Extract from lines 83-165 + 190-242
   - **Critical**: Most complex service, handles entire AI resource lifecycle

4. **StandardsService** (~120-150 lines)
   - Publishing standards comparison and enrichment
   - Extract from lines 350-366 + 511-577

### Files to Create

```
src/infrastructure/api/services/
├── resources/
│   ├── AIResourceManager.ts
│   ├── ResourceLoaderService.ts
│   └── StandardsService.ts
└── shared/
    └── ToolOptionsProvider.ts
```

---

## Tasks

- [ ] **Create ResourceLoaderService**
  - [ ] Define class structure and constructor
  - [ ] Implement `getPromptLoader()` method
  - [ ] Implement `getGuideLoader()` method
  - [ ] Implement `getGuideRegistry()` method
  - [ ] Implement `ensureLoaded()` lazy initialization
  - [ ] Add JSDoc comments
  - [ ] Test prompt/guide loading

- [ ] **Create ToolOptionsProvider**
  - [ ] Define class structure
  - [ ] Implement `getOptions(focus?)` method
  - [ ] Implement `getWordSearchOptions()` method
  - [ ] Implement `getWordFrequencyOptions()` method
  - [ ] Add JSDoc comments
  - [ ] Test configuration retrieval

- [ ] **Create AIResourceManager** (CRITICAL)
  - [ ] Define class structure and constructor
  - [ ] Implement `initializeResources(apiKey, modelConfig)` method
  - [ ] Implement `getOrchestrator(scope)` method
  - [ ] Implement `refreshConfiguration()` method
  - [ ] Implement `setStatusCallback(callback)` method
  - [ ] Implement `dispose()` method
  - [ ] Implement scope-based resource bundling
  - [ ] Implement model fallback logic
  - [ ] Add JSDoc comments
  - [ ] Test AI resource lifecycle
  - [ ] Test model scope resolution

- [ ] **Create StandardsService**
  - [ ] Define class structure and constructor
  - [ ] Implement `enrichWithStandards(stats)` method
  - [ ] Implement `computePerFileStats(paths, proseStatsService)` method
  - [ ] Implement `findGenre(preset)` method
  - [ ] Add JSDoc comments
  - [ ] Test standards enrichment

- [ ] **Update ProseAnalysisService** (Temporary)
  - [ ] Inject ResourceLoaderService in constructor
  - [ ] Inject ToolOptionsProvider in constructor
  - [ ] Inject AIResourceManager in constructor
  - [ ] Inject StandardsService in constructor
  - [ ] Replace direct resource loading with service calls
  - [ ] Replace direct config retrieval with ToolOptionsProvider
  - [ ] Replace AI resource management with AIResourceManager
  - [ ] Replace standards enrichment with StandardsService

- [ ] **Update extension.ts**
  - [ ] Instantiate ResourceLoaderService
  - [ ] Instantiate ToolOptionsProvider
  - [ ] Instantiate AIResourceManager
  - [ ] Instantiate StandardsService
  - [ ] Inject services into ProseAnalysisService

- [ ] **Test All Functionality**
  - [ ] Extension loads without errors
  - [ ] All analysis tools work (dialogue, prose, dictionary, context)
  - [ ] All metrics tools work (prose stats, style flags, word frequency)
  - [ ] Word search works
  - [ ] Publishing standards comparison works
  - [ ] Model switching works
  - [ ] Configuration changes work

---

## Acceptance Criteria

- [ ] All 4 resource services created and functional
- [ ] ProseAnalysisService uses new services (line count reduced ~200 lines)
- [ ] All existing functionality preserved
- [ ] Extension loads without errors
- [ ] Manual tests pass (see testing checklist)
- [ ] No console errors or warnings
- [ ] Output channel shows expected logging

---

## Critical Preservation Requirements

### AIResourceManager Behavior

**Must preserve exact behavior**:
- Model scope resolution (assistant, dictionary, context) identical
- Fallback logic preserved (fallback to `model` setting)
- Resource lifecycle (initialization, refresh, disposal) unchanged
- StatusCallback propagation maintained
- Resolved models tracking unchanged

### StandardsService Behavior

**Must preserve exact behavior**:
- Standards comparison logic identical
- Per-file stats computation unchanged
- Genre lookup unchanged

---

## Testing Checklist

### Manual Tests (After Sprint)

1. **Analysis Tools**:
   - [ ] Dialogue analysis with all focus modes
   - [ ] Prose analysis with craft guides
   - [ ] Analysis with and without context text
   - [ ] Dictionary lookups with context

2. **Metrics Tools**:
   - [ ] Prose stats on selection, file, manuscript
   - [ ] Style flags detection
   - [ ] Word frequency with all options
   - [ ] Publishing standards comparison
   - [ ] Multi-file chapter aggregation

3. **Context**:
   - [ ] Context generation with resources
   - [ ] Context streaming behavior

4. **Search**:
   - [ ] Word search on selection, files, manuscript

5. **Configuration**:
   - [ ] Model switching (assistant, dictionary, context)
   - [ ] API key changes
   - [ ] Settings updates
   - [ ] Configuration refresh

---

## Implementation Notes

### ResourceLoaderService

Extract lazy initialization pattern:
```typescript
private ensureLoaded() {
  if (!this.promptLoader) {
    this.promptLoader = new PromptLoader(this.extensionUri, this.outputChannel);
  }
  if (!this.guideLoader) {
    this.guideLoader = new GuideLoader(this.extensionUri, this.outputChannel);
  }
  if (!this.guideRegistry) {
    this.guideRegistry = new GuideRegistry(this.guideLoader);
  }
}
```

### AIResourceManager (Most Critical)

Preserve exact lifecycle:
```typescript
// Scope-based resource bundling
private resources: Map<ModelScope, AIResourceBundle>;

// Model fallback logic
private resolveModel(scope: ModelScope): string {
  const config = vscode.workspace.getConfiguration('proseMinion');
  return config.get(`${scope}Model`) || config.get('model') || 'anthropic/claude-3-5-sonnet';
}
```

### ToolOptionsProvider

Centralize configuration retrieval:
```typescript
getOptions(focus?: 'dialogue' | 'microbeats' | 'both'): ToolOptions {
  const config = vscode.workspace.getConfiguration('proseMinion');
  return {
    temperature: config.get('temperature', 1.0),
    maxTokens: config.get('maxTokens', 10000),
    includeCraftGuides: config.get('includeCraftGuides', true),
    focus
  };
}
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AIResourceManager breaks resource lifecycle | Low | High | Test all analysis tools, careful extraction |
| Configuration changes break | Low | Medium | Test model switching, settings updates |
| Standards enrichment breaks | Low | Medium | Test prose stats with standards comparison |
| Performance regression | Very Low | Low | Services are lightweight wrappers |

---

## Definition of Done

- [ ] All 4 services created with JSDoc comments
- [ ] ProseAnalysisService uses new services
- [ ] Line count reduced by ~200 lines
- [ ] All manual tests pass
- [ ] No errors in Output Channel
- [ ] Extension loads without errors
- [ ] Git commit with clear message
- [ ] Memory bank entry created

---

## Next Sprint

[Sprint 02: Create Measurement Service Wrappers](02-create-measurement-service-wrappers.md)

---

**Created**: 2025-11-11
**Status**: Ready to Start
**ADR**: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../../docs/adr/2025-11-11-prose-analysis-service-refactor.md#phase-1-extract-resource-services-low-risk)
