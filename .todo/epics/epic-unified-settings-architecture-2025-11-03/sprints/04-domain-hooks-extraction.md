# Sprint 04: Domain Hooks Extraction

**Epic**: Unified Settings Architecture
**Phase**: Phase 3
**Status**: Planned
**Priority**: MEDIUM
**Effort**: 1 week
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

### Task 3: Create `useTokensSettings` Hook (2 hours)

**File**: `src/presentation/webview/hooks/domain/useTokensSettings.ts`

**Extract** from `useSettings`:
- Token usage tracking state
- `ui.showTokenWidget` setting
- Reset token usage method
- Token display logic

**Pattern**: Same as other domain hooks

---

### Task 4: Rename `usePublishing` → `usePublishingSettings` (30 min)

**Files**:
- Rename `src/presentation/webview/hooks/domain/usePublishing.ts` → `usePublishingSettings.ts`
- Update all imports in components and App.tsx

**Goal**: Consistent naming convention for all settings hooks

---

### Task 5: Eliminate `useSettings` Hook (3 hours)

**File**: `src/presentation/webview/hooks/domain/useSettings.ts`

**Action**: Delete this file entirely - all settings migrated to specialized hooks

**Update** all components that used `useSettings` to use the new specialized hooks instead

**Goal**: No more god hook - all settings in focused, single-purpose hooks

---

### Task 6: Update ConfigurationHandler (2 hours)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

**Add** semantic methods:
- `getContextPathsSettings()`
- `getModelsSettings()`
- `getTokensSettings()`

**Update** `getAllSettings()` to include all new groups.

---

### Task 7: Update App.tsx (1 hour)

**File**: `src/presentation/webview/App.tsx`

**Instantiate** new hooks:
```typescript
const contextPathsSettings = useContextPathsSettings(vscode);
const modelsSettings = useModelsSettings(vscode);
const tokensSettings = useTokensSettings(vscode);
const publishingSettings = usePublishingSettings(vscode); // Renamed
// Remove: const settings = useSettings(vscode); ← DELETED
```

**Register** with message router and persistence.

**Pass** to relevant components.

---

### Task 8: Update Components (3 hours)

**Files**: Various components using extracted settings

**Update** to use new hook props instead of `settings.*`

---

## Definition of Done

- ✅ 3 new settings hooks created (useContextPathsSettings, useModelsSettings, useTokensSettings)
- ✅ 1 hook renamed (usePublishing → usePublishingSettings)
- ✅ `useSettings` hook completely eliminated (deleted)
- ✅ ConfigurationHandler semantic methods added
- ✅ All components updated to use new hooks
- ✅ All settings still work (regression test)
- ✅ No TypeScript errors
- ✅ Clear naming convention established (all settings hooks end with "Settings")

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
- State/service hooks: 5 (useAnalysis, useMetrics, useContext, useSearch, useSelection, useDictionary)
- Total hooks: 11 focused, single-purpose hooks

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`
