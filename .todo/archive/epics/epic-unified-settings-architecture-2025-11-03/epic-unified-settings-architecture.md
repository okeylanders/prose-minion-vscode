# Epic: Unified Settings Architecture via Domain Hooks

**Created**: 2025-11-03
**Completed**: 2025-11-07
**Status**: ✅ Complete (Phases 0-3 implemented, Phase 4 deferred)
**Priority**: CRITICAL (Phase 0), HIGH (Phases 1-4)
**Target**: Phase 0 before v1.0, Phases 1-4 for v1.1
**ADR**: [2025-11-03-unified-settings-architecture.md](../../docs/adr/2025-11-03-unified-settings-architecture.md)

---

## Epic Overview

Unify all settings management using the Domain Hooks pattern to fix critical bugs, eliminate pattern confusion, and improve maintainability by 50%.

### Problem Statement

Settings management is broken in multiple ways:

1. **🚨 CRITICAL**: SearchTab settings completely non-functional
   - 4 settings with no sync, no persistence, wrong defaults
   - Users lose all customizations on reload
   - Native VSCode settings panel ignored

2. **HIGH**: Three conflicting patterns create confusion
   - Domain Hooks (modern, clean) ✅
   - Message-based (legacy, broken) ❌
   - Developers don't know which to use

3. **MEDIUM**: Backend duplication slows development
   - Adding new setting: 30 min → should be 15 min
   - Keys hardcoded in 3 places

### Solution

Migrate all settings to Domain Hooks pattern, matching successful implementations like `usePublishing` and `useSettings`.

**Benefits**:
- ✅ Fix critical SearchTab bug (user-facing)
- ✅ 100% persistence coverage (29/29 settings)
- ✅ 50% faster to add new settings
- ✅ One pattern = less confusion
- ✅ Clean Architecture alignment

---

## Epic Goals

### Primary Goals

1. **Fix SearchTab Settings** (Phase 0) - CRITICAL
   - All 4 settings work correctly
   - Bidirectional sync (Settings Overlay ↔ SearchTab ↔ VSCode settings)
   - Persistence across reload
   - Correct defaults

2. **Unify Architecture** (Phases 1-3)
   - All settings use domain hooks
   - Backend uses semantic methods (no hardcoded lists)
   - `useSettings` reduced from 360 → 150 lines

3. **Document & Test** (Phase 4)
   - Clear guidelines in ARCHITECTURE.md
   - Automated tests for settings sync
   - Migration guide for contributors

### Success Metrics

**Phase 0** (Critical Path):
- ✅ SearchTab settings sync with Settings Overlay
- ✅ SearchTab settings sync with native VSCode settings panel
- ✅ SearchTab settings persist across webview reload
- ✅ `minClusterSize` default is 2 (not 3)

**Full Epic** (v1.1):
- ✅ 0 message-based settings (all use hooks)
- ✅ 100% persistence coverage (29/29 settings)
- ✅ Backend uses 0 hardcoded setting lists
- ✅ `useSettings` < 200 lines
- ✅ Settings architecture documented

---

## Phased Approach

### Phase 0: 🚨 Fix SearchTab (CRITICAL)
**Timeline**: This week (before v1.0)
**Effort**: 2 hours
**Risk**: Low
**Sprint**: [01-searchtab-urgent-fix.md](sprints/01-searchtab-urgent-fix.md)

**Scope**:
- Create `useWordSearchSettings` hook
- Migrate SearchTab to use hook
- Wire into App.tsx
- Fix wrong default
- Test bidirectional sync

**Deliverables**:
- ✅ Working SearchTab settings
- ✅ No more user data loss

---

### Phase 1: Backend Cleanup
**Timeline**: Next week
**Effort**: 30 minutes
**Risk**: Low
**Sprint**: [02-backend-semantic-methods.md](sprints/02-backend-semantic-methods.md)

**Scope**:
- Extract hardcoded keys to constants
- Create semantic methods (`shouldBroadcastGeneralSettings`, etc.)
- Update config watcher

**Deliverables**:
- ✅ Single source of truth per settings group
- ✅ Adding setting requires 1 change (not 3)

---

### Phase 2: MetricsTab Migration ✅
**Status**: Complete (2025-11-03)
**Timeline**: v1.1
**Effort**: 1.5 hours (actual: 1.5 hours)
**Risk**: Low
**Sprint**: [03-metricstab-migration.md](sprints/03-metricstab-migration.md)

**Scope**:
- Create `useWordFrequencySettings` hook (all 11 settings)
- Migrate MetricsTab word frequency settings
- Test persistence

**Deliverables**:
- ✅ Explicit webview persistence for all 11 word frequency settings
- ✅ 82% code reduction in MetricsTab settings management
- ✅ Optimistic updates for responsive UI
- ✅ Bidirectional sync working correctly

---

### Phase 3: Domain Hooks Extraction
**Timeline**: v1.1
**Effort**: 1 week (15.5 hours)
**Risk**: Medium
**Sprint**: [04-domain-hooks-extraction.md](sprints/04-domain-hooks-extraction.md)

**Scope**:
- Create `useContextPathsSettings` hook (config)
- Create `useModelsSettings` hook (config)
- Create `useTokensSettings` hook (config - UI preference only)
- Create `useTokenTracking` hook (state - ephemeral token usage)
- Rename `usePublishing` → `usePublishingSettings`
- Refactor MetricsTab publishing props to object pattern (consistency)
- Refactor SettingsOverlay to accept specialized hooks (no more generic settings prop)
- Eliminate `useSettings` hook entirely

**Deliverables**:
- ✅ Focused, single-purpose hooks (4 new + 1 renamed)
- ✅ useSettings eliminated (replaced by specialized hooks)
- ✅ Clear naming convention (all settings hooks end with "Settings", state hooks don't)
- ✅ Token tracking separated from token UI preferences
- ✅ Consistent object pattern for all settings hooks
- ✅ SettingsOverlay refactored to use specialized hooks

---

### Phase 4: Documentation & Testing
**Timeline**: v1.1
**Effort**: 3 days
**Risk**: Low
**Sprint**: [05-documentation-testing.md](sprints/05-documentation-testing.md)

**Scope**:
- Update ARCHITECTURE.md
- Write automated tests
- Create migration guide

**Deliverables**:
- ✅ Documented architecture
- ✅ Test coverage for settings sync
- ✅ New contributor guide

---

## Architecture Context

### Current State

**Patterns in Use**:

| Pattern | Count | Examples | Persistence | Sync | Issues |
|---------|-------|----------|-------------|------|--------|
| Domain Hooks | 24 | `useSettings`, `usePublishing` | ✅ Yes | ✅ Bidirectional | None |
| Message-Based | 5 | SearchTab (4), MetricsTab (1) | ❌ No | ❌ No | Critical |
| Hybrid | 1 | API key (SecretStorage) | ✅ Yes | ✅ Bidirectional | None (correct) |

**Persistence Coverage**: 86% (25/29 settings)

### Target State

**Single Pattern**:

| Pattern | Count | Examples | Persistence | Sync | Issues |
|---------|-------|----------|-------------|------|--------|
| Domain Hooks | 28 | All settings except API key | ✅ Yes | ✅ Bidirectional | None |
| Hybrid | 1 | API key (SecretStorage) | ✅ Yes | ✅ Bidirectional | None |

**Persistence Coverage**: 100% (29/29 settings)

### Domain Hooks Pattern

**Frontend Hook Structure**:
```typescript
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
  ...wordSearch.persistedState,  // ✅ Composed
  // ...
});

useMessageRouter({
  [MessageType.SETTINGS_DATA]: settings.handleMessage,
  [MessageType.SETTINGS_DATA]: wordSearch.handleMessage,  // ✅ Registered
  // ...
});
```

**Backend Semantic Methods**:
```typescript
// ConfigurationHandler
public getWordSearchSettings() {
  return {
    contextWords: this.config.get('wordSearch.contextWords', 3),
    clusterWindow: this.config.get('wordSearch.clusterWindow', 50),
    minClusterSize: this.config.get('wordSearch.minClusterSize', 2),
    caseSensitive: this.config.get('wordSearch.caseSensitive', false)
  };
}

// MessageHandler
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

---

## Dependencies

### Prerequisite Work
- ✅ [ADR-2025-10-27: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) - Pattern established
- ✅ [ADR-2025-10-28: Message Envelope Architecture](../../docs/adr/2025-10-28-message-envelope-architecture.md) - Message routing in place
- ✅ Settings Architecture Analysis complete (2025-11-02)

### Blocking Issues
None. All patterns and infrastructure are in place.

### Parallel Work
Can proceed alongside other v1.0/v1.1 work. Phase 0 is independent and urgent.

---

## Risks & Mitigations

### Risk 1: Breaking Existing Settings
**Likelihood**: Low
**Impact**: High

**Mitigation**:
- Follow proven pattern (`usePublishing` works perfectly)
- Test bidirectional sync thoroughly
- Manual test checklist per sprint

### Risk 2: Migration Takes Longer Than Estimated
**Likelihood**: Medium (Phases 3-4)
**Impact**: Low (v1.1, not blocking v1.0)

**Mitigation**:
- Phase 0 is scoped tightly (2 hours)
- Phases 1-2 are small (< 2 hours each)
- Phase 3 can be split into smaller increments
- Phase 4 can be done incrementally

### Risk 3: Discovering More Broken Settings
**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
- Comprehensive audit already complete
- All 29 settings inventoried
- Known issues documented

---

## Testing Strategy

### Phase 0 (Manual)
**SearchTab Settings**:
1. ✅ Set value in SearchTab → check Settings Overlay
2. ✅ Set value in Settings Overlay → check SearchTab
3. ✅ Set value in VSCode settings panel → check SearchTab
4. ✅ Reload webview → verify persistence
5. ✅ Check defaults (`minClusterSize` = 2)
6. ✅ Perform word search → verify settings applied
7. ✅ Check echo prevention (no duplicate updates)

### Phase 4 (Automated)
**Hook Unit Tests**:
- ✅ Hook initializes with correct defaults
- ✅ `updateSetting` sends correct message
- ✅ Message handler updates state
- ✅ `persistedState` contains all settings

**Integration Tests**:
- ✅ Bidirectional sync: VSCode config ↔ hook state
- ✅ Persistence: `vscode.setState` called with correct data
- ✅ Echo prevention: Updates don't loop

---

## Code Locations

### Files to Create

- `src/presentation/webview/hooks/domain/useWordSearchSettings.ts` (Phase 0)
- `src/presentation/webview/hooks/domain/useWordFrequencySettings.ts` (Phase 2)
- `src/presentation/webview/hooks/domain/useContextPathsSettings.ts` (Phase 3)
- `src/presentation/webview/hooks/domain/useModelsSettings.ts` (Phase 3)
- `src/presentation/webview/hooks/domain/useTokensSettings.ts` (Phase 3 - config)
- `src/presentation/webview/hooks/domain/useTokenTracking.ts` (Phase 3 - state)

### Files to Modify

**Phase 0**:
- `src/presentation/webview/components/SearchTab.tsx` (remove local state)
- `src/presentation/webview/App.tsx` (wire hook)

**Phase 1**:
- `src/application/handlers/MessageHandler.ts` (semantic methods)
- `src/application/handlers/domain/ConfigurationHandler.ts` (expose settings)

**Phase 2**:
- `src/presentation/webview/components/MetricsTab.tsx` (use hook)
- `src/presentation/webview/App.tsx` (wire hook)

**Phase 3**:
- `src/presentation/webview/hooks/domain/useSettings.ts` (extract to new hooks)
- `src/presentation/webview/App.tsx` (wire new hooks)

**Phase 4**:
- `docs/ARCHITECTURE.md` (document pattern)
- New test files in `src/tests/`

### Reference Implementations

- `src/presentation/webview/hooks/domain/usePublishingSettings.ts` - Clean, focused example (renamed from usePublishing)
- `src/presentation/webview/hooks/domain/useSettings.ts` - Larger example (to be eliminated in Phase 3)
- `src/presentation/webview/hooks/useMessageRouter.ts` - Strategy pattern
- `src/presentation/webview/hooks/usePersistence.ts` - State composition

---

## Related Work

### Previous Epics
- [Epic: Presentation Layer Domain Hooks Refactoring](../epic-presentation-refactor-2025-10-27/) - Established hook pattern
- [Epic: Message Envelope Architecture](../epic-message-envelope-2025-10-28/) - Message routing refactor

### Architecture Debt (Resolved by This Epic)
1. [Settings Architecture Inconsistency](./../architecture-debt/2025-11-02-settings-architecture-analysis.md) - RESOLVED (Phases 0-3)
2. [Settings Sync Registration](./../architecture-debt/2025-11-02-settings-sync-registration.md) - RESOLVED (Phase 1)
3. [Configuration Strategy Inconsistency](./../architecture-debt/2025-11-02-configuration-strategy-inconsistency.md) - RESOLVED (Phases 0-3)

### Memory Bank
- [20251102-settings-architecture-analysis-complete.md](../../.memory-bank/20251102-settings-architecture-analysis-complete.md) - Analysis session
- [20251103-1230-state-of-repo-snapshot.md](../../.memory-bank/20251103-1230-state-of-repo-snapshot.md) - Repository state

---

## Sprint Breakdown

| Sprint | Phase | Effort | Priority | Target | Status |
|--------|-------|--------|----------|--------|--------|
| [01-searchtab-urgent-fix.md](sprints/01-searchtab-urgent-fix.md) | Phase 0 | 2 hours | CRITICAL | Before v1.0 | ✅ Complete (PR #18 merged 2025-11-03) |
| [02-backend-semantic-methods.md](sprints/02-backend-semantic-methods.md) | Phase 1 | 30 min | HIGH | Next week | ✅ Complete (PR #19 merged 2025-11-03) |
| [03-metricstab-migration.md](sprints/03-metricstab-migration.md) | Phase 2 | 1.5 hours | MEDIUM | v1.1 | ✅ Complete (PR #20 merged 2025-11-04) |
| [04-domain-hooks-extraction.md](sprints/04-domain-hooks-extraction.md) | Phase 3 | 1 week (15.5h) | MEDIUM | v1.1 | ✅ Complete (PR #21 merged 2025-11-06) |
| [05-documentation-testing.md](sprints/05-documentation-testing.md) | Phase 4 | 3 days | MEDIUM | v1.1 | Deferred (basic docs complete) |

---

## Expected Outcomes

### Immediate (Phase 0)
- ✅ SearchTab settings work correctly
- ✅ No more user data loss
- ✅ Correct defaults applied

### Short-Term (Phases 1-2)
- ✅ Backend maintainability improved
- ✅ Adding new settings 50% faster
- ✅ MetricsTab persistence explicit

### Long-Term (Phases 3-4)
- ✅ One unified architecture pattern
- ✅ 100% persistence coverage
- ✅ Clear documentation for contributors
- ✅ Automated test coverage

---

## Sprint Status

### Sprint 01: SearchTab Fix ✅
**Status**: Complete (2025-11-03)
**PR**: #18 (merged)

### Sprint 02: Backend Cleanup ✅
**Status**: Complete (2025-11-03)
**PR**: #19 (merged)

### Sprint 03: MetricsTab Migration ✅
**Status**: Complete (2025-11-04)
**PR**: #20 (merged)

### Sprint 04: Domain Hooks Extraction ✅
**Status**: Complete (2025-11-06)
**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`
**PR**: #TBD (ready for creation)
**Progress**: All phases (A, B, C, D, E) complete.
**Memory Bank**:
- [20251105-1445-sprint-04-phase-c-complete.md](../../../.memory-bank/20251105-1445-sprint-04-phase-c-complete.md)
- [20251105-1857-sprint-04-phase-d-complete.md](../../../.memory-bank/20251105-1857-sprint-04-phase-d-complete.md)
- [20251106-0705-sprint-04-complete.md](../../../.memory-bank/20251106-0705-sprint-04-complete.md)

---

## Retrospective Questions

After each sprint:
1. Did the hook pattern work as expected?
2. Were there any unexpected edge cases?
3. Did testing catch all issues?
4. How long did it actually take vs. estimate?
5. What would we do differently next time?

---

## Notes

### Alpha Development
This is alpha software with no released versions. Backward compatibility is NOT required. We can make breaking changes freely.

### Echo Prevention
The existing `webviewOriginatedUpdates` Set in `ConfigurationHandler` handles echo prevention. No changes needed.

### Persistence Composition
The existing `usePersistence` hook composition pattern scales seamlessly. Each new hook adds `persistedState` to the composition.

---

## Epic Completion Summary (2025-11-07)

**Epic Status**: ✅ COMPLETE
**Started**: 2025-11-03
**Completed**: 2025-11-07 (5 days)
**Total PRs**: 4 (PRs #18, #19, #20, #21)

### Achievements

**Phase 0: SearchTab Fix** ✅ (PR #18)
- Fixed critical bug: 4 settings now sync, persist, and use correct defaults
- No more user data loss
- Bidirectional sync working

**Phase 1: Backend Cleanup** ✅ (PR #19)
- Extracted hardcoded keys to constants
- Created semantic methods
- 50% faster to add new settings

**Phase 2: MetricsTab Migration** ✅ (PR #20)
- 11 word frequency settings now use domain hooks
- 82% code reduction in settings management
- Explicit persistence for all settings

**Phase 3: Domain Hooks Extraction** ✅ (PR #21)
- Created 4 new domain hooks (useContextPathsSettings, useModelsSettings, useTokensSettings, useTokenTracking)
- Renamed usePublishing → usePublishingSettings
- Eliminated useSettings god hook (360 lines → 0)
- SettingsOverlay refactored (~30 onUpdate calls replaced)
- Consistent naming convention: all settings hooks end with "Settings"

**Phase 4: Documentation** (Deferred)
- Sprint 05 deferred - basic documentation complete in CLAUDE.md
- Comprehensive testing deferred to future sprint

### Final Metrics

**Before Epic**:
- Settings persistence coverage: 86% (25/29 settings)
- Patterns in use: 3 (Domain Hooks, Message-Based, Hybrid)
- God hook: 360 lines (useSettings)
- Message-based settings: 5 (broken, no persistence)

**After Epic**:
- Settings persistence coverage: 100% (29/29 settings)
- Patterns in use: 2 (Domain Hooks, Hybrid for API key only)
- God hook: Eliminated ✅
- Message-based settings: 0 (all migrated to hooks)
- Settings hooks: 6 specialized hooks
- Total domain hooks: 12 (6 settings + 6 state/service)

### Architecture Impact

- ✅ 100% persistence coverage (29/29 settings)
- ✅ One unified pattern (Domain Hooks everywhere)
- ✅ 50% faster to add new settings
- ✅ Clear naming convention
- ✅ Consistent object pattern for all hooks
- ✅ Clean Architecture alignment maintained

### Related Documents

- **ADR**: [2025-11-03-unified-settings-architecture.md](../../docs/adr/2025-11-03-unified-settings-architecture.md)
- **Architecture Debt Resolved**:
  - [Settings Architecture Inconsistency](./../architecture-debt/2025-11-02-settings-architecture-analysis.md)
  - [Settings Sync Registration](./../architecture-debt/2025-11-02-settings-sync-registration.md)
  - [Configuration Strategy Inconsistency](./../architecture-debt/2025-11-02-configuration-strategy-inconsistency.md)
- **Memory Bank**:
  - [20251102-settings-architecture-analysis-complete.md](../../.memory-bank/20251102-settings-architecture-analysis-complete.md)
  - [20251103-1230-state-of-repo-snapshot.md](../../.memory-bank/20251103-1230-state-of-repo-snapshot.md)
  - [20251105-1445-sprint-04-phase-c-complete.md](../../.memory-bank/20251105-1445-sprint-04-phase-c-complete.md)
  - [20251105-1857-sprint-04-phase-d-complete.md](../../.memory-bank/20251105-1857-sprint-04-phase-d-complete.md)
  - [20251106-0705-sprint-04-complete.md](../../.memory-bank/20251106-0705-sprint-04-complete.md)

---

**Epic Owner**: Development Team
**Final Review**: 2025-11-07 - All critical objectives achieved
