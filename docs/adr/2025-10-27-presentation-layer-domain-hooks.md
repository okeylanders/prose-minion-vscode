# ADR: Presentation Layer Domain Hooks Architecture

Status: Accepted
Date: 2025-10-27
Implemented: Complete (PR #13)
Implementation Date: 2025-10-27

## Context

The presentation layer has grown into a monolithic "God Component" with App.tsx at 697 lines containing:
- **42 useState hooks** managing disparate state concerns
- **20 message handler cases** in a single switch statement
- **60+ dependencies** in the persistence effect
- Mixed concerns across analysis, metrics, dictionary, context, settings, search, and selection domains

Current pain points:
- **App.tsx is unmaintainable** – all state and logic in one component
- **No domain separation** – analysis state mixed with dictionary state mixed with metrics state
- **Poor testability** – can't test domain logic in isolation
- **Tight coupling** – tab components receive 10+ props each
- **Inconsistent architecture** – backend has domain handlers, frontend has one massive component
- **Hard to extend** – adding new features requires touching the 697-line App.tsx

The backend successfully refactored `MessageHandler.ts` from 1091 → 495 lines using domain handlers (ADR 2025-10-26). The frontend should follow the same pattern.

## Decision

Refactor App.tsx using custom React hooks organized by domain, mirroring the `application/handlers/domain/` pattern. Apply the Strategy pattern for message routing.

### Proposed Structure

```
src/presentation/webview/
├── App.tsx                          # Orchestration only (~150 lines)
├── hooks/
│   ├── domain/
│   │   ├── useAnalysis.ts          # Analysis state + handlers
│   │   ├── useMetrics.ts           # Metrics state + handlers
│   │   ├── useDictionary.ts        # Dictionary state + handlers
│   │   ├── useContext.ts           # Context generation state + handlers
│   │   ├── useSearch.ts            # Search state + handlers
│   │   ├── useSettings.ts          # Settings overlay state + handlers
│   │   ├── useSelection.ts         # Selection/paste state + handlers
│   │   └── usePublishing.ts        # Publishing standards state
│   ├── useMessageRouter.ts         # Strategy pattern for message routing
│   ├── usePersistence.ts           # vscode.setState logic
│   └── useVSCodeApi.ts             # VSCode API wrapper
└── components/
    ├── AnalysisTab.tsx              # Uses analysis hook props
    ├── MetricsTab.tsx               # Uses metrics hook props
    ├── UtilitiesTab.tsx             # Uses dictionary hook props
    ├── SearchTab.tsx                # Uses search hook props
    └── SettingsOverlay.tsx          # Uses settings hook props
```

### Organization Principles

1. **Domain-Driven** – Group state and logic by feature domain
2. **Single Responsibility** – Each hook manages one domain concern
3. **Composability** – Hooks can be combined and reused
4. **Testability** – Individual hooks can be unit tested in isolation
5. **Consistency** – Mirrors `application/handlers/domain/` backend pattern
6. **Type Safety** – Clear input/output contracts per hook

### Hook Patterns

**Domain Hook Structure (e.g., useAnalysis.ts)**
```typescript
export interface AnalysisState {
  result: string;
  toolName?: string;
  loading: boolean;
  usedGuides: string[];
}

export interface AnalysisActions {
  runAnalysis: (text: string, tool: string) => void;
  handleResult: (message: AnalysisResultMessage) => void;
  clearResult: () => void;
}

export const useAnalysis = (): AnalysisState & AnalysisActions => {
  const vscode = useVSCodeApi();
  const persisted = usePersistence<PersistedAnalysisState>();

  const [result, setResult] = useState(persisted?.analysisResult ?? '');
  const [toolName, setToolName] = useState(persisted?.analysisToolName);
  const [loading, setLoading] = useState(false);
  const [usedGuides, setUsedGuides] = useState<string[]>(persisted?.usedGuides ?? []);

  const handleResult = useCallback((message: AnalysisResultMessage) => {
    setResult(message.result);
    setToolName(message.toolName);
    setUsedGuides(message.usedGuides || []);
    setLoading(false);
  }, []);

  const runAnalysis = useCallback((text: string, tool: string) => {
    setLoading(true);
    setResult('');
    vscode.postMessage({
      type: MessageType.RUN_ANALYSIS,
      text,
      toolName: tool
    });
  }, [vscode]);

  const clearResult = useCallback(() => {
    setResult('');
    setUsedGuides([]);
  }, []);

  return {
    result,
    toolName,
    loading,
    usedGuides,
    handleResult,
    runAnalysis,
    clearResult
  };
};
```

**Message Router with Strategy Pattern (useMessageRouter.ts)**
```typescript
type MessageHandler<T = ExtensionToWebviewMessage> = (message: T) => void;
type MessageHandlerMap = Partial<Record<MessageType, MessageHandler>>;

export const useMessageRouter = (handlers: MessageHandlerMap) => {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const handler = handlersRef.current[event.data.type];
      if (handler) {
        handler(event.data);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);
};
```

**Refactored App.tsx (~150 lines)**
```typescript
export const App: React.FC = () => {
  // Domain hooks
  const analysis = useAnalysis();
  const metrics = useMetrics();
  const dictionary = useDictionary();
  const context = useContext();
  const search = useSearch();
  const settings = useSettings();
  const selection = useSelection();
  const publishing = usePublishing();

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>(TabId.ANALYSIS);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Message routing via Strategy pattern
  useMessageRouter({
    [MessageType.ANALYSIS_RESULT]: analysis.handleResult,
    [MessageType.METRICS_RESULT]: metrics.handleResult,
    [MessageType.DICTIONARY_RESULT]: dictionary.handleResult,
    [MessageType.CONTEXT_RESULT]: context.handleResult,
    [MessageType.SEARCH_RESULT]: search.handleResult,
    [MessageType.SELECTION_UPDATED]: selection.handleUpdate,
    [MessageType.SELECTION_DATA]: selection.handleData,
    [MessageType.SETTINGS_DATA]: settings.handleData,
    [MessageType.PUBLISHING_STANDARDS_DATA]: publishing.handleData,
    [MessageType.OPEN_SETTINGS]: settings.open,
    [MessageType.OPEN_SETTINGS_TOGGLE]: settings.toggle,
    [MessageType.ERROR]: (msg) => setError(msg.message),
    [MessageType.STATUS_MESSAGE]: (msg) => setStatusMessage(msg.message),
    // ... etc
  });

  // Persistence
  usePersistence({
    activeTab,
    ...analysis.persistedState,
    ...metrics.persistedState,
    ...dictionary.persistedState,
    ...context.persistedState,
    ...search.persistedState,
    ...selection.persistedState,
    ...settings.persistedState,
  });

  return (
    <>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tokenTotals={settings.tokenTotals}
        showTokenWidget={settings.showTokenWidget}
        onToggleTokenWidget={settings.toggleTokenWidget}
      />
      {activeTab === TabId.ANALYSIS && (
        <AnalysisTab
          {...analysis}
          {...selection}
          {...context}
        />
      )}
      {activeTab === TabId.METRICS && (
        <MetricsTab {...metrics} />
      )}
      {activeTab === TabId.UTILITIES && (
        <UtilitiesTab {...dictionary} />
      )}
      {activeTab === TabId.SEARCH && (
        <SearchTab {...search} />
      )}
      {settings.showSettings && (
        <SettingsOverlay {...settings} {...publishing} />
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {statusMessage && <StatusBanner message={statusMessage} />}
    </>
  );
};
```

## Migration Strategy

### Phase 1: Create Hook Infrastructure
1. Create `src/presentation/webview/hooks/` directory structure
2. Implement `useVSCodeApi` wrapper hook
3. Implement `usePersistence` hook for state management
4. Implement `useMessageRouter` with Strategy pattern
5. Verify infrastructure works with minimal state

### Phase 2: Extract Domain Hooks
Extract one domain at a time, testing after each:
1. `useSearch` (simplest - minimal state)
2. `usePublishing` (settings-related, few dependencies)
3. `useSettings` (isolated settings overlay logic)
4. `useSelection` (selection and paste operations)
5. `useAnalysis` (analysis tab state and handlers)
6. `useMetrics` (metrics tab with multi-tool state)
7. `useDictionary` (utilities tab with dictionary logic)
8. `useContext` (context generation with streaming)

### Phase 3: Refactor App.tsx and Components
1. Update App.tsx to use all domain hooks
2. Remove old state management from App.tsx
3. Update tab components to accept hook props
4. Clean up prop drilling and redundant state
5. Test full integration

### Phase 4: Cleanup and Documentation
1. Remove old commented-out code
2. Add JSDoc comments to all hooks
3. Update ARCHITECTURE.md with new structure
4. Create memory bank entry with refactoring summary

## Alternatives Considered

### Keep Everything in App.tsx
**Rejected** – Maintainability continues to degrade. Already at 697 lines with 42 useState hooks.

### Use Redux or Context API for State Management
**Rejected** – Overkill for current needs. Custom hooks provide sufficient abstraction without external dependencies.

### Split App.tsx into Multiple Components
**Rejected** – Doesn't address the state management problem, just moves it around. Hooks provide better composability.

### Use a State Machine Library (XState)
**Rejected** – Too complex for current needs. May revisit for complex async flows in the future.

## Consequences

### Positive
- ✅ App.tsx reduced from 697 → ~150 lines (78% reduction)
- ✅ State organized by domain (mirrors backend architecture)
- ✅ Individual domains testable in isolation
- ✅ Easier to add new features (modify one hook vs monolithic App)
- ✅ Better code navigation (find domain logic quickly)
- ✅ Improved type safety with clear hook contracts
- ✅ Strategy pattern for message routing (extensible)
- ✅ Consistent architecture between frontend and backend

### Neutral
- More files to navigate (but better organized)
- Learning curve for hook composition patterns
- Need to maintain clear hook contracts

### Risks
- Must preserve persistence behavior exactly (critical for UX)
- Message routing must handle all existing message types
- Tab components need careful prop refactoring
- Potential for hook dependency cycles (mitigated by clear boundaries)

## Implementation Notes

- Extract hooks incrementally, testing after each domain
- Use TypeScript interfaces for hook return types
- Preserve all existing persistence keys for state continuity
- Keep message handler signatures unchanged
- Use `useCallback` for all message handlers to prevent re-renders
- Maintain backward compatibility for tab components during migration
- Test in Extension Development Host after each major change

## Testing Plan

- Manual testing in Extension Development Host after each hook extraction
- Verify persistence works (refresh webview, state should restore)
- Verify all message types are handled correctly
- Test each tab independently
- Test settings overlay integration
- Check that token tracking still works
- Verify selection/paste operations function correctly

## Success Metrics

- App.tsx: 697 → ~150 lines (78% reduction)
- State hooks: 42 → ~8 domain hooks
- Message handler switch: 20 cases → Strategy pattern registry
- Component props: Reduced from 10+ individual props → 1-2 hook spreads
- Test coverage: Can unit test individual domains

## Links

- Related ADR: `docs/adr/2025-10-26-message-architecture-organization.md` (backend domain handlers)
- Epic: `.todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md`
- Sprint: `.todo/epics/epic-presentation-refactor-2025-10-27/sprints/01-domain-hooks-extraction.md`
- Branch: `sprint/epic-presentation-refactor-2025-10-27-01-domain-hooks`
