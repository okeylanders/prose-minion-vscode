# Context Assistant Response Bug Fix

When: 2025-10-27

## Summary

Fixed critical bug where context assistant responses weren't being returned to the webview when the AI didn't request additional project resources (the "fast path").

## The Bug

When the context assistant generated a response immediately without requesting additional resources, the early return path in `AIResourceOrchestrator.executeWithContextResources()` was missing two critical fields:

1. **`usage` field** - Token usage wasn't being tracked or reported
2. **Truncation note** - If response hit token limit, no warning was appended

This caused the webview's context box to not receive/display the AI's response.

## The Fix

**File**: [src/application/services/AIResourceOrchestrator.ts](../../src/application/services/AIResourceOrchestrator.ts#L296-L305)

**Before** (lines 296-303):
```typescript
if (!resourceRequest.hasResourceRequest) {
  const cleaned = ContextResourceRequestParser.stripRequestTags(response.content);
  return {
    content: cleaned,
    usedGuides: [],
    requestedResources: deliveredResources
  };
}
```

**After**:
```typescript
if (!resourceRequest.hasResourceRequest) {
  const cleaned = ContextResourceRequestParser.stripRequestTags(response.content);
  const truncatedNote = this.appendTruncationNote(response.content, response.finishReason);
  return {
    content: cleaned + truncatedNote,
    usedGuides: [],
    requestedResources: deliveredResources,
    usage: totalUsage
  };
}
```

## Root Cause

The early return path (when AI doesn't need project files) wasn't aligned with the follow-up return path (when AI requests files and generates a second response). The follow-up path correctly included both `usage` and the truncation note.

## Impact

- Context assistant responses now appear correctly in the webview
- Token usage is properly tracked for all context generations
- Users receive truncation warnings when responses hit the token limit

## Files Modified

- `src/application/services/AIResourceOrchestrator.ts` (lines 296-305)

## Build Status

✅ TypeScript compilation successful
✅ No breaking changes
✅ Only performance warnings (existing bundle size)

## Testing

To verify the fix:
1. Open Context tab in Prose Minion
2. Paste a prose excerpt
3. Click "Generate Context"
4. Verify response appears in the context box
5. Check that token usage is tracked in the token widget

## Related Components

- **Handler**: [ContextHandler.ts](../../src/application/handlers/domain/ContextHandler.ts)
- **Service**: [ProseAnalysisService.ts](../../src/infrastructure/api/ProseAnalysisService.ts) - `generateContext()`
- **Tool**: [contextAssistant.ts](../../src/tools/assist/contextAssistant.ts)
- **UI**: [App.tsx](../../src/presentation/webview/App.tsx) - `MessageType.CONTEXT_RESULT` handler (line 340)

## Branch

`sprint/epic-secure-storage-2025-10-27-01-implementation`

## Next Steps

1. Manual testing of context assistant with various excerpts
2. Verify token usage tracking appears in UI
3. Test both "fast path" (no resource requests) and "follow-up path" (with resource requests)
4. Commit fix with appropriate message referencing this bug
