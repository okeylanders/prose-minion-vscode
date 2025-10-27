# Epic: Presentation Layer Domain Hooks Refactoring

## Status

**10-27-2025**: In Progress

## Sprint Plan: 2025-10-27

This epic refactors the presentation layer from a monolithic "God Component" (App.tsx at 697 lines) into domain-organized custom React hooks, mirroring the successful backend domain handler pattern.

## Objectives

- Reduce App.tsx from 697 lines to ~150 lines (78% reduction)
- Extract 42 useState hooks into 8 domain-specific hooks
- Implement Strategy pattern for message routing
- Improve testability by isolating domain logic
- Achieve architectural consistency between frontend and backend
- Enable easier feature additions without modifying App.tsx

## References

- ADR: [docs/adr/2025-10-27-presentation-layer-domain-hooks.md](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Related ADR: [docs/adr/2025-10-26-message-architecture-organization.md](../../../docs/adr/2025-10-26-message-architecture-organization.md) (backend domain handlers inspiration)
- React Hooks: [Hooks API Reference](https://react.dev/reference/react)

## Scope Overview

1. **Hook Infrastructure (Critical)** — Create base hooks for VSCode API, persistence, message routing
2. **Domain Hooks (Critical)** — Extract 8 domain-specific hooks (analysis, metrics, dictionary, context, search, settings, selection, publishing)
3. **App.tsx Refactor (Critical)** — Rewrite App.tsx to orchestrate domain hooks
4. **Component Updates (Critical)** — Update tab components to accept hook props
5. **Testing (Required)** — Manual testing in Extension Development Host
6. **Documentation (Required)** — Update ARCHITECTURE.md and memory bank

Out-of-scope: Unit testing infrastructure (future epic), Redux/Context API migration (not needed)

## Milestones and Work Items

### Sprint 1 — Complete Presentation Layer Refactoring (Day 1)

**Goal**: Fully refactor App.tsx and extract all domain hooks with complete component integration

**Phase 1: Infrastructure Hooks**
1. Create hooks directory structure
   - `src/presentation/webview/hooks/`
   - `src/presentation/webview/hooks/domain/`

2. Implement useVSCodeApi hook
   - Wrap `acquireVsCodeApi()` singleton
   - Provide typed `postMessage` function
   - Export VSCode API instance

3. Implement usePersistence hook
   - Generic hook for reading/writing vscode.setState
   - Handle persisted state hydration
   - Automatic state synchronization

4. Implement useMessageRouter hook
   - Strategy pattern: `MessageType → Handler` registry
   - Window event listener lifecycle
   - Type-safe handler signatures

**Phase 2: Domain Hooks Extraction**
5. Implement useSearch hook (simplest)
   - Search result state
   - Word search targets state
   - Message handlers for SEARCH_RESULT

6. Implement usePublishing hook
   - Publishing preset state
   - Publishing trim key state
   - Genre list state
   - Message handlers for PUBLISHING_STANDARDS_DATA

7. Implement useSettings hook
   - Settings overlay visibility
   - Settings data state
   - Token totals and widget visibility
   - API key management state
   - Message handlers for SETTINGS_DATA, OPEN_SETTINGS, REQUEST_SETTINGS_DATA
   - Methods: open, close, toggle, save, resetTokens

8. Implement useSelection hook
   - Selected text, source URI, relative path
   - Dictionary injection state
   - Selection request handlers
   - Paste button handlers for all selection targets
   - Message handlers for SELECTION_UPDATED, SELECTION_DATA

9. Implement useAnalysis hook
   - Analysis result, tool name, loading state
   - Used guides state
   - Status message state
   - Message handlers for ANALYSIS_RESULT
   - Methods: runAnalysis, clearResult

10. Implement useMetrics hook
    - Results by tool (prose_stats, style_flags, word_frequency)
    - Active tool state
    - Source mode and path text
    - Loading state
    - Message handlers for METRICS_RESULT, ACTIVE_FILE, MANUSCRIPT_GLOBS, CHAPTER_GLOBS
    - Methods: runMetrics, switchTool, setSourceMode

11. Implement useDictionary hook
    - Dictionary word, context, source URI, relative path
    - Dictionary tool name
    - Word edited flag
    - Utilities result state
    - Loading state
    - Message handlers for DICTIONARY_RESULT
    - Methods: runDictionary, setWord, setContext

12. Implement useContext hook
    - Context text state
    - Requested resources state
    - Loading and status message state
    - Message handlers for CONTEXT_RESULT
    - Methods: runContext, clearContext

**Phase 3: App.tsx Refactoring**
13. Refactor App.tsx to use domain hooks
    - Import all domain hooks
    - Set up message router with handler registry
    - Set up persistence with combined state
    - Remove old useState calls (42 → ~5 UI-only states)
    - Remove old useEffect message handler
    - Remove old persistence effect

14. Update component JSX to pass hook props
    - AnalysisTab receives analysis, selection, context hooks
    - MetricsTab receives metrics hook
    - UtilitiesTab receives dictionary hook
    - SearchTab receives search hook
    - SettingsOverlay receives settings, publishing hooks
    - TabBar receives token widget props from settings

**Phase 4: Component Updates**
15. Update AnalysisTab component
    - Accept hook props instead of individual props
    - Update prop types/interfaces
    - Verify all functionality intact

16. Update MetricsTab component
    - Accept metrics hook props
    - Update prop types/interfaces
    - Verify tool switching and source selection

17. Update UtilitiesTab component
    - Accept dictionary hook props
    - Update prop types/interfaces
    - Verify dictionary input persistence

18. Update SearchTab component
    - Accept search hook props
    - Update prop types/interfaces
    - Verify search functionality

19. Update SettingsOverlay component
    - Accept settings and publishing hook props
    - Update prop types/interfaces
    - Verify settings save/load

**Phase 5: Testing & Documentation**
20. Test extension in Extension Development Host
    - Verify all tabs work correctly
    - Test state persistence (refresh webview)
    - Test all message types
    - Test selection/paste operations
    - Test settings overlay
    - Test token tracking
    - Verify no regressions

21. Update ARCHITECTURE.md
    - Document new hooks structure
    - Add diagrams showing hook organization
    - Update component interaction patterns

22. Update memory bank
    - Summarize refactoring results
    - Link to ADR and epic
    - Document line count reductions

**Affected Files**:
- src/presentation/webview/hooks/useVSCodeApi.ts (new)
- src/presentation/webview/hooks/usePersistence.ts (new)
- src/presentation/webview/hooks/useMessageRouter.ts (new)
- src/presentation/webview/hooks/domain/useAnalysis.ts (new)
- src/presentation/webview/hooks/domain/useMetrics.ts (new)
- src/presentation/webview/hooks/domain/useDictionary.ts (new)
- src/presentation/webview/hooks/domain/useContext.ts (new)
- src/presentation/webview/hooks/domain/useSearch.ts (new)
- src/presentation/webview/hooks/domain/useSettings.ts (new)
- src/presentation/webview/hooks/domain/useSelection.ts (new)
- src/presentation/webview/hooks/domain/usePublishing.ts (new)
- src/presentation/webview/App.tsx (major refactor)
- src/presentation/webview/components/AnalysisTab.tsx (update)
- src/presentation/webview/components/MetricsTab.tsx (update)
- src/presentation/webview/components/UtilitiesTab.tsx (update)
- src/presentation/webview/components/SearchTab.tsx (update)
- src/presentation/webview/components/SettingsOverlay.tsx (update)
- docs/ARCHITECTURE.md (update)

**Acceptance Criteria**:
- ✅ App.tsx reduced from 697 → ~150 lines (78% reduction)
- ✅ All 42 useState hooks extracted into 8 domain hooks
- ✅ Message routing uses Strategy pattern
- ✅ All existing functionality preserved (no regressions)
- ✅ State persistence works correctly
- ✅ All tabs function correctly
- ✅ Settings overlay works with new hooks
- ✅ Token tracking maintained
- ✅ Selection/paste operations work
- ✅ TypeScript compilation successful
- ✅ Extension runs in Development Host
- ✅ ARCHITECTURE.md updated
- ✅ Memory bank entry created

**Risks/Notes**:
- Large refactoring requires careful testing after each phase
- Persistence keys must remain unchanged to preserve user state
- Message handler signatures must match exactly
- Tab component prop changes must be backward compatible during migration
- Hook dependency cycles could cause infinite re-renders (mitigate with clear boundaries)
- useCallback/useMemo usage critical for performance

## Cross-Cutting Concerns

- **Architecture Consistency**: Frontend now mirrors backend domain handler pattern
- **Maintainability**: Smaller, focused files easier to understand and modify
- **Testability**: Domain hooks can be unit tested in isolation (future)
- **Performance**: useCallback/useMemo prevent unnecessary re-renders
- **Type Safety**: Clear TypeScript interfaces for all hook contracts
- **Developer Experience**: Easier to find and modify domain-specific logic

## Review & Verification Cadence

- Test in Extension Development Host after each phase
- Verify state persistence after each domain hook extraction
- Check TypeScript compilation after each hook implementation
- Manual testing of all features after App.tsx refactor
- Final integration testing before merge

## Definition of Done

- ADR finalized and committed with accepted status
- All 8 domain hooks implemented and tested
- App.tsx refactored to ~150 lines
- All tab components updated with new prop patterns
- Infrastructure hooks (useVSCodeApi, usePersistence, useMessageRouter) working
- No regressions in existing functionality
- State persistence intact
- TypeScript compilation successful
- Extension tested in Development Host
- ARCHITECTURE.md updated
- Memory bank entry created
- All changes committed with descriptive messages
- Branch merged to main

## Success Metrics

- **Line Count Reduction**: App.tsx 697 → ~150 lines (78%)
- **State Hook Reduction**: 42 useState → 8 domain hooks (81%)
- **Message Handling**: 20-case switch → Strategy pattern registry
- **Component Props**: 10+ props → 1-2 hook spreads per component
- **File Organization**: 1 monolithic file → 11 organized hook files
- **Maintainability**: Time to locate domain logic reduced by ~70%

## Future Work (Separate Epics)

- Unit testing infrastructure for React hooks
- Performance profiling and optimization
- Error boundary components for graceful failures
- Hook composition patterns for shared logic
- Storybook setup for component documentation
- Integration testing with Playwright/Cypress
- Performance monitoring with React DevTools Profiler
