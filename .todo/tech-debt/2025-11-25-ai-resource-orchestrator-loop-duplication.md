# AIResourceOrchestrator Multi-Turn Loop Duplication

**Date Identified**: 2025-11-25
**Identified During**: UX Polish Epic - Context 3-Turn Support Implementation
**Priority**: Low
**Estimated Effort**: 2-3 hours

## Problem

`AIResourceOrchestrator` contains two methods with nearly identical multi-turn conversation loop patterns:

1. `executeWithAgentCapabilities` (lines 112-258) - Handles **craft guides** via `<guide-request>` tags
2. `executeWithContextResources` (lines 312-506) - Handles **context files** via `<context-request>` tags

Both methods implement the same algorithmic pattern:
- Start conversation
- Send initial message
- Loop up to MAX_TURNS:
  - Parse response for resource requests
  - If no request → break
  - Load resources
  - Add assistant response + user follow-up to conversation
  - Call API again
  - Accumulate token usage
- Handle max turns edge case
- Strip tags, return result

This violates DRY and means bug fixes (like the max-turns recovery mechanism) must be applied to both methods separately.

## Current Implementation

```typescript
// Method 1: Craft guides (~146 lines)
async executeWithAgentCapabilities(toolName, systemMessage, userMessage, options) {
  // ... setup ...
  while (turnCount < this.MAX_TURNS) {
    const resourceRequest = ResourceRequestParser.parse(last.content);
    if (!resourceRequest.hasGuideRequest) break;
    // ... load guides, continue conversation ...
  }
  // ... cleanup ...
}

// Method 2: Context resources (~194 lines)
async executeWithContextResources(toolName, systemMessage, userMessage, resourceProvider, catalog, options) {
  // ... setup ...
  while (turnCount < this.MAX_TURNS) {
    const resourceRequest = ContextResourceRequestParser.parse(response.content);
    if (!resourceRequest.hasResourceRequest) break;
    // ... load resources, continue conversation ...
  }
  // Max turns recovery (only in this method!)
  // ... cleanup ...
}
```

**Key differences** (abstractions needed):
- Different parsers (`ResourceRequestParser` vs `ContextResourceRequestParser`)
- Different loaders (`guideLoader.loadGuide` vs `resourceProvider.loadResources`)
- Different message builders (`buildGuideResponseMessage` vs `buildContextResourceMessage`)
- Different tag formats
- Max-turns recovery only in `executeWithContextResources`

## Recommendation

Extract a generic `executeWithResourceLoop` method that accepts a configuration object:

```typescript
interface ResourceLoopConfig<TResource> {
  parseRequest: (content: string) => { hasRequest: boolean; requestedPaths: string[] };
  loadResources: (paths: string[]) => Promise<TResource[]>;
  buildFollowUpMessage: (resources: TResource[], requestedPaths: string[]) => string;
  stripTags: (content: string) => string;
  forceOutputMessage?: string;  // For max-turns recovery
  statusMessage?: string;
}

async executeWithResourceLoop<TResource>(
  toolName: string,
  systemMessage: string,
  userMessage: string,
  config: ResourceLoopConfig<TResource>,
  options: AIOptions
): Promise<ExecutionResult>
```

Then both methods become thin wrappers (~20-30 lines each) that configure the generic loop.

## Impact

**Benefits of fixing:**
- ~200 lines removed (DRY)
- Bug fixes apply to both resource types automatically
- Easier to add new resource types (e.g., MCP tools)
- Max-turns recovery can be enabled for guides easily

**Risks of not fixing:**
- Low immediate risk - both methods work correctly
- Future bug fixes must be applied twice
- Cognitive overhead when understanding the code

**Why Low Priority:**
- Both methods are stable and well-tested
- No user-facing bugs
- Refactor can happen opportunistically during next orchestrator changes

## References

- Related file: [src/application/services/AIResourceOrchestrator.ts](../../src/application/services/AIResourceOrchestrator.ts)
- Related tests: [src/__tests__/application/services/AIResourceOrchestrator.test.ts](../../src/__tests__/application/services/AIResourceOrchestrator.test.ts)
- Epic where identified: [.todo/epics/epic-ux-polish-2025-11-24/](../epics/epic-ux-polish-2025-11-24/)
