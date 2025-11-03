# ADR: Message Architecture Organization by Domain

Status: Accepted
Date: 2025-10-26
Implemented: Complete (2025-10-26)
Results: messages.ts → 11 domain files (674 lines); MessageHandler 1091 → 495 lines (54% reduction)

## Context

The messaging layer has grown organically to 532 lines (`messages.ts`) and the `MessageHandler` is now 1091 lines with a large switch statement. All message types, interfaces, and handler logic are in single monolithic files, making them difficult to navigate and maintain.

Current pain points:
- Hard to find specific message contracts quickly
- `MessageHandler.ts` switch statement spans hundreds of lines
- No clear domain separation despite having distinct tool areas
- Import statements are verbose when you only need a subset of message types
- Testing individual message handlers requires importing the entire class

The codebase already has clear domain boundaries (Analysis, Dictionary, Context, Metrics, Search, etc.), but the messaging layer doesn't reflect this organization.

## Decision

Reorganize the messaging architecture into domain-specific modules while maintaining backward compatibility for existing consumers.

### Proposed Structure

```
src/shared/types/messages/
├── index.ts                          # Re-exports everything (backward compat)
├── base.ts                           # BaseMessage, MessageType enum, common types
├── analysis.ts                       # Dialogue, prose analysis messages
├── dictionary.ts                     # Dictionary lookup messages
├── context.ts                        # Context generation messages
├── metrics.ts                        # Prose stats, style flags, word frequency
├── search.ts                         # Word search messages
├── configuration.ts                  # Model selection, settings, token usage
├── publishing.ts                     # Publishing standards messages
├── sources.ts                        # Active file, manuscript/chapter globs
├── ui.ts                             # Tab changes, selection, guide actions
└── results.ts                        # Result message types (analysis, metrics, etc.)

src/application/handlers/
├── MessageHandler.ts                 # Main dispatcher (routing only)
└── domain/
    ├── AnalysisHandler.ts           # Dialogue, prose analysis
    ├── DictionaryHandler.ts         # Dictionary operations
    ├── ContextHandler.ts            # Context generation
    ├── MetricsHandler.ts            # All metrics tools
    ├── SearchHandler.ts             # Word search
    ├── ConfigurationHandler.ts      # Settings, models, tokens
    ├── PublishingHandler.ts         # Publishing standards
    ├── SourcesHandler.ts            # File/glob requests
    ├── UIHandler.ts                 # Tab changes, selections
    └── FileOperationsHandler.ts     # Copy, save, open guides
```

### Organization Principles

1. **Domain-Driven** – Group by tool/feature domain, not technical concern
2. **Single Responsibility** – Each handler file manages one domain area
3. **Backward Compatible** – `src/shared/types/messages/index.ts` re-exports everything
4. **Import Clarity** – Consumers can import specific domains or use the barrel export
5. **Testability** – Individual handlers can be unit tested in isolation

### Message Types Organization

**base.ts**
- `MessageType` enum (all variants)
- `BaseMessage` interface
- `TokenUsage`, `ModelScope`, `TabId`, `SelectionTarget`
- Common utilities

**Domain-specific files (e.g., metrics.ts)**
- Request messages (`MeasureProseStatsMessage`, etc.)
- Response shapes (`MetricsResultMessage`, payload types)
- Domain-specific options/configs

**results.ts**
- Generic result types (`AnalysisResultMessage`, `ErrorMessage`, `StatusMessage`)
- Union types (`ExtensionToWebviewMessage`, `WebviewToExtensionMessage`)

### Handler Organization

**MessageHandler.ts (slimmed down)**
- Constructor with service dependencies
- `handleMessage(message)` dispatcher
- Delegates to domain-specific handlers
- Maintains result cache and token totals at the top level
- Config watcher for service refresh

**Domain Handlers (e.g., MetricsHandler.ts)**
```typescript
export class MetricsHandler {
  constructor(
    private service: IProseAnalysisService,
    private webview: vscode.Webview
  ) {}

  async handleProseStats(msg: MeasureProseStatsMessage): Promise<void> { /* ... */ }
  async handleStyleFlags(msg: MeasureStyleFlagsMessage): Promise<void> { /* ... */ }
  async handleWordFrequency(msg: MeasureWordFrequencyMessage): Promise<void> { /* ... */ }
}
```

**MessageHandler.ts integration**
```typescript
export class MessageHandler {
  private analysisHandler: AnalysisHandler;
  private metricsHandler: MetricsHandler;
  // ... etc

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case MessageType.MEASURE_PROSE_STATS:
        return this.metricsHandler.handleProseStats(message);
      case MessageType.MEASURE_STYLE_FLAGS:
        return this.metricsHandler.handleStyleFlags(message);
      // ...
    }
  }
}
```

## Migration Strategy

### Phase 1: Create Message Domain Files
1. Create `src/shared/types/messages/` directory
2. Move message types to domain-specific files
3. Create `index.ts` barrel export re-exporting all types
4. Update imports throughout codebase to use barrel export
5. Verify no breaking changes

### Phase 2: Create Handler Modules

1. Create `src/application/handlers/domain/` directory
2. Extract handler methods from `MessageHandler.ts` into domain handlers
3. Update `MessageHandler.ts` to instantiate and delegate to domain handlers
4. Preserve result cache and token tracking in main `MessageHandler`
5. Verify all message routing works correctly

### Phase 3: Cleanup and Documentation
1. Remove old messages.ts file
2. Update ARCHITECTURE.md with new structure
3. Add JSDoc comments to handler interfaces
4. Update sprint documentation

## Alternatives Considered

### Keep Everything in One File
**Rejected** – Maintainability continues to degrade as new tools are added.

### Split by Technical Layer (Requests vs Responses)
**Rejected** – Doesn't align with domain boundaries; harder to find related messages.

### Create Separate Packages/Modules
**Rejected** – Overkill for current scale; adds complexity without clear benefit.

## Consequences

### Positive
- ✅ Easier to locate message contracts by domain
- ✅ Handler logic grouped by feature area
- ✅ Smaller, more focused files
- ✅ Better testability (can mock individual handlers)
- ✅ Clearer ownership per domain
- ✅ Backward compatible via barrel exports

### Neutral
- More files to navigate (but better organized)
- Slightly more boilerplate for handler instantiation

### Risks
- Must maintain barrel exports for backward compatibility
- Need to ensure proper import paths during refactor
- Result cache and token tracking must remain centralized

## Implementation Notes

- Start with messages reorganization (lower risk)
- Handlers can be extracted incrementally (one domain at a time)
- Keep `MessageHandler.ts` as the single entry point for routing
- Use absolute imports for clarity: `from '../../shared/types/messages/metrics'`
- Or relative imports from barrel: `from '../../shared/types/messages'`

## Testing Plan

- Unit tests for individual domain handlers
- Integration test that full message flow still works
- Verify webview can still send/receive all message types
- Check that model data, settings, and token tracking persist correctly

## Links

- Epic: `.todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md` (Phase 6-7: Architecture Passes)
- Related: `docs/ARCHITECTURE.md` (to be updated post-implementation)
- Branch: `sprint/epic-search-arch-05-message-organization`
