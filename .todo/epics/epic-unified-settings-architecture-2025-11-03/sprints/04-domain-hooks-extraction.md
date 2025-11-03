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

Extract specialized settings from the large `useSettings` hook (360 lines) into focused domain hooks, reducing it to ~150 lines.

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

### Task 1: Create `useContextPaths` Hook (2 hours)

**File**: `src/presentation/webview/hooks/domain/useContextPaths.ts`

**Extract** from `useSettings`:
- `contextSourceMode`
- `contextSourcePath`
- Related update methods

**Pattern**: Same as `useWordSearch` / `useWordFrequency`

---

### Task 2: Create `useModels` Hook (2 hours)

**File**: `src/presentation/webview/hooks/domain/useModels.ts`

**Extract** from `useSettings`:
- `assistantModel`
- `dictionaryModel`
- `contextModel`
- Model selection methods

**Pattern**: Same as other domain hooks

---

### Task 3: Create `useTokens` Hook (2 hours)

**File**: `src/presentation/webview/hooks/domain/useTokens.ts`

**Extract** from `useSettings`:
- Token usage tracking
- Reset token usage
- Token display logic

**Pattern**: Same as other domain hooks

---

### Task 4: Refactor `useSettings` (4 hours)

**File**: `src/presentation/webview/hooks/domain/useSettings.ts`

**Reduce** to only general settings:
- `includeCraftGuides`
- `temperature`
- `maxTokens`
- `applyContextWindowTrimming`
- `contextAgentWordLimit`
- `analysisAgentWordLimit`

**Goal**: Reduce from 360 → 150 lines

---

### Task 5: Update ConfigurationHandler (2 hours)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

**Add** semantic methods:
- `getContextPathSettings()`
- `getModelSettings()`
- `getTokenSettings()`

**Update** `getAllSettings()` to include all new groups.

---

### Task 6: Update App.tsx (1 hour)

**File**: `src/presentation/webview/App.tsx`

**Instantiate** new hooks:
```typescript
const contextPaths = useContextPaths(vscode);
const models = useModels(vscode);
const tokens = useTokens(vscode);
```

**Register** with message router and persistence.

**Pass** to relevant components.

---

### Task 7: Update Components (3 hours)

**Files**: Various components using extracted settings

**Update** to use new hook props instead of `settings.*`

---

## Definition of Done

- ✅ 3 new domain hooks created
- ✅ `useSettings` reduced to ~150 lines
- ✅ ConfigurationHandler semantic methods added
- ✅ All components updated
- ✅ All settings still work (regression test)
- ✅ No TypeScript errors

---

## Testing

**Regression Suite**:
1. ✅ All context path settings work
2. ✅ All model selections work
3. ✅ Token tracking works
4. ✅ Token reset works
5. ✅ All general settings work
6. ✅ Persistence works for all hooks
7. ✅ Bidirectional sync works

---

## Success Metrics

**Before**:
- `useSettings`: 360 lines (god hook)
- Domain hooks: 5

**After**:
- `useSettings`: 150 lines (focused)
- Domain hooks: 8 (added 3)

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`
