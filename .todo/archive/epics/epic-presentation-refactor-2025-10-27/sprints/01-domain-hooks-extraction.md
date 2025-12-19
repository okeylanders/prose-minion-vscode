# Sprint 1 — Complete Presentation Layer Domain Hooks Refactoring

## Epic

.todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md

## Status

✅ Complete

**10-27-2025**: Implemented
**Merged**: November 2025 (PR #13)

## Goal

Completely refactor App.tsx from a 697-line "God Component" into an orchestrator using domain-organized custom React hooks, reducing complexity by 78% and achieving architectural consistency with the backend domain handler pattern.

## ADR Reference

- [docs/adr/2025-10-27-presentation-layer-domain-hooks.md](../../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Status: Accepted
- Decision: Extract domain hooks mirroring `application/handlers/domain/` pattern, implement Strategy pattern for message routing

## Tasks

### Phase 1: Infrastructure Hooks

#### 1. Create Hooks Directory Structure

**Directories to create**:
```
src/presentation/webview/hooks/
src/presentation/webview/hooks/domain/
```

#### 2. Implement useVSCodeApi Hook

File: `src/presentation/webview/hooks/useVSCodeApi.ts` (new)

**Implementation**:
```typescript
import * as React from 'react';

declare function acquireVsCodeApi(): any;

export const useVSCodeApi = () => {
  const vscode = React.useRef(acquireVsCodeApi());
  return vscode.current;
};
```

**Key Features**:
- Wraps singleton `acquireVsCodeApi()`
- Returns stable reference via useRef
- Type-safe postMessage wrapper

#### 3. Implement usePersistence Hook

File: `src/presentation/webview/hooks/usePersistence.ts` (new)

**Implementation**:
```typescript
import * as React from 'react';
import { useVSCodeApi } from './useVSCodeApi';

export const usePersistence = <T extends Record<string, any>>(state: T) => {
  const vscode = useVSCodeApi();

  React.useEffect(() => {
    vscode.setState(state);
  }, [vscode, state]);
};

export const usePersistedState = <T>(): T | undefined => {
  const vscode = useVSCodeApi();
  return vscode.getState?.() as T | undefined;
};
```

**Key Features**:
- Auto-sync state to vscode.setState
- Hydrate state from vscode.getState
- Generic type support

#### 4. Implement useMessageRouter Hook

File: `src/presentation/webview/hooks/useMessageRouter.ts` (new)

**Implementation**:
```typescript
import * as React from 'react';
import { MessageType, ExtensionToWebviewMessage } from '../../shared/types';

type MessageHandler<T = ExtensionToWebviewMessage> = (message: T) => void;
type MessageHandlerMap = Partial<Record<MessageType, MessageHandler>>;

export const useMessageRouter = (handlers: MessageHandlerMap) => {
  const handlersRef = React.useRef(handlers);

  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  React.useEffect(() => {
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

**Key Features**:
- Strategy pattern: MessageType → Handler
- Stable event listener (no re-registration)
- Type-safe handler signatures
- Memoized handlers ref

### Phase 2: Domain Hooks

#### 5. Implement useSearch Hook

File: `src/presentation/webview/hooks/domain/useSearch.ts` (new)

**State**:
- `searchResult: any | null`
- `wordSearchTargets: string`

**Actions**:
- `handleSearchResult(message: SearchResultMessage)`
- `setWordSearchTargets(targets: string)`

**Persistence**: `searchResult`, `wordSearchTargets`

#### 6. Implement usePublishing Hook

File: `src/presentation/webview/hooks/domain/usePublishing.ts` (new)

**State**:
- `publishingPreset: string`
- `publishingTrimKey: string`
- `publishingGenres: Array<Genre>`

**Actions**:
- `handlePublishingStandardsData(message: PublishingStandardsDataMessage)`

**Persistence**: `publishingPreset`, `publishingTrimKey`

#### 7. Implement useSettings Hook

File: `src/presentation/webview/hooks/domain/useSettings.ts` (new)

**State**:
- `showSettings: boolean`
- `settingsData: Record<string, any>`
- `tokenTotals: TokenUsage`
- `showTokenWidget: boolean`
- `apiKeyInput: string`
- `hasSavedKey: boolean`
- `modelOptions: ModelOption[]`
- `modelSelections: Partial<Record<ModelScope, string>>`

**Actions**:
- `open()`, `close()`, `toggle()`
- `handleSettingsData(message: SettingsDataMessage)`
- `handleApiKeyStatus(message: ApiKeyStatusMessage)`
- `saveApiKey()`, `clearApiKey()`
- `resetTokens()`
- `toggleTokenWidget()`
- `setModelSelection(scope: ModelScope, model: string)`

**Persistence**: `settingsData`, `tokenTotals`, `showTokenWidget`, `modelSelections`

#### 8. Implement useSelection Hook

File: `src/presentation/webview/hooks/domain/useSelection.ts` (new)

**State**:
- `selectedText: string`
- `selectedSourceUri: string`
- `selectedRelativePath: string`
- `dictionaryInjection: { word?, context?, sourceUri?, relativePath?, timestamp } | null`

**Actions**:
- `handleSelectionUpdated(message: SelectionUpdatedMessage)`
- `handleSelectionData(message: SelectionDataMessage)`
- `requestSelection(target: SelectionTarget)`
- `handleDictionaryInjectionHandled()`

**Persistence**: `selectedText`, `selectedSourceUri`, `selectedRelativePath`

#### 9. Implement useAnalysis Hook

File: `src/presentation/webview/hooks/domain/useAnalysis.ts` (new)

**State**:
- `result: string`
- `toolName: string | undefined`
- `loading: boolean`
- `usedGuides: string[]`
- `guideNames: string`
- `statusMessage: string`

**Actions**:
- `runAnalysis(text: string, tool: string, ...)`
- `handleAnalysisResult(message: AnalysisResultMessage)`
- `clearResult()`

**Persistence**: `analysisResult`, `analysisToolName`, `usedGuides`, `guideNames`, `statusMessage`

#### 10. Implement useMetrics Hook

File: `src/presentation/webview/hooks/domain/useMetrics.ts` (new)

**State**:
- `metricsResultsByTool: Partial<Record<MetricsTool, any>>`
- `metricsActiveTool: MetricsTool`
- `metricsLoading: boolean`
- `metricsSourceMode: TextSourceMode`
- `metricsPathText: string`

**Actions**:
- `runMetrics(tool: string, ...)`
- `handleMetricsResult(message: MetricsResultMessage)`
- `handleActiveFile(message: ActiveFileMessage)`
- `handleManuscriptGlobs(message: ManuscriptGlobsMessage)`
- `handleChapterGlobs(message: ChapterGlobsMessage)`
- `setActiveTool(tool: MetricsTool)`
- `setSourceMode(mode: TextSourceMode)`

**Persistence**: `metricsResultsByTool`, `metricsActiveTool`, `metricsSourceMode`, `metricsPathText`

#### 11. Implement useDictionary Hook

File: `src/presentation/webview/hooks/domain/useDictionary.ts` (new)

**State**:
- `utilitiesResult: string`
- `dictionaryToolName: string | undefined`
- `utilitiesLoading: boolean`
- `dictionaryWord: string`
- `dictionaryContext: string`
- `dictionaryWordEdited: boolean`
- `dictionarySourceUri: string`
- `dictionaryRelativePath: string`

**Actions**:
- `runDictionary(tool: string, word: string, context: string)`
- `handleDictionaryResult(message: DictionaryResultMessage)`
- `setWord(word: string)`
- `setContext(context: string)`
- `setWordEdited(edited: boolean)`

**Persistence**: All state fields

#### 12. Implement useContext Hook

File: `src/presentation/webview/hooks/domain/useContext.ts` (new)

**State**:
- `contextText: string`
- `contextLoading: boolean`
- `contextStatusMessage: string`
- `contextRequestedResources: string[]`

**Actions**:
- `runContext(...)`
- `handleContextResult(message: ContextResultMessage)`
- `clearContext()`
- `setContextLoading(loading: boolean)`

**Persistence**: `contextText`, `contextRequestedResources`

### Phase 3: App.tsx Refactoring

#### 13. Refactor App.tsx

File: `src/presentation/webview/App.tsx` (major refactor)

**Key Changes**:
1. Import all domain hooks
2. Replace 42 useState with 8 domain hook calls
3. Replace 60+ dependency useEffect with usePersistence
4. Replace message handler useEffect with useMessageRouter
5. Update component JSX to pass hook props

**Target Structure**:
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

  // UI-only state
  const [activeTab, setActiveTab] = useState<TabId>(TabId.ANALYSIS);
  const [error, setError] = useState('');

  // Message routing
  useMessageRouter({ /* handler map */ });

  // Persistence
  usePersistence({ /* combined state */ });

  return (/* JSX */);
};
```

**Expected Reduction**: 697 → ~150 lines (78%)

### Phase 4: Component Updates

#### 14. Update AnalysisTab Component

File: `src/presentation/webview/components/AnalysisTab.tsx`

**Changes**:
- Update props interface to accept hook return types
- Replace individual props with hook spreads
- Verify all functionality intact

#### 15. Update MetricsTab Component

File: `src/presentation/webview/components/MetricsTab.tsx`

**Changes**:
- Update props interface for metrics hook
- Simplify prop passing
- Test tool switching and source selection

#### 16. Update UtilitiesTab Component

File: `src/presentation/webview/components/UtilitiesTab.tsx`

**Changes**:
- Update props interface for dictionary hook
- Verify input persistence works
- Test dictionary injection

#### 17. Update SearchTab Component

File: `src/presentation/webview/components/SearchTab.tsx`

**Changes**:
- Update props interface for search hook
- Verify search functionality

#### 18. Update SettingsOverlay Component

File: `src/presentation/webview/components/SettingsOverlay.tsx`

**Changes**:
- Update props interface for settings + publishing hooks
- Simplify prop passing
- Test save/load functionality

### Phase 5: Documentation & Testing

#### 19. Test Extension

**Manual Testing Protocol**:
1. Run `npm run watch`
2. Press F5 to launch Extension Development Host
3. Test each tab:
   - Analysis: Run dialogue/prose analysis
   - Metrics: Run all three metrics tools, switch between them
   - Utilities: Dictionary lookup with context
   - Search: Word search
4. Test state persistence:
   - Refresh webview, verify state restored
5. Test settings:
   - Open settings overlay
   - Change model selections
   - Save settings
   - Reset token usage
6. Test selection/paste operations:
   - Selection to assistant
   - Selection to dictionary
   - Paste buttons
7. Verify token tracking widget
8. Check for TypeScript errors
9. Check browser console for errors

**Acceptance**: No regressions, all features work

#### 20. Update ARCHITECTURE.md

File: `docs/ARCHITECTURE.md`

**Changes**:
- Add section on presentation layer hooks architecture
- Document hook organization by domain
- Add diagrams showing hook composition
- Update component interaction patterns
- Document message routing Strategy pattern

#### 21. Create Memory Bank Entry

File: `.memory-bank/20251027-<time>-presentation-layer-refactor.md`

**Contents**:
- Summary of refactoring
- Before/after metrics
- Links to ADR, epic, sprint
- Key decisions and learnings
- Future work items

## Affected Files

**New Files (11)**:
- src/presentation/webview/hooks/useVSCodeApi.ts
- src/presentation/webview/hooks/usePersistence.ts
- src/presentation/webview/hooks/useMessageRouter.ts
- src/presentation/webview/hooks/domain/useAnalysis.ts
- src/presentation/webview/hooks/domain/useMetrics.ts
- src/presentation/webview/hooks/domain/useDictionary.ts
- src/presentation/webview/hooks/domain/useContext.ts
- src/presentation/webview/hooks/domain/useSearch.ts
- src/presentation/webview/hooks/domain/useSettings.ts
- src/presentation/webview/hooks/domain/useSelection.ts
- src/presentation/webview/hooks/domain/usePublishing.ts

**Updated Files (7)**:
- src/presentation/webview/App.tsx (major refactor: 697 → ~150 lines)
- src/presentation/webview/components/AnalysisTab.tsx
- src/presentation/webview/components/MetricsTab.tsx
- src/presentation/webview/components/UtilitiesTab.tsx
- src/presentation/webview/components/SearchTab.tsx
- src/presentation/webview/components/SettingsOverlay.tsx
- docs/ARCHITECTURE.md

**Total Files**: 18 (11 new, 7 updated)

## Acceptance Criteria

- ✅ All infrastructure hooks implemented (useVSCodeApi, usePersistence, useMessageRouter)
- ✅ All 8 domain hooks implemented and tested
- ✅ App.tsx reduced from 697 → ~150 lines (78% reduction)
- ✅ 42 useState hooks → 8 domain hooks (81% reduction)
- ✅ Message routing uses Strategy pattern
- ✅ All tab components updated with hook props
- ✅ State persistence works correctly across webview refreshes
- ✅ All existing functionality preserved (no regressions)
- ✅ TypeScript compilation successful
- ✅ Extension runs successfully in Development Host
- ✅ All tabs function correctly
- ✅ Settings overlay works with new hooks
- ✅ Token tracking maintained
- ✅ Selection/paste operations work
- ✅ ARCHITECTURE.md updated
- ✅ Memory bank entry created

## Commit Strategy

This sprint will use multiple commits organized by phase:

1. **Infrastructure**: "feat(presentation): add hook infrastructure (useVSCodeApi, usePersistence, useMessageRouter)"
2. **Domain Hooks Batch 1**: "feat(presentation): add useSearch and usePublishing domain hooks"
3. **Domain Hooks Batch 2**: "feat(presentation): add useSettings and useSelection domain hooks"
4. **Domain Hooks Batch 3**: "feat(presentation): add useAnalysis and useMetrics domain hooks"
5. **Domain Hooks Batch 4**: "feat(presentation): add useDictionary and useContext domain hooks"
6. **App Refactor**: "refactor(presentation): rewrite App.tsx using domain hooks (697→150 lines)"
7. **Component Updates**: "refactor(presentation): update tab components for hook props"
8. **Documentation**: "docs: update ARCHITECTURE.md with presentation layer hooks pattern"

## Testing Protocol

### Phase Testing
After each phase, verify:
- TypeScript compiles without errors
- Extension launches in Development Host
- No runtime errors in console

### Integration Testing (After Phase 3)
Full feature testing:
- All analysis tools work
- All metrics tools work
- Dictionary lookup works
- Search functionality works
- Settings save/load works
- State persistence across refresh works
- Token tracking works

### Regression Testing (Final)
Comprehensive check:
- Every button/input works as before
- No visual regressions
- No performance regressions
- No console errors
- State persistence intact

## Risks/Notes

- **Large refactor**: Requires careful testing after each phase
- **Persistence keys**: Must remain unchanged to preserve user state
- **Message handlers**: Signatures must match exactly
- **Hook dependencies**: Watch for infinite re-render loops
- **Performance**: Use useCallback/useMemo appropriately
- **Type safety**: Maintain strict TypeScript types throughout

## Success Metrics

- **App.tsx**: 697 → ~150 lines (78% reduction) ✅
- **useState hooks**: 42 → 8 domain hooks (81% reduction) ✅
- **Message handling**: Switch statement → Strategy pattern ✅
- **Component props**: 10+ props → 1-2 hook spreads ✅
- **File organization**: 1 file → 11 organized hooks ✅
- **Build time**: No significant change expected
- **Runtime performance**: No regressions expected

## Definition of Done

- All acceptance criteria met
- All commits pushed to sprint branch
- Manual testing completed successfully
- No TypeScript errors
- No console errors
- No functional regressions
- ARCHITECTURE.md updated
- Memory bank entry created
- PR created referencing ADR and epic
- Ready for merge to main

## Next Actions After Sprint

1. Merge sprint branch to main
2. Update CHANGELOG.md with refactoring note
3. Consider unit testing infrastructure for hooks (future epic)
4. Consider Storybook setup for component documentation (future epic)
5. Consider performance profiling with React DevTools (future epic)
