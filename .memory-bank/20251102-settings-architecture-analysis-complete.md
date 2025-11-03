# Memory Bank: Settings Architecture Analysis Complete

**Date**: 2025-11-02
**Session**: Settings Architecture Deep-Dive
**Status**: Analysis Complete - Critical Issues Identified
**Next Session**: Implementation Planning

---

## What We Did

Conducted a comprehensive analysis of settings architecture across the entire extension, triggered by user observation that the Word Length Filter feature (added in recent epic) uses a different pattern than Publishing Standards.

### Investigation Scope

1. ✅ Mapped all settings flows (extension ↔ webview)
2. ✅ Documented bidirectional sync mechanisms
3. ✅ Analyzed echo prevention system
4. ✅ Identified persistence architecture
5. ✅ Found pattern inconsistencies
6. ✅ Discovered critical bugs in SearchTab

---

## Critical Findings

### 🚨 SearchTab Settings BROKEN (Critical)

Found **4 settings completely disconnected** from the settings system:
- `wordSearch.contextWords` - No sync, no persistence
- `wordSearch.clusterWindow` - No sync, no persistence
- `wordSearch.minClusterSize` - No sync, no persistence, **wrong default** (3 vs 2)
- `wordSearch.caseSensitive` - No sync, no persistence

**Impact**:
- Users cannot configure Word Search via Settings Overlay ❌
- Settings don't persist across reloads ❌
- Changes in native VSCode settings panel ignored ❌
- Wrong default causes incorrect clustering behavior ❌

**User Story**: User sets custom search params, gets good results, closes VSCode, reopens → all settings lost, back to defaults.

### ⚠️ MetricsTab Settings (Medium Priority)

Found **1 setting partially broken**:
- `wordFrequency.minCharacterLength` - Has sync, but no webview persistence

**Impact**:
- Syncs with Settings Overlay ✅
- Syncs with native VSCode settings ✅
- But relies on backend sync on mount (not webview persistence) ⚠️

### 📊 Pattern Analysis

**Three Conflicting Patterns Identified**:

1. **Domain Hooks** (5 hooks) - Modern, clean ✅
   - `useSettings`, `usePublishing`, `useAnalysis`, `useMetrics`, `useDictionary`
   - Registered with `useMessageRouter`
   - Persisted via `usePersistence`
   - Single source of truth across components

2. **Message-Based** (5 settings) - Legacy, problematic ❌
   - MetricsTab: `minCharacterLength` (partial sync)
   - SearchTab: 4 settings (no sync at all)
   - Manual listeners in `useEffect`
   - No persistence (SearchTab) or indirect persistence (MetricsTab)

3. **Hybrid** (API key) - Special case ✅
   - SecretStorage for security
   - Status-based UI
   - Correct pattern for sensitive data

**Metrics**:
- Message-based settings: 5 (should be 0)
- Persistence coverage: 86% (25/29 settings)
- Wrong defaults: 1 (SearchTab minCluster)

---

## Documents Created

### 1. Executive Summary (Quick Read)
**File**: `.todo/architecture-debt/2025-11-02-settings-architecture-SUMMARY.md`
**Length**: ~400 lines
**Purpose**: Decision-making for leadership
**Contains**:
- Problem statement (3 sentences)
- Key findings
- Impact assessment
- Migration phases with effort estimates
- Decision matrix

### 2. Comprehensive Analysis (Deep Dive)
**File**: `.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md`
**Length**: 1818 lines
**Purpose**: Technical reference for implementation
**Contains**:
- Complete architecture map (backend + frontend)
- Flow diagrams for all 4 settings patterns
- Hook vs message comparison tables
- Bidirectional sync mechanisms
- Echo prevention system documentation
- Persistence architecture
- Code examples and migration plan

### 3. Critical Discovery (SearchTab)
**File**: `.todo/architecture-debt/2025-11-02-settings-architecture-ADDENDUM.md`
**Length**: ~550 lines
**Purpose**: Urgent issue documentation
**Contains**:
- SearchTab issues breakdown
- Side-by-side comparison: MetricsTab vs SearchTab
- User impact scenarios
- Evidence (code samples, grep results)
- Immediate fix recommendations

---

## Key Technical Insights

### Echo Prevention System

**Implementation**: `webviewOriginatedUpdates` Set in ConfigurationHandler
- Marks updates from webview with 100ms timeout
- Prevents infinite loop: webview → backend → config change → webview
- Supports prefix matching for nested settings (`wordFrequency.*`)

**Flow**:
1. Webview sends `UPDATE_SETTING`
2. Handler marks key as webview-originated (100ms timeout)
3. VSCode config updated
4. Config watcher fires
5. `shouldBroadcastConfigChange()` checks Set → returns false
6. No echo to webview ✅

### Bidirectional Sync Mechanisms

**Webview → Backend**:
- Hook method calls `vscode.postMessage({ type: UPDATE_SETTING })`
- ConfigurationHandler updates VSCode workspace config
- Echo prevention prevents loop

**Backend → Webview**:
- Config watcher detects changes from native VSCode settings panel
- Calls `shouldBroadcastConfigChange()` (echo prevention)
- Sends `SETTINGS_DATA` to webview
- Hook handler updates state

**Native VSCode Settings → Webview**:
- User changes setting in VSCode settings panel
- Config watcher broadcasts `SETTINGS_DATA`
- Webview hooks receive and update state
- Works correctly for hook-based settings ✅
- **Broken for SearchTab** (no listeners) ❌

### Persistence Architecture

**usePersistence Hook**:
```typescript
export const usePersistence = (state: T) => {
  React.useEffect(() => {
    vscode.setState(state);  // Persist to VSCode webview storage
  }, [vscode, state]);
};
```

**App.tsx Composition**:
```typescript
usePersistence({
  activeTab,
  ...settings.persistedState,
  ...publishing.persistedState,
  ...analysis.persistedState,
  // ❌ SearchTab settings NOT included
});
```

**Gap**: SearchTab settings not in composition → lost on reload

---

## Backend Issues (Related)

### Hardcoded Settings Lists

**File**: `MessageHandler.ts` (lines 108-136)
**Problem**: Keys duplicated in `if` conditions AND arrays
**Impact**: Manual updates in 3+ places when adding settings

**Example**:
```typescript
// ❌ Duplication
if (
  event.affectsConfiguration('proseMinion.includeCraftGuides') ||
  event.affectsConfiguration('proseMinion.temperature') ||
  // ...
) {
  const affectedKeys = [
    'proseMinion.includeCraftGuides',
    'proseMinion.temperature',
    // ...
  ];
}
```

**Proposed Fix** (30 min):
```typescript
private readonly GENERAL_SETTINGS_KEYS = [
  'proseMinion.includeCraftGuides',
  'proseMinion.temperature',
  // ...
] as const;

private shouldBroadcastGeneralSettings(event) {
  return this.GENERAL_SETTINGS_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}
```

---

## Recommended Action Plan

### Phase 0: 🚨 URGENT - SearchTab Fix (2 hours)
**Timeline**: This week (before v1.0)
**Priority**: CRITICAL

1. Create `useWordSearch` hook (1 hour)
   - All 4 word search settings
   - Message handlers for `SETTINGS_DATA`
   - Send `UPDATE_SETTING` on changes
   - Expose `persistedState`

2. Migrate SearchTab (30 min)
   - Remove local state
   - Remove manual listeners
   - Use hook props
   - Fix wrong default (minCluster: 3 → 2)

3. Wire in App.tsx (15 min)
   - Instantiate hook
   - Register with `useMessageRouter`
   - Add to `usePersistence`

4. Test (15 min)
   - Bidirectional sync works
   - Persistence across reload
   - Correct defaults

**Blockers**: None
**Risk**: Low (follows existing pattern)
**Impact**: Fixes critical user-facing bug

### Phase 1: Backend Cleanup (30 min)
**Timeline**: Next week
**Priority**: High

1. Extract hardcoded keys to constants
2. Create semantic methods
3. Update config watcher

**Blockers**: None
**Risk**: Low
**Impact**: Cleaner backend code

### Phase 2-4: Full Migration (3 weeks)
**Timeline**: v1.1
**Priority**: Medium

1. Create domain hooks (useWordFrequency, useContextPaths, useModels, useTokens)
2. Migrate MetricsTab
3. Reduce useSettings from 360 → 150 lines
4. Testing and validation

**Blockers**: None
**Risk**: Medium
**Impact**: Unified architecture, 100% persistence, better maintainability

---

## Code Locations

### Files Modified/Created
- `.todo/architecture-debt/2025-11-02-settings-architecture-SUMMARY.md` (new)
- `.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md` (new)
- `.todo/architecture-debt/2025-11-02-settings-architecture-ADDENDUM.md` (new)
- `.memory-bank/20251102-settings-architecture-analysis-complete.md` (this file)

### Key Source Files
- `src/application/handlers/MessageHandler.ts` (lines 86-160) - Config watcher
- `src/application/handlers/domain/ConfigurationHandler.ts` - Settings management
- `src/presentation/webview/hooks/domain/useSettings.ts` - Settings hook
- `src/presentation/webview/hooks/domain/usePublishing.ts` - Publishing hook (model to follow)
- `src/presentation/webview/components/MetricsTab.tsx` (lines 68-112) - minCharLength message-based
- `src/presentation/webview/components/SearchTab.tsx` (lines 45-48) - 4 broken settings
- `src/presentation/webview/App.tsx` - Hook composition

### Configuration
- `package.json` - Settings definitions
- `src/application/handlers/domain/ConfigurationHandler.ts` (lines 110-148) - Settings exposure

---

## Related Documentation

### Existing
- **ADR**: `docs/adr/2025-10-27-presentation-layer-domain-hooks.md` - Domain hooks architecture
- **Epic**: `.todo/epics/epic-word-length-filter-metrics-2025-11-02/` - What triggered this analysis
- **Debt**: `.todo/architecture-debt/2025-11-02-configuration-strategy-inconsistency.md` - Frontend patterns
- **Debt**: `.todo/architecture-debt/2025-11-02-settings-sync-registration.md` - Backend registration

### New (Created Today)
- Executive Summary (decision-making)
- Comprehensive Analysis (implementation reference)
- Critical Addendum (SearchTab issues)

---

## Statistics

**Time Invested**: ~4 hours
**Lines Analyzed**: ~5000+ lines across 20+ files
**Documents Created**: 4 (including this memory bank)
**Total Documentation**: ~3000 lines
**Issues Found**:
- Critical: 1 (SearchTab completely broken)
- Medium: 1 (MetricsTab partial persistence)
- Low: 2 (backend hardcoded lists, pattern inconsistency)

**Metrics**:
- Settings audited: 29
- Hooks analyzed: 8
- Components analyzed: 4
- Message flows documented: 4
- Code examples: 20+

---

## Next Session Tasks

### Immediate (Before v1.0)
1. ✅ Review analysis documents with team
2. ⬜ Decide on timeline (v1.0 vs v1.1)
3. ⬜ **Implement Phase 0**: Create `useWordSearch` hook (2 hours)
4. ⬜ Test SearchTab fixes thoroughly
5. ⬜ Update ARCHITECTURE.md if patterns chosen

### Short Term (v1.0 or v1.1)
6. ⬜ Implement Phase 1: Backend cleanup (30 min)
7. ⬜ Create epic for full migration
8. ⬜ Break into sprints

### Long Term (v1.1+)
9. ⬜ Implement Phases 2-4: Full domain hooks migration
10. ⬜ Add automated tests for settings sync
11. ⬜ Document patterns in ARCHITECTURE.md

---

## Open Questions

1. **Timeline**: Fix SearchTab before v1.0 or defer to v1.1?
   - **Recommendation**: Before v1.0 (critical user-facing bug)

2. **Scope**: Backend only or full migration?
   - **Recommendation**: Phase 0 + Phase 1 before v1.0, rest in v1.1

3. **Testing**: Manual or automated?
   - **Recommendation**: Manual for Phase 0, automated for full migration

4. **Breaking Changes**: Care about backward compatibility?
   - **Note**: Alpha software, no users, no compatibility needed

---

## Key Takeaways

1. **Pattern Consistency Matters**: Mixed patterns (hooks vs messages) create confusion and bugs
2. **Persistence is Critical**: Users expect settings to persist (SearchTab failure case)
3. **Defaults Must Match**: SearchTab has wrong default (3 vs 2) - data integrity issue
4. **Bidirectional Sync is Complex**: Echo prevention, config watchers, message routing all must work together
5. **Domain Hooks Work Well**: Publishing Standards is the model to follow (clean, persistent, shared)
6. **User Testing Finds Issues**: This was discovered organically during feature development, not planned analysis

---

## Success Criteria

### Phase 0 Complete When:
- ✅ SearchTab settings sync with SettingsOverlay
- ✅ SearchTab settings sync with native VSCode settings panel
- ✅ SearchTab settings persist across webview reload
- ✅ minClusterSize default is 2 (not 3)
- ✅ All 4 word search settings work correctly

### Full Migration Complete When:
- ✅ All settings use domain hooks (0 message-based)
- ✅ 100% persistence coverage (29/29 settings)
- ✅ Backend config watcher uses semantic methods
- ✅ useSettings reduced to 150 lines
- ✅ Clear architectural guidelines documented

---

## Lessons Learned

1. **Always Check Scope**: User's suggestion to check "scope" settings led to critical discovery
2. **Grep is Your Friend**: Found issues by searching for `useState`, `addEventListener`, `UPDATE_SETTING`
3. **Document Thoroughly**: 3000 lines of analysis might seem like overkill, but it's valuable for future reference
4. **User Scenarios Matter**: Documented specific failure cases helps prioritize fixes
5. **Alpha Means No Compatibility**: Freedom to make breaking changes is a gift - use it!

---

**Status**: 📊 Analysis Complete - Ready for Implementation
**Commit**: All documents committed to main
**Next**: Resume tomorrow with implementation planning

---

**Session End**: 2025-11-02
**Claude Code Session**: Architecture Analysis Deep-Dive
**User Feedback**: Thorough analysis appreciated, good catch on SearchTab issues
