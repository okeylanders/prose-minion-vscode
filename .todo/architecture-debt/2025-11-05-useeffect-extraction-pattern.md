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

---

## Resolution

**Status**: ✅ **RESOLVED**
**Resolution Date**: 2025-11-17
**Resolved By**: [Technical Debt Cleanup Epic - Sprint 03](.todo/epics/epic-technical-debt-cleanup-2025-11-15/sprints/03-useeffect-extraction-pattern.md)
**Commit**: 9550ff6

### What Was Done

✅ **4 Hooks Modified** (only 4 had useEffect, not 12 as originally estimated):

1. **usePublishingSettings**: Extracted `requestPublishingStandardsData()`
2. **useDictionary**: Extracted `clearResultWhenLoading()`
3. **useContext**: Extracted `syncLoadingRef()`
4. **useAnalysis**: Extracted `clearResultWhenLoading()`

✅ **Naming Patterns Established**:
- `request*` - Data fetching (e.g., `requestPublishingStandardsData`)
- `sync*` - Synchronization (e.g., `syncLoadingRef`)
- `clear*When*` - Conditional state updates (e.g., `clearResultWhenLoading`)
- `initialize*` - Initialization (for future use)
- `validate*` - Validation (for future use)

✅ **Documentation Updated**:
- Added useEffect extraction pattern to `.ai/central-agent-setup.md`
- Included in presentation hooks conventions

✅ **All Methods Wrapped in useCallback**:
- Referential stability maintained
- No unnecessary re-renders

### Outcome

✅ Self-documenting code (method names explain intent)
✅ Testable in isolation
✅ Imperative calling enabled (can call from buttons/triggers)
✅ Better debugging (clearer stack traces)
✅ No regressions (207/207 tests passing)

### Actual Time

- **Estimated**: 2-4 hours
- **Actual**: ~1 hour (75% faster - only 4 hooks had useEffect)
