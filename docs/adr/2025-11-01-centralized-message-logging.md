# ADR: Centralized Message Logging for Debugging

**Date**: 2025-11-01
**Status**: Accepted
**Epic**: Message Envelope Architecture Refactor
**Sprint**: 4 (Observability)

## Context

After completing the message envelope refactor (Sprints 1-3), we have centralized routing infrastructure:
- MessageRouter handles all incoming messages (webview → extension)
- MessageHandler.postMessage() handles all outgoing messages (extension → webview)

This creates a perfect **observability choke point** - two functions see 100% of message traffic. We can add comprehensive logging in exactly two locations to gain complete visibility into message flow.

**Current State:**
- No centralized message logging
- Error logging scattered across ~10 domain handlers
- Hard to debug message flow during testing/production
- No visibility into message timing or throughput

**Testing Opportunity:**
- User is currently testing the refactored architecture
- Comprehensive logging would aid testing and future debugging
- Centralized architecture makes implementation trivial

## Decision

We will implement **centralized message logging** at the routing boundaries:

### 1. MessageRouter.route() - Log Incoming Messages

Log every message from webview → extension:
```typescript
async route(message: WebviewToExtensionMessage): Promise<void> {
  const handler = this.handlers.get(message.type);
  if (!handler) {
    throw new Error(`No handler registered for ${message.type}`);
  }

  // Log incoming message
  if (this.outputChannel) {
    this.outputChannel.appendLine(
      `[MessageRouter] ← ${message.type} from ${message.source}`
    );
  }

  await handler(message);
}
```

### 2. MessageHandler.postMessage() - Log Outgoing Messages

Log every message from extension → webview:
```typescript
private async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
  // Spy on messages and update cache...

  // Log outgoing message
  this.outputChannel.appendLine(
    `[MessageHandler] → ${message.type} to webview (source: ${message.source})`
  );

  try {
    await this.webview.postMessage(message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[MessageHandler] ✗ Failed to post ${message.type}: ${messageText}`
    );
  }
}
```

### 3. MessageHandler.handleMessage() - Enhanced Error Logging

Improve top-level error handling:
```typescript
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  try {
    await this.router.route(message);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[MessageHandler] ✗ Error routing ${message.type} from ${message.source}: ${details}`
    );
    this.sendError('unknown', 'Error processing request', details);
  }
}
```

## Example Output

```
[MessageRouter] ← ANALYZE_DIALOGUE from webview.analysis.tab
[MessageHandler] → STATUS to webview (source: extension.analysis)
[MessageHandler] → STATUS to webview (source: extension.analysis)
[MessageHandler] → ANALYSIS_RESULT to webview (source: extension.analysis)
[MessageHandler] → TOKEN_USAGE_UPDATE to webview (source: extension.handler)
[MessageRouter] ← UPDATE_SETTING from webview.settings.overlay
[MessageHandler] → MODEL_DATA to webview (source: extension.configuration)
[MessageRouter] ← SET_MODEL_SELECTION from webview.settings.overlay
[MessageHandler] → MODEL_DATA to webview (source: extension.configuration)
[MessageHandler] ✗ Failed to post STATUS: WebView disposed
```

## Benefits

### 1. Testing Support
- Complete message flow visibility during manual testing
- Easy to spot missing messages or wrong sequencing
- Verify echo prevention is working (no double-sends)

### 2. Production Debugging
- Trace user-reported issues via output channel logs
- Identify message storms or infinite loops
- Detect timing issues between messages

### 3. Performance Insights
- See message frequency and patterns
- Identify chatty components
- Foundation for future timing metrics

### 4. Minimal Implementation Cost
- Two locations to add logging (chokepoints)
- ~10 lines of code total
- Zero impact on architecture or existing code

### 5. Developer Experience
- Clear visual feedback in Output panel
- Searchable logs (CMD+F for message types)
- Emoji indicators (← → ✗) for quick scanning

## Alternatives Considered

### Alt 1: Domain Handler Logging
**Rejected**: Would require updating ~10 handlers, not centralized, harder to maintain

### Alt 2: Middleware Pattern
**Rejected**: Over-engineered for current needs, adds complexity

### Alt 3: Conditional/Verbose Logging
**Rejected**: Always-on logging is fine (minimal overhead), helps production debugging

### Alt 4: Payload Logging
**Deferred**: Log message type/source only (not payload contents) to avoid noise and sensitive data leaking. Can add verbose mode later if needed.

## Implementation Plan

### Sprint 4: Centralized Message Logging
1. Update MessageRouter constructor to accept outputChannel
2. Add logging to MessageRouter.route()
3. Add logging to MessageHandler.postMessage()
4. Enhance MessageHandler.handleMessage() error logging
5. Test with all message types
6. Document in ARCHITECTURE.md

**Estimated Time**: 30 minutes

### Future Enhancements (Not Now)
- Timing metrics (log message processing duration)
- Payload size logging (detect large payloads)
- Verbose mode (log payload contents for deep debugging)
- Message filtering (only log certain types)
- Performance counters (messages/second by type)

## Related Work

- Epic: `.todo/epics/epic-message-envelope-2025-10-28/`
- Sprint 1-3: Message envelope architecture refactor
- ADR: `2025-10-28-message-envelope-architecture.md`

## Success Criteria

- ✅ All incoming messages logged at routing boundary
- ✅ All outgoing messages logged at sending boundary
- ✅ Routing errors logged with context
- ✅ Sending errors logged with context
- ✅ Logs visible in VSCode Output panel
- ✅ Zero impact on existing functionality
- ✅ Aids manual testing and debugging

## Decision Outcome

**Accepted**: Implement centralized message logging in Sprint 4 to aid testing and debugging. This leverages the centralized architecture from Sprints 1-3 and provides complete observability with minimal implementation cost.
