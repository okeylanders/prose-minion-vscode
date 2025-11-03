# ADR: Unified Settings Architecture via Domain Hooks

**Status**: Accepted
**Date**: 2025-11-03
**Deciders**: Development Team
**Related**: [ADR-2025-10-27: Presentation Layer Domain Hooks](./2025-10-27-presentation-layer-domain-hooks.md)

---

## Context

During the Word Length Filter epic (2025-11-02), we discovered critical inconsistencies in how settings are managed across the extension. A comprehensive audit revealed:

### Critical Issues

1. **SearchTab Settings Completely Broken** (CRITICAL)
   - 4 settings with no sync, no persistence, wrong defaults
   - Users cannot configure via Settings Overlay
   - Settings lost on webview reload
   - Native VSCode settings panel changes ignored

2. **Mixed Architecture Patterns** (HIGH)
   - Domain Hooks pattern (5 hooks): Modern, persistent, bidirectional sync ✅
   - Message-based pattern (5 settings): Legacy, no persistence, manual listeners ❌
   - Hybrid pattern (API key): SecretStorage, correct for sensitive data ✅

3. **Backend Duplication** (MEDIUM)
   - Settings keys hardcoded in multiple locations
   - Manual updates in 3+ places when adding settings
   - No single source of truth

### Current State

**Settings Inventory** (51 total):

| Pattern | Count | Examples | Persistence | Sync | Issues |
|---------|-------|----------|-------------|------|--------|
| Domain Hooks | 37 | `useSettings`, `usePublishing`, `useAnalysis` | ✅ Yes | ✅ Bidirectional | None |
| Message-Based | 14 | SearchTab (6), MetricsTab (10) | ❌ No (SearchTab)<br>⚠️ Indirect (MetricsTab) | ❌ No | Critical |
| Hybrid (SecretStorage) | 1 | API key | ✅ Yes | ✅ Bidirectional | None (correct) |

**Persistence Coverage**: 73% (37/51 settings)

### User Impact

**Broken User Journey** (SearchTab):
1. User sets custom word search parameters
2. Gets good results
3. Closes VSCode
4. Reopens → all settings lost, back to defaults ❌

**Maintainability Cost**:
- Adding a new setting: 30 minutes (current) vs 15 minutes (unified) = 50% slower
- Backend config watcher: Hardcoded lists in 3 places
- Pattern confusion: New developers must learn multiple approaches

---

## Decision

We will **unify all settings management using the Domain Hooks pattern**, matching the existing successful implementations (`usePublishing`, `useSettings`, etc.).

### Architecture Choice: Domain Hooks Everywhere

**Pattern**:
```typescript
// Frontend Hook
export const useWordSearch = (vscode: VSCodeAPI) => {
  const [settings, setSettings] = React.useState({
    defaultTargets: 'just',
    contextWords: 7,
    clusterWindow: 150,
    minClusterSize: 2,
    caseSensitive: false,
    enableAssistantExpansion: false
  });

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === MessageType.SETTINGS_DATA) {
        // Extract wordSearch.* settings
        setSettings({ ... });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateSetting = (key: string, value: any) => {
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      key: `wordSearch.${key}`,
      value
    });
  };

  return {
    settings,
    updateSetting,
    persistedState: { wordSearch: settings }
  };
};
```

**App.tsx Composition**:
```typescript
const wordSearch = useWordSearch(vscode);

usePersistence({
  activeTab,
  ...settings.persistedState,
  ...publishing.persistedState,
  ...wordSearch.persistedState,  // ✅ Added
  // ...
});

useMessageRouter({
  [MessageType.SETTINGS_DATA]: settings.handleMessage,
  [MessageType.SETTINGS_DATA]: wordSearch.handleMessage,  // ✅ Strategy pattern
  // ...
});
```

**Backend**:
```typescript
// ConfigurationHandler exposes all wordSearch.* settings
public getWordSearchSettings() {
  return {
    defaultTargets: this.config.get('wordSearch.defaultTargets', 'just'),
    contextWords: this.config.get('wordSearch.contextWords', 7),
    clusterWindow: this.config.get('wordSearch.clusterWindow', 150),
    minClusterSize: this.config.get('wordSearch.minClusterSize', 2),
    caseSensitive: this.config.get('wordSearch.caseSensitive', false),
    enableAssistantExpansion: this.config.get('wordSearch.enableAssistantExpansion', false)
  };
}

// MessageHandler uses semantic methods (no hardcoded lists)
private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.defaultTargets',
  'proseMinion.wordSearch.contextWords',
  'proseMinion.wordSearch.clusterWindow',
  'proseMinion.wordSearch.minClusterSize',
  'proseMinion.wordSearch.caseSensitive',
  'proseMinion.wordSearch.enableAssistantExpansion'
] as const;

private shouldBroadcastWordSearchSettings(event: vscode.ConfigurationChangeEvent) {
  return this.WORD_SEARCH_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}
```

### Why Domain Hooks?

**Pros**:
- ✅ **Single Pattern**: One way to manage settings reduces cognitive load
- ✅ **Proven**: `usePublishing`, `useSettings` work flawlessly
- ✅ **Persistent**: Automatic via `usePersistence` composition
- ✅ **Bidirectional Sync**: VSCode settings panel ↔ Settings Overlay ↔ Component state
- ✅ **Echo Prevention**: Built into ConfigurationHandler
- ✅ **Testable**: Hooks are isolated and composable
- ✅ **Mirrors Backend**: Frontend hooks mirror backend domain handlers (Clean Architecture)
- ✅ **Maintainable**: Adding settings becomes mechanical (follow the pattern)

**Cons**:
- ⚠️ Migration effort (mitigated by phased approach)

### Alternatives Considered

**Option B: Keep Message-Based for Simple Settings**
- Rejected: Creates pattern confusion, no persistence, broken for SearchTab

**Option C: Settings Registry (Backend Only)**
- Rejected: Doesn't solve frontend persistence gap, doesn't unify patterns

**Option D: Do Nothing**
- Rejected: SearchTab is critically broken, user-facing bug

---

## Settings Architecture Map

This section provides a complete inventory of all settings, their domain groupings, associated hooks, and persistence strategy.

### Complete Settings Inventory (51 Items)

| # | Setting Key | Type | Default | Hook (Current/Target) | Phase | Persisted |
|---|-------------|------|---------|----------------------|-------|-----------|
| **Model Configuration Settings** | | | | **useModels** | Phase 3 | ✅ |
| 1 | `assistantModel` | string | 'z-ai/glm-4.6' | useSettings → useModels | Phase 3 | ✅ |
| 2 | `dictionaryModel` | string | 'z-ai/glm-4.6' | useSettings → useModels | Phase 3 | ✅ |
| 3 | `contextModel` | string | 'z-ai/glm-4.6' | useSettings → useModels | Phase 3 | ✅ |
| 4 | `model` (legacy fallback) | string | 'z-ai/glm-4.6' | useSettings → useModels | Phase 3 | ✅ |
| 5 | `includeCraftGuides` | boolean | true | useSettings → useModels | Phase 3 | ✅ |
| 6 | `temperature` | number | 0.7 | useSettings → useModels | Phase 3 | ✅ |
| 7 | `maxTokens` | number | 10000 | useSettings → useModels | Phase 3 | ✅ |
| 8 | `applyContextWindowTrimming` | boolean | true | useSettings → useModels | Phase 3 | ✅ |
| 9 | `ui.showTokenWidget` | boolean | true | useSettings → useTokens | Phase 3 | ✅ |
| **Word Search Settings** | | | | **useWordSearch** | Phase 0 | ❌→✅ |
| 10 | `wordSearch.defaultTargets` | string | 'just' | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 11 | `wordSearch.contextWords` | number | 7 | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 12 | `wordSearch.clusterWindow` | number | 150 | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 13 | `wordSearch.minClusterSize` | number | 2 | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 14 | `wordSearch.caseSensitive` | boolean | false | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 15 | `wordSearch.enableAssistantExpansion` | boolean | false | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| **Word Frequency Settings** | | | | **useWordFrequency** | Phase 2 | ⚠️→✅ |
| 16 | `wordFrequency.topN` | number | 100 | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 17 | `wordFrequency.includeHapaxList` | boolean | true | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 18 | `wordFrequency.hapaxDisplayMax` | number | 300 | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 19 | `wordFrequency.includeStopwordsTable` | boolean | true | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 20 | `wordFrequency.contentWordsOnly` | boolean | true | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 21 | `wordFrequency.posEnabled` | boolean | true | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 22 | `wordFrequency.includeBigrams` | boolean | true | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 23 | `wordFrequency.includeTrigrams` | boolean | true | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 24 | `wordFrequency.enableLemmas` | boolean | false | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 25 | `wordFrequency.lengthHistogramMaxChars` | number | 10 | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 26 | `wordFrequency.minCharacterLength` | number | 1 | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| **Context Resource Paths** | | | | **useContextPaths** | Phase 3 | ✅ |
| 27 | `contextPaths.characters` | string | 'characters/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 28 | `contextPaths.locations` | string | 'locations/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 29 | `contextPaths.themes` | string | 'themes/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 30 | `contextPaths.things` | string | 'things/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 31 | `contextPaths.chapters` | string | 'drafts/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 32 | `contextPaths.manuscript` | string | 'manuscript/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 33 | `contextPaths.projectBrief` | string | 'brief/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| 34 | `contextPaths.general` | string | 'research/**/*,...' | useSettings → useContextPaths | Phase 3 | ✅ |
| **Publishing Standards** | | | | **usePublishing** | Exists | ✅ |
| 35 | `publishingStandards.preset` | string | 'none' | usePublishing | Current | ✅ |
| 36 | `publishingStandards.pageSizeKey` | string | '' | usePublishing | Current | ✅ |
| **Token Tracking** | | | | **useTokens** | Phase 3 | ✅ |
| 37 | Token usage (state) | object | - | useSettings → useTokens | Phase 3 | ✅ |
| **Analysis Results** | | | | **useAnalysis** | Exists | ✅ |
| 38 | Analysis results (state) | object | - | useAnalysis | Current | ✅ |
| 39 | Guides (state) | array | - | useAnalysis | Current | ✅ |
| 40 | Analysis context (component state) | string | - | Local to AnalysisTab | Current | ✅ |
| **Metrics Results** | | | | **useMetrics** | Exists | ✅ |
| 41 | Metrics results (state) | object | - | useMetrics | Current | ✅ |
| 42 | Active subtool (state) | string | - | useMetrics | Current | ✅ |
| 43 | Metrics scope selection (component state) | object | - | Local to MetricsTab subtools | Current | ✅ |
| **Dictionary** | | | | **useDictionary** | Exists | ✅ |
| 44 | Dictionary word/context (state) | object | - | useDictionary | Current | ✅ |
| 45 | Dictionary context (component state) | string | - | Local to DictionaryTab | Current | ✅ |
| **Context Generation Service** | | | | **useContext** | Exists | ✅ |
| 46 | Context generation results (state) | string | - | useContext | Current | ✅ |
| 47 | Requested resources (state) | array | - | useContext | Current | ✅ |
| 48 | Context generation status (state) | string | - | useContext | Current | ✅ |
| **Search** | | | | **useSearch** | Exists | ✅ |
| 49 | Search results (state) | object | - | useSearch | Current | ✅ |
| 50 | Search scope selection (component state) | object | - | Local to SearchTab | Current | ✅ |
| **API Key** | | | | **Hybrid (SecretStorage)** | Exists | ✅ |
| 51 | `openRouterApiKey` | secret | - | SecretStorage (not hook) | Current | ✅ |

**Total**: 51 items (36 config settings, 14 state items, 1 secret)

**Legend**:

- ✅ = Currently persisted
- ❌ = Not persisted (broken)
- ⚠️ = Indirectly persisted (not ideal)
- ❌→✅ = Will be fixed in this epic
- ⚠️→✅ = Will be improved in this epic

---

### Domain Hook Mapping

This table shows which hooks manage which settings/state and which components consume them.

| Hook | Type | Settings/State Managed | Used By Components | Phase | File |
|------|------|------------------------|-------------------|-------|------|
| **useModels** | Config | 8 model/agent configuration settings | SettingsOverlay, All tabs (model behavior) | Phase 3 (NEW) | `hooks/domain/useModels.ts` |
| | | • `assistantModel` | | | |
| | | • `dictionaryModel` | | | |
| | | • `contextModel` | | | |
| | | • `model` (legacy fallback) | | | |
| | | • `includeCraftGuides` | | | |
| | | • `temperature` | | | |
| | | • `maxTokens` | | | |
| | | • `applyContextWindowTrimming` | | | |
| **useWordSearch** | Config | 6 word search settings | SearchTab, SettingsOverlay | Phase 0 (NEW) | `hooks/domain/useWordSearch.ts` |
| | | • `wordSearch.defaultTargets` | | | |
| | | • `wordSearch.contextWords` | | | |
| | | • `wordSearch.clusterWindow` | | | |
| | | • `wordSearch.minClusterSize` | | | |
| | | • `wordSearch.caseSensitive` | | | |
| | | • `wordSearch.enableAssistantExpansion` | | | |
| **useWordFrequency** | Config | 11 word frequency settings | MetricsTab (word frequency subtool), SettingsOverlay | Phase 2 (NEW) | `hooks/domain/useWordFrequency.ts` |
| | | • `wordFrequency.topN` | | | |
| | | • `wordFrequency.includeHapaxList` | | | |
| | | • `wordFrequency.hapaxDisplayMax` | | | |
| | | • `wordFrequency.includeStopwordsTable` | | | |
| | | • `wordFrequency.contentWordsOnly` | | | |
| | | • `wordFrequency.posEnabled` | | | |
| | | • `wordFrequency.includeBigrams` | | | |
| | | • `wordFrequency.includeTrigrams` | | | |
| | | • `wordFrequency.enableLemmas` | | | |
| | | • `wordFrequency.lengthHistogramMaxChars` | | | |
| | | • `wordFrequency.minCharacterLength` | | | |
| **useContextPaths** | Config | 8 context resource path settings (glob patterns) | SettingsOverlay, used by context generation ([bot] button) | Phase 3 (NEW) | `hooks/domain/useContextPaths.ts` |
| | | • `contextPaths.characters` | | | |
| | | • `contextPaths.locations` | | | |
| | | • `contextPaths.themes` | | | |
| | | • `contextPaths.things` | | | |
| | | • `contextPaths.chapters` | | | |
| | | • `contextPaths.manuscript` | | | |
| | | • `contextPaths.projectBrief` | | | |
| | | • `contextPaths.general` | | | |
| | | **Note**: Glob patterns defining where different resource types are stored. Used by context agent when scanning for materials. | | | |
| **useTokens** | Config + State | Token tracking + UI preference | SettingsOverlay, TokenWidget (all tabs) | Phase 3 (NEW) | `hooks/domain/useTokens.ts` |
| | | • `ui.showTokenWidget` | | | |
| | | • Token usage state | | | |
| **usePublishing** | Config | 2 publishing standard settings | SettingsOverlay, MetricsTab (prose stats) | Exists | `hooks/domain/usePublishing.ts` |
| | | • `publishing.genre` | | | |
| | | • `publishing.trimOption` | | | |
| **useAnalysis** | State | Analysis results + guides (NOT context text) | AnalysisTab, UtilitiesTab | Exists | `hooks/domain/useAnalysis.ts` |
| | | • Dialogue/prose results | | | |
| | | • Loaded guides | | | |
| | | • Status ticker | | | |
| | | **Note**: Analysis context text is component-local state | | | |
| **useMetrics** | State | Metrics results + active subtool (NOT scope) | MetricsTab | Exists | `hooks/domain/useMetrics.ts` |
| | | • Prose stats results | | | |
| | | • Style flags results | | | |
| | | • Word frequency results | | | |
| | | • Active subtool name | | | |
| | | **Note**: Each subtool's scope selection is component-local state | | | |
| **useDictionary** | State | Dictionary word + tool name (NOT context) | DictionaryTab | Exists | `hooks/domain/useDictionary.ts` |
| | | • Current word | | | |
| | | • Tool name | | | |
| | | **Note**: Dictionary context text is component-local state | | | |
| **useContext** | State | Context generation service (triggered by [bot] button) | AnalysisTab ([bot] button), potentially DictionaryTab | Exists | `hooks/domain/useContext.ts` |
| | | • Generated context text | | | |
| | | • Requested resources | | | |
| | | • Generation status/loading | | | |
| | | **Note**: Generates context when [bot] clicked. Result displayed in component-local context boxes. | | | |
| **useSearch** | State | Search results (NOT scope selection) | SearchTab | Exists | `hooks/domain/useSearch.ts` |
| | | • Word search results | | | |
| | | • Search targets | | | |
| | | **Note**: SearchTab scope selection is component-local state | | | |
| **useSelection** | State | Selected text + metadata (global) | App.tsx → all tabs | Exists | `hooks/domain/useSelection.ts` |
| | | • Selected text | | | |
| | | • Source metadata | | | |

**Hook Categories**:

- **Config**: Manages VSCode settings (persisted to workspace config)
- **State**: Manages UI/result state (persisted to webview state)
- **Hybrid**: Special handling (SecretStorage for API key)

---

### Persistence Strategy

All domain hooks expose `persistedState` which is composed in App.tsx via `usePersistence`.

#### Before Refactor (86% coverage - 30/35 items)

```typescript
// App.tsx - Current State
usePersistence({
  activeTab,
  ...settings.persistedState,      // ⚠️ Mixed: Models + Context Paths + Tokens all in one
  ...publishing.persistedState,    // ✅ Publishing standards
  ...analysis.persistedState,      // ✅ Analysis results
  ...metrics.persistedState,       // ✅ Metrics results (but wordFrequency settings indirect)
  ...dictionary.persistedState,    // ✅ Dictionary state
  ...context.persistedState,       // ✅ Context state
  ...search.persistedState,        // ✅ Search state (but NOT SearchTab settings!)
  ...selection.persistedState      // ✅ Selection state
  // ❌ Missing: wordSearch.* settings (SearchTab broken)
  // ⚠️ Indirect: wordFrequency.* settings (via backend sync)
  // ⚠️ God hook: useSettings has too many concerns (360 lines)
});
```

**Issues**:
- SearchTab settings (4) not included → lost on reload ❌
- MetricsTab settings (2) indirectly persisted via backend ⚠️
- useSettings is a god hook with mixed concerns ⚠️

---

#### After Refactor (100% coverage)

```typescript
// App.tsx - Target State
usePersistence({
  activeTab,
  ...models.persistedState,        // ✅ NEW: Model configuration (9 settings)
  ...wordSearch.persistedState,    // ✅ NEW: Word search settings (4)
  ...wordFrequency.persistedState, // ✅ NEW: Word frequency settings (2, explicit)
  ...contextPaths.persistedState,  // ✅ NEW: Context source settings (2)
  ...tokens.persistedState,        // ✅ NEW: Token tracking + UI prefs (2)
  ...publishing.persistedState,    // ✅ Publishing standards (2)
  ...analysis.persistedState,      // ✅ Analysis results
  ...metrics.persistedState,       // ✅ Metrics results
  ...dictionary.persistedState,    // ✅ Dictionary state
  ...context.persistedState,       // ✅ Context Assistant state
  ...search.persistedState,        // ✅ Search results
  ...selection.persistedState      // ✅ Selection state (global)
  // ✅ useSettings eliminated - all settings in specialized hooks
});
```

**Benefits**:

- All 35 items explicitly persisted ✅
- No reliance on backend sync for persistence ✅
- Clear, predictable persistence model ✅
- Each hook has a single, focused purpose ✅
- useSettings god hook eliminated ✅

---

### Component-to-Hook Matrix

This table shows which components consume which hooks.

| Component | Hooks Consumed | Settings/State Used | Component-Local State |
|-----------|---------------|-------------------|---------------------|
| **App.tsx** | All hooks (composition) | Composes all `persistedState`, routes all messages | Active tab |
| **SettingsOverlay** | useModels, useWordSearch, useWordFrequency, useContextPaths, useTokens, usePublishing | All 20 config settings (editable UI) | - |
| **AnalysisTab** | useModels, useAnalysis, useContext, useSelection | Model config, analysis results, context generation ([bot] button) | Context text box (local), scope selection |
| **MetricsTab** | useModels, useWordFrequency, usePublishing, useMetrics | Model config, word frequency settings, publishing standards, results | Scope selection per subtool (local) |
| **SearchTab** | useModels, useWordSearch, useSearch, useSelection | Model config, word search settings, search results | Scope selection (local) |
| **DictionaryTab** | useModels, useDictionary, useSelection | Model config, dictionary model, word/tool state | Context text box (local) |
| **UtilitiesTab** | useModels, useAnalysis | Model config, prose assistant results | - |
| **TokenWidget** | useTokens | Token usage, show/hide preference | - |

**Navigation Flow** (for config settings):
1. User changes setting in SettingsOverlay
2. Hook sends `UPDATE_SETTING` to backend
3. Backend updates VSCode config
4. Config watcher broadcasts `SETTINGS_DATA` to webview
5. Hook receives message, updates state
6. React re-renders component with new state
7. `usePersistence` persists state to webview storage

**Component-Local State** (NOT in hooks):

- **Context text boxes**:
  - **AnalysisTab**: Has a context box with a **[bot]** button. When clicked, triggers `useContext` to generate context, which is then displayed in the local box.
  - **DictionaryTab**: Has a context box for manual text entry (no [bot] button).
  - These boxes are local `useState` in each component - NOT shared.

- **Scope selection**: Each metrics subtool (prose stats, style flags, word frequency), SearchTab, and AnalysisTab has its own scope selection (which text to analyze). This is component-local state, NOT a global setting.

- **Why local?**: These are UI-specific, temporary values that don't need to be shared or persisted across components. They're managed with standard React `useState` in each component.

**Context Generation Flow** (AnalysisTab [bot] button):

1. User clicks [bot] in AnalysisTab context box
2. AnalysisTab triggers `useContext` hook to generate context
3. `useContext` uses `useContextPaths` settings (global defaults for source)
4. Generated context returned to AnalysisTab
5. AnalysisTab displays result in its local context box

---

### Backend Configuration Groups

The backend `MessageHandler` will use semantic methods to group settings (Phase 1):

| Settings Group | Constant Name | Settings Count | Broadcast Method |
|----------------|---------------|----------------|------------------|
| Model Configuration | `MODEL_CONFIG_KEYS` | 8 | `shouldBroadcastModelConfigSettings()` |
| | | (craft guides, temperature, max tokens, trim settings, model selections + legacy) | |
| Word Search | `WORD_SEARCH_KEYS` | 6 | `shouldBroadcastWordSearchSettings()` |
| | | (default targets, context words, cluster window, min cluster size, case sensitive, assistant expansion) | |
| Word Frequency | `WORD_FREQUENCY_KEYS` | 11 | `shouldBroadcastWordFrequencySettings()` |
| | | (topN, hapax settings, stopwords, content words only, POS, bigrams, trigrams, lemmas, histogram, min length) | |
| Context Paths | `CONTEXT_PATH_KEYS` | 8 | `shouldBroadcastContextPathSettings()` |
| | | (characters, locations, themes, things, chapters, manuscript, project brief, general) | |
| UI Preferences | `UI_KEYS` | 1 | `shouldBroadcastUISettings()` |
| | | (show token widget) | |
| Publishing | `PUBLISHING_KEYS` | 2 | `shouldBroadcastPublishingSettings()` |
| | | (preset, page size key) | |

**Total**: 36 config settings (excludes state-only items and component-local state)

---

### Migration Path Summary

| Phase | Hooks Created/Modified | Settings Fixed | Components Updated | Persistence Coverage |
|-------|----------------------|----------------|-------------------|---------------------|
| **Current** | 8 hooks (mixed patterns) | 37/51 working | Mixed patterns | 73% |
| **Phase 0** | +1 (useWordSearch) | 51/51 working | SearchTab | 100% |
| **Phase 1** | Backend refactor only | - | - | 100% |
| **Phase 2** | +1 (useWordFrequency) | - | MetricsTab | 100% |
| **Phase 3** | +3 (useModels, useContextPaths, useTokens), -1 (remove useSettings) | - | SettingsOverlay, all tabs | 100% |
| **Phase 4** | Documentation + tests | - | - | 100% |
| **Target** | 11 hooks (all domain hooks) | 51/51 working | All using hooks | 100% |

**Hook Count Progression**: 8 → 9 → 9 → 10 → 11 hooks

**Key Changes**:

- **useSettings eliminated**: All settings moved to specialized hooks (useModels, useContextPaths, useTokens)
- **useModels**: 8 model/agent settings (4 model selections + agent behavior configuration)
- **useWordSearch**: 6 word search settings (including defaults and assistant expansion)
- **useWordFrequency**: 11 comprehensive word frequency settings (all metrics display options)
- **useContextPaths**: 8 resource path globs (defines where context agent scans for materials)
- **Component-local state identified**: Context text boxes and scope selections remain in components (not hooks)

---

## Implementation Plan

### Phase 0: 🚨 URGENT - Fix SearchTab (2 hours)

**Priority**: CRITICAL (before v1.0)
**Timeline**: This week
**Risk**: Low (follows existing pattern)

**Tasks**:
1. Create `useWordSearch` hook (1 hour)
   - All 6 word search settings:
     - `defaultTargets` - Default search targets
     - `contextWords` - Context words around hits
     - `clusterWindow` - Cluster detection window
     - `minClusterSize` - Minimum cluster size
     - `caseSensitive` - Case-sensitive matching
     - `enableAssistantExpansion` - AI-based synonym expansion
   - Message handlers for `SETTINGS_DATA`
   - Send `UPDATE_SETTING` on changes
   - Expose `persistedState`

2. Migrate SearchTab component (30 min)
   - Remove local state (`useState`)
   - Remove manual listeners (`useEffect` + `addEventListener`)
   - Use hook props
   - Fix wrong default (`minClusterSize: 3 → 2`)

3. Wire into App.tsx (15 min)
   - Instantiate `useWordSearch(vscode)`
   - Register handler with `useMessageRouter`
   - Add `wordSearch.persistedState` to `usePersistence`

4. Test (15 min)
   - Bidirectional sync: Settings Overlay ↔ SearchTab
   - Native VSCode settings panel ↔ SearchTab
   - Persistence across webview reload
   - Correct defaults applied

**Success Criteria**:
- ✅ All 6 SearchTab settings sync bidirectionally
- ✅ Settings persist across webview reload
- ✅ `minClusterSize` default is 2 (not 3)
- ✅ Native VSCode settings panel changes reflected in SearchTab

---

### Phase 1: Backend Cleanup (30 min)

**Priority**: HIGH
**Timeline**: Next week
**Risk**: Low

**Tasks**:
1. Extract hardcoded settings keys to constants (10 min)
   ```typescript
   private readonly GENERAL_SETTINGS_KEYS = [
     'proseMinion.includeCraftGuides',
     'proseMinion.temperature',
     // ...
   ] as const;
   ```

2. Create semantic methods (15 min)
   ```typescript
   private shouldBroadcastGeneralSettings(event) {
     return this.GENERAL_SETTINGS_KEYS.some(key =>
       event.affectsConfiguration(key) &&
       this.configurationHandler.shouldBroadcastConfigChange(key)
     );
   }
   ```

3. Update config watcher to use semantic methods (5 min)

**Success Criteria**:
- ✅ No hardcoded setting keys in `if` conditions
- ✅ Single source of truth for each settings group
- ✅ Adding new setting requires 1 change (not 3)

---

### Phase 2: MetricsTab Migration (1.5 hours)

**Priority**: MEDIUM
**Timeline**: v1.1
**Risk**: Low

**Tasks**:
1. Create `useWordFrequency` hook (45 min)
   - All 11 word frequency settings:
     - `topN` - Top N words to display
     - `includeHapaxList` - Include hapax (frequency=1) list
     - `hapaxDisplayMax` - Max hapax words to display
     - `includeStopwordsTable` - Include stopwords table
     - `contentWordsOnly` - Filter to content words only
     - `posEnabled` - Enable POS tagging sections
     - `includeBigrams` - Include bigrams analysis
     - `includeTrigrams` - Include trigrams analysis
     - `enableLemmas` - Enable lemmatization view
     - `lengthHistogramMaxChars` - Max word length in histogram
     - `minCharacterLength` - Minimum word length filter
   - Message handlers for `SETTINGS_DATA`
   - Send `UPDATE_SETTING` on changes
   - Expose `persistedState`

2. Migrate MetricsTab (30 min)
   - Remove manual listeners
   - Use hook for all word frequency settings
   - Update word frequency subtool to use hook props

3. Test (15 min)
   - Bidirectional sync for all 11 settings
   - Persistence across webview reload

**Success Criteria**:
- ✅ All 11 word frequency settings use hook pattern
- ✅ Explicit webview persistence (not reliant on backend sync)
- ✅ Settings Overlay ↔ MetricsTab sync works

---

### Phase 3: Domain Hooks Extraction & useSettings Elimination (1 week)

**Priority**: MEDIUM
**Timeline**: v1.1
**Risk**: Medium

**Tasks**:

1. Create `useModels` hook (2 hours)
   - Extract all 8 model/agent configuration settings from `useSettings`
   - Model selections: assistantModel, dictionaryModel, contextModel, model (legacy)
   - Agent behavior: includeCraftGuides, temperature, maxTokens, applyContextWindowTrimming
   - Message handlers and persistence

2. Create `useContextPaths` hook (2 hours)
   - Extract all 8 context resource path settings from `useSettings`
   - Resource paths (glob patterns):
     - `contextPaths.characters` - Character reference files
     - `contextPaths.locations` - Location/setting files
     - `contextPaths.themes` - Theme notebooks
     - `contextPaths.things` - Props/objects files
     - `contextPaths.chapters` - Draft chapters/outlines
     - `contextPaths.manuscript` - Manuscript chapters
     - `contextPaths.projectBrief` - Project brief materials
     - `contextPaths.general` - General reference materials
   - Used by context agent when [bot] button is clicked
   - Message handlers and persistence

3. Create `useTokens` hook (1 hour)
   - Extract token tracking and UI preferences from `useSettings`
   - `ui.showTokenWidget` setting
   - Token usage state
   - Message handlers and persistence

4. **Eliminate useSettings** (3 hours)
   - Remove useSettings hook entirely (all settings migrated)
   - Update all components to use specialized hooks
   - Update App.tsx composition (remove useSettings, add 3 new hooks)
   - Update SettingsOverlay to use new hooks

**Goal**: Eliminate useSettings god hook entirely, replace with 3 focused hooks

**Success Criteria**:

- ✅ All config settings use domain hooks
- ✅ 100% persistence coverage (51/51 items)
- ✅ useSettings hook removed (0 lines, down from 360)
- ✅ All components updated to use specialized hooks
- ✅ Context agent can access all 8 resource path settings

---

### Phase 4: Documentation & Testing (3 days)

**Priority**: MEDIUM
**Timeline**: v1.1
**Risk**: Low

**Tasks**:
1. Update ARCHITECTURE.md (1 day)
   - Document domain hooks pattern
   - Settings management guidelines
   - Code examples

2. Automated tests (1 day)
   - Hook unit tests
   - Bidirectional sync integration tests
   - Persistence tests

3. Migration guide (1 day)
   - For future contributors
   - Adding new settings checklist

**Success Criteria**:
- ✅ Clear architectural guidelines documented
- ✅ Settings sync tests passing
- ✅ New contributor can add setting in 15 minutes

---

## Consequences

### Positive

1. **User Experience**: SearchTab settings work correctly (critical fix)
2. **Maintainability**: One pattern, faster development (50% reduction in time to add settings)
3. **Reliability**: 100% persistence coverage (no lost settings)
4. **Clean Architecture**: Frontend mirrors backend domain organization
5. **Developer Experience**: Clear guidelines, mechanical process

### Negative

1. **Migration Effort**: 3 weeks part-time (mitigated by phased approach)
2. **Initial Learning Curve**: New contributors must learn hook pattern (mitigated by documentation)

### Neutral

1. **No Breaking Changes**: Alpha software, no users to migrate
2. **No Performance Impact**: Domain hooks have negligible overhead

---

## Validation

### Success Metrics

**Phase 0 Complete When**:
- SearchTab settings sync with Settings Overlay ✅
- SearchTab settings sync with native VSCode settings panel ✅
- SearchTab settings persist across webview reload ✅
- `minClusterSize` default is 2 (not 3) ✅

**Full Migration Complete When**:
- All settings use domain hooks (0 message-based) ✅
- 100% persistence coverage (51/51 items) ✅
- Backend uses semantic methods (0 hardcoded lists) ✅
- `useSettings` eliminated (0 lines, replaced by specialized hooks) ✅
- Clear architectural guidelines documented ✅

### Testing Strategy

**Manual Testing** (Phase 0):
- ✅ Change setting in SearchTab → check Settings Overlay
- ✅ Change setting in Settings Overlay → check SearchTab
- ✅ Change setting in VSCode settings panel → check SearchTab
- ✅ Reload webview → verify settings persist
- ✅ Verify correct defaults

**Automated Testing** (Phase 4):
- Unit tests for each hook
- Integration tests for bidirectional sync
- Persistence tests (mock `vscode.setState`)

---

## References

### Related ADRs
- [ADR-2025-10-27: Presentation Layer Domain Hooks](./2025-10-27-presentation-layer-domain-hooks.md) - Established hook pattern
- [ADR-2025-10-28: Message Envelope Architecture](./2025-10-28-message-envelope-architecture.md) - Message routing strategy

### Analysis Documents
- [Settings Architecture Analysis](./../.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md) - Comprehensive 1818-line analysis
- [Settings Architecture Summary](./../.todo/architecture-debt/2025-11-02-settings-architecture-SUMMARY.md) - Executive summary
- [SearchTab Critical Issues](./../.todo/architecture-debt/2025-11-02-settings-architecture-ADDENDUM.md) - SearchTab deep-dive

### Memory Bank
- [20251102-settings-architecture-analysis-complete.md](../.memory-bank/20251102-settings-architecture-analysis-complete.md) - Session notes
- [20251103-1230-state-of-repo-snapshot.md](../.memory-bank/20251103-1230-state-of-repo-snapshot.md) - Repository state

### Code Locations

**Frontend**:
- `src/presentation/webview/hooks/domain/useSettings.ts` - Model to follow (360 lines, to be reduced)
- `src/presentation/webview/hooks/domain/usePublishing.ts` - Clean example (small, focused)
- `src/presentation/webview/hooks/useMessageRouter.ts` - Strategy pattern
- `src/presentation/webview/hooks/usePersistence.ts` - State persistence
- `src/presentation/webview/App.tsx` - Hook composition

**Backend**:
- `src/application/handlers/MessageHandler.ts` (lines 86-160) - Config watcher (to be refactored)
- `src/application/handlers/domain/ConfigurationHandler.ts` - Settings management
- `package.json` - Settings definitions

**Broken Code**:
- `src/presentation/webview/components/SearchTab.tsx` (lines 45-48) - 4 broken settings
- `src/presentation/webview/components/MetricsTab.tsx` (lines 68-112) - 1 partial setting

---

## Notes

### Alpha Development

This is alpha software with no released versions. Backward compatibility is NOT required. We can make breaking changes freely to achieve clean architecture.

### Echo Prevention System

The existing echo prevention system in `ConfigurationHandler` (`webviewOriginatedUpdates` Set with 100ms timeout) will continue to work with domain hooks. No changes needed.

### Persistence Architecture

The existing `usePersistence` hook composition pattern will scale seamlessly as we add domain hooks. Each hook exposes `persistedState`, and App.tsx composes them into a single state object.

### Future Extensibility

This architecture naturally supports:
- Per-tool settings (each tool gets its own hook)
- Settings validation (in hook before sending `UPDATE_SETTING`)
- Settings migration (in hook on mount)
- Settings presets (export/import `persistedState`)

---

**Decision**: Accepted
**Implementation Start**: 2025-11-03 (Phase 0)
**Expected Completion**: v1.1 (Phases 1-4)
**Review Date**: After Phase 0 completion (reassess timeline)
