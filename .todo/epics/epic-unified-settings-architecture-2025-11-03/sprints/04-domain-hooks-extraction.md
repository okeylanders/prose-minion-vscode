# Sprint 04: Domain Hooks Extraction

**Epic**: Unified Settings Architecture
**Phase**: Phase 3
**Status**: Planned
**Priority**: MEDIUM
**Effort**: 1 week (15.5 hours)
**Timeline**: v1.1
**Owner**: Development Team
**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`

---

## Sprint Goal

Extract specialized settings from the large `useSettings` hook (360 lines) into focused domain hooks, and eliminate `useSettings` entirely by migrating all settings to specialized hooks with clear naming convention (`use[Domain]Settings`).

### Problem

`useSettings` is a god hook handling too many concerns:
- General settings (craft guides, temperature, etc.)
- Context paths (source mode, path)
- Model selections (assistant, dictionary, context)
- Token tracking (usage, reset)
- UI preferences (show token widget)

**Impact**: Hard to maintain, hard to test, violates Single Responsibility Principle.

---

## Tasks

### Task 1: Create `useContextPathsSettings` Hook (2 hours)

**File**: `src/presentation/webview/hooks/domain/useContextPathsSettings.ts`

**Extract** from `useSettings`:
- All 8 `contextPaths.*` settings (characters, locations, themes, things, chapters, manuscript, projectBrief, general)
- Related update methods

**Pattern**: Same as `useWordSearchSettings` / `useWordFrequencySettings`

---

### Task 2: Create `useModelsSettings` Hook (2 hours)

**File**: `src/presentation/webview/hooks/domain/useModelsSettings.ts`

**Extract** from `useSettings`:
- `assistantModel`
- `dictionaryModel`
- `contextModel`
- `model` (legacy fallback)
- `includeCraftGuides`
- `temperature`
- `maxTokens`
- `applyContextWindowTrimming`
- Model selection methods

**Pattern**: Same as other domain hooks

---

### Task 3: Create `useTokensSettings` Hook (30 min)

**File**: `src/presentation/webview/hooks/domain/useTokensSettings.ts`

**Extract** from `useSettings`:
- `ui.showTokenWidget` setting only

**Pattern**: Same as other domain hooks

---

### Task 4: Create `useTokenTracking` Hook (30 min)

**File**: `src/presentation/webview/hooks/domain/useTokenTracking.ts`

**Extract** from `useSettings`:
- Token usage tracking state (ephemeral)
- Reset token usage method
- Token display logic

**Pattern**: Same as other domain hooks (state hook, not config)

---

### Task 5: Rename `usePublishing` → `usePublishingSettings` (30 min)

**Files**:
- Rename `src/presentation/webview/hooks/domain/usePublishing.ts` → `usePublishingSettings.ts`
- Update all imports in components and App.tsx

**Goal**: Consistent naming convention for all settings hooks

---

### Task 5b: Refactor MetricsTab Publishing Props to Object Pattern (30 min)

**File**: `src/presentation/webview/components/MetricsTab.tsx`

**Problem**: Publishing props use individual props pattern (inconsistent with word frequency settings):

**Current** (individual props):
```typescript
publishingPreset: string;
publishingTrimKey: string;
publishingGenres: Array<...>;
onPublishingPresetChange: (preset: string) => void;
onPublishingTrimChange: (pageSizeKey: string) => void;
```

**Target** (object pattern - matches word frequency):
```typescript
publishingSettings: {
  settings: {
    preset: string;
    trimKey: string;
  };
  genres: Array<...>;  // Reference data, not a setting
  setPreset: (preset: string) => void;
  setTrimKey: (pageSizeKey: string) => void;
}
```

**Changes Required**:

1. **Update MetricsTabProps interface** to use object pattern
2. **Update component destructuring** to use `publishingSettings`
3. **Update all usages** of individual props to `publishingSettings.settings.preset`, etc.
4. **Update App.tsx** to pass `publishingSettings` object instead of individual props

**Goal**: Consistent prop pattern for all settings hooks (object pattern everywhere)

---

### Task 6: Eliminate `useSettings` Hook (3 hours)

**File**: `src/presentation/webview/hooks/domain/useSettings.ts`

**Action**: Delete this file entirely - all settings migrated to specialized hooks

**Update** all components that used `useSettings` to use the new specialized hooks instead

**Update** TokenWidget to use both useTokensSettings and useTokenTracking

**Goal**: No more god hook - all settings in focused, single-purpose hooks

---

### Task 7: Update ConfigurationHandler (2 hours)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

**Add** semantic methods:
- `getContextPathsSettings()`
- `getModelsSettings()`
- `getTokensSettings()` (just UI preference)

**Update** `getAllSettings()` to include all new groups.

**Note**: Token usage tracking is ephemeral state, not a config setting.

---

### Task 8: Update App.tsx (1 hour)

**File**: `src/presentation/webview/App.tsx`

**Instantiate** new hooks:
```typescript
const contextPathsSettings = useContextPathsSettings(vscode);
const modelsSettings = useModelsSettings(vscode);
const tokensSettings = useTokensSettings(vscode);
const tokenTracking = useTokenTracking(vscode);
const publishingSettings = usePublishingSettings(vscode); // Renamed
// Remove: const settings = useSettings(vscode); ← DELETED
```

**Register** with message router and persistence (include both tokensSettings and tokenTracking).

**Pass** to relevant components.

---

### Task 9: Update Components (3 hours)

**Files**: Various components using extracted settings

**Update** to use new hook props instead of `settings.*`

---

### Task 10: Refactor SettingsOverlay to Accept Specialized Hooks (2 hours)

**File**: `src/presentation/webview/components/SettingsOverlay.tsx`

**Problem**: SettingsOverlay currently receives generic `settings` object from god hook:

**Current** ([SettingsOverlay.tsx:4-28](../../../src/presentation/webview/components/SettingsOverlay.tsx#L4-L28)):
```typescript
type SettingsOverlayProps = {
  visible: boolean;
  onClose: () => void;
  vscode: any;
  settings: Record<string, string | number | boolean>;  // Generic settings object
  onUpdate: (key: string, value: string | number | boolean) => void;  // Generic updater
  onResetTokens: () => void;
  modelOptions: ModelOption[];
  modelSelections: Partial<Record<ModelScope, string>>;
  onModelChange: (scope: ModelScope, modelId: string) => void;
  publishing: { ... };
  apiKey: { ... };
};
```

**Target**: Replace generic `settings` prop with 4 specialized hook prop objects:

```typescript
type SettingsOverlayProps = {
  visible: boolean;
  onClose: () => void;
  vscode: any;
  // Specialized settings hooks (replaces generic settings + onUpdate)
  modelsSettings: {
    settings: ModelsSettings;
    updateSetting: (key: keyof ModelsSettings, value: any) => void;
  };
  contextPathsSettings: {
    settings: ContextPathsSettings;
    updateSetting: (key: keyof ContextPathsSettings, value: any) => void;
  };
  tokensSettings: {
    settings: TokensSettings;
    updateSetting: (key: keyof TokensSettings, value: any) => void;
  };
  tokenTracking: {
    usage: { input: number; output: number };
    resetTokens: () => void;
  };
  // Model selection remains (from modelsSettings hook)
  modelOptions: ModelOption[];
  modelSelections: Partial<Record<ModelScope, string>>;
  onModelChange: (scope: ModelScope, modelId: string) => void;
  // Publishing and API key remain unchanged
  publishing: { ... };
  apiKey: { ... };
};
```

**Changes Required**:

1. **Update SettingsOverlayProps interface** to accept 4 specialized hook objects instead of generic `settings` + `onUpdate`
2. **Update component destructuring** to use specialized props
3. **Update ~30 `onUpdate()` calls** throughout the file to use appropriate hook's `updateSetting`:
   - Model/agent settings (8 settings) → `modelsSettings.updateSetting(key, value)`
   - Context paths (8 settings) → `contextPathsSettings.updateSetting(key, value)`
   - UI preferences (1 setting) → `tokensSettings.updateSetting(key, value)`
   - Token reset → `tokenTracking.resetTokens()`
4. **Update helper functions** (`asString`, `asNumber`, `asBoolean`) to work with typed objects instead of generic Record
5. **Update App.tsx** to pass specialized hook objects instead of generic `settings` object

**Current App.tsx usage** ([App.tsx:236-260](../../../src/presentation/webview/App.tsx#L236-L260)):
```typescript
<SettingsOverlay
  settings={settings.settingsData}           // From useSettings (god hook)
  onUpdate={settings.updateSetting}          // From useSettings
  onResetTokens={settings.resetTokens}       // From useSettings
  modelOptions={settings.modelOptions}       // From useSettings
  modelSelections={settings.modelSelections} // From useSettings
  onModelChange={settings.setModelSelection} // From useSettings
  // ... other props
/>
```

**Target App.tsx usage**:

```typescript
<SettingsOverlay
  modelsSettings={modelsSettings}             // From useModelsSettings
  contextPathsSettings={contextPathsSettings} // From useContextPathsSettings
  tokensSettings={tokensSettings}             // From useTokensSettings
  tokenTracking={tokenTracking}               // From useTokenTracking
  modelOptions={modelsSettings.modelOptions}
  modelSelections={modelsSettings.modelSelections}
  onModelChange={modelsSettings.setModelSelection}
  // ... other props
/>
```

**Goal**: SettingsOverlay no longer depends on generic `settings` object from god hook. Each setting is accessed from its domain-specific hook.

**Impact**: ~30 `onUpdate()` calls need to be refactored to use appropriate hook's `updateSetting` method.

---

## Cross-Cutting Requirements (Additions)

- Persisted key naming: All settings hooks must expose a `persistedState` key named `<domain>Settings` (e.g., `wordSearchSettings`, `wordFrequencySettings`, `publishingSettings`, `modelsSettings`, `contextPathsSettings`, `tokensSettings`). If legacy keys exist, keep read compatibility but write the new name.
- Merge defaults with persisted: All settings hooks must initialize by merging domain defaults with any persisted values to avoid first‑paint flicker and undefined fields. Support partial persisted data gracefully.

---

## Definition of Done

- ✅ 4 new hooks created (useContextPathsSettings, useModelsSettings, useTokensSettings, useTokenTracking)
- ✅ 1 hook renamed (usePublishing → usePublishingSettings)
- ✅ MetricsTab refactored to use object pattern for publishing props (consistent with word frequency)
- ✅ SettingsOverlay refactored to accept specialized hook objects (no more generic settings prop)
- ✅ `useSettings` hook completely eliminated (deleted)
- ✅ ConfigurationHandler semantic methods added
- ✅ All components updated to use new hooks
- ✅ TokenWidget uses both useTokensSettings and useTokenTracking
- ✅ All settings still work (regression test)
- ✅ No TypeScript errors
- ✅ Clear naming convention established (all settings hooks end with "Settings", state hooks don't)
- ✅ Consistent prop pattern (object pattern) used for all settings hooks
- ✅ Consistent persistedState key names across all settings hooks (`<domain>Settings`)
- ✅ All settings hooks merge defaults with persisted values (no first‑paint flicker)

---

## Testing

**Regression Suite**:
1. ✅ All context path settings work (8 settings)
2. ✅ All model/agent settings work (8 settings)
3. ✅ Token tracking works (2 items: usage state + UI preference)
4. ✅ Token reset works
5. ✅ Publishing standards work (2 settings)
6. ✅ Persistence works for all hooks
7. ✅ Bidirectional sync works

---

## Success Metrics

**Before**:
- `useSettings`: 360 lines (god hook managing 17+ settings)
- Settings hooks: 5 (useSettings, usePublishingSettings, useAnalysis, useMetrics, etc.)
- Mixed naming convention

**After**:
- `useSettings`: 0 lines (ELIMINATED ✅)
- Settings hooks: 6 specialized hooks (useModelsSettings, useWordSearchSettings, useWordFrequencySettings, useContextPathsSettings, useTokensSettings, usePublishingSettings)
- Clear naming convention: All settings hooks end with "Settings" suffix
- State/service hooks: 6 (useTokenTracking, useAnalysis, useMetrics, useContext, useSearch, useSelection, useDictionary)
- Total hooks: 12 focused, single-purpose hooks

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`
