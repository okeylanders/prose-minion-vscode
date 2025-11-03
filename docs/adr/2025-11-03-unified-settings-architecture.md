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

**Settings Inventory** (29 total):

| Pattern | Count | Examples | Persistence | Sync | Issues |
|---------|-------|----------|-------------|------|--------|
| Domain Hooks | 24 | `useSettings`, `usePublishing`, `useAnalysis` | ✅ Yes | ✅ Bidirectional | None |
| Message-Based | 5 | SearchTab (4), MetricsTab (1) | ❌ No (SearchTab)<br>⚠️ Indirect (MetricsTab) | ❌ No | Critical |
| Hybrid (SecretStorage) | 1 | API key | ✅ Yes | ✅ Bidirectional | None (correct) |

**Persistence Coverage**: 86% (25/29 settings)

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
    contextWords: 3,
    clusterWindow: 50,
    minClusterSize: 2,
    caseSensitive: false
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
    contextWords: this.config.get('wordSearch.contextWords', 3),
    clusterWindow: this.config.get('wordSearch.clusterWindow', 50),
    minClusterSize: this.config.get('wordSearch.minClusterSize', 2),
    caseSensitive: this.config.get('wordSearch.caseSensitive', false)
  };
}

// MessageHandler uses semantic methods (no hardcoded lists)
private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.contextWords',
  'proseMinion.wordSearch.clusterWindow',
  'proseMinion.wordSearch.minClusterSize',
  'proseMinion.wordSearch.caseSensitive'
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

### Complete Settings Inventory (29 Settings)

| # | Setting Key | Type | Default | Hook (Current/Target) | Phase | Persisted |
|---|-------------|------|---------|----------------------|-------|-----------|
| **General Settings** | | | | **useSettings** | Exists | ✅ |
| 1 | `includeCraftGuides` | boolean | true | useSettings | Current | ✅ |
| 2 | `temperature` | number | 0.8 | useSettings | Current | ✅ |
| 3 | `maxTokens` | number | 10000 | useSettings | Current | ✅ |
| 4 | `applyContextWindowTrimming` | boolean | true | useSettings | Current | ✅ |
| 5 | `contextAgentWordLimit` | number | 50000 | useSettings | Current | ✅ |
| 6 | `analysisAgentWordLimit` | number | 75000 | useSettings | Current | ✅ |
| **Word Search Settings** | | | | **useWordSearch** | Phase 0 | ❌→✅ |
| 7 | `wordSearch.contextWords` | number | 3 | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 8 | `wordSearch.clusterWindow` | number | 50 | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 9 | `wordSearch.minClusterSize` | number | 2 | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| 10 | `wordSearch.caseSensitive` | boolean | false | ❌ None → useWordSearch | Phase 0 | ❌→✅ |
| **Word Frequency Settings** | | | | **useWordFrequency** | Phase 2 | ⚠️→✅ |
| 11 | `wordFrequency.minLength` | number | 1 | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| 12 | `wordFrequency.includeLemmas` | boolean | false | ⚠️ MetricsTab → useWordFrequency | Phase 2 | ⚠️→✅ |
| **Context Path Settings** | | | | **useContextPaths** | Phase 3 | ✅ |
| 13 | `contextSourceMode` | string | 'selection' | useSettings → useContextPaths | Phase 3 | ✅ |
| 14 | `contextSourcePath` | string | '' | useSettings → useContextPaths | Phase 3 | ✅ |
| **Model Settings** | | | | **useModels** | Phase 3 | ✅ |
| 15 | `assistantModel` | string | 'anthropic/claude-3.5-sonnet' | useSettings → useModels | Phase 3 | ✅ |
| 16 | `dictionaryModel` | string | 'anthropic/claude-3.5-sonnet' | useSettings → useModels | Phase 3 | ✅ |
| 17 | `contextModel` | string | 'anthropic/claude-3.5-sonnet' | useSettings → useModels | Phase 3 | ✅ |
| **Token Tracking** | | | | **useTokens** | Phase 3 | ✅ |
| 18 | `ui.showTokenWidget` | boolean | true | useSettings → useTokens | Phase 3 | ✅ |
| 19 | Token usage (state) | object | - | useSettings → useTokens | Phase 3 | ✅ |
| **Publishing Standards** | | | | **usePublishing** | Exists | ✅ |
| 20 | `publishing.genre` | string | 'commercial-fiction' | usePublishing | Current | ✅ |
| 21 | `publishing.trimOption` | string | 'typical' | usePublishing | Current | ✅ |
| **Analysis Results** | | | | **useAnalysis** | Exists | ✅ |
| 22 | Analysis results (state) | object | - | useAnalysis | Current | ✅ |
| 23 | Guides (state) | array | - | useAnalysis | Current | ✅ |
| **Metrics Results** | | | | **useMetrics** | Exists | ✅ |
| 24 | Metrics results (state) | object | - | useMetrics | Current | ✅ |
| 25 | Active subtool (state) | string | - | useMetrics | Current | ✅ |
| **Dictionary** | | | | **useDictionary** | Exists | ✅ |
| 26 | Dictionary inputs (state) | object | - | useDictionary | Current | ✅ |
| **Context** | | | | **useContext** | Exists | ✅ |
| 27 | Context text (state) | string | - | useContext | Current | ✅ |
| **Search** | | | | **useSearch** | Exists | ✅ |
| 28 | Search results (state) | object | - | useSearch | Current | ✅ |
| **API Key** | | | | **Hybrid (SecretStorage)** | Exists | ✅ |
| 29 | `openRouterApiKey` | secret | - | SecretStorage (not hook) | Current | ✅ |

**Legend**:

- ✅ = Currently persisted
- ❌ = Not persisted (broken)
- ⚠️ = Indirectly persisted (not ideal)
- ❌→✅ = Will be fixed in this epic
- ⚠️→✅ = Will be improved in this epic

---

### Domain Hook Mapping

This table shows which hooks manage which settings and which components consume them.

| Hook | Type | Settings/State Managed | Used By Components | Phase | File |
|------|------|------------------------|-------------------|-------|------|
| **useSettings** | Config | 6 general settings (after Phase 3 refactor) | SettingsOverlay, AnalysisTab, UtilitiesTab | Exists (refactor Phase 3) | `hooks/domain/useSettings.ts` |
| | | • `includeCraftGuides` | | | |
| | | • `temperature` | | | |
| | | • `maxTokens` | | | |
| | | • `applyContextWindowTrimming` | | | |
| | | • `contextAgentWordLimit` | | | |
| | | • `analysisAgentWordLimit` | | | |
| **useWordSearch** | Config | 4 word search settings | SearchTab, SettingsOverlay | Phase 0 (NEW) | `hooks/domain/useWordSearch.ts` |
| | | • `wordSearch.contextWords` | | | |
| | | • `wordSearch.clusterWindow` | | | |
| | | • `wordSearch.minClusterSize` | | | |
| | | • `wordSearch.caseSensitive` | | | |
| **useWordFrequency** | Config | 2 word frequency settings | MetricsTab (word frequency subtool), SettingsOverlay | Phase 2 (NEW) | `hooks/domain/useWordFrequency.ts` |
| | | • `wordFrequency.minLength` | | | |
| | | • `wordFrequency.includeLemmas` | | | |
| **useContextPaths** | Config | 2 context path settings | SettingsOverlay, ContextTab | Phase 3 (NEW) | `hooks/domain/useContextPaths.ts` |
| | | • `contextSourceMode` | | | |
| | | • `contextSourcePath` | | | |
| **useModels** | Config | 3 model selection settings | SettingsOverlay, AnalysisTab, DictionaryTab, ContextTab | Phase 3 (NEW) | `hooks/domain/useModels.ts` |
| | | • `assistantModel` | | | |
| | | • `dictionaryModel` | | | |
| | | • `contextModel` | | | |
| **useTokens** | Config + State | Token tracking + UI preference | SettingsOverlay, TokenWidget (all tabs) | Phase 3 (NEW) | `hooks/domain/useTokens.ts` |
| | | • `ui.showTokenWidget` | | | |
| | | • Token usage state | | | |
| **usePublishing** | Config | 2 publishing standard settings | SettingsOverlay, MetricsTab (prose stats) | Exists | `hooks/domain/usePublishing.ts` |
| | | • `publishing.genre` | | | |
| | | • `publishing.trimOption` | | | |
| **useAnalysis** | State | Analysis results + guides | AnalysisTab, UtilitiesTab | Exists | `hooks/domain/useAnalysis.ts` |
| | | • Dialogue/prose results | | | |
| | | • Loaded guides | | | |
| | | • Status ticker | | | |
| **useMetrics** | State | Metrics results + active subtool | MetricsTab | Exists | `hooks/domain/useMetrics.ts` |
| | | • Prose stats results | | | |
| | | • Style flags results | | | |
| | | • Word frequency results | | | |
| | | • Active subtool name | | | |
| **useDictionary** | State | Dictionary word + context | DictionaryTab | Exists | `hooks/domain/useDictionary.ts` |
| | | • Current word | | | |
| | | • Context text | | | |
| | | • Tool name | | | |
| **useContext** | State | Context generation text + resources | ContextTab | Exists | `hooks/domain/useContext.ts` |
| | | • Context text | | | |
| | | • Requested resources | | | |
| | | • Loading status | | | |
| **useSearch** | State | Search results + targets | SearchTab | Exists | `hooks/domain/useSearch.ts` |
| | | • Word search results | | | |
| | | • Search targets | | | |
| **useSelection** | State | Selected text + metadata | App.tsx (global) | Exists | `hooks/domain/useSelection.ts` |
| | | • Selected text | | | |
| | | • Source metadata | | | |

**Hook Categories**:

- **Config**: Manages VSCode settings (persisted to workspace config)
- **State**: Manages UI/result state (persisted to webview state)
- **Hybrid**: Special handling (SecretStorage for API key)

---

### Persistence Strategy

All domain hooks expose `persistedState` which is composed in App.tsx via `usePersistence`.

#### Before Refactor (86% coverage)

```typescript
// App.tsx - Current State
usePersistence({
  activeTab,
  ...settings.persistedState,      // ✅ General + Models + Context Paths + Tokens (mixed)
  ...publishing.persistedState,    // ✅ Publishing standards
  ...analysis.persistedState,      // ✅ Analysis results
  ...metrics.persistedState,       // ✅ Metrics results (but wordFrequency settings indirect)
  ...dictionary.persistedState,    // ✅ Dictionary state
  ...context.persistedState,       // ✅ Context state
  ...search.persistedState,        // ✅ Search state (but NOT SearchTab settings!)
  ...selection.persistedState      // ✅ Selection state
  // ❌ Missing: wordSearch.* settings (SearchTab broken)
  // ⚠️ Indirect: wordFrequency.* settings (via backend sync)
});
```

**Issues**:
- SearchTab settings (4) not included → lost on reload ❌
- MetricsTab settings (2) indirectly persisted via backend ⚠️

---

#### After Refactor (100% coverage)

```typescript
// App.tsx - Target State
usePersistence({
  activeTab,
  ...settings.persistedState,      // ✅ General settings only (refactored)
  ...wordSearch.persistedState,    // ✅ NEW: Word search settings
  ...wordFrequency.persistedState, // ✅ NEW: Word frequency settings (explicit)
  ...contextPaths.persistedState,  // ✅ NEW: Context path settings
  ...models.persistedState,        // ✅ NEW: Model selections
  ...tokens.persistedState,        // ✅ NEW: Token tracking + UI prefs
  ...publishing.persistedState,    // ✅ Publishing standards
  ...analysis.persistedState,      // ✅ Analysis results
  ...metrics.persistedState,       // ✅ Metrics results
  ...dictionary.persistedState,    // ✅ Dictionary state
  ...context.persistedState,       // ✅ Context state
  ...search.persistedState,        // ✅ Search state
  ...selection.persistedState      // ✅ Selection state
});
```

**Benefits**:

- All 29 settings/states explicitly persisted ✅
- No reliance on backend sync for persistence ✅
- Clear, predictable persistence model ✅

---

### Component-to-Hook Matrix

This table shows which components consume which hooks (read-only reference).

| Component | Hooks Consumed | Settings/State Used |
|-----------|---------------|-------------------|
| **App.tsx** | All hooks (composition) | Composes all `persistedState`, routes all messages |
| **SettingsOverlay** | useSettings, useWordSearch, useWordFrequency, useContextPaths, useModels, useTokens, usePublishing | All config settings (editable UI) |
| **AnalysisTab** | useSettings, useModels, useAnalysis | General settings, assistant model, results |
| **MetricsTab** | useWordFrequency, usePublishing, useMetrics | Word frequency settings, publishing standards, results |
| **SearchTab** | useWordSearch, useSearch | Word search settings, search results |
| **DictionaryTab** | useModels, useDictionary | Dictionary model, word/context state |
| **ContextTab** | useContextPaths, useModels, useContext | Context paths, context model, generated text |
| **UtilitiesTab** | useSettings, useAnalysis | General settings, prose assistant results |
| **TokenWidget** | useTokens | Token usage, show/hide preference |

**Navigation Flow**:
1. User changes setting in SettingsOverlay
2. Hook sends `UPDATE_SETTING` to backend
3. Backend updates VSCode config
4. Config watcher broadcasts `SETTINGS_DATA` to webview
5. Hook receives message, updates state
6. React re-renders component with new state
7. `usePersistence` persists state to webview storage

---

### Backend Configuration Groups

The backend `MessageHandler` will use semantic methods to group settings (Phase 1):

| Settings Group | Constant Name | Settings Count | Broadcast Method |
|----------------|---------------|----------------|------------------|
| General | `GENERAL_SETTINGS_KEYS` | 6 | `shouldBroadcastGeneralSettings()` |
| Word Search | `WORD_SEARCH_KEYS` | 4 | `shouldBroadcastWordSearchSettings()` |
| Word Frequency | `WORD_FREQUENCY_KEYS` | 2 | `shouldBroadcastWordFrequencySettings()` |
| Context Paths | `CONTEXT_PATH_KEYS` | 2 | `shouldBroadcastContextPathSettings()` |
| Models | `MODEL_KEYS` | 3 | `shouldBroadcastModelSettings()` |
| UI Preferences | `UI_KEYS` | 1 | `shouldBroadcastUISettings()` |
| Publishing | `PUBLISHING_KEYS` | 2 | `shouldBroadcastPublishingSettings()` |

**Total**: 20 config settings (excludes 9 state-only items)

---

### Migration Path Summary

| Phase | Hooks Created/Modified | Settings Fixed | Components Updated | Persistence Coverage |
|-------|----------------------|----------------|-------------------|---------------------|
| **Current** | 8 hooks (mixed patterns) | 25/29 working | Mixed patterns | 86% |
| **Phase 0** | +1 (useWordSearch) | 29/29 working | SearchTab | 100% |
| **Phase 1** | Backend refactor only | - | - | 100% |
| **Phase 2** | +1 (useWordFrequency) | - | MetricsTab | 100% |
| **Phase 3** | +3 (useContextPaths, useModels, useTokens) | - | Multiple | 100% |
| **Phase 4** | Documentation + tests | - | - | 100% |
| **Target** | 13 hooks (all domain hooks) | 29/29 working | All using hooks | 100% |

**Hook Count Progression**: 8 → 9 → 9 → 10 → 13 hooks

---

## Implementation Plan

### Phase 0: 🚨 URGENT - Fix SearchTab (2 hours)

**Priority**: CRITICAL (before v1.0)
**Timeline**: This week
**Risk**: Low (follows existing pattern)

**Tasks**:
1. Create `useWordSearch` hook (1 hour)
   - All 4 word search settings
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
- ✅ All 4 SearchTab settings sync bidirectionally
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

### Phase 2: MetricsTab Migration (1 hour)

**Priority**: MEDIUM
**Timeline**: v1.1
**Risk**: Low

**Tasks**:
1. Create `useWordFrequency` hook (30 min)
   - Extract `minCharacterLength` from MetricsTab
   - Message handlers
   - Persistence

2. Migrate MetricsTab (20 min)
   - Remove manual listener
   - Use hook

3. Test (10 min)

**Success Criteria**:
- ✅ `minCharacterLength` uses hook pattern
- ✅ Explicit webview persistence (not reliant on backend sync)

---

### Phase 3: Additional Domain Hooks (1 week)

**Priority**: MEDIUM
**Timeline**: v1.1
**Risk**: Medium

**Tasks**:
1. Create `useContextPaths` hook
   - Extract context path settings from `useSettings`
2. Create `useModels` hook
   - Extract model selections from `useSettings`
3. Create `useTokens` hook
   - Extract token tracking from `useSettings`

**Goal**: Reduce `useSettings` from 360 → 150 lines

**Success Criteria**:
- ✅ All settings use domain hooks
- ✅ 100% persistence coverage (29/29 settings)
- ✅ `useSettings` < 200 lines

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
- 100% persistence coverage (29/29 settings) ✅
- Backend uses semantic methods (0 hardcoded lists) ✅
- `useSettings` < 200 lines ✅
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
