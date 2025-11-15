# Sprint 02: Tier 2 - Domain Handlers

**Epic**: [Infrastructure Testing Framework](../epic-infrastructure-testing.md)
**Status**: ✅ Complete
**Branch**: `epic/infrastructure-testing-2025-11-15`
**Commit Prefix**: `[Sprint 02]`
**Completion Date**: 2025-11-15
**Estimated Effort**: 2-3 days
**Actual Effort**: ~2 hours
**ADR**: [ADR-2025-11-15: Lightweight Testing Framework](../../../docs/adr/2025-11-15-lightweight-testing-framework.md)
**Depends On**: Sprint 01 (Infrastructure Patterns)

---

## Goals

Test all domain handlers to ensure they correctly register routes, handle messages, cache results, and gracefully handle errors. Focus on orchestration logic that ties infrastructure patterns to business logic.

**Focus**: Domain handler lifecycle (registration, message processing, error handling, caching)

---

## Scope

### In Scope
- ✅ Test all 10 domain handlers for route registration
- ✅ Test message processing for each handler
- ✅ Test error handling for malformed messages
- ✅ Test result caching behavior
- ✅ Validate handler initialization and cleanup

### Out of Scope
- ❌ Business logic testing (Sprint 03)
- ❌ Service implementation testing (defer to integration tests)
- ❌ UI component testing (Tier 4 - deferred to v1.0)

---

## Domain Handlers to Test

Based on [MessageHandler.ts](../../../src/application/handlers/MessageHandler.ts), we have 10 domain handlers:

1. **AnalysisHandler** - Dialogue and prose analysis
2. **DictionaryHandler** - Word lookups and definitions
3. **ContextHandler** - Context generation and resource management
4. **MetricsHandler** - Prose stats, style flags, word frequency
5. **SearchHandler** - Word search and clustering
6. **ConfigurationHandler** - Settings, models, API keys
7. **PublishingHandler** - Publishing standards and comparisons
8. **SourcesHandler** - File and glob operations
9. **UIHandler** - Tab changes, selections, guides
10. **FileOperationsHandler** - File read/write operations

---

## Tasks

### Test Pattern Template

Each handler test should follow this structure:

```typescript
import { HandlerName } from '@/application/handlers/domain/HandlerName';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('HandlerName', () => {
  let handler: HandlerName;
  let mockService: jest.Mocked<ServiceType>;
  let router: MessageRouter;

  beforeEach(() => {
    mockService = createMockService();
    handler = new HandlerName(mockService, mockHelper);
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register all routes on initialization', () => {
      handler.registerRoutes(router);

      expect(router.hasRoute(MessageType.HANDLER_MESSAGE_1)).toBe(true);
      expect(router.hasRoute(MessageType.HANDLER_MESSAGE_2)).toBe(true);
    });
  });

  describe('Message Processing', () => {
    it('should process valid messages successfully', async () => {
      const msg = createMessageEnvelope({
        type: MessageType.HANDLER_MESSAGE_1,
        source: 'test',
        payload: { /* valid payload */ }
      });

      await expect(handler.handleMessage(msg)).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed messages gracefully', async () => {
      const msg = createMessageEnvelope({
        type: MessageType.HANDLER_MESSAGE_1,
        source: 'test',
        payload: { /* invalid payload */ }
      });

      await expect(handler.handleMessage(msg)).resolves.not.toThrow();
    });

    it('should handle service failures gracefully', async () => {
      mockService.someMethod.mockRejectedValue(new Error('Service failure'));

      const msg = createMessageEnvelope({
        type: MessageType.HANDLER_MESSAGE_1,
        source: 'test',
        payload: { /* valid payload */ }
      });

      await expect(handler.handleMessage(msg)).resolves.not.toThrow();
    });
  });

  describe('Result Caching', () => {
    it('should cache results correctly', async () => {
      // Test caching logic if applicable
    });
  });
});
```

---

### Handler-Specific Tests

#### 1. AnalysisHandler

- [ ] **`src/__tests__/application/handlers/domain/AnalysisHandler.test.ts`**

  **Routes to test**:
  - `ANALYZE_DIALOGUE` → Dialogue analysis with microbeats
  - `ANALYZE_PROSE` → Prose analysis and suggestions
  - `CLEAR_ANALYSIS_RESULT` → Clear cached analysis

  **What to test**:
  - Route registration for all analysis message types
  - Analysis result caching in MessageHandler
  - Error handling for invalid prose/dialogue input
  - Guide loading (if `includeCraftGuides` enabled)

---

#### 2. DictionaryHandler

- [ ] **`src/__tests__/application/handlers/domain/DictionaryHandler.test.ts`**

  **Routes to test**:
  - `DICTIONARY_LOOKUP` → Word definition lookup
  - `DICTIONARY_CONTEXT_LOOKUP` → Context-aware word lookup

  **What to test**:
  - Route registration
  - Error handling for empty word input
  - Service call with correct parameters

---

#### 3. ContextHandler

- [ ] **`src/__tests__/application/handlers/domain/ContextHandler.test.ts`**

  **Routes to test**:
  - `GENERATE_CONTEXT` → Context generation from resources
  - `REQUEST_CONTEXT_RESOURCES` → Fetch available resources
  - `CLEAR_CONTEXT_RESULT` → Clear cached context

  **What to test**:
  - Route registration
  - Resource discovery and filtering
  - Context window trimming (50K words)
  - Error handling for missing resources

---

#### 4. MetricsHandler

- [ ] **`src/__tests__/application/handlers/domain/MetricsHandler.test.ts`**

  **Routes to test**:
  - `PROSE_STATS` → Word count, sentence analysis, pacing
  - `STYLE_FLAGS` → Style patterns and issues
  - `WORD_FREQUENCY` → Word usage, Top 100, hapax, POS

  **What to test**:
  - Route registration for all metrics tools
  - Settings integration (word length filter, POS enabled, etc.)
  - Result caching per subtool
  - Error handling for empty prose input

---

#### 5. SearchHandler

- [ ] **`src/__tests__/application/handlers/domain/SearchHandler.test.ts`**

  **Routes to test**:
  - `WORD_SEARCH` → Word search with clustering
  - `CLEAR_SEARCH_RESULT` → Clear cached search

  **What to test**:
  - Route registration
  - Settings integration (context words, cluster window, etc.)
  - Clustering algorithm invocation
  - Error handling for empty targets

---

#### 6. ConfigurationHandler

- [ ] **`src/__tests__/application/handlers/domain/ConfigurationHandler.test.ts`**

  **Routes to test**:
  - `REQUEST_MODEL_DATA` → Fetch available models
  - `REQUEST_SETTINGS` → Fetch current settings
  - `UPDATE_SETTING` → Update setting value
  - `SET_MODEL_SELECTION` → Update model selection

  **What to test**:
  - Route registration
  - Settings sync (VSCode → webview)
  - API key retrieval (SecretStorage)
  - Publishing standards preset loading

---

#### 7. PublishingHandler

- [ ] **`src/__tests__/application/handlers/domain/PublishingHandler.test.ts`**

  **Routes to test**:
  - `REQUEST_PUBLISHING_PRESETS` → Fetch available presets
  - `REQUEST_PUBLISHING_TRIM_SIZES` → Fetch trim sizes for genre
  - `REQUEST_PUBLISHING_COMPARISON` → Fetch comparison data

  **What to test**:
  - Route registration
  - Preset loading from repository
  - Trim size filtering by genre
  - Comparison data structure

---

#### 8. SourcesHandler

- [ ] **`src/__tests__/application/handlers/domain/SourcesHandler.test.ts`**

  **Routes to test**:
  - `REQUEST_FILE_READ` → Read file contents
  - `REQUEST_GLOB_RESULTS` → Glob pattern matching

  **What to test**:
  - Route registration
  - File read with encoding
  - Glob pattern validation
  - Error handling for non-existent files

---

#### 9. UIHandler

- [ ] **`src/__tests__/application/handlers/domain/UIHandler.test.ts`**

  **Routes to test**:
  - `TAB_CHANGE` → Tab navigation
  - `PASTE_SELECTION` → Paste with source metadata
  - `GUIDE_PILL_CLICK` → Open guide files
  - `RESOURCE_PILL_CLICK` → Open resource files

  **What to test**:
  - Route registration
  - File opening in VSCode editor
  - Column selection (smart editor split)
  - Error handling for non-existent files

---

#### 10. FileOperationsHandler

- [ ] **`src/__tests__/application/handlers/domain/FileOperationsHandler.test.ts`**

  **Routes to test**:
  - `SAVE_REPORT` → Save metrics/analysis reports
  - File write operations

  **What to test**:
  - Route registration
  - Directory creation (ensure parent exists)
  - File write with encoding
  - Error handling for write failures

---

## Acceptance Criteria

- [ ] All 10 domain handlers have corresponding test files
- [ ] Route registration tested for each handler
- [ ] Message processing tested for primary message types
- [ ] Error handling tested for malformed messages
- [ ] Service failures handled gracefully (no crashes)
- [ ] Result caching validated where applicable
- [ ] All tests pass (`npm test`)
- [ ] Code coverage increases to ~30-35%

---

## Implementation Notes

### Mocking Services

**Pattern**:
```typescript
const createMockService = (): jest.Mocked<ServiceType> => ({
  someMethod: jest.fn().mockResolvedValue({ /* mock response */ }),
  anotherMethod: jest.fn().mockResolvedValue({ /* mock response */ })
});
```

**When to mock**:
- OpenRouter API calls (always mock - external dependency)
- VSCode API calls (always mock - extension host not available in tests)
- File system operations (mock unless testing file operations specifically)

---

### Error Handling Pattern

All handlers should follow this pattern:

```typescript
try {
  // Business logic
} catch (error) {
  console.error('Handler error:', error);
  // Return error message to webview
  webviewPanel.postMessage(createMessageEnvelope({
    type: MessageType.STATUS,
    source: 'extension.handler.domain',
    payload: { message: 'Error occurred', isError: true }
  }));
}
```

Tests validate that errors don't crash the handler and that appropriate error messages are sent.

---

## Deliverables

- ✅ `src/__tests__/application/handlers/domain/AnalysisHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/DictionaryHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/ContextHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/MetricsHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/SearchHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/ConfigurationHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/PublishingHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/SourcesHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/UIHandler.test.ts`
- ✅ `src/__tests__/application/handlers/domain/FileOperationsHandler.test.ts`

---

## Success Metrics

After Sprint 02:
- ✅ 30-35% code coverage (infrastructure + handlers)
- ✅ Error handling standardized across all handlers
- ✅ Regression protection for handler registration
- ✅ Confident refactoring of handler logic

---

## Related Documentation

- [Epic: Infrastructure Testing](../epic-infrastructure-testing.md)
- [Sprint 01: Tier 1 - Infrastructure Patterns](01-tier1-infrastructure-patterns.md)
- [ADR-2025-11-15: Lightweight Testing Framework](../../../docs/adr/2025-11-15-lightweight-testing-framework.md)
- [MessageHandler.ts](../../../src/application/handlers/MessageHandler.ts)

---

**Status**: Pending
**Next Action**: Begin after Sprint 01 completion
