# ADR-2025-11-20: Parallel Dictionary Generation via Fan-Out Batching

**Date**: 2025-11-20
**Status**: Proposed
**Scope**: Dictionary feature enhancement
**Pattern**: Fan-out/Fan-in parallel processing

---

## Context

### Current Dictionary Implementation

The dictionary feature currently generates comprehensive word entries using a single synchronous OpenRouter API call:

**Template Blocks** (14 sections):
1. 📕 **Definition** — Canonical definition(s)
2. 🔈 **Pronunciation** — IPA, phonetic respelling, syllable count, stress pattern
3. 🧩 **Parts of Speech** — Enumerate each part of speech
4. 🔍 **Sense Explorer** — Numbered senses with definitions, examples, synonyms, antonyms, nuance
5. 🗣️ **Register & Connotation** — Registers, emotional valence, tonal sliders
6. 🪶 **Narrative Texture** — Sensory tags, mood levers, symbolic associations
7. 📚 **Collocations & Idioms** — High-value collocations, idioms, clichés
8. 🧬 **Morphology & Family** — Inflections, derivational family, compounds
9. 🎭 **Character Voice Variations** — Alternative phrasings for character archetypes
10. 🎵 **Soundplay & Rhyme** — Rhyme families, slant rhymes, alliterative partners
11. 🌐 **Translations & Cognates** — Key equivalents in multiple languages
12. ⚠️ **Usage Watchpoints** — Ambiguity risks, overuse alerts, regional pitfalls
13. 🧭 **Semantic Gradient** — Ordered ladder of near-synonyms
14. 🧠 **AI Advisory Notes** — Flag insights with limited certainty

**Current Flow**:
```
User clicks "Generate Dictionary Entry"
  ↓
Single prompt with full template sent to OpenRouter
  ↓
Model generates all blocks sequentially (internal to model)
  ↓
Complete result returned and displayed
```

**Performance**: Single call takes ~8-15 seconds for comprehensive entries (varies by model and word complexity).

### Proven Success: Category Search Batching

The [Context Search feature](.todo/archived/epics/epic-context-search-2025-11-03/) successfully implemented parallel fan-out processing:

**Pattern**:
- Split word list into batches (5-10 words per batch)
- Fire up to 5 concurrent OpenRouter calls
- Reassemble results into unified output
- **Result**: 3-5× faster than sequential processing

**Key Learnings**:
- Concurrency cap prevents API throttling (5 threads optimal)
- Partial failure handling essential (graceful degradation)
- Progress indicators improve perceived performance
- Batch size matters (too small = overhead, too large = stragglers)

### Opportunity: Apply Pattern to Dictionary

Dictionary generation is **highly parallelizable**:
- Each template block is independent (definitions don't need etymology to generate)
- Blocks vary in complexity (etymology is heavy, pronunciation is light)
- Users care about speed (dictionary lookups are workflow blockers)
- Experimental feature allows risk-taking (can refine based on feedback)

---

## Decision

Implement **parallel dictionary generation** as an experimental feature using the fan-out/fan-in pattern proven in Category Search.

### Architecture Decision

**Fan-Out Strategy**:
1. Split dictionary template into **14 block-specific prompts** (one per section)
2. Fire parallel OpenRouter requests (concurrency cap: 5 threads)
3. Reassemble blocks into standard dictionary result shape
4. Preserve message envelope pattern for consistent routing

**UX Decision**:
- Add secondary button: **"Experimental: Fast Generate"** next to existing "Generate Dictionary Entry"
- Show experimental badge (🧪 icon + tooltip)
- Display per-block progress indicator (optional but high-value)
- Reuse existing dictionary settings (model, maxTokens)

**Failure Handling**:
- Partial failures surface gracefully (show completed blocks, mark missing sections)
- Timeout per block (10 seconds)
- Retry once on failure (per block)
- Fallback to standard generation on catastrophic failure

---

## Implementation Approach

### 1. Message Contracts

**New Messages** (in `src/shared/types/messages/dictionary.ts`):

```typescript
// Request message
export interface FastGenerateDictionaryRequest extends BaseMessage {
  type: MessageType.FAST_GENERATE_DICTIONARY;
  word: string;
  context?: string;
  sourceUri?: string;
}

// Result message (reuse existing DictionaryResult structure)
export interface FastGenerateDictionaryResult extends BaseMessage {
  type: MessageType.FAST_GENERATE_DICTIONARY_RESULT;
  word: string;
  blocks: {
    definitions?: string;
    etymology?: string;
    usage?: string;
    synonyms?: string;
    antonyms?: string;
    nuance?: string;
    related?: string;
    pronunciation?: string;
  };
  metadata: {
    totalDuration: number;
    blockDurations: Record<string, number>;
    partialFailures: string[]; // List of failed block names
  };
}

// Progress message (optional, for per-block status)
export interface DictionaryGenerationProgress extends BaseMessage {
  type: MessageType.DICTIONARY_GENERATION_PROGRESS;
  word: string;
  completedBlocks: string[];
  totalBlocks: number;
}
```

**Add to `MessageType` enum** (in `src/shared/types/messages/base.ts`):
```typescript
export enum MessageType {
  // ... existing types
  FAST_GENERATE_DICTIONARY = 'fastGenerateDictionary',
  FAST_GENERATE_DICTIONARY_RESULT = 'fastGenerateDictionaryResult',
  DICTIONARY_GENERATION_PROGRESS = 'dictionaryGenerationProgress',
}
```

---

### 2. Backend: DictionaryService Enhancement

**New Method** (in `src/infrastructure/api/services/dictionary/DictionaryService.ts`):

```typescript
export class DictionaryService {
  private readonly CONCURRENCY_LIMIT = 5;
  private readonly BLOCK_TIMEOUT = 10000; // 10 seconds per block

  async generateParallelDictionary(
    word: string,
    context?: string
  ): Promise<FastGenerateDictionaryResult> {
    const blocks = this.getBlockPrompts(word, context);

    // Fan-out: Fire concurrent requests
    const blockPromises = Object.entries(blocks).map(([blockName, prompt]) =>
      this.generateBlock(blockName, prompt)
    );

    // Concurrency cap using p-limit or similar
    const results = await this.executeWithConcurrency(
      blockPromises,
      this.CONCURRENCY_LIMIT
    );

    // Fan-in: Reassemble results
    return this.assembleResult(word, results);
  }

  private getBlockPrompts(word: string, context?: string): Record<string, string> {
    // Generate block-specific prompts derived from main dictionary prompt
    // Each prompt instructs model to ONLY return that block
    return {
      definitions: this.buildBlockPrompt('definitions', word, context),
      etymology: this.buildBlockPrompt('etymology', word, context),
      usage: this.buildBlockPrompt('usage', word, context),
      synonyms: this.buildBlockPrompt('synonyms', word, context),
      antonyms: this.buildBlockPrompt('antonyms', word, context),
      nuance: this.buildBlockPrompt('nuance', word, context),
      // ... other blocks
    };
  }

  private buildBlockPrompt(blockType: string, word: string, context?: string): string {
    // Load base dictionary prompt
    // Modify to focus on single block
    // Add guardrail: "Only return the [blockType] section. Do not include other sections."
    return `...`;
  }

  private async generateBlock(
    blockName: string,
    prompt: string
  ): Promise<{ blockName: string; content: string; duration: number; error?: string }> {
    const startTime = Date.now();
    try {
      const response = await Promise.race([
        this.openRouterClient.complete(prompt),
        this.timeout(this.BLOCK_TIMEOUT)
      ]);

      return {
        blockName,
        content: response.content,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Retry once
      try {
        const retryResponse = await this.openRouterClient.complete(prompt);
        return {
          blockName,
          content: retryResponse.content,
          duration: Date.now() - startTime
        };
      } catch (retryError) {
        return {
          blockName,
          content: '',
          duration: Date.now() - startTime,
          error: retryError.message
        };
      }
    }
  }

  private assembleResult(
    word: string,
    blocks: Array<{ blockName: string; content: string; duration: number; error?: string }>
  ): FastGenerateDictionaryResult {
    // Merge blocks into result structure
    // Track partial failures
    // Calculate total duration
    // Return assembled result
  }
}
```

---

### 3. Backend: DictionaryHandler Registration

**Update Handler** (in `src/application/handlers/domain/DictionaryHandler.ts`):

```typescript
export class DictionaryHandler {
  registerRoutes(router: MessageRouter): void {
    // ... existing routes
    router.register(
      MessageType.FAST_GENERATE_DICTIONARY,
      this.handleFastGenerate.bind(this)
    );
  }

  private async handleFastGenerate(message: MessageEnvelope<FastGenerateDictionaryRequest>): Promise<void> {
    try {
      const { word, context, sourceUri } = message.payload;

      // Call parallel generation service
      const result = await this.dictionaryService.generateParallelDictionary(word, context);

      // Send result back to webview
      this.sendMessage({
        type: MessageType.FAST_GENERATE_DICTIONARY_RESULT,
        source: 'extension.handler.dictionary',
        payload: result,
        timestamp: Date.now()
      });

      // Optional: Send progress updates during generation
      // (requires streaming or polling)

    } catch (error) {
      this.sendError(message, error);
    }
  }
}
```

---

### 4. Frontend: useDictionary Hook Enhancement

**Update Hook** (in `src/presentation/webview/hooks/domain/useDictionary.ts`):

```typescript
export interface DictionaryState {
  // ... existing state
  isFastGenerating: boolean;
  fastGenerationProgress?: {
    completedBlocks: string[];
    totalBlocks: number;
  };
}

export interface DictionaryActions {
  // ... existing actions
  handleFastGenerate: (word: string, context?: string) => void;
  handleFastGenerateResult: (result: FastGenerateDictionaryResult) => void;
  handleProgress: (progress: DictionaryGenerationProgress) => void;
}

export function useDictionary(): UseDictionaryReturn {
  const [isFastGenerating, setIsFastGenerating] = useState(false);
  const [fastProgress, setFastProgress] = useState<DictionaryGenerationProgress | null>(null);

  const handleFastGenerate = useCallback((word: string, context?: string) => {
    setIsFastGenerating(true);
    setFastProgress(null);

    vscode.postMessage({
      type: MessageType.FAST_GENERATE_DICTIONARY,
      source: 'webview.domain.dictionary',
      payload: { word, context },
      timestamp: Date.now()
    });
  }, [vscode]);

  const handleFastGenerateResult = useCallback((result: FastGenerateDictionaryResult) => {
    setIsFastGenerating(false);
    setDictionaryResult(result); // Reuse existing result state

    // Show notification if partial failures
    if (result.metadata.partialFailures.length > 0) {
      // Display warning about missing sections
    }
  }, []);

  const handleProgress = useCallback((progress: DictionaryGenerationProgress) => {
    setFastProgress(progress);
  }, []);

  return {
    // ... existing state/actions
    isFastGenerating,
    fastGenerationProgress: fastProgress,
    handleFastGenerate,
    handleFastGenerateResult,
    handleProgress,
    persistedState: {
      // ... existing persistence
    }
  };
}
```

---

### 5. Frontend: UI Component Enhancement

**Update Component** (in `src/presentation/webview/components/Dictionary.tsx`):

```typescript
export function Dictionary() {
  const dictionary = useDictionary();

  return (
    <div className="dictionary-container">
      {/* ... existing input fields */}

      <div className="button-group">
        {/* Existing button */}
        <button
          onClick={() => dictionary.handleGenerate(word, context)}
          disabled={dictionary.isGenerating || dictionary.isFastGenerating}
        >
          Generate Dictionary Entry
        </button>

        {/* NEW: Experimental fast generate button */}
        <button
          onClick={() => dictionary.handleFastGenerate(word, context)}
          disabled={dictionary.isGenerating || dictionary.isFastGenerating}
          className="experimental-button"
          title="Experimental parallel generation (faster, may have incomplete sections)"
        >
          <span className="experimental-badge">🧪</span>
          Fast Generate
        </button>
      </div>

      {/* Progress indicator for fast generation */}
      {dictionary.isFastGenerating && dictionary.fastGenerationProgress && (
        <div className="fast-progress">
          <span>
            Generating blocks: {dictionary.fastGenerationProgress.completedBlocks.length} / {dictionary.fastGenerationProgress.totalBlocks}
          </span>
          <ProgressBar
            current={dictionary.fastGenerationProgress.completedBlocks.length}
            total={dictionary.fastGenerationProgress.totalBlocks}
          />
        </div>
      )}

      {/* ... existing result display */}
      {dictionary.dictionaryResult && dictionary.dictionaryResult.metadata?.partialFailures && (
        <div className="warning">
          ⚠️ Some sections could not be generated: {dictionary.dictionaryResult.metadata.partialFailures.join(', ')}
        </div>
      )}
    </div>
  );
}
```

---

### 6. Prompt Engineering

**Block-Specific Prompt Template**:

```markdown
You are a lexicographer creating a dictionary entry for creative writers.

WORD: {word}
CONTEXT: {context}

TASK: Generate ONLY the {blockType} section for this word. Do not include any other sections.

{blockType === 'definitions' && `
## Definitions
Provide 2-4 definitions ordered by relevance to creative writing. For each:
- Clear, concise definition
- Usage context (formal, informal, literary, etc.)
- Example sentence showing the word in context
`}

{blockType === 'etymology' && `
## Etymology
Provide:
- Origin language and root word
- Evolution of meaning over time
- Related words in other languages (if interesting)
`}

{blockType === 'usage' && `
## Usage Examples
Provide 3-5 example sentences demonstrating:
- Different senses of the word
- Varied contexts (dialogue, narration, description)
- Tone variation (formal, casual, poetic)
`}

{/* ... similar for other blocks */}

OUTPUT FORMAT: Return ONLY the requested section in markdown format. Do not include a title or other sections.
```

**Guardrails**:
- Each prompt explicitly states "ONLY return the {blockType} section"
- No preamble or closing remarks allowed
- Markdown formatting required for consistency
- Length hints per block (e.g., "2-4 definitions", "3-5 examples")

---

### 7. Performance Optimization Strategies

**Concurrency Cap**:
- Default: 5 concurrent calls (proven optimal in Category Search)
- Each block gets its own API call (no combining)
- Total: **14 concurrent calls** (one per template section)
- Batched in groups of 5 to respect concurrency limit

**Timeout Strategy**:
- Per-block timeout: 10 seconds (configurable)
- Graceful degradation: Continue with completed blocks if one fails
- Fallback: If > 50% blocks fail, retry entire request using standard generation

**Caching** (Future Enhancement):
- Cache block results per word (keyed by word + model)
- On repeat lookup, return cached blocks immediately
- Only regenerate missing/failed blocks

---

## Consequences

### Benefits

✅ **Performance**: Expected 2-4× faster generation (8-15s → 3-5s for comprehensive entries)
✅ **Pattern Reuse**: Leverages proven Category Search fan-out architecture
✅ **User Choice**: Experimental button allows users to opt-in (no disruption to stable path)
✅ **Graceful Degradation**: Partial failures don't block entire result
✅ **Progress Visibility**: Per-block indicators improve perceived performance
✅ **Clean Architecture**: Preserves message envelope pattern, domain mirroring, hook interfaces

### Risks

⚠️ **API Costs**: 6-8× more API calls per dictionary entry (mitigated by concurrency cap and user opt-in)
⚠️ **Partial Failures**: More complex error handling (mitigated by retry logic and graceful degradation)
⚠️ **Prompt Complexity**: Block-specific prompts require careful engineering (mitigated by iteration and user feedback)
⚠️ **Model Variability**: Different models may handle block-focused prompts differently (mitigated by testing across models)

### Trade-offs

**Speed vs. Cost**:
- Fast generation = 6-8× API calls = higher cost per entry
- Mitigation: Experimental badge sets expectations; users opt-in consciously
- Future: Add cost estimator in UI ("Fast Generate uses ~$0.03 vs. $0.005 for standard")

**Completeness vs. Speed**:
- Parallel generation may miss block interdependencies (e.g., usage examples referencing definitions)
- Mitigation: Prompt engineering emphasizes self-contained blocks
- Fallback: Standard generation remains default for reliability

**Complexity vs. Maintainability**:
- Fan-out pattern adds complexity (concurrency management, reassembly logic)
- Mitigation: Reuse proven Category Search patterns; comprehensive testing
- Future: Extract shared fan-out utility for both features

---

## Implementation Plan

### Phase 1: Core Fan-Out Infrastructure (Sprint 1)
**Scope**: Backend service implementation
- [ ] Add message types to `dictionary.ts`
- [ ] Implement `DictionaryService.generateParallelDictionary()`
- [ ] Create block-specific prompt templates
- [ ] Add concurrency management (p-limit or custom)
- [ ] Implement timeout + retry logic
- [ ] Add handler route registration

**Acceptance Criteria**:
- Service successfully fans out 6-8 parallel calls
- Results reassemble correctly
- Partial failures handled gracefully
- Logs show per-block timing

---

### Phase 2: Frontend Integration (Sprint 2)
**Scope**: UI + hook implementation
- [ ] Extend `useDictionary` with fast generate actions
- [ ] Add message routing for new types
- [ ] Create "Fast Generate" button with experimental badge
- [ ] Add progress indicator (optional: per-block progress)
- [ ] Display partial failure warnings in UI
- [ ] Add persistence for experimental feature preference

**Acceptance Criteria**:
- Button triggers parallel generation
- Progress indicator updates in real-time (if implemented)
- Partial failures display warning but show completed blocks
- User preference persists across sessions

---

### Phase 3: Prompt Refinement (Sprint 3)
**Scope**: Iterative prompt improvement
- [ ] Test block prompts across models (Claude, GPT-4, Gemini)
- [ ] Refine guardrails to prevent cross-block leakage
- [ ] Optimize batch combining for lightweight blocks
- [ ] Add model-specific prompt variations (if needed)
- [ ] User testing: Collect feedback on quality vs. speed trade-off

**Acceptance Criteria**:
- Block outputs are self-contained (no preambles/closings)
- Quality comparable to standard generation
- At least 2× faster than standard generation
- User feedback positive (>70% would use fast generate)

---

### Phase 4: Performance Tuning (Sprint 4)
**Scope**: Optimization and monitoring
- [ ] Performance testing: Measure latency across models
- [ ] Add Output Channel logging for debugging (per-block timing)
- [ ] Monitor partial failure rates
- [ ] Document performance outcomes in ADR

**Acceptance Criteria**:
- Logging includes per-block timing and errors
- Performance documented in ADR outcomes
- Partial failure rate < 10%

---

### Phase 5: Production Readiness (Future - Not in Initial Epic)
**Scope**: Graduating from experimental to stable
- [ ] Remove experimental badge (based on user feedback)
- [ ] Add caching layer (per-word + model) - if valuable
- [ ] Extract shared fan-out utility (for reuse in other features)
- [ ] Comprehensive automated tests (unit + integration)
- [ ] Visual progress indicator (horizontal list with graying sections)
- [ ] Update documentation and user guide

**Acceptance Criteria**:
- Feature graduates to default (with setting to use standard generation)
- Shared fan-out pattern available for future features
- Test coverage > 80% for fan-out logic
- User guide includes fast generate best practices

**Note**: Phase 5 is deferred - not included in initial epic scope

---

## Testing Strategy

### Unit Tests
- Block prompt generation (ensure guardrails present)
- Result reassembly logic (handle missing blocks)
- Timeout handling (mock slow responses)
- Retry logic (mock transient failures)

### Integration Tests
- Full fan-out flow with mocked OpenRouter responses
- Message envelope routing (request → result)
- Persistence (experimental preference)
- Progress updates (if implemented)

### Manual Testing Checklist
- [ ] Test with 1-word entries (simple)
- [ ] Test with complex words (multiple senses)
- [ ] Test with context provided vs. no context
- [ ] Test partial failures (mock API errors for some blocks)
- [ ] Test across models (Claude, GPT-4, Gemini)
- [ ] Test concurrency limits (verify no throttling)
- [ ] Test progress indicator updates
- [ ] Verify cost is acceptable (<$0.05 per entry)

---

## Design Decisions (Resolved)

1. **Block Granularity**: Each block gets its own API call (no combining)
   - Decision: **14 separate calls** (one per template section), no optimization through combining
   - Rationale: Maximize parallelism, simplicity over micro-optimization

2. **Progress Updates**: Send message as each block completes (like Category Search batching)
   - Decision: Use existing loader graphic + backend messages per completed block
   - Future Enhancement: Visual horizontal list showing sections graying in as they complete
   - Example: `*definition* ↔ **etymology** ↔ *character voices* ↔ etc`

3. **Caching Strategy**: No caching for experimental trial
   - Decision: Defer caching entirely (not in scope)
   - Rationale: Keep experimental feature simple; add if feature graduates

4. **Cost Mitigation**: No cost warning
   - Decision: Experimental badge is sufficient warning
   - Rationale: Users opt-in consciously; avoid friction

5. **Model-Specific Prompts**: Do some models need different block prompts?
   - Recommendation: Start with unified prompts; iterate in Phase 3 based on testing

---

## References

- **Proven Pattern**: [Context Search Epic](.todo/archived/epics/epic-context-search-2025-11-03/) - Fan-out batching for word categorization
- **Architecture**: [Message Envelope ADR](2025-10-28-message-envelope-architecture.md) - Message routing pattern
- **Domain Hooks**: [Presentation Layer ADR](2025-10-27-presentation-layer-domain-hooks.md) - Hook interface pattern
- **Dictionary Service**: `src/infrastructure/api/services/dictionary/DictionaryService.ts`
- **Category Search Reference**: `src/infrastructure/api/services/search/WordSearchService.ts` (batching implementation)

---

## Success Metrics

**Performance**:
- Target: 2-4× faster than standard generation (baseline: 8-15s → target: 3-5s)
- Measure: Average duration across 100 test words

**Quality**:
- Target: >90% block completion rate (≤10% partial failures)
- Measure: Track partial failure rate in production logs

**User Adoption**:
- Target: >30% of dictionary lookups use fast generate after 1 month
- Measure: Telemetry (if added) or user survey

**Cost**:
- Target: <$0.05 per fast dictionary entry (acceptable for experimental feature)
- Measure: OpenRouter API logs

---

## Decision Outcome

**Status**: Proposed → Pending Review

**Next Steps**:
1. Review ADR with stakeholders
2. Create Epic: `epic-parallel-dictionary-generation-2025-11-20`
3. Break into sprints (Phases 1-4)
4. Implement Sprint 1 (Core Fan-Out Infrastructure)
5. Iterate based on user feedback

---

**Author**: Claude Code (AI Agent)
**Reviewer**: [Pending]
**Last Updated**: 2025-11-20
