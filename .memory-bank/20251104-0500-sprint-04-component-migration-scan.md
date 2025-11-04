# Sprint 04 Component Migration Scan - SettingsOverlay Discovery

**Date**: 2025-11-04 05:00
**Context**: Post-Sprint 03 completion, pre-Sprint 04 planning
**Epic**: [Unified Settings Architecture](.todo/epics/epic-unified-settings-architecture-2025-11-03/)
**Related**: Sprint 03 complete, Sprint 04 planning phase

---

## Summary

Performed comprehensive component migration scan to identify which UI components will need updates during Sprint 04 (Phase 3: Domain Hooks Extraction). **Discovered critical dependency**: SettingsOverlay component requires major refactoring not initially scoped.

---

## Discovery Process

### Trigger
User asked: "Can you scan for any other ui components that would need to be migrated as well after we've updated the backend with use*Settings hooks?"

### Method
1. Searched for `useSettings` usage in TSX files (only App.tsx)
2. Searched for settings property access patterns (only App.tsx)
3. Analyzed SettingsOverlay component structure and props
4. Traced how App.tsx currently passes settings to SettingsOverlay
5. Identified all components receiving settings-related props

### Tools Used
- `grep -r "useSettings" src/presentation/webview/**/*.tsx`
- `grep -r "settings\.(model|temperature|...)" src/presentation/webview/**/*.tsx`
- Read SettingsOverlay.tsx interface (file too large - 35K tokens, required targeted reads)

---

## Key Findings

### 1. SettingsOverlay - Major Refactoring Required ⚠️

**Current Architecture** ([SettingsOverlay.tsx:4-28](../src/presentation/webview/components/SettingsOverlay.tsx#L4-L28)):

```typescript
type SettingsOverlayProps = {
  visible: boolean;
  onClose: () => void;
  vscode: any;
  settings: Record<string, string | number | boolean>;  // Generic object
  onUpdate: (key: string, value: string | number | boolean) => void;  // Generic updater
  onResetTokens: () => void;
  modelOptions: ModelOption[];
  modelSelections: Partial<Record<ModelScope, string>>;
  onModelChange: (scope: ModelScope, modelId: string) => void;
  publishing: { ... };
  apiKey: { ... };
};
```

**Problem**:
- Generic `settings` prop comes from `useSettings` god hook
- Generic `onUpdate(key, value)` method called ~30 times throughout component
- No type safety - settings accessed by string keys

**Impact**:
- ~30 `onUpdate()` calls need refactoring
- All 17 settings accessed in SettingsOverlay must be mapped to appropriate hooks
- Helper functions (`asString`, `asNumber`, `asBoolean`) need updates

**Effort**: 2 hours (not originally scoped)

### 2. MetricsTab - Already Scoped ✅

**Status**: Task 5b already in Sprint 04
- Refactor publishing props from individual props to object pattern
- Effort: 30 minutes

### 3. Components NOT Requiring Changes ✅

- **SearchTab**: Already migrated in Sprint 01 (uses `useWordSearchSettings`)
- **AnalysisTab**: No settings props
- **SuggestionsTab**: No settings props
- **UtilitiesTab**: No settings props

---

## Breakdown: Which Settings Go Where

### SettingsOverlay Settings Mapping

**From `useModelsSettings` (8 settings)**:
- `assistantModel`, `dictionaryModel`, `contextModel`, `model`
- `includeCraftGuides`, `temperature`, `maxTokens`
- `applyContextWindowTrimming`

**From `useContextPathsSettings` (8 settings)**:
- `contextPaths.characters`, `contextPaths.locations`
- `contextPaths.themes`, `contextPaths.things`
- `contextPaths.chapters`, `contextPaths.manuscript`
- `contextPaths.projectBrief`, `contextPaths.general`

**From `useTokensSettings` (1 setting)**:
- `ui.showTokenWidget`

**From `useTokenTracking` (ephemeral state)**:
- Token usage display
- Reset tokens function

---

## Actions Taken

### 1. Updated Sprint 04 Documentation

**Added Task 10**: Refactor SettingsOverlay to Accept Specialized Hooks (2 hours)

**Files Updated**:
- [Sprint 04 doc](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/04-domain-hooks-extraction.md)
- [ADR](../docs/adr/2025-11-03-unified-settings-architecture.md)
- [Epic master doc](.todo/epics/epic-unified-settings-architecture-2025-11-03/epic-unified-settings-architecture.md)

**Effort Impact**: 13.5 hours → **15.5 hours** (+2 hours)

**Commit**: `25a27d2` - "docs(sprint-04): add SettingsOverlay refactoring to Phase 3 scope"

### 2. Updated Sprint 03 PR

**Added Section**: "Sprint 04 Impact Discovery"
- Documented SettingsOverlay discovery
- Listed component migration status
- Updated Next Steps with revised Sprint 04 scope

**File**: [docs/pr/sprint-03-metricstab-word-frequency-settings.md](../docs/pr/sprint-03-metricstab-word-frequency-settings.md)

---

## Sprint 04 Updated Scope

### Tasks (10 total, was 9)

1. Create `useModelsSettings` hook (2 hours)
2. Create `useContextPathsSettings` hook (2 hours)
3. Create `useTokensSettings` hook (30 min)
4. Create `useTokenTracking` hook (30 min)
5. Rename `usePublishing` → `usePublishingSettings` (30 min)
5b. Refactor MetricsTab publishing props to object pattern (30 min)
6. Eliminate `useSettings` hook (3 hours)
7. Update ConfigurationHandler (2 hours)
8. Update App.tsx (1 hour)
9. Update Components (3 hours)
**10. Refactor SettingsOverlay** (2 hours) ← NEW

**Total**: 15.5 hours (was 13.5 hours)

---

## Architecture Implications

### Pattern Consistency Achieved

After Sprint 04 completion:
- **All settings hooks** use object pattern for props
- **No generic settings objects** passed to components
- **Type-safe settings access** throughout UI
- **Specialized hooks only** (no god hooks)

### Component Prop Patterns

**Before Sprint 04**:
- ❌ SettingsOverlay: `settings={settings.settingsData}`, `onUpdate={settings.updateSetting}`
- ❌ MetricsTab: Individual publishing props

**After Sprint 04**:
- ✅ SettingsOverlay: `modelsSettings={modelsSettings}`, `contextPathsSettings={...}`, etc.
- ✅ MetricsTab: `publishingSettings={publishingSettings}` (object pattern)

---

## Lessons Learned

### 1. Early Component Scanning Critical

**What Happened**: SettingsOverlay refactoring discovered during post-sprint analysis, not during initial planning.

**Impact**: +2 hours effort, documentation churn

**Better Approach**: Scan all components using god hook during ADR/Epic planning phase, not after sprint completion.

### 2. God Hook Dependencies Pervasive

**Observation**: God hooks like `useSettings` spread their influence widely:
- Direct usage in App.tsx
- Indirect usage via props to many components
- Not immediately obvious from component interface alone

**Takeaway**: When eliminating god hooks, expect component prop refactoring, not just hook replacement.

### 3. Component Scan Tools

**Effective**:
- Grep for hook usage (`useSettings`)
- Grep for settings property access patterns
- Read component prop interfaces

**Less Effective**:
- Assuming only direct hook consumers need updates
- Not tracing prop passing chains

---

## Next Session Prep

### For Sprint 04 Implementation

**Components to Update** (in order):
1. Create 4 new hooks (Tasks 1-4)
2. Update ConfigurationHandler (Task 7)
3. Update App.tsx to instantiate new hooks (Task 8)
4. **Refactor SettingsOverlay** (Task 10) ← Critical path
5. Refactor MetricsTab publishing props (Task 5b)
6. Eliminate useSettings (Task 6)

**Testing Focus**:
- SettingsOverlay: All 17 settings work in UI
- Bidirectional sync: SettingsOverlay ↔ VSCode settings panel
- Persistence: Settings maintained across reload

---

## References

- [Sprint 04 Doc](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/04-domain-hooks-extraction.md)
- [Sprint 03 PR](../docs/pr/sprint-03-metricstab-word-frequency-settings.md)
- [ADR: Unified Settings Architecture](../docs/adr/2025-11-03-unified-settings-architecture.md)
- [Commit: 25a27d2](https://github.com/user/repo/commit/25a27d2)

---

**Status**: Sprint 04 planning complete, scope finalized at 15.5 hours
**Next**: Ready to begin Sprint 04 implementation
