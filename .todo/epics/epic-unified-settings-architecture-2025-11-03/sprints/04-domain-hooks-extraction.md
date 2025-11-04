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

### Task 6: Eliminate `useSettings` Hook (3 hours) 🚨 HIGH RISK

**File**: `src/presentation/webview/hooks/domain/useSettings.ts`

**Action**: Delete this file entirely - all settings migrated to specialized hooks

**Update** all components that used `useSettings` to use the new specialized hooks instead

**Update** TokenWidget to use both useTokensSettings and useTokenTracking

**Goal**: No more god hook - all settings in focused, single-purpose hooks

**⚠️ Pre-Deletion Checklist** (CRITICAL - verify before deleting):

1. **Verify All Exports Migrated**:
   ```bash
   # Check what useSettings exports
   grep "export " src/presentation/webview/hooks/domain/useSettings.ts
   # Verify each export is now in a specialized hook
   ```

2. **Grep for All Import References**:
   ```bash
   # Should return ZERO results after migration
   grep -r "import.*useSettings" src/presentation/webview/
   ```

3. **Check All Components**:
   - [ ] App.tsx: `useSettings` removed, new hooks wired
   - [ ] TokenWidget: Using `useTokensSettings` + `useTokenTracking`
   - [ ] SettingsOverlay: Using specialized hooks (Task 10 complete)

4. **TypeScript Compilation**:
   ```bash
   npm run compile
   # Should pass with zero errors
   ```

5. **Persistence Verification**:
   - [ ] All 4 new hooks added to `usePersistence` composition in App.tsx
   - [ ] All 4 new hooks registered in `useMessageRouter` in App.tsx

6. **Manual Test**:
   - [ ] Open webview → verify no console errors
   - [ ] Change a setting in SettingsOverlay → verify it works
   - [ ] Reload webview → verify persistence maintained

**⚠️ Only delete useSettings.ts after ALL checklist items pass**

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

**⚠️ Testing Checklist** (verify after refactor):

1. **Model Selections** (4 dropdowns):
   - [ ] Change `assistantModel` → verify VSCode settings update
   - [ ] Change `dictionaryModel` → verify VSCode settings update
   - [ ] Change `contextModel` → verify VSCode settings update
   - [ ] Change legacy `model` fallback → verify VSCode settings update

2. **Agent Behavior** (4 settings):
   - [ ] Toggle `includeCraftGuides` → verify VSCode settings update
   - [ ] Change `temperature` → verify VSCode settings update
   - [ ] Change `maxTokens` → verify VSCode settings update
   - [ ] Toggle `applyContextWindowTrimming` → verify VSCode settings update

3. **Context Paths** (8 glob patterns):
   - [ ] Change each path (characters, locations, themes, things, chapters, manuscript, projectBrief, general)
   - [ ] Verify VSCode settings update for each

4. **Token Widget**:
   - [ ] Toggle `ui.showTokenWidget` → verify widget shows/hides
   - [ ] Click reset tokens → verify counter resets

5. **Persistence**:
   - [ ] Reload webview → verify all settings maintained

6. **TypeScript**:
   - [ ] Zero compilation errors
   - [ ] No `any` types introduced

---

## Recommended Execution Order (For AI Agent)

**⚠️ CRITICAL**: Follow this order exactly to minimize risk and ensure proper verification at each step.

### Phase A: Hook Creation (5 hours) - Build Foundation

Execute these tasks IN ORDER (simplest → most complex):

**Step 1: Task 3 - `useTokensSettings` Hook (30 min)** ✅ WARMUP
- **Why first**: Simplest hook (1 setting), good warmup, low risk
- **Pattern**: Follow Sprint 03 patterns (persistence key: `tokensSettings`)
- **Files**: Create `src/presentation/webview/hooks/domain/useTokensSettings.ts`
- **Verify**: TypeScript compiles, hook exports State/Actions/Persistence interfaces

**Step 2: Task 4 - `useTokenTracking` Hook (30 min)** ✅ STATE HOOK PATTERN
- **Why second**: State hook (not settings), different pattern to practice
- **Pattern**: Ephemeral state (token usage), no VSCode config sync
- **Files**: Create `src/presentation/webview/hooks/domain/useTokenTracking.ts`
- **Naming**: No "Settings" suffix (it's a state hook)
- **Verify**: TypeScript compiles, hook exports State/Actions/Persistence interfaces

**Step 3: Task 1 - `useContextPathsSettings` Hook (2 hours)** ✅ STANDARD SETTINGS HOOK
- **Why third**: 8 settings, straightforward, proven pattern
- **Pattern**: Follow Sprint 03 patterns exactly (persistence key: `contextPathsSettings`)
- **Files**: Create `src/presentation/webview/hooks/domain/useContextPathsSettings.ts`
- **Gotcha**: Glob patterns (strings) - validate format if needed
- **Verify**: TypeScript compiles, all 8 settings in interface, defaults merged

**Step 4: Task 2 - `useModelsSettings` Hook (2 hours)** ✅ MOST COMPLEX HOOK
- **Why last in Phase A**: 8 settings, two sub-concerns (model selections + agent behavior)
- **Pattern**: Follow Sprint 03 patterns (persistence key: `modelsSettings`)
- **Files**: Create `src/presentation/webview/hooks/domain/useModelsSettings.ts`
- **Recommendation**: Consider sub-interfaces (ModelSelections, AgentBehavior) for clarity
- **Verify**: TypeScript compiles, all 8 settings in interface, defaults merged

**Phase A Completion Checkpoint**:
- [ ] 4 new hooks created and compiling
- [ ] All follow Sprint 03 pattern (defaults merging, persistence keys, legacy support)
- [ ] All export State/Actions/Persistence interfaces
- [ ] No TypeScript errors

---

### Phase B: Consistency (1 hour) - Rename & Refactor

**Step 5: Tasks 5 + 5b - Rename & Refactor Publishing (1 hour)** ✅ ATOMIC CHANGE
- **Why together**: Coordinated change, keep atomic to avoid half-migrated state
- **Task 5**: Rename `usePublishing.ts` → `usePublishingSettings.ts`
  - Update all imports in App.tsx and components
  - Use find-replace-all to catch all references
- **Task 5b**: Refactor MetricsTab publishing props to object pattern
  - Change from 5 individual props → 1 object prop
  - Match word frequency pattern (Sprint 03)
- **Verify**: TypeScript compiles, MetricsTab still works, publishing settings sync

**Phase B Completion Checkpoint**:
- [ ] `usePublishing.ts` renamed to `usePublishingSettings.ts`
- [ ] All imports updated
- [ ] MetricsTab uses object pattern for publishing
- [ ] Consistent pattern across all settings hooks
- [ ] No TypeScript errors

---

### Phase C: Integration (5 hours) - Wire & Verify

**Step 6: Task 7 - Wire New Hooks in App.tsx (1.5 hours)** ✅ INTEGRATION

**Substep 6a: Import new hooks**:
```typescript
import { useModelsSettings } from './hooks/domain/useModelsSettings';
import { useContextPathsSettings } from './hooks/domain/useContextPathsSettings';
import { useTokensSettings } from './hooks/domain/useTokensSettings';
import { useTokenTracking } from './hooks/domain/useTokenTracking';
```

**Substep 6b: Instantiate hooks** (around line 30):
```typescript
const modelsSettings = useModelsSettings();
const contextPathsSettings = useContextPathsSettings();
const tokensSettings = useTokensSettings();
const tokenTracking = useTokenTracking();
```

**Substep 6c: Register in message router** (in useMessageRouter call):
```typescript
useMessageRouter({
  // ... existing handlers
  [MessageType.SETTINGS_DATA]: (message) => {
    settings.handleMessage(message);      // Still exists (not deleted yet)
    modelsSettings.handleSettingsData(message);
    contextPathsSettings.handleSettingsData(message);
    tokensSettings.handleSettingsData(message);
    // ... other handlers
  },
  // ...
});
```

**Substep 6d: Add to persistence** (in usePersistence call):
```typescript
usePersistence({
  activeTab,
  ...settings.persistedState,            // Still exists (not deleted yet)
  ...modelsSettings.persistedState,
  ...contextPathsSettings.persistedState,
  ...tokensSettings.persistedState,
  ...tokenTracking.persistedState,
  // ... other hooks
});
```

**Verify**:
- [ ] TypeScript compiles
- [ ] Webview loads without errors
- [ ] Console shows no errors

---

**Step 7: Task 8 - Update TokenWidget (1 hour)** ✅ COMPONENT MIGRATION

**Current** ([TokenWidget.tsx](../../../src/presentation/webview/components/TokenWidget.tsx)):
- Uses `settings` prop from `useSettings` god hook

**Target**:
- Use `tokensSettings` + `tokenTracking` props

**Changes**:
1. Update `TokenWidgetProps` interface to accept `tokensSettings` + `tokenTracking` objects
2. Remove `settings` prop
3. Update all references:
   - `settings.ui.showTokenWidget` → `tokensSettings.settings.showTokenWidget`
   - `settings.tokenUsage` → `tokenTracking.tokenUsage`
   - `settings.resetTokens` → `tokenTracking.resetTokens`
4. Update App.tsx to pass new props to TokenWidget

**Verify**:
- [ ] TypeScript compiles
- [ ] Token widget shows/hides correctly
- [ ] Reset button works
- [ ] Token usage displays correctly

---

**Step 8: Task 6 - Eliminate useSettings (2.5 hours)** 🚨 CRITICAL - DELETE GOD HOOK

**⚠️ IMPORTANT**: Only execute this step after Steps 6-7 complete and pass verification.

**Substep 8a: Run Pre-Deletion Checklist** (see Task 6 checklist above):
- [ ] All exports migrated
- [ ] Grep returns zero import references
- [ ] All components updated
- [ ] TypeScript compiles
- [ ] Persistence verified

**Substep 8b: Remove useSettings from App.tsx**:
- Remove `import { useSettings } from './hooks/domain/useSettings';`
- Remove `const settings = useSettings(vscode);`
- Remove `settings.handleMessage` from message router
- Remove `...settings.persistedState` from usePersistence

**Substep 8c: Verify no references remain**:
```bash
grep -r "useSettings" src/presentation/webview/
# Should return ZERO results (except in comments/docs)
```

**Substep 8d: Delete the file**:
```bash
rm src/presentation/webview/hooks/domain/useSettings.ts
```

**Verify**:
- [ ] TypeScript compiles with zero errors
- [ ] Webview loads without console errors
- [ ] All settings still work (spot check)

**Phase C Completion Checkpoint**:
- [ ] All 4 new hooks wired in App.tsx
- [ ] TokenWidget uses new hooks
- [ ] `useSettings` deleted
- [ ] No TypeScript errors
- [ ] Webview loads successfully

---

### Phase D: SettingsOverlay Refactor (2 hours) 🚨 MOST COMPLEX

**⚠️ IMPORTANT**: Only execute this phase after Phase C complete and verified.

**Step 9: Task 10 - Refactor SettingsOverlay (2 hours)**

**Substep 9a: Update SettingsOverlayProps interface** (30 min):
- Remove: `settings: Record<string, any>`
- Remove: `onUpdate: (key: string, value: any) => void`
- Add: `modelsSettings: UseModelsSettingsReturn`
- Add: `contextPathsSettings: UseContextPathsSettingsReturn`
- Add: `tokensSettings: UseTokensSettingsReturn`
- Add: `tokenTracking: UseTokenTrackingReturn`

**Substep 9b: Update component destructuring** (5 min):
```typescript
export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  // Remove: settings, onUpdate
  // Add:
  modelsSettings,
  contextPathsSettings,
  tokensSettings,
  tokenTracking,
  // ... other props
}) => {
```

**Substep 9c: Refactor settings sections** (1 hour):

Break this into sub-sections (test each after refactoring):

1. **Model Selections Section** (~5 `onUpdate` calls):
   - `onUpdate('assistantModel', value)` → `modelsSettings.updateSetting('assistantModel', value)`
   - Test: Change each model dropdown → verify VSCode settings update

2. **Agent Behavior Section** (~4 `onUpdate` calls):
   - `onUpdate('temperature', value)` → `modelsSettings.updateSetting('temperature', value)`
   - Test: Change temperature/maxTokens → verify VSCode settings update

3. **Context Paths Section** (~8 `onUpdate` calls):
   - `onUpdate('contextPaths.characters', value)` → `contextPathsSettings.updateSetting('characters', value)`
   - Test: Change a path → verify VSCode settings update

4. **Token Widget Toggle** (~1 `onUpdate` call):
   - `onUpdate('ui.showTokenWidget', value)` → `tokensSettings.updateSetting('showTokenWidget', value)`
   - Test: Toggle → verify widget shows/hides

**Substep 9d: Update helper functions** (15 min):
- Update `asString`, `asNumber`, `asBoolean` to work with typed hook objects
- Replace generic `settings[key]` access with specific hook property access

**Substep 9e: Update App.tsx to pass new props** (10 min):
```typescript
<SettingsOverlay
  // Remove: settings={settings.settingsData}
  // Remove: onUpdate={settings.updateSetting}
  // Add:
  modelsSettings={modelsSettings}
  contextPathsSettings={contextPathsSettings}
  tokensSettings={tokensSettings}
  tokenTracking={tokenTracking}
  // ... other props
/>
```

**Verify** (use Testing Checklist from Task 10 above):
- [ ] All model selections work
- [ ] All agent behavior settings work
- [ ] All context paths work
- [ ] Token widget toggle works
- [ ] Persistence works (reload webview)
- [ ] No TypeScript errors

**Phase D Completion Checkpoint**:
- [ ] SettingsOverlay refactored
- [ ] All ~30 `onUpdate` calls replaced
- [ ] All settings sections tested
- [ ] No TypeScript errors
- [ ] No console errors

---

### Phase E: Final Verification (2.5 hours) - Comprehensive Testing

**Step 10: Regression Testing** (1.5 hours)

Run full regression suite (see Testing section below):
1. All context path settings (8)
2. All model/agent settings (8)
3. Token tracking (usage + UI preference)
4. Token reset
5. Publishing standards (2)
6. Word frequency settings (11)
7. Word search settings (6)
8. Persistence for all hooks
9. Bidirectional sync

**Step 11: Code Quality Check** (30 min):
- [ ] TypeScript: `npm run compile` - zero errors
- [ ] Lint: No new warnings
- [ ] Console: No errors in webview console
- [ ] Network: No failed API calls

**Step 12: Documentation** (30 min):
- Update sprint doc with completion notes
- Add any gotchas discovered during implementation
- Create memory bank entry

---

## Execution Order Summary

| Phase | Steps | Effort | Risk | Dependencies |
|-------|-------|--------|------|--------------|
| **A: Hook Creation** | 1-4 | 5 hours | Low-Medium | None |
| **B: Consistency** | 5 | 1 hour | Low | Phase A complete |
| **C: Integration** | 6-8 | 5 hours | Medium-High | Phase A+B complete |
| **D: SettingsOverlay** | 9 | 2 hours | High | Phase C complete |
| **E: Verification** | 10-12 | 2.5 hours | Low | Phase D complete |
| **TOTAL** | | **15.5 hours** | | |

**Critical Path**: A → B → C → D → E (sequential, cannot parallelize)

**Highest Risk Steps**:
1. Step 8 (Task 6): Deleting useSettings - must verify checklist
2. Step 9 (Task 10): SettingsOverlay refactor - most complex, ~30 changes

**Fallback Strategy**:
- If Step 9 (SettingsOverlay) is blocked, can land Steps 1-8 in separate PR
- SettingsOverlay can be refactored in follow-up PR (not blocking)

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
