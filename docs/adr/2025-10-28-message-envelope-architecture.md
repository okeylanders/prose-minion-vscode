# ADR: Message Envelope Architecture with Handler Registration

Status: Accepted
Date: 2025-10-28
Implemented: Complete (PR #12, PR #13)
Implementation Date: 2025-11-01

## Context

The message architecture has grown organically and now exhibits fundamental problems that cannot be fixed with patches:

### Current Pain Points

**1. Switch-Based Message Routing**
- MessageHandler.ts uses a large switch statement (lines 176-304, ~130 lines)
- Domain handlers are injected but called by the orchestrator
- No clear ownership - handlers are passive receivers
- Adding new message types requires editing MessageHandler
- Switch statement grows unbounded

**2. Configuration Event Race Conditions**
- Settings UI updates → sends UPDATE_SETTING
- ConfigurationHandler updates VSCode config
- VSCode config watcher fires `onDidChangeConfiguration`
- Handler sends MODEL_DATA/SETTINGS_DATA back to webview
- Settings UI receives update it just sent, causing:
  - State thrashing and UI flicker
  - Dropped updates
  - Competing updates between user actions and echo responses

**3. Multiple Sources of Truth**
The same data exists in 4 places with unclear precedence:
- VSCode Config (proseMinion.*)
- Frontend State (React state)
- Backend Cache (sharedResultCache)
- Service State (ProseAnalysisService)

**4. Unclear Ownership**
No clear answer to "who responds to model selection changes?":
- Config watcher in MessageHandler?
- handleSetModelSelection in ConfigurationHandler?
- Frontend optimistic update?
- All of the above? (Current broken state)

**5. Message Contract Inconsistency**
- Different message types have different top-level structures
- No standard envelope for routing metadata (source, target)
- Hard to implement cross-cutting concerns (tracing, filtering)
- No way to prevent echo-back from config watcher

**6. Temporal Coupling**
VSCode's config system is async but reads appear sync:
```typescript
await config.update(key, value);  // Async save
const read = config.get(key);     // Sync read returns OLD value!
```

Current "solution": `await setTimeout(50ms)` to let config settle (code smell)

### Real-World Scenario

**Settings Screen Update Flow (Current - Broken)**:
```
1. User clicks dropdown in Settings UI
   ↓
2. Frontend: setState + send SET_MODEL_SELECTION
   ↓
3. Backend: config.update()
   ↓
4. Config Watcher: fires immediately
   ↓
5. Read config (still OLD due to async save)
   ↓
6. Send MODEL_DATA with OLD values
   ↓
7. Frontend: receives OLD data, overwrites user selection
   ↓
8. User sees wrong model ❌
```

## Decision

Implement a two-part architectural refactor:

### Part 1: Handler-Registered Strategy Pattern

**Current Pattern (Orchestrator Dispatch)**:
```typescript
// MessageHandler constructor
this.analysisHandler = new AnalysisHandler(...)
this.dictionaryHandler = new DictionaryHandler(...)

// MessageHandler.handleMessage()
switch (message.type) {
  case MessageType.ANALYZE_DIALOGUE:
    await this.analysisHandler.handleAnalyzeDialogue(message);
    break;
  // ... 30+ cases
}
```

**New Pattern (Handler Registration)**:
```typescript
// MessageRouter manages the strategy map
class MessageRouter {
  private handlers = new Map<MessageType, (msg: WebviewToExtensionMessage) => Promise<void>>();

  register(messageType: MessageType, handler: (msg: any) => Promise<void>): void {
    if (this.handlers.has(messageType)) {
      throw new Error(`Duplicate handler registration for ${messageType}`);
    }
    this.handlers.set(messageType, handler);
  }

  async route(message: WebviewToExtensionMessage): Promise<void> {
    const handler = this.handlers.get(message.type);
    if (!handler) {
      throw new Error(`No handler registered for ${message.type}`);
    }
    await handler(message);
  }
}

// Domain handlers register themselves
class AnalysisHandler {
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.ANALYZE_DIALOGUE, this.handleAnalyzeDialogue.bind(this));
    router.register(MessageType.ANALYZE_PROSE, this.handleAnalyzeProse.bind(this));
  }
}

// MessageHandler becomes thin coordinator
class MessageHandler {
  private router = new MessageRouter();

  constructor(...deps) {
    // Handlers self-register their routes
    this.analysisHandler = new AnalysisHandler(...);
    this.analysisHandler.registerRoutes(this.router);

    this.dictionaryHandler = new DictionaryHandler(...);
    this.dictionaryHandler.registerRoutes(this.router);
    // ... etc
  }

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    await this.router.route(message);
  }
}
```

**Benefits**:
- ✅ Handlers own their message types (domain ownership)
- ✅ No central switch statement to maintain
- ✅ Easy to add new handlers - they register themselves
- ✅ Clear coupling: handler declares dependencies
- ✅ Easier testing: can test router + handler independently
- ✅ Open/Closed Principle: extend by adding handlers, don't modify orchestrator

### Part 2: Standardized Message Envelope

**Current Structure (Inconsistent)**:
```typescript
// Some messages
{ type: MessageType.ANALYZE_DIALOGUE, text: string, ... }

// Others
{ type: MessageType.UPDATE_SETTING, key: string, value: any, ... }

// No metadata for routing
```

**New Structure (Standard Envelope)**:
```typescript
interface MessageEnvelope<TPayload = any> {
  // Required metadata
  type: MessageType;
  source: string;        // e.g., "webview.settings.overlay"

  // Optional routing hints
  target?: string;       // e.g., "extension.configuration"

  // Actual message payload
  payload: TPayload;     // Type varies by message type

  // Standard metadata
  timestamp: number;
  correlationId?: string; // For request/response tracking
}

// Example transformation
// BEFORE
{
  type: MessageType.UPDATE_SETTING,
  key: 'ui.showTokenWidget',
  value: true,
  timestamp: Date.now()
}

// AFTER
{
  type: MessageType.UPDATE_SETTING,
  source: 'webview.settings.overlay',
  payload: {
    key: 'ui.showTokenWidget',
    value: true
  },
  timestamp: Date.now()
}
```

**Benefits**:
- ✅ Enables source tracking (solves echo-back problem!)
- ✅ Consistent structure across all messages
- ✅ Easier to implement middleware (logging, tracing, filtering)
- ✅ Can implement request/response correlation
- ✅ Future-proof for advanced routing

### Part 3: Source-Based Echo Prevention

**Solution**:
```typescript
class ConfigurationHandler {
  private lastUpdateSource?: string;

  async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
    // Track who sent this update
    this.lastUpdateSource = message.source; // e.g., "webview.settings.overlay"

    const config = vscode.workspace.getConfiguration('proseMinion');
    await config.update(message.payload.key, message.payload.value, true);

    // Clear after a short delay (config watcher will fire soon)
    setTimeout(() => { this.lastUpdateSource = undefined; }, 100);
  }

  async sendModelData(triggeredBy?: string): Promise<void> {
    // If update came from webview, don't echo back to webview
    if (this.lastUpdateSource?.startsWith('webview.')) {
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Skipping echo to ${this.lastUpdateSource}`
      );
      return;
    }

    // Otherwise, send update (triggered by VSCode settings UI or JSON edit)
    const message: ModelDataMessage = { /* ... */ };
    this.postMessage(message);
  }
}
```

**Benefits**:
- ✅ Prevents webview echo-back
- ✅ Still updates webview when VSCode settings change externally
- ✅ No lost updates
- ✅ Clean architectural solution (not a band-aid)

## Alternatives Considered

### Alternative 1: Keep Switch-Based Routing
**Rejected** – Violates Open/Closed Principle. Every new message type requires modifying MessageHandler. Doesn't address ownership or echo problems.

### Alternative 2: Add Source Field Without Envelope (Partial Refactor)
**Rejected for Alpha** – Since breaking changes are FREE in alpha, there's no reason to stagger the work. Doing a partial refactor now means touching all message sends again later for full envelope.

### Alternative 3: Client-Side Echo Filtering
**Rejected** – Band-aid solution that doesn't address root cause. Requires timeout-based hacks in every hook that updates settings. Not architecturally sound.

### Alternative 4: Debounced Config Watcher
**Rejected** – Still echoes back to webview (just delayed). Doesn't solve the race condition, just makes it less visible.

### Alternative 5: Redux or MobX for State Management
**Rejected** – Overkill. The problem is message routing and config echo, not state management patterns. Adding another library doesn't solve the architectural issues.

## Consequences

### Positive

**Code Organization**:
- ✅ MessageHandler: 495 lines → ~200 lines (60% reduction)
- ✅ Domain handlers own their message routes
- ✅ Easier to add new message types (register, don't modify)
- ✅ Clear separation of concerns

**Settings Race Conditions**:
- ✅ No more echo-back from config watcher
- ✅ No more UI flicker or state thrashing
- ✅ Optimistic updates work correctly
- ✅ External config changes still propagate

**Message Architecture**:
- ✅ Consistent envelope structure
- ✅ Source tracking for debugging
- ✅ Future-proof for correlation IDs, tracing
- ✅ Easier middleware implementation

**Maintainability**:
- ✅ Better testability (can test router + handler independently)
- ✅ Better debugging (source in logs)
- ✅ Better extensibility (register new handlers)

### Neutral

- More boilerplate per handler (registerRoutes method)
- Slightly more indirection (map lookup vs switch)
- One level of nesting (payload wrapper)
- Need to update ~100+ message sends

### Risks

- ⚠️ **BREAKING CHANGE** - All message types need migration
- ⚠️ Requires updating ~100+ message sends
- ⚠️ Need to drop old persisted state (alpha - acceptable)
- ⚠️ Must ensure handlers are instantiated before registration
- ⚠️ TypeScript errors will flood initially (but guide the refactor)

**Mitigation**: Alpha software with no releases. Breaking changes are FREE. Can always reset to main branch if needed.

## Implementation Strategy

### Phase 1: Type Definitions (30 min)
1. Create MessageEnvelope interface in base.ts
2. Update all message type interfaces to use envelope pattern
3. Let TypeScript show ~200+ errors (our TODO list)

### Phase 2: Extension-Side Migration (1 day)
1. Create MessageRouter class
2. Update MessageHandler to use router
3. Update each domain handler to register routes
4. Update each handler method to use payload
5. Update all postMessage calls to use envelope

### Phase 3: Webview-Side Migration (1 day)
1. Update all postMessage calls to use envelope
2. Update all message handlers to use payload
3. Update persistence layer to drop old state

### Phase 4: Testing (2-3 hours)
1. Manual test pass per domain
2. Verify settings don't echo
3. Verify all tabs work
4. Verify persistence (with new state format)
5. Ship when build is green

## Migration Approach

**Type-First Refactor**: Define types, let TypeScript guide the migration.

**Work Domain-by-Domain**:
1. ConfigurationHandler (test settings echo prevention)
2. AnalysisHandler
3. MetricsHandler
4. SearchHandler
5. DictionaryHandler
6. ContextHandler
7. PublishingHandler
8. SourcesHandler
9. UIHandler
10. FileOperationsHandler

**Test After Each Domain**: Ensure no regressions before moving to next.

## Source Naming Conventions

**Extension Sources**:
- `extension.configuration` - ConfigurationHandler
- `extension.analysis` - AnalysisHandler
- `extension.metrics` - MetricsHandler
- `extension.search` - SearchHandler
- `extension.dictionary` - DictionaryHandler
- `extension.context` - ContextHandler
- `extension.publishing` - PublishingHandler
- `extension.sources` - SourcesHandler
- `extension.ui` - UIHandler
- `extension.file_ops` - FileOperationsHandler

**Webview Sources**:
- `webview.settings.overlay` - SettingsOverlay component
- `webview.settings.tab_bar` - TabBar token widget
- `webview.analysis.tab` - AnalysisTab component
- `webview.metrics.tab` - MetricsTab component
- `webview.dictionary.tab` - UtilitiesTab component
- `webview.search.tab` - SearchTab component
- `webview.context.assistant` - Context assistant component

## Persistence Migration

**Drop Old State Format (Alpha)**:
```typescript
// usePersistence.ts - add version check
const loadPersistedState = () => {
  const state = vscode.getState();

  // Drop old state format (pre-envelope)
  if (state && !state.version) {
    console.log('[Persistence] Dropping old state format after message envelope refactor');
    return undefined;
  }

  return state;
};
```

**Why**: Trying to migrate persisted state is not worth the effort in alpha. Users can re-select models and re-run analyses.

## Testing Plan

**Per-Domain Testing**:
- Test domain after refactoring its handlers
- Verify messages send/receive correctly
- Check OutputChannel logs for correct source

**Settings Echo Testing**:
- Change model selection in settings → Verify no echo
- Change setting in settings.json → Verify webview updates
- Toggle UI setting → Verify no flicker

**Integration Testing**:
- All tabs work correctly
- State persistence works (new format)
- No regressions in existing functionality

## Success Metrics

- MessageHandler: 495 → ~200 lines (60% reduction)
- Switch statement: 30+ cases → Strategy pattern registry
- Settings echo bugs: 5+ bugs → 0 bugs
- Message structure: Inconsistent → Consistent envelope
- Source tracking: None → All messages
- Config race conditions: Frequent → None

## Links

- Planning Document: `.planning/architecture-refactor-message-routing-and-config-events.md`
- Epic: `.todo/epics/epic-message-envelope-2025-10-28/epic-message-envelope.md`
- Sprint 1: `.todo/epics/epic-message-envelope-2025-10-28/sprints/01-handler-registration-types.md`
- Sprint 2: `.todo/epics/epic-message-envelope-2025-10-28/sprints/02-extension-migration.md`
- Sprint 3: `.todo/epics/epic-message-envelope-2025-10-28/sprints/03-webview-migration-testing.md`
- Branch: `sprint/epic-message-envelope-2025-10-28-01-handler-registration-types`
- Related ADR: `docs/adr/2025-10-27-presentation-layer-domain-hooks.md` (frontend refactor that exposed these issues)
- Related ADR: `docs/adr/2025-10-26-message-architecture-organization.md` (backend domain handlers)

## Future Enhancements

**Post-v1.0**:
- Correlation IDs for request/response tracking
- Message tracing middleware
- Advanced routing based on target hints
- Message replay for debugging
- Message queue for offline operation
- WebSocket for bidirectional streaming (if needed)
