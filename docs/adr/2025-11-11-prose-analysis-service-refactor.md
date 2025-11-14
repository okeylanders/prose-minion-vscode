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

Refactor ProseAnalysisService into **focused domain services** that handlers inject directly. **Remove the facade pattern** - orchestration logic belongs in the application layer (handlers), not infrastructure layer. Services wrap tools for consistency and provide clean abstractions.

### Key Architectural Principle

**Handlers orchestrate use cases. Services provide focused capabilities.**

```
Application Layer (Handlers)
  ↓ orchestrates
Infrastructure Services (focused, single-responsibility)
  ↓ wrap
Tools (PassageProseStats, DialogueMicrobeatAssistant, etc.)
```

### Proposed Architecture

```
src/application/handlers/domain/
├── AnalysisHandler.ts              # Orchestrates analysis use cases
├── MetricsHandler.ts                # Orchestrates metrics use cases (includes ProseStats orchestration)
├── DictionaryHandler.ts
├── ContextHandler.ts
├── SearchHandler.ts
└── ... (other handlers)

src/infrastructure/api/services/
├── analysis/
│   ├── AssistantToolService.ts       # Wraps DialogueMicrobeatAssistant + ProseAssistant
│   └── ContextAssistantService.ts    # Wraps ContextAssistant
│
├── measurement/
│   ├── ProseStatsService.ts          # Wraps PassageProseStats
│   ├── StyleFlagsService.ts          # Wraps StyleFlags
│   └── WordFrequencyService.ts       # Wraps WordFrequency
│
├── search/
│   ├── WordSearchService.ts          # Word search logic
│   └── ContextSearchService.ts       # NEW: Semantic search (future)
│
├── dictionary/
│   └── DictionaryService.ts          # Wraps DictionaryUtility
│
├── resources/
│   ├── AIResourceManager.ts          # OpenRouterClient + orchestrator lifecycle
│   ├── ResourceLoaderService.ts      # Prompts, guides, registry
│   └── StandardsService.ts           # Publishing standards comparison
│
└── shared/
    └── ToolOptionsProvider.ts        # Configuration helper

src/tools/ (unchanged - wrapped by services)
├── assist/
│   ├── DialogueMicrobeatAssistant.ts
│   ├── ProseAssistant.ts
│   ├── DictionaryUtility.ts
│   └── ContextAssistant.ts
└── measure/
    ├── PassageProseStats.ts
    ├── StyleFlags.ts
    └── WordFrequency.ts
```

**Note**: ProseAnalysisService.ts will be **deleted**. IProseAnalysisService interface will be **removed**. Handlers will inject services directly.

---

## Service Responsibilities

### 1. **AssistantToolService** (~120-150 lines)
**Single Responsibility**: Wrap dialogue and prose assistant tools

**Methods**:
- `analyzeDialogue(text, context, sourceUri, options): Promise<AnalysisResult>`
- `analyzeProse(text, context, sourceUri, options): Promise<AnalysisResult>`

**Dependencies**:
- AIResourceManager (for orchestrator)
- ResourceLoaderService (for prompts)
- DialogueMicrobeatAssistant (tool)
- ProseAssistant (tool)

**Extracts**: Lines 254-290 + 292-322 from current PAS

---

### 2. **ContextAssistantService** (~100-120 lines)
**Single Responsibility**: Wrap context generation tool

**Methods**:
- `generateContext(request: ContextGenerationRequest): Promise<ContextGenerationResult>`
- `createResourceProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider>`

**Dependencies**:
- AIResourceManager (for orchestrator)
- ContextResourceResolver
- ResourceLoaderService (for prompts)
- ContextAssistant (tool)

**Extracts**: Lines 651-719 from current PAS

---

### 3. **ProseStatsService** (~80-100 lines)
**Single Responsibility**: Wrap PassageProseStats measurement tool

**Methods**:
- `analyze(text: string): any`

**Dependencies**:
- PassageProseStats (tool)

**Rationale**: Thin wrapper for consistency. All handlers depend on services, not tools directly. Provides clean extension point if orchestration is needed later.

---

### 4. **StyleFlagsService** (~60-80 lines)
**Single Responsibility**: Wrap StyleFlags measurement tool

**Methods**:
- `analyze(text: string): any`

**Dependencies**:
- StyleFlags (tool)

**Rationale**: Thin wrapper for consistency. Symmetric architecture with ProseStatsService and WordFrequencyService.

---

### 5. **WordFrequencyService** (~80-100 lines)
**Single Responsibility**: Wrap WordFrequency measurement tool

**Methods**:
- `analyze(text: string, options: WordFrequencyOptions): any`

**Dependencies**:
- WordFrequency (tool)
- ToolOptionsProvider (for config)

**Rationale**: Thin wrapper for consistency. Handles configuration retrieval before delegating to tool.

---

### 6. **WordSearchService** (~250-300 lines)
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

### 7. **DictionaryService** (~80-100 lines)
**Single Responsibility**: Wrap dictionary lookup tool

**Methods**:
- `lookupWord(word, contextText?): Promise<AnalysisResult>`

**Dependencies**:
- AIResourceManager (for orchestrator)
- ResourceLoaderService (for prompts)
- DictionaryUtility (tool)

**Extracts**: Lines 616-649 from current PAS

---

### 8. **AIResourceManager** (~200-250 lines)
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

### 9. **ResourceLoaderService** (~100-120 lines)
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

### 10. **StandardsService** (~120-150 lines)
**Single Responsibility**: Publishing standards comparison and enrichment

**Methods**:
- `enrichWithStandards(stats: any): Promise<any>`
- `computePerFileStats(relativePaths: string[], proseStatsService: ProseStatsService): Promise<any[]>`
- `findGenre(preset: string): Promise<Genre | undefined>`

**Dependencies**:
- PublishingStandardsRepository
- StandardsComparisonService
- VSCode workspace API (for file reading)
- ProseStatsService (for per-file analysis)

**Extracts**: Lines 350-366 + 511-577 from current PAS

**Note**: `computePerFileStats` takes ProseStatsService as parameter to analyze individual files

---

### 11. **ToolOptionsProvider** (~60-80 lines)
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

## Handler Orchestration Examples

### MetricsHandler: Orchestrating Prose Stats

**Before** (via facade):
```typescript
constructor(private readonly proseAnalysisService: IProseAnalysisService) {}

async handleProseStats(message: MessageEnvelope) {
  const result = await this.proseAnalysisService.measureProseStats(text, files, sourceMode);
  this.panel.postMessage(result);
}
```

**After** (direct orchestration):
```typescript
constructor(
  private readonly proseStatsService: ProseStatsService,
  private readonly standardsService: StandardsService,
  private readonly panel: ProseToolsViewProvider
) {}

async handleProseStats(message: MessageEnvelope) {
  const { text, files, sourceMode } = message.payload;

  // Step 1: Get base stats
  const stats = this.proseStatsService.analyze(text);

  // Step 2: Multi-file aggregation (if needed)
  if (files?.length && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
    const perFileStats = await this.standardsService.computePerFileStats(files, this.proseStatsService);
    Object.assign(stats, { chapterStats: perFileStats });
  }

  // Step 3: Standards enrichment
  const enriched = await this.standardsService.enrichWithStandards(stats);

  // Step 4: Send result
  const result = AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
  this.panel.postMessage(result);
}
```

**Benefits**:
- ✅ Handler owns the use case orchestration
- ✅ Clear, explicit steps
- ✅ Easy to test (mock services)
- ✅ No hidden logic in facade

---

### AnalysisHandler: Delegating to Services

```typescript
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
```

**Benefits**:
- ✅ Thin delegation when no orchestration needed
- ✅ Handler still owns message routing and result posting
- ✅ Service provides focused capability

---

## Dependency Injection Architecture

```typescript
// Extension activation (extension.ts)
export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Prose Minion');
  const secretsService = new SecretStorageService(context.secrets);

  // Resource services (foundation)
  const resourceLoader = new ResourceLoaderService(context.extensionUri, outputChannel);
  const aiResourceManager = new AIResourceManager(resourceLoader, secretsService, outputChannel);
  const toolOptions = new ToolOptionsProvider();
  const standards = new StandardsService(context.extensionUri, outputChannel);

  // Analysis services (wrap AI tools)
  const assistantTools = new AssistantToolService(aiResourceManager, resourceLoader);
  const contextAssistant = new ContextAssistantService(aiResourceManager, resourceLoader);
  const dictionary = new DictionaryService(aiResourceManager, resourceLoader);

  // Measurement services (wrap measurement tools)
  const proseStatsService = new ProseStatsService();
  const styleFlagsService = new StyleFlagsService();
  const wordFrequencyService = new WordFrequencyService(toolOptions);

  // Search service
  const wordSearch = new WordSearchService(toolOptions, outputChannel);

  // Handlers inject services directly
  const analysisHandler = new AnalysisHandler(
    assistantTools,
    contextAssistant,
    dictionary,
    toolOptions,
    panel
  );

  const metricsHandler = new MetricsHandler(
    proseStatsService,
    styleFlagsService,
    wordFrequencyService,
    wordSearch,
    standards,
    toolOptions,
    panel
  );

  const dictionaryHandler = new DictionaryHandler(dictionary, panel);
  const contextHandler = new ContextHandler(contextAssistant, panel);
  const searchHandler = new SearchHandler(wordSearch, panel);

  // MessageHandler routes to domain handlers
  const messageHandler = new MessageHandler(
    analysisHandler,
    metricsHandler,
    dictionaryHandler,
    contextHandler,
    searchHandler,
    // ... other handlers
  );

  // ProseToolsViewProvider uses messageHandler
  const panel = new ProseToolsViewProvider(
    context.extensionUri,
    messageHandler,
    aiResourceManager
  );

  // Rest of activation...
}
```

**Benefits**:
- ✅ Explicit dependency tree
- ✅ Services created once, injected into handlers
- ✅ Easy to unit test (mock individual services)
- ✅ Clear service boundaries
- ✅ Services can be reused independently

---

## Anti-Patterns to Avoid

### 1. **God Service → Multiple God Services**
**Risk**: Each domain service becomes a mini god component

**Mitigation**:
- Each service has **exactly one responsibility**
- Line count cap: Services < 300 lines (except WordSearchService due to helpers)
- If service grows, extract further

### 2. **Handlers Become God Components**
**Risk**: Handlers accumulate orchestration logic and become bloated

**Mitigation**:
- Handlers own **use case orchestration only** (not business logic)
- Complex orchestration → extract to service
- If handler > 200 lines, extract orchestration to service
- Each handler focuses on one domain (analysis, metrics, search, etc.)

### 3. **Circular Dependencies**
**Risk**: Services depend on each other in cycles

**Mitigation**:
- Dependency graph flows **inward** (handlers → services → tools)
- Shared dependencies injected via constructor
- No service-to-service calls except through composition (e.g., StandardsService uses ProseStatsService via parameter)

### 4. **Shared Mutable State**
**Risk**: Services share global state leading to race conditions

**Mitigation**:
- AIResourceManager owns all AI resource lifecycle (single source of truth)
- Each service is stateless except for injected dependencies
- Configuration changes flow through handlers → services

### 5. **Leaky Abstractions**
**Risk**: Services expose internal implementation details

**Mitigation**:
- Each service has clear public interface (3-5 methods max)
- Internal helpers are private
- Return types use domain models (AnalysisResult, MetricsResult), not implementation types

---

## Migration Strategy

### Phase 1: Extract Resource Services (Low Risk)
**Goal**: Extract foundational services that other services depend on

**Tasks**:
1. Create `ResourceLoaderService` (prompts, guides, registry)
2. Create `ToolOptionsProvider` (configuration helper)
3. Create `AIResourceManager` (OpenRouter + orchestrator lifecycle)
4. Create `StandardsService` (publishing standards)
5. Update ProseAnalysisService to use these services (temporary - will be deleted later)
6. Test all existing functionality

**Acceptance Criteria**:
- All tests pass
- Extension loads without errors
- ProseAnalysisService line count reduced ~200 lines

**Estimated Effort**: 2-3 hours

---

### Phase 2: Create Measurement Service Wrappers (Low Risk)

**Goal**: Create thin service wrappers for measurement tools (consistency)

**Tasks**:
1. Create `ProseStatsService` (wraps PassageProseStats)
2. Create `StyleFlagsService` (wraps StyleFlags)
3. Create `WordFrequencyService` (wraps WordFrequency)
4. Update ProseAnalysisService to use these services (temporary)
5. Test all metrics tools (Prose Stats, Style Flags, Word Frequency)

**Acceptance Criteria**:
- All measurement tools work identically
- Metrics tab shows correct results
- Service wrappers follow consistent pattern

**Estimated Effort**: 1-2 hours

---

### Phase 3: Extract Analysis Services (Medium Risk)
**Goal**: Extract AI-powered analysis tools

**Tasks**:
1. Create `AssistantToolService` (wraps dialogue + prose assistants)
2. Create `DictionaryService` (wraps dictionary utility)
3. Create `ContextAssistantService` (wraps context assistant)
4. Update ProseAnalysisService to use these services (temporary)
5. Test all analysis flows

**Acceptance Criteria**:
- Dialogue analysis works with all focus modes
- Prose analysis returns correct results
- Dictionary lookups function correctly
- Context generation with resources works

**Estimated Effort**: 2-3 hours

---

### Phase 4: Extract Search Service (Medium Risk)
**Goal**: Extract word search logic (heaviest method)

**Tasks**:
1. Create `WordSearchService` with all helper functions
2. Move 200+ lines of search logic
3. Update ProseAnalysisService to use this service (temporary)
4. Test word search across selection, files, manuscript modes

**Acceptance Criteria**:
- Word search returns identical results
- Search tab functions correctly
- Cluster detection works as expected

**Estimated Effort**: 2-3 hours

---

### Phase 5: Update Handlers to Inject Services Directly (Medium Risk)
**Goal**: Remove ProseAnalysisService facade, handlers orchestrate directly

**Tasks**:
1. Update AnalysisHandler to inject AssistantToolService, ContextAssistantService, DictionaryService
2. Update MetricsHandler to inject measurement services and orchestrate ProseStats use case
3. Update SearchHandler to inject WordSearchService
4. Update DictionaryHandler to inject DictionaryService
5. Update ContextHandler to inject ContextAssistantService
6. Update extension.ts dependency injection
7. **Delete ProseAnalysisService.ts**
8. **Delete IProseAnalysisService interface**
9. Test all handlers end-to-end

**Acceptance Criteria**:
- All handlers work identically to before
- ProseAnalysisService.ts deleted
- IProseAnalysisService interface removed
- All use cases functional
- Orchestration logic lives in handlers

**Estimated Effort**: 3-4 hours

---

### Phase 6: Documentation and Cleanup (Low Risk)
**Goal**: Update documentation and verify architecture

**Tasks**:
1. Update ARCHITECTURE.md with new service organization
2. Add JSDoc comments to all services
3. Verify dependency graph flows inward
4. Run comprehensive regression testing
5. Update memory bank with completion summary

**Acceptance Criteria**:
- Architecture documentation accurate
- All services have JSDoc comments
- No circular dependencies
- All manual tests pass

**Estimated Effort**: 1-2 hours

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
   - **Multi-file chapter aggregation** (critical orchestration test)

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

### 2. Keep ProseAnalysisService as Facade (Original Proposal)
**Rejected** - After analysis, most methods would be pure delegation. Orchestration belongs in application layer (handlers), not infrastructure layer. YAGNI principle - don't create facade until orchestration is needed across multiple handlers.

### 3. Split by Tool Type Only (Assist vs Measure)
**Rejected** - Still creates large services with multiple responsibilities. Doesn't align with domain-driven organization.

### 4. Use Dependency Injection Framework (InversifyJS, TSyringe)
**Rejected** - Overkill for current needs. Manual DI in extension.ts is explicit and easier to understand. May revisit for v1.0.

### 5. Implement Services as Singletons
**Rejected** - Singletons hide dependencies and make testing harder. Constructor injection is clearer and more testable.

### 6. Inject Tools Directly into Handlers (No Service Wrappers)
**Rejected** - Inconsistent architecture. Some handlers would depend on services (AssistantToolService) while others depend on tools (PassageProseStats). Service wrappers provide consistency and clean extension points.

---

## Consequences

### Positive ✅

1. **Clean Architecture Achieved**
   - Last god component eliminated
   - Consistent domain organization across backend, frontend, infrastructure
   - SOLID principles followed throughout codebase
   - **Orchestration in application layer** (where it belongs)

2. **Maintainability Improved**
   - ProseAnalysisService: **deleted** (916 lines eliminated)
   - 11 focused services (~80-300 lines each)
   - Each service has single responsibility
   - Easy to locate and modify specific functionality

3. **Testability Improved**
   - Services can be unit tested in isolation
   - Handlers can be tested with mocked services
   - Clear dependency injection makes mocking easy

4. **Extensibility Improved**
   - Context Search can be added as clean SearchService sibling
   - New measurement tools easy to add (create service wrapper)
   - New AI tools easy to add to AssistantToolService
   - **Handlers own orchestration** - easy to add new use cases

5. **Code Navigation Improved**
   - Find analysis logic → AssistantToolService
   - Find measurement logic → ProseStatsService, StyleFlagsService, WordFrequencyService
   - Find search logic → WordSearchService
   - Find orchestration → Handlers
   - Clear mental model

6. **Reduced Coupling**
   - Handlers depend on focused services
   - Services depend on abstractions, not concretions
   - Changes to one service don't cascade to others
   - Resource lifecycle isolated in AIResourceManager

### Neutral ⚖️

1. **More Files to Navigate**
   - 1 file → ~11 services + updated handlers
   - But: Better organized, easier to find specific logic

2. **Dependency Injection Complexity**
   - extension.ts activation becomes longer
   - Handlers have more constructor parameters
   - But: Explicit dependencies easier to understand than hidden facade

3. **Learning Curve**
   - New contributors need to understand service organization
   - But: Mirrors backend handler architecture (consistent pattern)
   - But: Orchestration in handlers is familiar pattern (MessageHandler already does this)

### Risks & Mitigations ⚠️

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing functionality | Medium | High | Test after each phase, manual testing checklist |
| Handlers become god components | Low | Medium | Line count caps, orchestration complexity review |
| Introducing circular dependencies | Low | Medium | Strict dependency graph, code review |
| Services become mini god components | Low | Medium | Line count caps, single responsibility review |
| Performance degradation | Very Low | Low | Services are lightweight wrappers, no overhead |

---

## Success Metrics

| Metric | Before | Target | Success Criteria |
|--------|--------|--------|------------------|
| God components | 1 (ProseAnalysisService) | 0 | ✅ Eliminated |
| Service count | 1 monolith | 11 focused services | ✅ Domain-organized |
| Service responsibilities | 9+ in one file | 1 per service | ✅ Single responsibility |
| Largest service file | 916 lines | < 300 lines | ✅ All focused |
| Orchestration location | Mixed (facade + handlers) | Handlers only | ✅ Application layer |
| Handler complexity | Thin (facade dependency) | Explicit (orchestration) | ✅ Use case ownership |
| Test coverage | Minimal | Unit tests per service | ✅ Improved testability |
| Architecture consistency | Inconsistent | Mirrors frontend/backend | ✅ Symmetric |
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

5. **Preserve Orchestration Logic**
   - ProseStats multi-file aggregation + standards enrichment **must work identically**
   - Chapter stats computation unchanged
   - Standards comparison logic preserved

### Code Quality Standards

- **TypeScript**: Strict typing throughout, no `any` except pragmatic cases (document rationale)
- **Error Handling**: Try/catch with fallbacks, clear error messages
- **Logging**: Output channel logging for debugging and transparency
- **Comments**: JSDoc for public methods, inline comments for complex logic
- **Naming**: Clear, descriptive names following existing conventions

### Dependency Graph (Must Flow Inward)

```
Application Layer (Handlers)
    ↓ depends on
Infrastructure Services (Analysis, Measurement, Search, Dictionary, Resources)
    ↓ depends on
Tools (DialogueMicrobeatAssistant, PassageProseStats, etc.)
    ↓ depends on
Infrastructure (OpenRouterClient, VSCode API, File System)
```

**Rule**: No upward dependencies. Services never import from handlers. Tools never import from services.

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

- [ ] **Architecture Review**: ADR reviewed against anti-patterns (god components, circular deps, leaky abstractions, handlers becoming bloated)
- [ ] **Dependency Graph Validated**: No upward dependencies, clear separation of concerns
- [ ] **Service Responsibilities Defined**: Each service has exactly one responsibility
- [ ] **Orchestration Strategy Confirmed**: Handlers own use case orchestration, services provide focused capabilities
- [ ] **Migration Strategy Confirmed**: Phased approach with acceptance criteria per phase
- [ ] **Testing Plan Confirmed**: Manual testing checklist for each phase, special focus on ProseStats orchestration
- [ ] **Epic and Sprints Created**: Breakdown into executable sprints with time estimates
- [ ] **Branch Strategy Confirmed**: Sprint branches off main, PR per phase or combined

---

**Status**: Proposed (awaiting review and iteration)
**Next Steps**:
1. Review ADR for anti-patterns
2. Validate dependency graph (no circular dependencies)
3. Confirm handler orchestration pattern doesn't create bloat
4. Create epic and sprint breakdown
5. Implement Phase 1 (Resource Services)

---

## Appendix A: Facade vs. Direct Injection Analysis

**Date Added**: 2025-11-11 (Post-Draft Review)
**Question**: Do we need ProseAnalysisService as a facade, or should handlers inject services directly?
**Decision**: **Direct injection** (no facade needed)

### Analysis: Where Should Orchestration Live?

We analyzed the proposed facade methods to determine where orchestration logic belongs:

#### Methods That Would Be Pure Delegation

1. **analyzeDialogue** → delegate to assistantTools
2. **analyzeProse** → delegate to assistantTools
3. **lookupDictionary** → delegate to dictionary
4. **generateContext** → delegate to contextAssistant
5. **measureStyleFlags** → delegate to styleFlagsService
6. **measureWordFrequency** → delegate to wordFrequencyService (with config)
7. **measureWordSearch** → delegate to wordSearch

**7 out of 8 methods** = pure delegation with no orchestration value.

#### Method With Real Orchestration

**measureProseStats** - Multi-step orchestration:
1. Call proseStatsService.analyze()
2. If multi-file mode, call standards.computePerFileStats()
3. Aggregate chapter stats
4. Call standards.enrichWithStandards()
5. Wrap result

**Question**: Where does this orchestration belong?

**Answer**: In **MetricsHandler** (application layer), not in a facade (infrastructure layer).

### Clean Architecture: Orchestration Belongs in Application Layer

```
Application Layer (Handlers)
  ↓ orchestrates use cases
Domain/Infrastructure Services
  ↓ provide capabilities
Tools
```

**MetricsHandler.handleProseStats()** should orchestrate:
```typescript
async handleProseStats(message: MessageEnvelope) {
  const { text, files, sourceMode } = message.payload;

  // Handler orchestrates the use case
  const stats = this.proseStatsService.analyze(text);

  if (files?.length && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
    const perFileStats = await this.standardsService.computePerFileStats(files, this.proseStatsService);
    Object.assign(stats, { chapterStats: perFileStats });
  }

  const enriched = await this.standardsService.enrichWithStandards(stats);
  const result = AnalysisResultFactory.createMetricsResult('prose_stats', enriched);

  this.panel.postMessage(result);
}
```

**Benefits**:
- ✅ Use case logic lives in application layer (correct architectural layer)
- ✅ Clear, explicit orchestration steps
- ✅ Easy to test (mock services)
- ✅ No hidden logic in facade

### Comparison: With vs. Without Facade

| Aspect | With Facade | Without Facade (Direct) |
|--------|-------------|-------------------------|
| **Orchestration Location** | Infrastructure layer (wrong) | Application layer (correct) |
| **Facade Value** | 7/8 methods pure delegation | N/A - handlers own orchestration |
| **Handler Complexity** | Thin (delegates to facade) | Explicit (orchestrates use cases) |
| **Testability** | Mock one facade | Mock individual services (more granular) |
| **Clarity** | Orchestration hidden in facade | Orchestration explicit in handlers |
| **Architecture** | Extra layer with minimal value | Clean Architecture pattern |
| **Lines of Code** | +150-200 (facade) | 0 extra |

### Decision Rationale

**YAGNI + Clean Architecture** - The facade provides minimal value:

1. **7/8 methods are pure delegation** - No orchestration to abstract
2. **Orchestration belongs in application layer** - Handlers should own use case logic
3. **Simpler architecture** - One fewer layer, explicit dependencies
4. **Already consistent** - MessageHandler already orchestrates (routes messages to domain handlers)
5. **Handlers won't become bloated** - Each handler focuses on one domain with clear responsibilities

### What About Measurement Service Wrappers?

**Question**: If we're rejecting the facade for YAGNI reasons, why add measurement service wrappers?

**Answer**: **Consistency and architectural symmetry**

- **Analysis tools**: Wrapped (AssistantToolService, ContextAssistantService, DictionaryService)
- **Measurement tools**: Should also be wrapped for consistency
- **Pattern**: All handlers depend on services, not tools directly
- **Benefits**: Clean extension points, symmetric architecture, consistent abstraction level

**Difference from facade**:
- Wrappers are **service → tool** (infrastructure abstraction)
- Facade would be **handler → service** (application → infrastructure delegation)

Wrappers provide architectural consistency. Facade would add unnecessary indirection.

### Conclusion

**Remove ProseAnalysisService facade.** Handlers inject services directly and orchestrate use cases. Create measurement service wrappers for consistency (ProseStatsService, StyleFlagsService, WordFrequencyService), but let handlers own orchestration logic.

---

**Author**: Claude (AI Assistant)
**Date**: 2025-11-11
**Updated**: 2025-11-11 (Major revision: removed facade, handlers orchestrate directly, added measurement service wrappers)
