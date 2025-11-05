# useEffect Extraction Pattern - Named Methods Over Inline Logic

**Date Identified**: 2025-11-05
**Identified During**: Sprint 04 - Domain Hooks Extraction (Phase C completion)
**Priority**: Medium
**Estimated Effort**: 2-4 hours (systematic refactor across all domain hooks)

## Problem

Throughout the codebase, `useEffect` hooks contain inline logic with comments explaining their purpose. This makes the code harder to scan, test, and reuse.

**Example (Current Pattern):**
```typescript
// Request publishing standards data on mount to populate genres array
React.useEffect(() => {
  vscode.postMessage({
    type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
    source: 'webview.hooks.usePublishingSettings',
    payload: {},
    timestamp: Date.now()
  });
}, [vscode]);
```

**Issues:**
- Logic is buried in anonymous functions
- Comments required to explain intent
- Difficult to test in isolation
- Cannot be reused or called imperatively
- Code scanning tools miss the semantic meaning

## Current Implementation

Inline `useEffect` blocks are common in:
- `usePublishingSettings.ts` - data request on mount
- `useModelsSettings.ts` - settings sync on mount
- `useContextPathsSettings.ts` - path validation effects
- Components throughout `src/presentation/webview/components/`

## Recommendation

Extract `useEffect` logic into named methods with clear, self-documenting names:

**Improved Pattern:**
```typescript
// Named method: self-documenting, testable, reusable
const requestPublishingStandardsData = React.useCallback(() => {
  vscode.postMessage({
    type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
    source: 'webview.hooks.usePublishingSettings',
    payload: {},
    timestamp: Date.now()
  });
}, [vscode]);

// Effect declaration: intent is clear from method name
React.useEffect(() => {
  requestPublishingStandardsData();
}, [requestPublishingStandardsData]);
```

**Benefits:**
- ✅ Method name documents intent (no comment needed)
- ✅ Can be tested in isolation
- ✅ Can be called imperatively (e.g., retry button)
- ✅ Code scanning tools recognize semantic meaning
- ✅ Easier to refactor and extract to utilities
- ✅ Better stack traces in debugging

## Impact

**If Fixed:**
- Improved code readability and maintainability
- Better testability (can unit test extracted methods)
- Easier to add retry/refresh logic
- Clearer separation of concerns

**If Not Fixed:**
- Code remains functional but harder to maintain
- Testing requires mocking React lifecycle
- Duplication more likely (can't extract to shared utilities)

## Implementation Plan

1. **Phase 1**: Extract effects in domain hooks (8 hooks)
   - Start with newly created hooks (useTokensSettings, useModelsSettings, etc.)
   - Establish consistent naming pattern (`request*`, `sync*`, `initialize*`)

2. **Phase 2**: Extract effects in components
   - TabBar, AnalysisTab, MetricsTab, UtilitiesTab, etc.
   - Document pattern in CLAUDE.md

3. **Phase 3**: Add pattern to code review checklist
   - Prevent regression by requiring named methods in reviews

## References

- Related: [ADR: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Sprint: [Sprint 04 - Domain Hooks Extraction](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/04-domain-hooks-extraction.md)
- Files affected: All hooks in `src/presentation/webview/hooks/domain/`
