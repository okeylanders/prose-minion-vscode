# Architecture Refactor: Message Routing & Configuration Events

**Date**: 2025-10-28
**Status**: PLANNING - Working Document
**Author**: Collaborative analysis (User + Claude)

## Context

The architecture has grown organically and is now showing strain, particularly around:
1. Message routing (switch-based orchestrator vs handler-registered strategy)
2. Configuration event publishing (race conditions from echo-back to sender)
3. Overall coordination complexity

The infrastructure, presentation layer, and application layers have good patterns, but they're being retrofitted causing friction.

---

## Problem Statement

### Current Pain Points

1. **Message Routing Architecture**
   - MessageHandler.ts uses a large switch statement (lines 176-304)
   - Domain handlers are injected and called by the orchestrator
   - No clear ownership - handlers are passive receivers
   - Adding new message types requires editing MessageHandler

2. **Configuration Event Race Conditions**
   - Settings UI updates a setting → sends UPDATE_SETTING
   - ConfigurationHandler updates VSCode config
   - VSCode config watcher fires `onDidChangeConfiguration` (line 81-92 in MessageHandler.ts)
   - Handler sends MODEL_DATA/SETTINGS_DATA back to webview
   - Settings UI receives update it just sent, causing:
     - State thrashing
     - UI flicker/wonkiness
     - Dropped updates
     - Competing updates between user actions and echo responses

3. **Message Contract Inconsistency**
   - Different message types have different top-level structures
   - No standard envelope for routing metadata (source, target)
   - Hard to implement cross-cutting concerns (tracing, filtering)

---

## Proposal 1: Inverted Message Routing (Handler-Registered Strategy)

### Current Pattern (Orchestrator Dispatch)

```typescript
// MessageHandler constructor
this.analysisHandler = new AnalysisHandler(...)
this.dictionaryHandler = new DictionaryHandler(...)
// ... etc

// MessageHandler.handleMessage()
switch (message.type) {
  case MessageType.ANALYZE_DIALOGUE:
    await this.analysisHandler.handleAnalyzeDialogue(message);
    break;
  // ... 30+ cases
}
```

**Issues:**
- Central orchestrator must know about all handlers
- Adding message type requires editing orchestrator
- Handlers are passive - no ownership
- Switch statement grows unbounded

### Proposed Pattern (Handler Registration)

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

**Benefits:**
- ✅ Handlers own their message types (domain ownership)
- ✅ No central switch statement to maintain
- ✅ Easy to add new handlers - they register themselves
- ✅ Clear coupling: handler declares dependencies
- ✅ Easier testing: can test router + handler independently
- ✅ Open/Closed Principle: extend by adding handlers, don't modify orchestrator

**Concerns:**
- More boilerplate per handler (registerRoutes method)
- Slightly more indirection (map lookup vs switch)
- Need to ensure handlers are instantiated before registration

**Verdict:** ✅ **Strong improvement** - Better separation of concerns, clearer ownership, more maintainable

---

## Proposal 2: Standardized Message Envelope

### Current Structure

Messages have inconsistent top-level fields:
```typescript
// Some messages
{ type: MessageType.ANALYZE_DIALOGUE, text: string, ... }

// Others
{ type: MessageType.UPDATE_SETTING, key: string, value: any, ... }

// No metadata for routing
```

### Proposed Structure

```typescript
interface MessageEnvelope {
  // Required metadata
  type: MessageType;
  source: string;        // e.g., "webview.settings.overlay"

  // Optional routing hints
  target?: string;       // e.g., "extension.configuration"

  // Actual message payload
  payload: any;          // Type varies by message type

  // Standard metadata
  timestamp: number;
  correlationId?: string; // For request/response tracking
}
```

**Example:**
```typescript
// Before
{
  type: MessageType.UPDATE_SETTING,
  key: 'ui.showTokenWidget',
  value: true,
  timestamp: Date.now()
}

// After
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

**Benefits:**
- ✅ Enables source tracking (solves echo-back problem!)
- ✅ Consistent structure across all messages
- ✅ Easier to implement middleware (logging, tracing, filtering)
- ✅ Can implement request/response correlation
- ✅ Future-proof for advanced routing

**Concerns:**
- ⚠️ **BREAKING CHANGE** - All message types need migration
- ⚠️ Requires updating ~100+ message sends
- ⚠️ Need migration strategy for persisted state
- Adds one level of nesting (payload wrapper)

**Verdict:** 🟡 **Good long-term, expensive short-term** - Solves real problems but requires large refactor

---

## Proposal 3: Configuration Event Echo Prevention

### The Race Condition

```
1. User clicks toggle in Settings UI
   ↓
2. useSettings.toggleTokenWidget() → setShowTokenWidget(true) + postMessage(UPDATE_SETTING)
   ↓
3. ConfigurationHandler receives UPDATE_SETTING
   ↓
4. config.update('ui.showTokenWidget', true)  [writes to VSCode settings]
   ↓
5. VSCode fires onDidChangeConfiguration event
   ↓
6. MessageHandler watcher calls configurationHandler.sendModelData()
   ↓
7. sendModelData() sends MODEL_DATA with ui.showTokenWidget = true
   ↓
8. useSettings receives MODEL_DATA → setShowTokenWidget(true again)
   ↓
9. RACE: Step 8 might overwrite a user action that happened between steps 2-8
```

**Current Code:**
```typescript
// MessageHandler.ts:81-92
const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
  if (event.affectsConfiguration('proseMinion.assistantModel') ||
      event.affectsConfiguration('proseMinion.ui.showTokenWidget') /* etc */) {
    void this.refreshServiceConfiguration();
    void this.configurationHandler.sendModelData();  // ← ALWAYS sends back to webview
  }
});
```

### Solution A: Track Message Source (Requires Proposal 2)

```typescript
class ConfigurationHandler {
  private lastUpdateSource?: string;

  async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
    // Track who sent this update
    this.lastUpdateSource = message.source; // e.g., "webview.settings.overlay"

    const config = vscode.workspace.getConfiguration('proseMinion');
    await config.update(message.key, message.value, true);

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

**Benefits:**
- ✅ Prevents webview echo-back
- ✅ Still updates webview when VSCode settings change externally
- ✅ No lost updates

**Concerns:**
- Requires message envelope (Proposal 2)
- Timeout-based tracking is fragile
- Doesn't handle rapid successive updates well

### Solution B: Debounced Config Watcher

```typescript
class MessageHandler {
  private configUpdateDebounce?: NodeJS.Timeout;

  constructor(...) {
    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('proseMinion.*')) {
        // Debounce: wait 100ms for burst of updates to settle
        if (this.configUpdateDebounce) {
          clearTimeout(this.configUpdateDebounce);
        }

        this.configUpdateDebounce = setTimeout(async () => {
          await this.refreshServiceConfiguration();
          await this.configurationHandler.sendModelData();
          this.configUpdateDebounce = undefined;
        }, 100);
      }
    });
  }
}
```

**Benefits:**
- ✅ Handles bursts of updates
- ✅ Simple to implement
- ✅ No breaking changes

**Concerns:**
- ⚠️ Still echoes back to webview (just delayed)
- ⚠️ User might see stale state for 100ms
- ⚠️ Doesn't actually solve the race condition

### Solution C: Webview Ignores Echoed Updates (Current Client-Side Defense)

```typescript
// useSettings.ts - add tracking
const [lastUpdate, setLastUpdate] = React.useState<{key: string, value: any, time: number} | null>(null);

const updateSetting = React.useCallback((key: string, value: any) => {
  // Optimistically update local state
  setSettingsData(prev => ({ ...prev, [key]: value }));

  // Track what we just sent
  setLastUpdate({ key, value, time: Date.now() });

  vscode.postMessage({ type: MessageType.UPDATE_SETTING, key, value, timestamp: Date.now() });
}, [vscode]);

const handleSettingsData = React.useCallback((message: any) => {
  // If we just sent an update, ignore echo for a short window
  if (lastUpdate && (Date.now() - lastUpdate.time) < 200) {
    if (message.settings[lastUpdate.key] === lastUpdate.value) {
      // This is our echo, ignore it
      return;
    }
  }

  setSettingsData(message.settings || {});
}, [lastUpdate]);
```

**Benefits:**
- ✅ No backend changes required
- ✅ Can implement immediately
- ✅ Handles rapid updates

**Concerns:**
- ⚠️ Timeout-based (fragile)
- ⚠️ Logic duplicated per hook that updates settings
- ⚠️ Band-aid, not architectural fix

### Solution D: Separate Update vs Broadcast Channels

```typescript
// Two distinct message types
enum MessageType {
  UPDATE_SETTING = 'UPDATE_SETTING',           // Webview → Extension (command)
  SETTING_CHANGED_EXTERNAL = 'SETTING_CHANGED_EXTERNAL', // Extension → Webview (event, external source only)
  // ...
}

// ConfigurationHandler
async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
  const config = vscode.workspace.getConfiguration('proseMinion');
  await config.update(message.key, message.value, true);
  // DO NOT send anything back - webview already updated optimistically
}

// MessageHandler config watcher
const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
  if (event.affectsConfiguration('proseMinion.*')) {
    // Check if this was triggered by our own UPDATE_SETTING
    // (VSCode doesn't provide this info, so we need to track it)

    // Only send SETTING_CHANGED_EXTERNAL if it was an external change
    void this.configurationHandler.sendModelDataIfExternal();
  }
});
```

**Benefits:**
- ✅ Clear semantic distinction (command vs event)
- ✅ Webview knows external changes need to overwrite local state
- ✅ No timing-based hacks

**Concerns:**
- ⚠️ Still need to track whether update was internal or external
- Requires message type changes

---

## Recommendation: Phased Approach

### Phase 1: Quick Wins (Now - Alpha Development)

**Goal**: Stop the bleeding - fix configuration race conditions immediately

1. **Implement Solution C** (Client-side echo filtering)
   - Add to useSettings hook
   - Track recent updates, ignore echoes
   - 2-3 hours of work
   - Can deploy immediately

2. **Debounce config watcher** (Solution B)
   - Add 50-100ms debounce to config watcher
   - Reduces flood of updates
   - 30 min of work

**Why these first:**
- No breaking changes
- Can implement and test quickly
- Buys time to do architectural refactor properly
- User-facing pain stops immediately

### Phase 2: Architectural Refactor (Next Sprint)

**Goal**: Set up sustainable architecture for v1.0

1. **Implement Handler-Registered Strategy** (Proposal 1)
   - Create MessageRouter
   - Refactor domain handlers to register routes
   - MessageHandler becomes thin coordinator
   - 1 day of work
   - **Immediate benefit:** Better code organization, easier to extend

2. **Add Message Envelope** (Proposal 2)
   - Define MessageEnvelope interface
   - Add source field to all messages (don't nest payload yet)
   - Update all message sends to include source
   - 1-2 days of work (tedious but straightforward)
   - **Immediate benefit:** Can track message origin

3. **Implement Source-Based Echo Prevention** (Solution A)
   - Use source field to detect webview-originated updates
   - ConfigurationHandler skips echo when source is webview
   - Remove client-side hacks from Phase 1
   - 2-3 hours of work
   - **Immediate benefit:** Clean architectural solution to race conditions

### Phase 3: Full Message Envelope (Future - Post v1.0)

**Goal**: Complete the message envelope refactor for advanced routing

1. **Nest payload in all messages**
   - Move message-specific fields into payload: {}
   - Update all message handlers
   - Update persistence layer
   - 2-3 days of work (requires careful testing)

2. **Add advanced routing**
   - Correlation IDs for request/response tracking
   - Message tracing/logging middleware
   - Target hints for optimization

---

## Open Questions

1. **Switch vs Strategy performance**: Is map lookup noticeably slower than switch? (Probably not, but worth measuring)

2. **Message envelope backward compat**: Do we need to support old message format for persisted state? (No - alpha software, can drop persisted state)

3. **Configuration scope**: Should all webview components avoid echoes, or just settings UI? (Probably all - any component can trigger config updates)

4. **Multi-webview future**: If we support multiple webview instances, how does message routing work? (Envelope helps, but need instance IDs)

---

## Decision Log

### Decision 1: Use Phased Approach
**Status**: PROPOSED
**Rationale**: Balances immediate user impact (race conditions) with long-term code health (routing refactor)

### Decision 2: Implement Handler Registration (Proposal 1)
**Status**: PROPOSED
**Rationale**: Clear win - better separation of concerns, easier to maintain, no downsides

### Decision 3: Add Source Field to Messages (Proposal 2, partial)
**Status**: PROPOSED
**Rationale**: Solves echo problem, enables future routing features, doesn't require full envelope refactor immediately

### Decision 4: Defer Full Envelope Nesting (Proposal 2, full)
**Status**: DEFERRED to post-v1.0
**Rationale**: Expensive refactor, diminishing returns, not needed for immediate pain points

---

## Next Steps

1. **Review this document** - User approves/modifies phased approach
2. **Create ADR** - Document architectural decisions
3. **Create Epic** - "Message Architecture Refactor" under .todo/epics/
4. **Create Sprint 1** - Phase 1 (quick wins)
5. **Create Sprint 2** - Phase 2 (architectural refactor)
6. **Execute** - Iterate with testing and validation

---

## References

- Current MessageHandler: [src/application/handlers/MessageHandler.ts](../src/application/handlers/MessageHandler.ts)
- ConfigurationHandler: [src/application/handlers/domain/ConfigurationHandler.ts](../src/application/handlers/domain/ConfigurationHandler.ts)
- useSettings hook: [src/presentation/webview/hooks/domain/useSettings.ts](../src/presentation/webview/hooks/domain/useSettings.ts)
- Message types: [src/shared/types/messages/](../src/shared/types/messages/)
