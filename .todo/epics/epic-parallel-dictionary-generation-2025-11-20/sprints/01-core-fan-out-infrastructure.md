# Sprint 01: Core Fan-Out Infrastructure

**Epic**: [Parallel Dictionary Generation](../epic-parallel-dictionary-generation.md)
**Status**: Pending
**Duration**: 1-2 days
**Branch**: `epic/parallel-dictionary-generation-2025-11-20` (shared across all sprints)

---

## Goals

Build the backend fan-out infrastructure for parallel dictionary generation:
- Message contracts for fast generate flow
- Service method for parallel generation
- Block-specific prompt templates
- Concurrency management (5 threads)
- Timeout + retry logic
- Handler route registration

---

## Tasks

### 1. Message Contracts

**File**: `src/shared/types/messages/dictionary.ts`

- [ ] Add `FastGenerateDictionaryRequest` interface
  - `word: string`
  - `context?: string`
  - `sourceUri?: string`
- [ ] Add `FastGenerateDictionaryResult` interface
  - `word: string`
  - `blocks: { definitions?, etymology?, usage?, ... }`
  - `metadata: { totalDuration, blockDurations, partialFailures }`
- [ ] Add `DictionaryGenerationProgress` interface
  - `word: string`
  - `completedBlocks: string[]`
  - `totalBlocks: number`
- [ ] Add to `MessageType` enum in `base.ts`:
  - `FAST_GENERATE_DICTIONARY = 'fastGenerateDictionary'`
  - `FAST_GENERATE_DICTIONARY_RESULT = 'fastGenerateDictionaryResult'`
  - `DICTIONARY_GENERATION_PROGRESS = 'dictionaryGenerationProgress'`
- [ ] Export from `index.ts` barrel export

---

### 2. Block-Specific Prompt Templates

**Directory**: `resources/system-prompts/dictionary-fast/`

Create block-specific prompt templates matching the **14-section dictionary template**:

- [ ] Create directory structure: `resources/system-prompts/dictionary-fast/`
- [ ] `00-base-instructions.md` - Modified version of `dictionary-utility/00-dictionary-utility.md`
  - Add instruction: "Generate ONLY the section specified in the following instruction"
  - Preserve operating principles and style guardrails
  - Reference the full output blueprint for context
  - **Word injection point**: "The word is: {word}" (injected at runtime)
  - **Context injection**: "Context (if provided): {context}" (optional)

**Block-Specific Prompts** (each includes the example for that section from `01-dictionary-example.md`):

- [ ] `01-definition-block.md` - 📕 **Definition** only
  - Include example: Lines 11-12 from `01-dictionary-example.md`
- [ ] `02-pronunciation-block.md` - 🔈 **Pronunciation** only
  - Include example: Lines 14-19 from `01-dictionary-example.md`
- [ ] `03-parts-of-speech-block.md` - 🧩 **Parts of Speech** only
  - Include example: Lines 21-23 from `01-dictionary-example.md`
- [ ] `04-sense-explorer-block.md` - 🔍 **Sense Explorer** only
  - Include example: Lines 25-52 from `01-dictionary-example.md`
- [ ] `05-register-connotation-block.md` - 🗣️ **Register & Connotation** only
  - Include example: Lines 54-60 from `01-dictionary-example.md`
- [ ] `06-narrative-texture-block.md` - 🪶 **Narrative Texture** only
  - Include example: Lines 62-65 from `01-dictionary-example.md`
- [ ] `07-collocations-idioms-block.md` - 📚 **Collocations & Idioms** only
  - Include example: Lines 67-70 from `01-dictionary-example.md`
- [ ] `08-morphology-family-block.md` - 🧬 **Morphology & Family** only
  - Include example: Lines 72-77 from `01-dictionary-example.md`
- [ ] `09-character-voice-block.md` - 🎭 **Character Voice Variations** only
  - Include example: Lines 79-87 from `01-dictionary-example.md`
- [ ] `10-soundplay-rhyme-block.md` - 🎵 **Soundplay & Rhyme** only
  - Include example: Lines 89-93 from `01-dictionary-example.md`
- [ ] `11-translations-cognates-block.md` - 🌐 **Translations & Cognates** only
  - Include example: Lines 95-100 from `01-dictionary-example.md`
- [ ] `12-usage-watchpoints-block.md` - ⚠️ **Usage Watchpoints** only
  - Include example: Lines 102-106 from `01-dictionary-example.md`
- [ ] `13-semantic-gradient-block.md` - 🧭 **Semantic Gradient** only
  - Include example: Lines 108-109 from `01-dictionary-example.md`
- [ ] `14-ai-advisory-notes-block.md` - 🧠 **AI Advisory Notes** only
  - Include example: Lines 111-115 from `01-dictionary-example.md`

**Guardrails** (each block prompt):
- "Generate ONLY the [section icon + name] section for the word provided"
- "Do not include preambles, closings, or other sections"
- "Preserve the section icon and heading exactly as shown"
- "Output markdown format matching the reference example below"
- Each block prompt includes the specific example for that section

---

### 3. DictionaryService Enhancement

**File**: `src/infrastructure/api/services/dictionary/DictionaryService.ts`

- [ ] Add constants:
  - `CONCURRENCY_LIMIT = 5`
  - `BLOCK_TIMEOUT = 10000` (10 seconds)
- [ ] Add `generateParallelDictionary()` method
  - Accept `word: string, context?: string`
  - Return `Promise<FastGenerateDictionaryResult>`
- [ ] Implement `getBlockPrompts()` method
  - Load block-specific prompts from `resources/system-prompts/dictionary-fast/`
  - Inject word and context into each template
  - Return map: `{ blockName: promptString }`
- [ ] Implement `buildBlockPrompt()` method
  - Combine base instructions + block-specific template
  - Inject word and context
  - Add guardrails
- [ ] Implement `generateBlock()` method
  - Fire single OpenRouter API call
  - Wrap with timeout (Promise.race)
  - Retry once on failure
  - Return `{ blockName, content, duration, error? }`
- [ ] Implement `executeWithConcurrency()` method
  - Use concurrency limiter (p-limit or manual queue)
  - Cap at 5 concurrent calls
  - Send progress message per completed block
- [ ] Implement `assembleResult()` method
  - Merge block results into `FastGenerateDictionaryResult`
  - Calculate total duration
  - Track partial failures (blocks with errors)
  - Return assembled result

---

### 4. Handler Route Registration

**File**: `src/application/handlers/domain/DictionaryHandler.ts`

- [ ] Add `handleFastGenerate()` method
  - Extract `word`, `context`, `sourceUri` from message payload
  - Call `dictionaryService.generateParallelDictionary()`
  - Send `FAST_GENERATE_DICTIONARY_RESULT` message back to webview
  - Handle errors (send error message)
- [ ] Register route in `registerRoutes()`:
  - `MessageType.FAST_GENERATE_DICTIONARY → handleFastGenerate`
- [ ] Add progress message sending in service (call from `executeWithConcurrency`)
  - Send `DICTIONARY_GENERATION_PROGRESS` after each block completes

---

### 5. Concurrency Management

**Dependencies**: Install `p-limit` (or use manual queue)

```bash
npm install p-limit
npm install --save-dev @types/p-limit
```

- [ ] Install `p-limit` package
- [ ] Import in `DictionaryService.ts`
- [ ] Use in `executeWithConcurrency()`:
  ```typescript
  const limit = pLimit(this.CONCURRENCY_LIMIT);
  const promises = blocks.map(block => limit(() => this.generateBlock(block)));
  const results = await Promise.all(promises);
  ```

---

### 6. Error Handling and Logging

**File**: `src/infrastructure/api/services/dictionary/DictionaryService.ts`

- [ ] Add try/catch in `generateBlock()` with retry logic
- [ ] Log to Output Channel:
  - "Starting parallel dictionary generation for '{word}'"
  - "Block '{blockName}' completed in {duration}ms"
  - "Block '{blockName}' failed: {error}"
  - "Retrying block '{blockName}'..."
  - "Parallel generation completed: {successCount}/{totalCount} blocks in {totalDuration}ms"
- [ ] Handle partial failures gracefully:
  - Continue with successful blocks
  - Mark failed blocks in `metadata.partialFailures`
  - Include partial result in response

---

## Acceptance Criteria

✅ **Message Types**:
- All new message interfaces added to `dictionary.ts`
- Message types added to `MessageType` enum
- Exported from barrel export

✅ **Prompt Templates**:
- 8 block-specific prompts created in `resources/system-prompts/dictionary-fast/`
- Each prompt includes guardrails ("ONLY return this section")
- Prompts load correctly from filesystem

✅ **Service Implementation**:
- `generateParallelDictionary()` successfully fans out 6-8 API calls
- Concurrency capped at 5 (no throttling)
- Results reassemble correctly into `FastGenerateDictionaryResult`
- Partial failures handled gracefully (show completed blocks)

✅ **Handler Registration**:
- Route registered for `FAST_GENERATE_DICTIONARY`
- Handler calls service and returns result
- Progress messages sent per completed block

✅ **Logging**:
- Output Channel logs per-block timing
- Errors logged with retry attempts
- Total duration logged at completion

✅ **Testing**:
- Manual test: Send `FAST_GENERATE_DICTIONARY` message from webview
- Verify: 6-8 API calls fired in parallel (check Output Channel logs)
- Verify: Results reassemble correctly
- Verify: Partial failures don't block response

---

## Testing Checklist

### Manual Testing

- [ ] Test with simple word (e.g., "run")
  - Verify all 8 blocks complete successfully
  - Check Output Channel for timing logs
  - Verify result structure matches `FastGenerateDictionaryResult`
- [ ] Test with complex word (e.g., "ephemeral")
  - Verify quality of block outputs
  - Check for cross-block leakage (blocks shouldn't reference each other)
- [ ] Test with context provided
  - Verify context injected into prompts
  - Check if context improves block relevance
- [ ] Simulate API failure (disconnect network mid-request)
  - Verify retry logic triggers
  - Verify partial failures marked in metadata
  - Verify completed blocks still returned

### Code Review Checklist

- [ ] Message contracts follow existing patterns (BaseMessage, MessageType enum)
- [ ] Service follows DictionaryService patterns (constructor injection, error handling)
- [ ] Handler follows domain handler patterns (registerRoutes, message envelope)
- [ ] Prompts follow existing prompt structure (markdown, clear instructions)
- [ ] Logging follows existing Output Channel patterns

---

## Dependencies

**Packages**:
- `p-limit` (concurrency management)

**Existing Code**:
- `DictionaryService` (extend with new method)
- `DictionaryHandler` (add route registration)
- Message envelope pattern (reuse)
- OpenRouter client (reuse)

---

## Notes

**Prompt Engineering Strategy**:
- Start with simple block-specific prompts (copy from main dictionary prompt, focus on one block)
- Test guardrails effectiveness (check for cross-block leakage)
- Iterate in Sprint 3 based on quality outcomes

**Performance Expectations**:
- Each block call: ~1-3 seconds (varies by complexity and model)
- Total parallel time: ~3-5 seconds (max of slowest block + overhead)
- Standard generation baseline: ~8-15 seconds

**Alpha Development**:
- Breaking changes allowed (no backward compatibility)
- Focus on working implementation; refine in later sprints

---

## Outcomes (Post-Sprint)

**Completed**: [Date]
**PR**: [Link]
**Actual Duration**: [Days]

**Achievements**:
- [List of completed tasks]
- [Performance measurements]
- [Any deviations from plan]

**Issues Discovered**:
- [Architecture debt identified]
- [Blockers encountered]
- [Lessons learned]

---

**Last Updated**: 2025-11-20
