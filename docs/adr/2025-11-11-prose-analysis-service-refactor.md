# ADR: ProseAnalysisService Domain Services Architecture

Status: Proposed
Date: 2025-11-11
Supersedes: None
Related: ADR-2025-10-26 (MessageHandler), ADR-2025-10-27 (Presentation Layer)

## Context

### Current State: God Component Anti-Pattern

`ProseAnalysisService.ts` has grown to **916 lines** with **9+ distinct responsibilities**, making it the last remaining god component in the codebase. This represents a critical architectural debt that blocks clean implementation of new features like Context Search.

**File**: `src/infrastructure/api/ProseAnalysisService.ts`
**Lines**: 916
**Methods**: 20+ (public and private)
**Dependencies**: 15+ imports

### Identified Responsibilities

1. **AI Tool Lifecycle Management** (~150 lines)
   - DialogueMicrobeatAssistant initialization
   - ProseAssistant initialization
   - DictionaryUtility initialization
   - ContextAssistant initialization
   - Tool disposal and cleanup

2. **Measurement Tool Management** (~50 lines)
   - PassageProseStats instantiation
   - StyleFlags instantiation
   - WordFrequency instantiation

3. **AI Resource Orchestration** (~180 lines)
   - OpenRouterClient creation per model scope
   - AIResourceOrchestrator management
   - ConversationManager lifecycle
   - Model fallback logic (assistantModel, dictionaryModel, contextModel)
   - Scope-based resource bundling

4. **Configuration Management** (~80 lines)
   - API key retrieval (SecretStorage + settings fallback)
   - Model selection resolution
   - Tool options retrieval (temperature, maxTokens, includeCraftGuides)
   - Configuration refresh

5. **Resource Loading** (~60 lines)
   - PromptLoader initialization
   - GuideLoader initialization
   - GuideRegistry management
   - PublishingStandardsRepository loading

6. **Analysis Service Methods** (~120 lines)
   - `analyzeDialogue()` - Dialogue microbeat analysis
   - `analyzeProse()` - Prose assistant analysis
   - `lookupDictionary()` - Word definitions and context
   - `generateContext()` - Context generation with resources

7. **Metrics Service Methods** (~100 lines)
   - `measureProseStats()` - Word count, sentences, pacing
   - `measureStyleFlags()` - Style pattern detection
   - `measureWordFrequency()` - Word usage analysis

8. **Word Search Implementation** (~200+ lines)
   - `measureWordSearch()` - Main search method
   - 12 helper functions (prepareTargets, tokenizeContent, findOccurrences, detectClusters, etc.)
   - File reading and text processing

9. **Publishing Standards Integration** (~60 lines)
   - `enrichWithStandards()` - Standards comparison
   - Per-file stats computation
   - Genre-based enrichment

### Current Pain Points

#### 1. **Tight Coupling**
- All tools depend on shared PromptLoader/GuideLoader/GuideRegistry
- AI resource lifecycle tied to all assistant tools
- Configuration changes require full service reinitialization

#### 2. **Hard to Test**
- Cannot test individual tools in isolation
- Mock setup requires entire service dependency tree
- Integration tests expensive (916 lines of setup)

#### 3. **Hard to Extend**
- Adding Context Search would add ~150 lines to already-bloated file
- No clear place for new semantic search features
- Risk of further entangling responsibilities

#### 4. **Poor Single Responsibility Principle**
- Service has **9 reasons to change** (one per responsibility)
- Violates SOLID principles
- Maintenance nightmare as complexity grows

#### 5. **Inconsistent Architecture**
- Backend handlers organized by domain (AnalysisHandler, MetricsHandler, etc.)
- Frontend hooks organized by domain (useAnalysis, useMetrics, etc.)
- **ProseAnalysisService is monolithic** - doesn't match architectural patterns

### Why Refactor Now?

1. **Last Major Architectural Debt** - ProseAnalysisService is the final god component
2. **Blocks Clean Feature Implementation** - Context Search requires semantic matching infrastructure
3. **Proven Pattern Exists** - Successfully refactored MessageHandler (1091→495 lines) and App.tsx (697→394 lines)
4. **Alpha Development Freedom** - No backward compatibility required, can break cleanly
5. **Token Budget Savings** - Refactor now saves 3-5 hours vs. untangling later

## Decision

Refactor ProseAnalysisService into **domain-specific services** following the Facade pattern, with the main service acting as a lightweight orchestrator delegating to focused domain services.

### Proposed Architecture

```
src/infrastructure/api/
├── ProseAnalysisService.ts              # Facade (~150-200 lines)
│   - Implements IProseAnalysisService
│   - Delegates to domain services
│   - Minimal orchestration logic
│
└── services/
    ├── analysis/
    │   ├── AssistantToolService.ts       # Dialogue + Prose assistants
    │   └── ContextAssistantService.ts    # Context generation
    │
    ├── measurement/
    │   # No facade needed - tools injected directly into ProseAnalysisService
    │   # PassageProseStats, StyleFlags, WordFrequency are already focused classes
    │
    ├── search/
    │   ├── WordSearchService.ts          # Current word search logic
    │   └── ContextSearchService.ts       # NEW: Semantic search (future)
    │
    ├── dictionary/
    │   └── DictionaryService.ts          # Dictionary utility wrapper
    │
    ├── resources/
    │   ├── AIResourceManager.ts          # OpenRouterClient + orchestrator lifecycle
    │   ├── ResourceLoaderService.ts      # Prompts, guides, registry
    │   └── StandardsService.ts           # Publishing standards
    │
    └── shared/
        └── ToolOptionsProvider.ts        # Configuration helper
```

### Service Responsibilities

#### 1. **ProseAnalysisService (Facade)** (~150-200 lines)
**Single Responsibility**: Orchestrate domain services to implement IProseAnalysisService

```typescript
export class ProseAnalysisService implements IProseAnalysisService {
  constructor(
    private readonly assistantTools: AssistantToolService,
    private readonly contextAssistant: ContextAssistantService,
    private readonly proseStats: PassageProseStats,      // Direct injection
    private readonly styleFlags: StyleFlags,              // Direct injection
    private readonly wordFrequency: WordFrequency,        // Direct injection
    private readonly wordSearch: WordSearchService,
    private readonly dictionary: DictionaryService,
    private readonly standards: StandardsService,
    private readonly aiResources: AIResourceManager,
    private readonly toolOptions: ToolOptionsProvider
  ) {}

  async analyzeDialogue(text: string, contextText?: string, sourceFileUri?: string, focus?: 'dialogue' | 'microbeats' | 'both'): Promise<AnalysisResult> {
    const options = this.toolOptions.getOptions(focus);
    return this.assistantTools.analyzeDialogue(text, contextText, sourceFileUri, options);
  }

  async measureProseStats(text: string, files?: string[], sourceMode?: string): Promise<MetricsResult> {
    const stats = this.proseStats.analyze({ text });

    // Multi-file aggregation (ProseStats-specific)
    if (files?.length && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
      const perFileStats = await this.standards.computePerFileStats(files, this.proseStats);
      Object.assign(stats, perFileStats); // Aggregate chapter data
    }

    // Standards enrichment
    const enriched = await this.standards.enrichWithStandards(stats);
    return AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
  }

  async measureStyleFlags(text: string): Promise<MetricsResult> {
    const flags = this.styleFlags.analyze({ text });
    return AnalysisResultFactory.createMetricsResult('style_flags', flags);
  }

  async measureWordFrequency(text: string): Promise<MetricsResult> {
    const options = this.toolOptions.getWordFrequencyOptions();
    const frequency = this.wordFrequency.analyze({ text }, options);
    return AnalysisResultFactory.createMetricsResult('word_frequency', frequency);
  }

  // ... delegate all other methods
}
```

**Benefits**:
- Clear delegation pattern
- Easy to unit test (mock domain services)
- Each method 3-5 lines (delegate + error handling)

---

#### 2. **AssistantToolService** (~120-150 lines)
**Single Responsibility**: Manage dialogue and prose assistant tools

**Methods**:
- `analyzeDialogue(text, context, sourceUri, options): Promise<AnalysisResult>`
- `analyzeProse(text, context, sourceUri, options): Promise<AnalysisResult>`

**Dependencies**:
- AIResourceManager (for orchestrator)
- ResourceLoaderService (for prompts)

**Extracts**: Lines 254-290 + 292-322 from current PAS

---

#### 3. **ContextAssistantService** (~100-120 lines)
**Single Responsibility**: Handle context generation with resource providers

**Methods**:
- `generateContext(request: ContextGenerationRequest): Promise<ContextGenerationResult>`
- `createResourceProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider>`

**Dependencies**:
- AIResourceManager (for orchestrator)
- ContextResourceResolver
- ResourceLoaderService (for prompts)

**Extracts**: Lines 651-719 from current PAS

---

#### 4. **Measurement Tools** (No Service Wrapper Needed)

**Decision**: PassageProseStats, StyleFlags, and WordFrequency are **already focused service classes** with no shared orchestration. They will be injected **directly** into ProseAnalysisService.

**Rationale**:

- No shared state between the three tools
- No coordination needed (they don't interact)
- No shared initialization logic
- Adding a facade would be an extra layer with no value (pure delegation)
- YAGNI - You Aren't Gonna Need It

**See**: "Appendix A: MeasurementToolService Facade Analysis" at end of this document for detailed reasoning.

---

#### 5. **WordSearchService** (~250-300 lines)
**Single Responsibility**: Deterministic word search across files and text

**Methods**:
- `searchWords(text, files?, sourceMode?, options?): Promise<any>`
- Private helpers: prepareTargets, tokenizeContent, findOccurrences, detectClusters, etc.

**Dependencies**:
- VSCode workspace API (for file reading)
- ToolOptionsProvider (for default settings)

**Extracts**: Lines 372-494 + 740-916 (helper functions) from current PAS

**Future Addition**: ContextSearchService will live alongside this for semantic matching

---

#### 6. **DictionaryService** (~80-100 lines)
**Single Responsibility**: Dictionary word lookups with context

**Methods**:
- `lookupWord(word, contextText?): Promise<AnalysisResult>`

**Dependencies**:
- AIResourceManager (for orchestrator)
- ResourceLoaderService (for prompts)

**Extracts**: Lines 616-649 from current PAS

---

#### 7. **AIResourceManager** (~200-250 lines)
**Single Responsibility**: Manage OpenRouterClient and AIResourceOrchestrator lifecycle per model scope

**Methods**:
- `initializeResources(apiKey, modelConfig): Promise<void>`
- `getOrchestrator(scope: ModelScope): AIResourceOrchestrator | undefined`
- `refreshConfiguration(): Promise<void>`
- `setStatusCallback(callback: StatusCallback): void`
- `dispose(): void`

**State**:
- Map of scope → AIResourceBundle (client + orchestrator)
- Resolved model selections

**Dependencies**:
- OpenRouterClient
- AIResourceOrchestrator
- ConversationManager
- ResourceLoaderService (for guide registry)

**Extracts**: Lines 83-165 + 190-242 from current PAS

**Critical**: This service handles the complex lifecycle and scope-based resource management

---

#### 8. **ResourceLoaderService** (~100-120 lines)
**Single Responsibility**: Load and manage prompts, guides, and guide registry

**Methods**:
- `getPromptLoader(): PromptLoader`
- `getGuideLoader(): GuideLoader`
- `getGuideRegistry(): GuideRegistry`
- `ensureLoaded(): void`

**Dependencies**:
- VSCode extension URI
- OutputChannel (optional)

**Extracts**: Lines 196-208 from current PAS

**Note**: Lazy initialization pattern

---

#### 9. **StandardsService** (~120-150 lines)
**Single Responsibility**: Publishing standards comparison and enrichment

**Methods**:
- `enrichWithStandards(stats: any): Promise<any>`
- `computePerFileStats(relativePaths: string[]): Promise<any[]>`
- `findGenre(preset: string): Promise<Genre | undefined>`

**Dependencies**:
- PublishingStandardsRepository
- StandardsComparisonService
- VSCode workspace API (for file reading)

**Extracts**: Lines 350-366 + 511-577 from current PAS

---

#### 10. **ToolOptionsProvider** (~60-80 lines)
**Single Responsibility**: Centralize configuration option retrieval

**Methods**:
- `getOptions(focus?: 'dialogue' | 'microbeats' | 'both'): ToolOptions`
- `getWordSearchOptions(): WordSearchOptions`
- `getWordFrequencyOptions(): WordFrequencyOptions`

**Dependencies**:
- VSCode configuration API

**Extracts**: Lines 244-252 + scattered config calls throughout PAS

**Benefits**:
- Single source of truth for configuration defaults
- Easy to test configuration logic
- Reduces code duplication

---

### Dependency Injection Architecture

```typescript
// Extension activation (extension.ts)
export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Prose Minion');
  const secretsService = new SecretStorageService(context.secrets);

  // Resource services
  const resourceLoader = new ResourceLoaderService(context.extensionUri, outputChannel);
  const aiResourceManager = new AIResourceManager(resourceLoader, secretsService, outputChannel);
  const toolOptions = new ToolOptionsProvider();
  const standards = new StandardsService(context.extensionUri, outputChannel);

  // Domain services
  const assistantTools = new AssistantToolService(aiResourceManager, resourceLoader);
  const contextAssistant = new ContextAssistantService(aiResourceManager, resourceLoader);
  const wordSearch = new WordSearchService(toolOptions, outputChannel);
  const dictionary = new DictionaryService(aiResourceManager, resourceLoader);

  // Measurement tools (no facade needed - inject directly)
  const proseStats = new PassageProseStats();
  const styleFlags = new StyleFlags();
  const wordFrequency = new WordFrequency((msg) => outputChannel.appendLine(msg));

  // Facade
  const proseAnalysisService = new ProseAnalysisService(
    assistantTools,
    contextAssistant,
    proseStats,      // Direct injection
    styleFlags,      // Direct injection
    wordFrequency,   // Direct injection
    wordSearch,
    dictionary,
    standards,
    aiResourceManager,
    toolOptions
  );

  // Rest of activation...
}
```

**Benefits**:
- Explicit dependency tree
- Easy to unit test (mock individual dependencies)
- Clear service boundaries
- Services can be reused independently

---

## Anti-Patterns to Avoid

### 1. **God Service → Multiple God Services**
**Risk**: Each domain service becomes a mini god component

**Mitigation**:
- Each service has **exactly one responsibility**
- Line count cap: Services < 300 lines (except WordSearchService due to helpers)
- If service grows, extract further (but avoid facades with no orchestration value)

### 2. **Circular Dependencies**
**Risk**: Services depend on each other in cycles

**Mitigation**:
- Dependency graph flows **inward** (services → resources → infrastructure)
- Shared dependencies injected via constructor
- No service-to-service calls (only through facade if needed)

### 3. **Shared Mutable State**
**Risk**: Services share global state leading to race conditions

**Mitigation**:
- AIResourceManager owns all AI resource lifecycle (single source of truth)
- Each service is stateless except for injected dependencies
- Configuration changes flow through facade → AIResourceManager → services

### 4. **Leaky Abstractions**
**Risk**: Services expose internal implementation details

**Mitigation**:
- Each service has clear public interface (3-5 methods max)
- Internal helpers are private
- Return types use domain models (AnalysisResult, MetricsResult), not implementation types

### 5. **Facade Becomes God Component**
**Risk**: ProseAnalysisService facade accumulates logic instead of delegating

**Mitigation**:
- Facade methods are **delegation only** (3-5 lines each)
- No business logic in facade (only orchestration)
- If method > 10 lines, logic belongs in domain service

---

## Migration Strategy

### Phase 1: Extract Resource Services (Low Risk)
**Goal**: Extract foundational services that other services depend on

**Tasks**:
1. Create `ResourceLoaderService` (prompts, guides, registry)
2. Create `ToolOptionsProvider` (configuration helper)
3. Create `AIResourceManager` (OpenRouter + orchestrator lifecycle)
4. Update ProseAnalysisService to use these services
5. Test all existing functionality

**Acceptance Criteria**:
- All tests pass
- Extension loads without errors
- ProseAnalysisService line count reduced ~200 lines

**Estimated Effort**: 2-3 hours

---

### Phase 2: Inject Measurement Tools Directly (Low Risk)

**Goal**: Inject measurement tools directly (no facade needed)

**Tasks**:

1. Inject PassageProseStats, StyleFlags, WordFrequency directly into ProseAnalysisService constructor
2. Update ProseAnalysisService measurement methods to use injected tools
3. Move `computePerFileStats` to StandardsService
4. Test all metrics tools (Prose Stats, Style Flags, Word Frequency)

**Acceptance Criteria**:
- All measurement tools work identically
- Metrics tab shows correct results
- ProseAnalysisService line count reduced ~150 lines

**Estimated Effort**: 1-2 hours

---

### Phase 3: Extract Analysis Services (Medium Risk)
**Goal**: Extract AI-powered analysis tools

**Tasks**:
1. Create `AssistantToolService` (dialogue + prose)
2. Create `DictionaryService` (word lookups)
3. Create `ContextAssistantService` (context generation)
4. Update ProseAnalysisService to delegate analysis methods
5. Test all analysis flows

**Acceptance Criteria**:
- Dialogue analysis works with all focus modes
- Prose analysis returns correct results
- Dictionary lookups function correctly
- Context generation with resources works

**Estimated Effort**: 2-3 hours

---

### Phase 4: Extract Search Services (Medium Risk)
**Goal**: Extract word search logic (heaviest method)

**Tasks**:
1. Create `WordSearchService` with all helper functions
2. Move 200+ lines of search logic
3. Update ProseAnalysisService to delegate
4. Test word search across selection, files, manuscript modes

**Acceptance Criteria**:
- Word search returns identical results
- Search tab functions correctly
- Cluster detection works as expected
- ProseAnalysisService line count reduced ~250 lines

**Estimated Effort**: 2-3 hours

---

### Phase 5: Extract Standards Service (Low Risk)
**Goal**: Extract publishing standards integration

**Tasks**:
1. Create `StandardsService` (enrichment + per-file stats)
2. Update ProseAnalysisService to delegate
3. Test prose stats with publishing standards comparison

**Acceptance Criteria**:
- Standards comparison works for all genres
- Per-file stats aggregation correct
- Publishing format details accurate

**Estimated Effort**: 1-2 hours

---

### Phase 6: Finalize Facade (Low Risk)
**Goal**: Reduce ProseAnalysisService to pure delegation

**Tasks**:
1. Review facade for any remaining logic
2. Extract to services if found
3. Verify ProseAnalysisService ~150-200 lines
4. Add comprehensive JSDoc comments
5. Update ARCHITECTURE.md

**Acceptance Criteria**:
- ProseAnalysisService is pure delegation (no business logic)
- All public methods delegate to domain services
- Line count: 916 → ~150-200 (83% reduction)
- Architecture documentation updated

**Estimated Effort**: 1 hour

---

## Testing Strategy

### Manual Testing After Each Phase
- Launch Extension Development Host
- Test affected tools/methods
- Verify persistence works
- Check Output Channel for errors

### Critical Test Cases
1. **Analysis**:
   - Dialogue analysis with all focus modes
   - Prose analysis with craft guides
   - Analysis with and without context text

2. **Metrics**:
   - Prose stats on selection, file, manuscript
   - Style flags detection
   - Word frequency with all options
   - Publishing standards comparison

3. **Dictionary**:
   - Word lookup with context
   - Word lookup without context

4. **Context**:
   - Context generation with resources
   - Context with existing context
   - Context streaming behavior

5. **Search**:
   - Word search on selection
   - Word search on files
   - Cluster detection
   - Case sensitivity toggle

6. **Configuration**:
   - Model switching (assistant, dictionary, context)
   - API key changes
   - Settings updates
   - Configuration refresh

### Regression Testing
- All existing manual tests from previous sprints
- Token tracking still works
- Settings overlay functions correctly
- Tab switching preserves state

---

## Alternatives Considered

### 1. Keep ProseAnalysisService as God Component
**Rejected** - Maintainability continues to degrade, blocks clean feature implementation, violates architectural principles established in MessageHandler and App.tsx refactors.

### 2. Split by Tool Type Only (Assist vs Measure)
**Rejected** - Still creates large services with multiple responsibilities. Doesn't align with domain-driven organization.

### 3. Use Dependency Injection Framework (InversifyJS, TSyringe)
**Rejected** - Overkill for current needs. Manual DI in extension.ts is explicit and easier to understand. May revisit for v1.0.

### 4. Implement Services as Singletons
**Rejected** - Singletons hide dependencies and make testing harder. Constructor injection is clearer and more testable.

### 5. Keep All Logic in ProseAnalysisService, Create Helpers
**Rejected** - Helper functions don't solve the god component problem. Need true separation of concerns with independent services.

---

## Consequences

### Positive ✅

1. **Clean Architecture Achieved**
   - Last god component eliminated
   - Consistent domain organization across backend, frontend, infrastructure
   - SOLID principles followed throughout codebase

2. **Maintainability Improved**
   - ProseAnalysisService: 916 → ~150-200 lines (83% reduction)
   - Each service < 300 lines with single responsibility
   - Easy to locate and modify specific functionality

3. **Testability Improved**
   - Services can be unit tested in isolation
   - Clear dependency injection makes mocking easy
   - Integration tests simpler (test facade + mocked services)

4. **Extensibility Improved**
   - Context Search can be added as clean SearchService sibling
   - New measurement tools easy to add (inject directly, no facade needed)
   - New AI tools easy to add to AssistantToolService

5. **Code Navigation Improved**
   - Find analysis logic → AssistantToolService
   - Find measurement logic → PassageProseStats, StyleFlags, WordFrequency
   - Find search logic → WordSearchService
   - Clear mental model

6. **Reduced Coupling**
   - Services depend on abstractions, not concretions
   - Changes to one service don't cascade to others
   - Resource lifecycle isolated in AIResourceManager

### Neutral ⚖️

1. **More Files to Navigate**
   - 1 file → ~10 files
   - But: Better organized, easier to find specific logic

2. **Dependency Injection Complexity**
   - extension.ts activation becomes longer
   - But: Explicit dependencies easier to understand than implicit ones

3. **Learning Curve**
   - New contributors need to understand service organization
   - But: Mirrors backend handler architecture (consistent pattern)

### Risks & Mitigations ⚠️

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing functionality | Medium | High | Test after each phase, manual testing checklist |
| Introducing circular dependencies | Low | Medium | Strict dependency graph, code review |
| Services become mini god components | Low | Medium | Line count caps, single responsibility review |
| Performance degradation | Very Low | Low | Services are lightweight delegates, no overhead |
| Increased memory usage | Very Low | Very Low | Services hold no state beyond dependencies |

---

## Success Metrics

| Metric | Before | Target | Success Criteria |
|--------|--------|--------|------------------|
| ProseAnalysisService lines | 916 | 150-200 | ✅ 83% reduction |
| Service responsibilities | 9+ | 1 per service | ✅ Single responsibility |
| Largest service file | 916 | < 300 | ✅ All focused |
| God components | 1 | 0 | ✅ Eliminated |
| Test coverage | Minimal | Unit tests per service | ✅ Improved testability |
| Architecture consistency | Inconsistent | Mirrors backend | ✅ Domain organization |
| Feature readiness | Blocked | Ready for Context Search | ✅ Clean extension point |

---

## Implementation Notes

### Critical Preservation Requirements

1. **Preserve Resource Lifecycle**
   - AIResourceManager must maintain exact same lifecycle as current PAS
   - Model scope resolution (assistant, dictionary, context) identical
   - Fallback logic preserved (fallback to `model` setting)

2. **Preserve Configuration Behavior**
   - Tool options retrieval exactly matches current logic
   - Settings defaults unchanged
   - API key migration path (SecretStorage → settings fallback) preserved

3. **Preserve Error Handling**
   - API key warning message unchanged
   - Error result wrapping identical
   - Output channel logging preserved

4. **Preserve State Management**
   - StatusCallback propagation maintained
   - Resolved models tracking unchanged
   - Resource disposal on configuration refresh identical

### Code Quality Standards

- **TypeScript**: Strict typing throughout, no `any` except pragmatic cases (document rationale)
- **Error Handling**: Try/catch with fallbacks, clear error messages
- **Logging**: Output channel logging for debugging and transparency
- **Comments**: JSDoc for public methods, inline comments for complex logic
- **Naming**: Clear, descriptive names following existing conventions

### Dependency Graph (Must Flow Inward)

```
ProseAnalysisService (Facade)
    ↓ depends on
Domain Services (Analysis, Measurement, Search, Dictionary)
    ↓ depends on
Resource Services (AIResourceManager, ResourceLoader, Standards, ToolOptions)
    ↓ depends on
Infrastructure (OpenRouterClient, VSCode API, File System)
```

**Rule**: No upward dependencies. Services never import from outer layers.

---

## Links & References

### Related ADRs
- [ADR-2025-10-26: Message Architecture Organization](./2025-10-26-message-architecture-organization.md) - MessageHandler refactor (god component → domain handlers)
- [ADR-2025-10-27: Presentation Layer Domain Hooks](./2025-10-27-presentation-layer-domain-hooks.md) - App.tsx refactor (god component → domain hooks)

### Memory Bank
- [Presentation Layer Architectural Review](./.memory-bank/20251102-1845-presentation-layer-architectural-review.md) - 9.8/10 score, proven pattern

### Architecture Docs
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Clean Architecture overview
- [CLAUDE.md](../.ai/central-agent-setup.md) - Agent guidance, anti-pattern guardrails

### Future Work
- Context Search implementation (blocked by this refactor)
- Additional semantic analysis tools (enabled by clean architecture)

---

## Approval Checklist

Before implementation:

- [ ] **Architecture Review**: ADR reviewed against anti-patterns (god components, circular deps, leaky abstractions)
- [ ] **Dependency Graph Validated**: No upward dependencies, clear separation of concerns
- [ ] **Service Responsibilities Defined**: Each service has exactly one responsibility
- [ ] **Migration Strategy Confirmed**: Phased approach with acceptance criteria per phase
- [ ] **Testing Plan Confirmed**: Manual testing checklist for each phase
- [ ] **Epic and Sprints Created**: Breakdown into executable sprints with time estimates
- [ ] **Branch Strategy Confirmed**: Sprint branches off main, PR per phase or combined

---

**Status**: Proposed (awaiting review and iteration)
**Next Steps**:
1. Review ADR for anti-patterns
2. Iterate on architecture if needed
3. Create epic and sprint breakdown
4. Implement Phase 1 (Resource Services)

---

## Appendix A: MeasurementToolService Facade Analysis

**Date Added**: 2025-11-11 (Post-Draft Review)
**Question**: Should we create a MeasurementToolService facade, or inject measurement tools directly?
**Decision**: **Inject directly** (no facade needed)

### Analysis: Shared Orchestration Between Measurement Tools?

We analyzed the three measurement methods to determine if a facade provides value:

#### 1. measureStyleFlags (Lines 579-588)

```typescript
async measureStyleFlags(text: string): Promise<MetricsResult> {
  const flags = this.styleFlags.analyze({ text });
  return AnalysisResultFactory.createMetricsResult('style_flags', flags);
}
```

**Orchestration**: None. Pure delegation.

#### 2. measureWordFrequency (Lines 590-614)

```typescript
async measureWordFrequency(text: string): Promise<MetricsResult> {
  const wfOptions = this.toolOptions.getWordFrequencyOptions();
  const frequency = this.wordFrequency.analyze({ text }, wfOptions);
  return AnalysisResultFactory.createMetricsResult('word_frequency', frequency);
}
```

**Orchestration**: Config retrieval only (handled by ToolOptionsProvider).

#### 3. measureProseStats (Lines 324-348)

```typescript
async measureProseStats(text: string, files?, sourceMode?): Promise<MetricsResult> {
  const stats = this.proseStats.analyze({ text });

  // Chapter aggregation (multi-file modes)
  if (files && files.length > 0 && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
    const per = await this.computePerFileStats(files);
    // ... aggregate chapter stats
  }

  // Standards comparison
  const enriched = await this.enrichWithStandards(stats);
  return AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
}
```

**Orchestration**: Chapter aggregation + standards enrichment (**ProseStats-specific**, doesn't apply to StyleFlags or WordFrequency).

### Key Findings: No Shared Orchestration

1. ❌ **No shared state** between the three tools
2. ❌ **No coordination** between tools (they don't interact)
3. ❌ **No shared initialization** (all are simple constructors)
4. ❌ **No shared resource management** (no AI resources needed)
5. ✅ **Each tool is already a focused service class** (PassageProseStats, StyleFlags, WordFrequency)
6. ✅ **ProseStats has unique orchestration** (chapter aggregation, standards enrichment) that the other two don't need

### What Would a Facade Look Like?

```typescript
export class MeasurementToolService {
  private proseStats: PassageProseStats;
  private styleFlags: StyleFlags;
  private wordFrequency: WordFrequency;

  async computeStyleFlags(text: string): Promise<any> {
    return this.styleFlags.analyze({ text }); // ← Just delegation, no value added
  }

  async computeWordFrequency(text: string): Promise<any> {
    const options = this.toolOptions.getWordFrequencyOptions();
    return this.wordFrequency.analyze({ text }, options); // ← Config + delegation
  }

  async computeProseStats(text: string, files?, sourceMode?): Promise<any> {
    return this.proseStats.analyze({ text });
    // Wait... what about chapter aggregation and standards enrichment?
    // Do we move that logic HERE? Or keep it in ProseAnalysisService?
  }
}
```

**Problem**: The facade adds an extra layer of indirection with **no orchestration value**.

### Comparison: With vs. Without Facade

| Aspect | With Facade | Without Facade (Direct) |
|--------|-------------|-------------------------|
| **Layers** | ProseAnalysisService → MeasurementToolService → Tools | ProseAnalysisService → Tools |
| **Lines** | ~150 extra lines (facade) | 0 extra lines |
| **Complexity** | Higher (extra abstraction) | Lower (direct delegation) |
| **Testability** | Same | Same |
| **Clarity** | Less clear (what does facade do?) | Very clear (direct calls) |
| **Orchestration** | None (just delegation) | None needed |
| **Dependencies** | 1 facade | 3 focused tools |

### Decision Rationale

**YAGNI (You Aren't Gonna Need It)** - The facade provides no value:

1. **No shared orchestration** to abstract
2. **Simpler architecture** - fewer layers, easier to trace
3. **Already focused classes** - PassageProseStats, StyleFlags, WordFrequency are well-designed service objects
4. **ProseStats has unique needs** - Chapter aggregation and standards enrichment don't belong in a shared facade
5. **False simplification** - Facade doesn't abstract complexity, it just hides dependencies

### Implementation: Direct Injection

**ProseAnalysisService Constructor**:

```typescript
export class ProseAnalysisService implements IProseAnalysisService {
  constructor(
    private readonly assistantTools: AssistantToolService,
    private readonly contextAssistant: ContextAssistantService,
    private readonly proseStats: PassageProseStats,      // ← Direct
    private readonly styleFlags: StyleFlags,              // ← Direct
    private readonly wordFrequency: WordFrequency,        // ← Direct
    private readonly wordSearch: WordSearchService,
    private readonly dictionary: DictionaryService,
    private readonly standards: StandardsService,
    private readonly aiResources: AIResourceManager,
    private readonly toolOptions: ToolOptionsProvider
  ) {}
}
```

**Measurement Methods**:

```typescript
async measureProseStats(text: string, files?: string[], sourceMode?: string): Promise<MetricsResult> {
  const stats = this.proseStats.analyze({ text });

  // Multi-file aggregation (ProseStats-specific)
  if (files?.length && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
    const perFileStats = await this.standards.computePerFileStats(files, this.proseStats);
    Object.assign(stats, perFileStats);
  }

  // Standards enrichment
  const enriched = await this.standards.enrichWithStandards(stats);
  return AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
}

async measureStyleFlags(text: string): Promise<MetricsResult> {
  const flags = this.styleFlags.analyze({ text });
  return AnalysisResultFactory.createMetricsResult('style_flags', flags);
}

async measureWordFrequency(text: string): Promise<MetricsResult> {
  const options = this.toolOptions.getWordFrequencyOptions();
  const frequency = this.wordFrequency.analyze({ text }, options);
  return AnalysisResultFactory.createMetricsResult('word_frequency', frequency);
}
```

### Benefits of Direct Injection

1. ✅ **Simpler architecture** - One fewer layer to maintain
2. ✅ **Clearer intent** - Obvious what each method does (direct tool call)
3. ✅ **No false abstraction** - No facade pretending to orchestrate when it's just delegating
4. ✅ **Easier to trace** - Jump directly from ProseAnalysisService to tool implementation
5. ✅ **Follows YAGNI** - Don't create abstractions until you need them

### Conclusion

**Skip the MeasurementToolService facade.** Inject PassageProseStats, StyleFlags, and WordFrequency directly into ProseAnalysisService. The tools are already well-designed service classes with no shared orchestration needs.

---

**Author**: Claude (AI Assistant)
**Date**: 2025-11-11
**Updated**: 2025-11-11 (Added Appendix A: MeasurementToolService analysis)
