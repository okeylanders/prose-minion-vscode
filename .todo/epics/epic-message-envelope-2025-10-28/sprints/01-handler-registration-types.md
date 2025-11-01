# Sprint 1: Handler Registration + Message Envelope Types

**Status**: Not Started
**Estimated Time**: 4-6 hours
**Branch**: `sprint/epic-message-envelope-2025-10-28-01-handler-registration-types`
**Commit Prefix**: `[sprint-1]`

## Goal

Implement MessageRouter with strategy pattern and define envelope types for all messages. Let TypeScript compilation errors guide Sprint 2 migration.

## Context

This sprint establishes the foundation for the message envelope refactor. We create the routing infrastructure and update type definitions, expecting ~200+ TypeScript errors that will serve as our TODO list for Sprint 2.

## Tasks

### Phase 1: MessageRouter Implementation

**1. Create MessageRouter class** (30 min)
- File: `src/application/handlers/MessageRouter.ts` (new)
- Map-based strategy: `Map<MessageType, (msg) => Promise<void>>`
- `register(type, handler)` with duplicate detection
- `route(message)` with missing handler detection
- Clear error messages

**2. Update MessageHandler to use router** (30 min)
- File: `src/application/handlers/MessageHandler.ts`
- Remove switch statement (lines 176-304, ~130 lines)
- Instantiate `MessageRouter` in constructor
- Call `handler.registerRoutes(router)` for each domain handler
- Replace `handleMessage` body with `await this.router.route(message)`

### Phase 2: Message Envelope Type Definitions

**3. Define MessageEnvelope interface** (30 min)
- File: `src/shared/types/messages/base.ts`
- Generic: `MessageEnvelope<TPayload>`
- Required: `type`, `source`, `payload`, `timestamp`
- Optional: `target`, `correlationId`
- Source type: `'extension.${string}' | 'webview.${string}' | 'unknown'`

**4. Update message type interfaces** (2-3 hours)
- Create `*Payload` interfaces (extract fields from message)
- Update message interfaces: `extends MessageEnvelope<*Payload>`
- Remove payload fields from message interface
- Update all 11 domain files:
  - `src/shared/types/messages/analysis.ts` (~8 message types)
  - `src/shared/types/messages/dictionary.ts` (~4 message types)
  - `src/shared/types/messages/context.ts` (~4 message types)
  - `src/shared/types/messages/metrics.ts` (~8 message types)
  - `src/shared/types/messages/search.ts` (~4 message types)
  - `src/shared/types/messages/configuration.ts` (~10 message types)
  - `src/shared/types/messages/publishing.ts` (~4 message types)
  - `src/shared/types/messages/sources.ts` (~4 message types)
  - `src/shared/types/messages/ui.ts` (~6 message types)
  - `src/shared/types/messages/results.ts` (~4 message types)
  - `src/shared/types/messages/base.ts` (update)

**5. Run TypeScript compilation** (15 min)
- Run: `npm run compile`
- Expect: ~200+ errors (THIS IS GOOD!)
- Save error output to reference file for Sprint 2
- DO NOT attempt to fix errors yet

## Example Transformations

### MessageRouter

```typescript
// src/application/handlers/MessageRouter.ts (new file)
export class MessageRouter {
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
```

### Message Type Interface

```typescript
// BEFORE
export interface UpdateSettingMessage extends BaseMessage {
  type: MessageType.UPDATE_SETTING;
  key: string;
  value: any;
  timestamp?: number;
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

### MessageHandler

```typescript
// BEFORE (switch statement)
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  switch (message.type) {
    case MessageType.UPDATE_SETTING:
      await this.configurationHandler.handleUpdateSetting(message);
      break;
    case MessageType.ANALYZE_DIALOGUE:
      await this.analysisHandler.handleAnalyzeDialogue(message);
      break;
    // ... 30+ more cases
  }
}

// AFTER (router delegation)
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  await this.router.route(message);
}
```

## Files Created/Modified

**Created**:
- `src/application/handlers/MessageRouter.ts`

**Modified**:
- `src/application/handlers/MessageHandler.ts`
- `src/shared/types/messages/base.ts`
- `src/shared/types/messages/analysis.ts`
- `src/shared/types/messages/dictionary.ts`
- `src/shared/types/messages/context.ts`
- `src/shared/types/messages/metrics.ts`
- `src/shared/types/messages/search.ts`
- `src/shared/types/messages/configuration.ts`
- `src/shared/types/messages/publishing.ts`
- `src/shared/types/messages/sources.ts`
- `src/shared/types/messages/ui.ts`
- `src/shared/types/messages/results.ts`

**Total**: 1 created, 12 modified

## Acceptance Criteria

- ✅ MessageRouter class implemented
- ✅ MessageRouter has `register` and `route` methods
- ✅ MessageRouter detects duplicate registrations
- ✅ MessageRouter errors on unhandled message types
- ✅ MessageHandler uses router instead of switch
- ✅ MessageEnvelope interface defined
- ✅ All ~50+ message types updated to use envelope
- ✅ TypeScript compilation run (expect ~200+ errors)
- ✅ Error output saved for Sprint 2

## Testing

**DO NOT test functionality** - types only, expect compilation errors

- ✅ MessageRouter compiles (class definition valid)
- ✅ MessageEnvelope compiles (interface valid)
- ✅ TypeScript errors show everywhere messages are used (expected)

## Risks/Notes

- **TypeScript errors are EXPECTED** - they guide Sprint 2
- DO NOT attempt to fix errors in this sprint
- DO NOT test runtime behavior yet
- Focus on type definitions only
- Save error list for reference

## Next Sprint

Sprint 2 will:
- Add `registerRoutes` to all domain handlers
- Update handler methods to use `message.payload`
- Update all `postMessage` calls to use envelope
- Implement echo prevention in ConfigurationHandler
- Fix all TypeScript errors from Sprint 1

## Links

- Epic: [epic-message-envelope.md](../epic-message-envelope.md)
- ADR: [docs/adr/2025-10-28-message-envelope-architecture.md](../../../../docs/adr/2025-10-28-message-envelope-architecture.md)
- Planning Doc: [.planning/architecture-refactor-message-routing-and-config-events.md](../../../../.planning/architecture-refactor-message-routing-and-config-events.md)
