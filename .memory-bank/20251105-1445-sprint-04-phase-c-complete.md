# Sprint 04 Phase C Complete - Domain Hooks Extraction

**Date**: 2025-11-05 14:45
**Sprint**: Sprint 04 - Domain Hooks Extraction
**Status**: Phase C Complete ✅ (Phases A, B, C done; Phase D, E pending)
**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`

## Executive Summary

Successfully completed Phases A, B, and C of Sprint 04, creating 4 new domain hooks and eliminating the god hook anti-pattern from `useSettings`. All builds compile, all tests pass, and a critical publishing settings persistence bug was identified and fixed.

**Key Achievement**: Migrated 21 settings from god hook → 4 specialized domain hooks with full persistence and bidirectional sync.

---

## Phase A: Hook Creation (5 hours) ✅

### Hooks Created

**1. useTokensSettings** (1 setting)
- File: `src/presentation/webview/hooks/domain/useTokensSettings.ts`
- Settings: `showTokenWidget` (boolean)
- Handles: `SETTINGS_DATA`, `MODEL_DATA` (legacy path)
- Persistence key: `tokensSettings` (legacy: `showTokenWidget`)

**2. useTokenTracking** (state hook)
- File: `src/presentation/webview/hooks/domain/useTokenTracking.ts`
- State: `TokenUsage` (promptTokens, completionTokens, totalTokens, costUsd)
- Ephemeral state (resets on reload)
- Methods: `handleTokenUsageUpdate`, `resetTokens`
- Persistence key: `tokenTracking` (legacy: `tokenTotals`)

**3. useContextPathsSettings** (8 settings)
- File: `src/presentation/webview/hooks/domain/useContextPathsSettings.ts`
- Settings: characters, locations, themes, things, chapters, manuscript, projectBrief, general
- All glob patterns for context resource paths
- Persistence key: `contextPathsSettings` (legacy: `contextPaths`)

**4. useModelsSettings** (8 settings - most complex)
- File: `src/presentation/webview/hooks/domain/useModelsSettings.ts`
- Model selections (4): assistantModel, dictionaryModel, contextModel, model (legacy)
- Agent behavior (4): includeCraftGuides, temperature, maxTokens, applyContextWindowTrimming
- Additional state: `modelOptions`, `modelSelections`
- Handles: `SETTINGS_DATA`, `MODEL_DATA`, `SET_MODEL_SELECTION`
- Persistence key: `modelsSettings` + `modelSelections`

### Patterns Established
- ✅ Tripartite Hook Interface (State, Actions, Persistence)
- ✅ Defaults merging (prevents first-paint flicker)
- ✅ Legacy key support (migration compatibility)
- ✅ Optimistic updates (instant UI feedback)
- ✅ Persistence key naming: `<domain>Settings`
- ✅ Type-safe interfaces with explicit exports

---

## Phase B: Consistency Refactor (1 hour) ✅

### Renamed Hook
- `usePublishing` → `usePublishingSettings`
- Updated all interface names: `PublishingState` → `PublishingSettingsState`
- Updated function name: `usePublishing()` → `usePublishingSettings()`
- Updated JSDoc examples

### MetricsTab Props Refactor
- **Before**: 5 individual props (preset, trimKey, genres, onPresetChange, onTrimChange)
- **After**: 1 object prop with nested structure
```typescript
publishingSettings: {
  settings: { preset, trimKey },
  genres,
  setPreset,
  setTrimKey
}
```
- Matches word frequency pattern for consistency

---

## Phase C: Integration & Migration (3 hours) ✅

### Step 6: Wired New Hooks in App.tsx
**Imports:**
```typescript
import { useTokensSettings } from './hooks/domain/useTokensSettings';
import { useTokenTracking } from './hooks/domain/useTokenTracking';
import { useContextPathsSettings } from './hooks/domain/useContextPathsSettings';
import { useModelsSettings } from './hooks/domain/useModelsSettings';
```

**Instantiation:**
```typescript
const tokensSettings = useTokensSettings();
const tokenTracking = useTokenTracking();
const contextPathsSettings = useContextPathsSettings();
const modelsSettings = useModelsSettings();
```

**Message Router Registration:**
```typescript
[MessageType.SETTINGS_DATA]: (msg) => {
  settings.handleSettingsData(msg);
  wordSearchSettings.handleSettingsData(msg);
  wordFrequencySettings.handleSettingsData(msg);
  tokensSettings.handleSettingsData(msg);       // NEW
  contextPathsSettings.handleSettingsData(msg); // NEW
  modelsSettings.handleSettingsData(msg);       // NEW
},
[MessageType.MODEL_DATA]: (msg) => {
  tokensSettings.handleModelData(msg);          // NEW
  modelsSettings.handleModelData(msg);          // NEW
},
[MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate, // CHANGED
```

**Persistence Composition:**
```typescript
usePersistence({
  activeTab,
  ...settings.persistedState,
  ...publishingSettings.persistedState,
  ...wordSearchSettings.persistedState,
  ...wordFrequencySettings.persistedState,
  ...tokensSettings.persistedState,      // NEW
  ...tokenTracking.persistedState,       // NEW
  ...contextPathsSettings.persistedState, // NEW
  ...modelsSettings.persistedState,      // NEW
});
```

### Step 7: Updated Token Widget
**Before:**
```typescript
{settings.showTokenWidget && (
  <div className="token-widget">
    <span>
      {(settings.tokenTotals?.totalTokens ?? 0).toLocaleString()} tokens
      {typeof settings.tokenTotals?.costUsd === 'number'
        ? ` | $${settings.tokenTotals.costUsd.toFixed(3)}`
        : ''}
    </span>
  </div>
)}
```

**After:**
```typescript
{tokensSettings.settings.showTokenWidget && (
  <div className="token-widget">
    <span>
      {(tokenTracking.usage?.totalTokens ?? 0).toLocaleString()} tokens
      {typeof tokenTracking.usage?.costUsd === 'number'
        ? ` | $${tokenTracking.usage.costUsd.toFixed(3)}`
        : ''}
    </span>
  </div>
)}
```

### Step 8: Migrated All References
**Model Selectors:**
- `settings.modelOptions` → `modelsSettings.modelOptions`
- `settings.modelSelections.assistant` → `modelsSettings.modelSelections.assistant`
- `settings.setModelSelection` → `modelsSettings.setModelSelection`

**SettingsOverlay Props:**
- `onResetTokens={settings.resetTokens}` → `onResetTokens={tokenTracking.resetTokens}`
- `modelOptions={settings.modelOptions}` → `modelOptions={modelsSettings.modelOptions}`
- `modelSelections={settings.modelSelections}` → `modelSelections={modelsSettings.modelSelections}`
- `onModelChange={settings.setModelSelection}` → `onModelChange={modelsSettings.setModelSelection}`

**UtilitiesTab:**
- `contextModel={settings.modelSelections.context}` → `contextModel={modelsSettings.modelSelections.context}`

### Removed Redundant Handler
Removed duplicate `settings.handleModelOptionsData(msg)` from `MODEL_DATA` message routing (functionality now in `modelsSettings.handleModelData`).

---

## Bug Fix: Publishing Settings Persistence 🐛

### Issue Discovered
User testing revealed publishing settings (preset/trim) only displayed after opening Settings overlay, despite being persisted.

**Root Cause Analysis:**
1. **Missing Data Request**: `usePublishingSettings` wasn't requesting genres array on mount
2. **State Overwriting**: Backend messages were unconditionally overwriting persisted state

### Two-Part Fix

**Fix #1: Conditional Updates (preserve persisted state)**
```typescript
const handlePublishingStandardsData = (message) => {
  const { preset, pageSizeKey, genres } = message.payload;

  // Only update if values are provided (preserves persisted state)
  if (preset !== undefined) {
    setPublishingPresetState(preset || 'none');
  }
  if (pageSizeKey !== undefined) {
    setPublishingTrimKeyState(pageSizeKey || '');
  }
  if (genres !== undefined) {
    setPublishingGenres(genres as Genre[]);
  }
};
```

**Fix #2: Request Data on Mount**
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

**Result**: Publishing settings now display immediately on webview load with persisted values. ✅

**Commit**: `be330e3` - fix(publishing): preserve persisted state and request data on mount

---

## Architecture Debt Identified 📝

Created document: `.todo/architecture-debt/2025-11-05-useeffect-extraction-pattern.md`

**Issue**: useEffect hooks contain inline logic with comments explaining purpose. Harder to scan, test, and reuse.

**Recommendation**: Extract useEffect logic into named methods:
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

**Priority**: Medium | **Effort**: 2-4 hours

---

## useSettings Status After Phase C

**Migrated Out** (now in specialized hooks):
- ✅ `tokenTotals`, `resetTokens`, `handleTokenUsageUpdate`, `toggleTokenWidget` → `tokenTracking`
- ✅ `showTokenWidget` → `tokensSettings`
- ✅ `modelOptions`, `modelSelections`, `setModelSelection`, `handleModelOptionsData` → `modelsSettings`
- ✅ Context paths (8 settings) → `contextPathsSettings`

**Still in useSettings** (to be refactored in Phase D):
- Settings overlay UI: `showSettings`, `open`, `close`, `toggle`
- General settings: `settingsData`, `updateSetting`, `handleSettingsData`
- API key: `apiKeyInput`, `hasSavedKey`, `setApiKeyInput`, `saveApiKey`, `clearApiKey`, `handleApiKeyStatus`

**Result**: God hook anti-pattern significantly reduced. Remaining functionality is UI/infrastructure, not domain settings.

---

## Testing Results ✅

### Manual Testing Performed
- ✅ Token widget displays and persists visibility toggle
- ✅ Token counts increment with AI operations
- ✅ Reset token usage works
- ✅ Model selectors populate and persist selections
- ✅ Model changes apply to operations (Analysis, Dictionary, Context)
- ✅ Publishing settings display immediately on load (after fix)
- ✅ Publishing settings persist across reloads
- ✅ Settings overlay opens/closes correctly
- ✅ No console errors
- ✅ All TypeScript compilation successful

### Known Issues
- 🐛 Active tab does not persist on reload (always resets to Analysis) - tracked in general bugs

---

## Technical Metrics

**Lines of Code:**
- Created: 4 new hooks (~900 lines total)
- Modified: App.tsx, MetricsTab.tsx, usePublishingSettings.ts
- Removed dependencies: 21 settings migrated from god hook

**Build Status:**
- ✅ Extension build: 2.02 MiB (no errors)
- ✅ Webview build: 407 KiB (performance warnings expected)
- ✅ TypeScript compilation: 0 errors

**Commits:**
- `be330e3` - fix(publishing): preserve persisted state and request data on mount

---

## Phase D Preview: SettingsOverlay Refactor (Most Complex)

**Scope**: Refactor SettingsOverlay to use individual domain hooks instead of generic `settings.updateSetting`

**Challenges:**
- ~30 `onUpdate` calls to migrate
- Each call needs to route to specific hook method
- Bidirectional sync must be maintained
- Multiple settings types (boolean, number, string, enum)

**Estimated Effort**: 3-4 hours

**Approach:**
1. Map each setting to its domain hook
2. Update SettingsOverlay props interface
3. Replace generic `onUpdate` with specific methods
4. Verify bidirectional sync (VSCode settings ↔ webview)
5. Test all settings in overlay

---

## References

- **ADR**: [2025-11-03-unified-settings-architecture.md](../../docs/adr/2025-11-03-unified-settings-architecture.md)
- **Epic**: [epic-unified-settings-architecture.md](../../.todo/epics/epic-unified-settings-architecture-2025-11-03/epic-unified-settings-architecture.md)
- **Sprint**: [04-domain-hooks-extraction.md](../../.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/04-domain-hooks-extraction.md)
- **Architecture Debt**: [2025-11-05-useeffect-extraction-pattern.md](../../.todo/architecture-debt/2025-11-05-useeffect-extraction-pattern.md)
- **Previous**: [20251104-1011-sprint-03-merged-and-sprint-04-review.md](./20251104-1011-sprint-03-merged-and-sprint-04-review.md)

---

## Next Steps

1. **Start Phase D**: SettingsOverlay refactor (new thread recommended)
2. **Phase E**: Regression testing, code quality checks
3. **Final**: Update sprint doc, create PR

**Recommendation**: Start fresh thread for Phase D due to complexity and context requirements.
