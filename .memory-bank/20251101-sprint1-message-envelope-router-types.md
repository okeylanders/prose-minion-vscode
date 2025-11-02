# Memory Bank: Message Envelope Architecture - Sprint 1 Complete

**Date**: 2025-11-01
**Branch**: `sprint/epic-message-envelope-2025-10-28-01-handler-registration-types`
**Status**: Sprint 1 Complete, Sprint 2 Ready to Start

## Summary

Completed Sprint 1 of the message envelope architecture refactor. Implemented MessageRouter with strategy pattern and migrated all ~50+ message types to use standardized envelope pattern. TypeScript compilation shows ~200+ expected errors that will be resolved in Sprint 2.

## What We Built

### 1. MessageRouter - Strategy Pattern for Message Routing

**File**: `src/application/handlers/MessageRouter.ts` (new, 70 lines)

- Map-based registration: `MessageType → Handler` function
- `register(messageType, handler)` - Registers handler with duplicate detection
- `route(message)` - Routes to registered handler, throws if unregistered
- Helper methods: `handlerCount`, `hasHandler()`, `getRegisteredTypes()`

**Benefits**:
- No central switch statement to maintain
- Handlers will own their message types (Sprint 2)
- Open/Closed Principle compliance
- Clear error messages for debugging

### 2. MessageEnvelope<TPayload> - Standardized Message Structure

**File**: `src/shared/types/messages/base.ts` (updated)

```typescript
export interface MessageEnvelope<TPayload = any> {
  type: MessageType;              // Message type for routing
  source: MessageSource;          // 'extension.*' or 'webview.*'
  payload: TPayload;              // Message-specific data
  timestamp: number;              // Creation time
  target?: MessageSource;         // Optional routing hint
  correlationId?: string;         // Optional request/response tracking
}

export type MessageSource =
  | `extension.${string}`
  | `webview.${string}`
  | 'unknown';
```

**Benefits**:
- Consistent structure across all messages
- Source tracking enables echo prevention
- Future-proof for correlation IDs, tracing middleware
- Generic payload type for type safety

### 3. MessageHandler Simplified

**File**: `src/application/handlers/MessageHandler.ts` (updated)

**Before**:
```typescript
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  switch (message.type) {
    case MessageType.ANALYZE_DIALOGUE:
      await this.analysisHandler.handleAnalyzeDialogue(message);
      break;
    // ... 30+ more cases (~130 lines)
  }
}
```

**After**:
```typescript
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  try {
    await this.router.route(message);  // ← 3 lines total!
  } catch (error) {
    this.sendError('unknown', 'Error processing request', ...);
  }
}
```

**Constructor** now manually registers all routes (temporary until Sprint 2 adds `registerRoutes()` to domain handlers):
- Analysis: 2 routes
- Dictionary: 1 route
- Context: 1 route
- Metrics: 3 routes
- Search: 1 route
- Configuration: 8 routes
- Publishing: 3 routes
- Sources: 3 routes
- UI: 3 routes
- File Operations: 2 routes
- Webview diagnostics: 1 route

**Total**: 28 message types registered

### 4. Message Type Migrations - All 11 Domain Files

Pattern applied to all messages:

```typescript
// BEFORE
export interface UpdateSettingMessage extends BaseMessage {
  type: MessageType.UPDATE_SETTING;
  key: string;
  value: any;
}

// AFTER
export interface UpdateSettingPayload {
  key: string;
  value: any;
}

export interface UpdateSettingMessage extends MessageEnvelope<UpdateSettingPayload> {
  type: MessageType.UPDATE_SETTING;
}
```

**Files Updated**:
1. `configuration.ts` - 11 message types (biggest)
2. `analysis.ts` - 3 message types
3. `metrics.ts` - 4 message types (+ 3 report types)
4. `dictionary.ts` - 2 message types
5. `context.ts` - 2 message types
6. `search.ts` - 2 message types (+ option/result types)
7. `publishing.ts` - 4 message types
8. `sources.ts` - 6 message types
9. `ui.ts` - 8 message types
10. `results.ts` - 5 message types (+ ErrorSource type)
11. `base.ts` - MessageEnvelope + MessageSource

**Total**: ~50+ message types migrated

## Metrics

- **Files changed**: 13
- **Lines added**: 457
- **Lines removed**: 231
- **Net change**: +226 lines (mostly documentation)
- **MessageHandler reduction**: Switch statement ~130 lines → 3 lines (96% reduction in handleMessage)
- **TypeScript errors**: ~200+ (EXPECTED - Sprint 2 TODO list)
- **Time**: ~4 hours

## TypeScript Errors (Expected)

Build shows ~200+ errors guiding Sprint 2 work:

**Categories**:
1. **Handler methods** - Accessing `message.field` instead of `message.payload.field` (~80 errors)
2. **postMessage calls** - Missing `source`, `payload`, `timestamp` fields (~50 errors)
3. **Result caching** - Cache assignments missing envelope fields (~20 errors)
4. **Type mismatches** - ErrorSource vs MessageSource, etc. (~10 errors)

These errors are **intentional** - they show exactly what needs to be fixed in Sprint 2.

## Sprint 2 Preview

**Goal**: Fix all TypeScript errors by migrating extension-side code to envelope pattern

**Tasks**:
1. Add `registerRoutes(router)` to all 10 domain handlers
2. Update ~30+ handler methods to use `message.payload`
3. Update ~50+ `postMessage` calls to use envelope format
4. Implement source-based echo prevention in ConfigurationHandler
5. Verify extension compiles cleanly

**Estimated Time**: 6-8 hours

## Key Insights

### flushCachedResults() Pattern

During review, clarified the `flushCachedResults()` pattern:
- **Purpose**: Replay results when webview becomes visible after being hidden
- **How**: Caches most recent result of each type in `sharedResultCache`
- **When**: Called on webview visibility change + MessageHandler construction
- **Why**: VSCode webviews can be hidden while extension runs; prevents lost results

**Example**:
```
User runs analysis (15s) → switches to terminal → analysis completes
→ result cached → user returns to tab → onDidChangeVisibility
→ flushCachedResults() → user sees result!
```

This pattern will continue to work with envelope - Sprint 2 will ensure cached messages use envelope format.

### Architecture Clarity

The refactor revealed clear architectural benefits:
- **MessageRouter**: Handlers declare what they handle (self-documenting)
- **MessageEnvelope**: Source tracking solves echo-back race conditions
- **Type-first**: Let TypeScript errors guide migration (safe refactor)

## Related Work

### Planning Documents
- Epic: `.todo/epics/epic-message-envelope-2025-10-28/epic-message-envelope.md`
- Sprint 1 Plan: `.todo/epics/epic-message-envelope-2025-10-28/sprints/01-handler-registration-types.md`
- Sprint 2 Plan: `.todo/epics/epic-message-envelope-2025-10-28/sprints/02-extension-migration.md`
- ADR: `docs/adr/2025-10-28-message-envelope-architecture.md`
- Planning Doc: `.planning/architecture-refactor-message-routing-and-config-events.md`

### Related Epics
- **Presentation Hooks Refactor** (completed): Exposed these architecture problems
  - Epic: `.todo/epics/epic-presentation-refactor-2025-10-27/`
  - ADR: `docs/adr/2025-10-27-presentation-layer-domain-hooks.md`

### Commits
```
7fc3cfe docs(planning): add message envelope architecture refactor ADR and epic
b9f553a [sprint-1] feat(messages): implement MessageRouter and envelope types
```

## Next Steps

1. **Sprint 2**: Extension-side migration (6-8 hours)
   - Domain handler registration
   - Handler method updates (use payload)
   - postMessage updates (add envelope)
   - Echo prevention implementation

2. **Sprint 3**: Webview-side migration + testing (6-8 hours)
   - Webview hook updates
   - Message handler updates
   - Persistence migration
   - Manual testing
   - Documentation

3. **Merge**: Back into `sprint/epic-presentation-refactor-2025-10-27-01-domain-hooks`

4. **Final**: Merge presentation-refactor into main when both epics complete

## Design Decisions

### Why Strategy Pattern Over Switch?
- **Extensibility**: Adding handlers doesn't modify MessageHandler
- **Ownership**: Handlers declare their routes (domain responsibility)
- **Testability**: Can test router + individual handlers independently
- **Open/Closed**: Extend by adding, don't modify orchestrator

### Why Full Envelope Now (Not Staged)?
- **Alpha software**: Breaking changes are FREE
- **Diminishing marginal cost**: Touching ~100+ messages anyway
- **Avoid future refactor**: Won't need to revisit post-v1.0
- **Better debugging**: Consistent structure helps troubleshooting

### Why Source Tracking?
- **Solves echo-back**: ConfigurationHandler can detect webview-originated updates
- **Enables tracing**: Future middleware can log message flows
- **Future-proof**: Correlation IDs, advanced routing become trivial

## Success Criteria (Sprint 1)

- ✅ MessageRouter implemented with clear error handling
- ✅ MessageEnvelope interface defined with generic payload
- ✅ All ~50+ message types updated to use envelope
- ✅ MessageHandler uses router (switch removed)
- ✅ TypeScript compilation run (~200+ errors as expected)
- ✅ Error list guides Sprint 2 work
- ✅ Commit complete with descriptive message
- ✅ Memory bank entry created

## Risks Mitigated

- **TypeScript errors overwhelming**: Errors are our TODO list, work domain-by-domain
- **Lost in refactor scope**: Sprint plan keeps work focused and incremental
- **Breaking persistence**: Will handle in Sprint 3 with version check
- **Performance concerns**: Map lookup is O(1), same as switch

---

**Status**: ✅ Sprint 1 Complete
**Next**: Sprint 2 - Extension-Side Migration
**Ready**: TypeScript errors documented, handlers identified, plan validated
