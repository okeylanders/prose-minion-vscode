# Memory Bank: Sprint 2 & 2.5 - Extension Envelope Migration Complete

**Date**: 2025-11-01
**Branch**: `sprint/epic-message-envelope-2025-10-28-01-handler-registration-types`
**Status**: Sprint 2 & 2.5 Complete, Ready for Sprint 3

## Summary

Completed Sprint 2 (extension-side envelope migration) and Sprint 2.5 (handler ownership inversion). Extension-side code now fully uses MessageEnvelope pattern with domain handlers owning their complete message lifecycle. Zero TypeScript errors, clean architecture.

## What We Built

### Sprint 2: Extension-Side Envelope Migration

**Phase 1: Handler Registration (78% reduction in orchestrator)**
- All 10 domain handlers self-register routes via `registerRoutes(router)`
- MessageHandler constructor: ~60 lines → 13 lines
- No more manual route registration in orchestrator
- Handlers declare their own message types (Strategy pattern)

**Phase 2: Payload Pattern Migration**
- Updated all ~30+ handler methods to use `message.payload` destructuring
- Pattern: `const { field } = message.payload;` (was: `message.field`)
- Applied across all 10 handlers

**Phase 3: Envelope Format for postMessage**
- Updated all postMessage calls to use full envelope structure
- Added `source: 'extension.*'` field to all outgoing messages
- Handlers: SourcesHandler (3), PublishingHandler (1), ProseToolsViewProvider (1), FileOperationsHandler (1), UIHandler (1)
- MessageHandler helpers already compliant from Sprint 1

**Phase 4: Source-Based Echo Prevention**
- Implemented `webviewOriginatedUpdates` Set in ConfigurationHandler
- `markWebviewOriginatedUpdate(key)` flags webview-initiated changes (100ms TTL)
- `shouldBroadcastConfigChange(key)` public API for MessageHandler
- MessageHandler config watcher checks before broadcasting
- Solves settings echo-back race condition:
  - Webview sends UPDATE_SETTING
  - Extension updates VSCode config (marks as webview-originated)
  - onDidChangeConfiguration fires
  - MessageHandler checks shouldBroadcast → skips (prevents double-send)

**Commits:**
- Sprint 2: `ccc16b8` - [sprint-2] feat(handlers): migrate extension to envelope pattern with echo prevention

### Sprint 2.5: Handler Ownership Inversion

**Architecture Shift:**
- **Before**: MessageHandler injected 4-5 callbacks into each handler
- **After**: Handlers receive `postMessage` + `outputChannel` (+ optional `applyTokenUsageCallback`)
- **Benefit**: True domain ownership - handlers control complete message lifecycle

**MessageHandler Changes:**
1. **postMessage() now spies on messages** for caching (orchestration concern):
   ```typescript
   private async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
     // Spy on messages and update cache
     switch (message.type) {
       case MessageType.ANALYSIS_RESULT:
         sharedResultCache.analysis = { ...message };
         sharedResultCache.error = undefined; // TODO: Source-specific clearing
         break;
       // ... other message types
     }
     await this.webview.postMessage(message);
   }
   ```

2. **Removed 5 domain-specific helpers**:
   - ~~sendAnalysisResult~~
   - ~~sendDictionaryResult~~
   - ~~sendContextResult~~
   - ~~sendMetricsResult~~
   - ~~sendSearchResult~~

3. **Kept 3 centralized helpers** (for MessageHandler's own coordination):
   - `sendStatus()` - MessageHandler-level status updates
   - `sendError()` - MessageHandler-level errors
   - `applyTokenUsage()` - Centralized token tracking across all domains

**Handler Pattern Applied (All 10 Handlers):**
```typescript
export class DomainHandler {
  constructor(
    private readonly service: DomainService,
    private readonly postMessage: (message: any) => Promise<void>,
    // Optional: for AI-powered handlers only
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  // Each handler owns its message creation
  private sendResult(...): void {
    const message: DomainResultMessage = {
      type: MessageType.DOMAIN_RESULT,
      source: 'extension.domain',  // Domain-specific, NOT 'extension.handler'
      payload: { ... },
      timestamp: Date.now()
    };
    void this.postMessage(message);  // Spy caches, then sends
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.domain',
      payload: { source, message, details },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(`[DomainHandler] ERROR [${source}]: ${message}`);
  }
}
```

**Handlers Migrated:**
1. **AnalysisHandler** - owns `sendAnalysisResult`, `sendStatus`, `sendError`, `applyTokenUsage`
2. **DictionaryHandler** - owns `sendDictionaryResult`, `sendStatus`, `sendError`, `applyTokenUsage`
3. **ContextHandler** - owns `sendContextResult`, `sendStatus`, `sendError`, `applyTokenUsage`
4. **MetricsHandler** - owns `sendMetricsResult`, `sendError`
5. **SearchHandler** - owns `sendSearchResult`, `sendError`
6. **ConfigurationHandler** - owns `sendError` (already owned model/settings messages)
7. **PublishingHandler** - owns `sendError`
8. **UIHandler** - owns `sendStatus`, `sendError`
9. **FileOperationsHandler** - owns `sendStatus`, `sendError`
10. **SourcesHandler** - minimal, no changes needed

**Commits:**
- Sprint 2.5: `e3917f5` - [sprint-2.5] refactor(handlers): invert ownership - handlers own message sending

## Metrics

**Sprint 2:**
- Files changed: 14
- Handlers updated: 10
- Lines changed: +274, -145

**Sprint 2.5:**
- Files changed: 10
- Lines changed: +447, -178
- MessageHandler helpers removed: 5
- Constructor parameter reduction: 4-5 callbacks → 2-3 dependencies

**Build Status:**
- TypeScript: 0 errors ✅
- Webpack: 3 warnings (bundle size - expected)

## Architecture Benefits

1. **True Domain Ownership**
   - Handlers own complete message lifecycle: create → send → cache
   - No more intimate coupling between orchestrator and domains

2. **Cleaner MessageHandler**
   - Orchestrator doesn't know domain message shapes
   - Just routes incoming, spies on outgoing for caching
   - 78% reduction in constructor orchestration code

3. **Consistent Source Attribution**
   - Each domain uses `source: 'extension.[domain]'`
   - Enables future source-based filtering, debugging, tracing

4. **Better Encapsulation**
   - Handlers are self-contained units
   - Easy to test: mock `postMessage` + `outputChannel` vs. 4-5 callbacks

5. **Echo Prevention**
   - Webview-originated config updates don't echo back
   - Prevents race conditions and UI flicker

## Known Issues / TODOs

### Source-Specific Error Cache Clearing

**Problem**: MessageHandler.postMessage() currently clears ALL domain caches on ANY error:
```typescript
case MessageType.ERROR:
  sharedResultCache.error = { ...message };
  sharedResultCache.analysis = undefined;     // ❌ Too aggressive
  sharedResultCache.dictionary = undefined;   // ❌ Dictionary error shouldn't clear analysis
  sharedResultCache.context = undefined;      // ❌ Too aggressive
  break;
```

**Solution**: Only clear cache for the domain that errored:
```typescript
case MessageType.ERROR:
  const error = message as ErrorMessage;
  sharedResultCache.error = { ...error };

  // Clear only the relevant domain cache based on error source
  if (error.payload.source.startsWith('analysis')) {
    sharedResultCache.analysis = undefined;
  } else if (error.payload.source.startsWith('dictionary')) {
    sharedResultCache.dictionary = undefined;
  } else if (error.payload.source.startsWith('context')) {
    sharedResultCache.context = undefined;
  }
  // Metrics/Search don't cache, so no clearing needed
  break;
```

**Why It Matters**: Dictionary error shouldn't wipe out a successful analysis result. Domains should be independent.

**Priority**: Before Sprint 3 (affects webview error handling)

## Next Steps

### Sprint 3: Webview-Side Migration (~6-8 hours)

**Tasks:**
1. Fix source-specific error cache clearing (see above)
2. Update webview hooks to use envelope pattern
3. Update webview message handlers to use `message.payload`
4. Update persistence to handle envelope structure
5. Manual testing (analysis, dictionary, context, metrics, search, settings)
6. Documentation updates

**Files to Modify:**
- `src/presentation/webview/hooks/useMessageRouter.ts` - envelope routing
- `src/presentation/webview/hooks/domain/*.ts` - 7 domain hooks
- `src/presentation/webview/hooks/usePersistence.ts` - envelope persistence
- `src/presentation/webview/App.tsx` - message sending

**Testing Plan:**
- Test all analysis tools (dialogue, prose)
- Test dictionary lookup
- Test context generation
- Test metrics (prose stats, style flags, word frequency)
- Test search
- Test settings changes (verify echo prevention works)
- Test model selection changes

## Related Work

### Planning Documents
- Epic: `.todo/epics/epic-message-envelope-2025-10-28/epic-message-envelope.md`
- Sprint 1: `.todo/epics/epic-message-envelope-2025-10-28/sprints/01-handler-registration-types.md`
- Sprint 2: `.todo/epics/epic-message-envelope-2025-10-28/sprints/02-extension-migration.md`
- Sprint 3: `.todo/epics/epic-message-envelope-2025-10-28/sprints/03-webview-migration.md`
- ADR: `docs/adr/2025-10-28-message-envelope-architecture.md`

### Related Epics
- **Presentation Hooks Refactor** (completed): Exposed these architecture problems
  - Epic: `.todo/epics/epic-presentation-refactor-2025-10-27/`
  - ADR: `docs/adr/2025-10-27-presentation-layer-domain-hooks.md`

### Previous Memory Banks
- Sprint 1: `.memory-bank/20251101-sprint1-message-envelope-router-types.md`

### Commits
```
b9f553a [sprint-1] feat(messages): implement MessageRouter and envelope types
ccc16b8 [sprint-2] feat(handlers): migrate extension to envelope pattern with echo prevention
e3917f5 [sprint-2.5] refactor(handlers): invert ownership - handlers own message sending
```

## Design Decisions

### Why Ownership Inversion?
- **Alpha software**: Breaking changes are FREE
- **True encapsulation**: Handlers should own their complete lifecycle
- **Testability**: Easier to mock `postMessage` than 4-5 specific callbacks
- **Consistency**: All handlers follow same pattern

### Why Spy Pattern for Caching?
- **Separation of concerns**: Caching is orchestration, not domain responsibility
- **No leaky abstraction**: Handlers don't need to know about cache
- **Single source of truth**: postMessage() sees all outgoing messages

### Why Keep Centralized Token Tracking?
- **Cross-domain concern**: Token totals span all AI-powered handlers
- **Single budget**: User cares about total spend, not per-domain spend
- **Simpler**: One counter vs. coordinating multiple counters

### Why Source-Specific Error Clearing?
- **Domain independence**: Dictionary error shouldn't affect analysis results
- **User experience**: Don't wipe successful results unnecessarily
- **Debugging**: Makes error boundaries clearer

## Success Criteria (Sprint 2 & 2.5)

- ✅ MessageRouter implemented with clear error handling
- ✅ MessageEnvelope interface used by all extension messages
- ✅ All ~50+ message types updated to use envelope
- ✅ MessageHandler uses router (switch removed)
- ✅ All handler methods use message.payload
- ✅ All postMessage calls use envelope format
- ✅ Echo prevention implemented for config updates
- ✅ Handlers own their complete message lifecycle
- ✅ MessageHandler.postMessage() spies for caching
- ✅ TypeScript compilation clean (0 errors)
- ✅ Commits complete with descriptive messages
- ✅ Memory bank entries created

## Risks Mitigated

- **TypeScript errors overwhelming**: Errors guided our work, domain-by-domain approach
- **Lost in refactor scope**: Sprint plan kept work focused and incremental
- **Breaking persistence**: Will handle in Sprint 3 with version check
- **Performance concerns**: Map lookup is O(1), spy switch is O(1)
- **Tight coupling**: Ownership inversion decoupled orchestrator from domains

---

**Status**: ✅ Sprint 2 & 2.5 Complete
**Next**: Sprint 3 - Webview-Side Migration
**Blockers**: None
**Priority TODO**: Fix source-specific error cache clearing before Sprint 3
