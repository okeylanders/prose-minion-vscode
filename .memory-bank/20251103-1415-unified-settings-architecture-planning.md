# Memory Bank: Unified Settings Architecture Planning Complete

**Date**: 2025-11-03
**Session**: Settings Architecture Refactor Planning
**Status**: ✅ **EPIC COMPLETE** (Completed 2025-11-07)
**Next Session**: ~~Begin Phase 0 Implementation~~ DONE

---

## 🎉 UPDATE: This Epic Has Been Completed!

**Completion Date**: 2025-11-07
**Final Status**: ✅ Complete (Phases 0-3 implemented, Phase 4 deferred)

**What Was Fixed**:
- ✅ SearchTab settings now work correctly (all 4 settings)
- ✅ Correct default: `minClusterSize: 2` (was broken with default 3)
- ✅ Full persistence and bidirectional sync implemented
- ✅ Domain Hooks pattern applied via `useWordSearchSettings`

**References**:
- **Epic (Archived)**: [.todo/archived/epics/epic-unified-settings-architecture-2025-11-03/](.todo/archived/epics/epic-unified-settings-architecture-2025-11-03/)
- **Implementation**: [src/presentation/webview/hooks/domain/useWordSearchSettings.ts](../src/presentation/webview/hooks/domain/useWordSearchSettings.ts)
- **PRs**: #18 (SearchTab fix), #19 (backend methods), #20 (MetricsTab), #21 (domain hooks)

---

## Original Planning Document (November 3, 2025)

---

## What We Did

Created comprehensive ADR and implementation plan for the Unified Settings Architecture refactor, addressing critical SearchTab bug and establishing long-term architecture pattern.

### Deliverables Created

1. **ADR**: [2025-11-03-unified-settings-architecture.md](../docs/adr/2025-11-03-unified-settings-architecture.md)
   - Decision to unify on Domain Hooks pattern
   - Phased implementation approach
   - Success criteria and validation

2. **Epic**: [epic-unified-settings-architecture-2025-11-03](../.todo/epics/epic-unified-settings-architecture-2025-11-03/)
   - Epic overview document
   - 5 detailed sprint documents
   - README for quick navigation

3. **Sprints**:
   - Sprint 01: SearchTab Urgent Fix (2 hours, CRITICAL)
   - Sprint 02: Backend Semantic Methods (30 min, HIGH)
   - Sprint 03: MetricsTab Migration (1 hour, MEDIUM)
   - Sprint 04: Domain Hooks Extraction (1 week, MEDIUM)
   - Sprint 05: Documentation & Testing (3 days, MEDIUM)

---

## Key Decisions

### Architecture Decision

**Chosen Pattern**: Domain Hooks everywhere

**Why**:
- ✅ Single pattern (reduces cognitive load)
- ✅ Proven (usePublishing, useSettings work perfectly)
- ✅ Persistent (automatic via usePersistence composition)
- ✅ Bidirectional sync (VSCode ↔ Settings Overlay ↔ Component)
- ✅ Mirrors backend (Clean Architecture alignment)

**Rejected Alternatives**:
- ❌ Keep message-based for simple settings (pattern confusion)
- ❌ Backend-only registry (doesn't solve frontend persistence)
- ❌ Do nothing (SearchTab critically broken)

### Phased Approach

**Phase 0** (CRITICAL, before v1.0): Fix SearchTab
- Create `useWordSearch` hook
- Migrate SearchTab component
- Fix wrong default (`minClusterSize: 3 → 2`)
- Test bidirectional sync
- **Effort**: 2 hours
- **Risk**: Low

**Phase 1** (HIGH, next week): Backend cleanup
- Extract hardcoded keys to constants
- Create semantic methods
- **Effort**: 30 minutes
- **Risk**: Low

**Phases 2-4** (MEDIUM, v1.1): Full migration
- MetricsTab migration
- Domain hooks extraction
- Documentation & testing
- **Effort**: 2+ weeks
- **Risk**: Medium

---

## Critical Findings (Referenced from Previous Analysis)

### SearchTab Settings Broken (CRITICAL)

**4 settings completely non-functional**:
- `wordSearch.contextWords` - No sync, no persistence
- `wordSearch.clusterWindow` - No sync, no persistence
- `wordSearch.minClusterSize` - No sync, no persistence, **wrong default** (3 vs 2)
- `wordSearch.caseSensitive` - No sync, no persistence

**User Impact**:
- Cannot configure via Settings Overlay ❌
- Settings lost on reload ❌
- Native VSCode settings ignored ❌
- Wrong default causes incorrect behavior ❌

**User Story**: User customizes search → gets good results → closes VSCode → reopens → all lost ❌

### MetricsTab Settings (MEDIUM)

**1 setting partially broken**:
- `wordFrequency.minCharacterLength` - Has sync, but indirect persistence

**Impact**:
- Works correctly but relies on backend sync (not webview persistence)
- Should follow Domain Hooks pattern for consistency

### Pattern Analysis

**Current State**:
| Pattern | Count | Persistence | Sync | Issues |
|---------|-------|-------------|------|--------|
| Domain Hooks | 24 | ✅ Yes | ✅ Bidirectional | None |
| Message-Based | 5 | ❌ No | ❌ No | Critical |
| Hybrid | 1 | ✅ Yes | ✅ Bidirectional | None (correct) |

**Target State**:
| Pattern | Count | Persistence | Sync | Issues |
|---------|-------|-------------|------|--------|
| Domain Hooks | 28 | ✅ Yes | ✅ Bidirectional | None |
| Hybrid | 1 | ✅ Yes | ✅ Bidirectional | None |

**Persistence Coverage**: 86% → 100% (25/29 → 29/29)

---

## Implementation Plan

### Sprint 01: SearchTab Urgent Fix (CRITICAL)

**Timeline**: This week (before v1.0)
**Effort**: 2 hours
**Risk**: Low

**Tasks**:
1. Create `useWordSearch` hook (1 hour)
2. Update ConfigurationHandler (15 min)
3. Update MessageHandler config watcher (15 min)
4. Migrate SearchTab component (30 min)
5. Wire into App.tsx (15 min)
6. Add settings to package.json (10 min)
7. Test bidirectional sync (15 min)

**Success Criteria**:
- ✅ All 4 SearchTab settings sync bidirectionally
- ✅ Settings persist across webview reload
- ✅ `minClusterSize` default is 2 (not 3)
- ✅ Native VSCode settings panel changes reflected

**Branch**: `sprint/unified-settings-01-searchtab-urgent-fix`

---

### Sprint 02: Backend Semantic Methods (HIGH)

**Timeline**: Next week
**Effort**: 30 minutes
**Risk**: Low

**Tasks**:
1. Extract settings keys to constants (10 min)
2. Create semantic helper methods (15 min)
3. Update config watcher (5 min)

**Success Criteria**:
- ✅ No hardcoded setting keys in `if` conditions
- ✅ Single source of truth per settings group
- ✅ Adding new setting requires 1 change (not 3)

**Branch**: `sprint/unified-settings-02-backend-semantic-methods`

---

### Sprint 03: MetricsTab Migration (MEDIUM)

**Timeline**: v1.1
**Effort**: 1 hour
**Risk**: Low

**Tasks**:
1. Create `useWordFrequency` hook (30 min)
2. Update ConfigurationHandler (10 min)
3. Migrate MetricsTab component (20 min)
4. Wire into App.tsx (10 min)

**Success Criteria**:
- ✅ `minCharacterLength` uses hook pattern
- ✅ Explicit webview persistence

**Branch**: `sprint/unified-settings-03-metricstab-migration`

---

### Sprint 04: Domain Hooks Extraction (MEDIUM)

**Timeline**: v1.1
**Effort**: 1 week
**Risk**: Medium

**Tasks**:
1. Create `useContextPaths` hook (2 hours)
2. Create `useModels` hook (2 hours)
3. Create `useTokens` hook (2 hours)
4. Refactor `useSettings` (4 hours)
5. Update ConfigurationHandler (2 hours)
6. Update App.tsx (1 hour)
7. Update components (3 hours)

**Success Criteria**:
- ✅ `useSettings` reduced from 360 → 150 lines
- ✅ 3 new focused domain hooks
- ✅ All settings still work (regression test)

**Branch**: `sprint/unified-settings-04-domain-hooks-extraction`

---

### Sprint 05: Documentation & Testing (MEDIUM)

**Timeline**: v1.1
**Effort**: 3 days
**Risk**: Low

**Tasks**:
1. Update ARCHITECTURE.md (1 day)
2. Create migration guide (1 day)
3. Hook unit tests (1 day)
4. Integration tests (1 day)
5. Update test documentation (0.5 days)
6. Add JSDoc comments (0.5 days)

**Success Criteria**:
- ✅ ARCHITECTURE.md has settings section
- ✅ Migration guide complete
- ✅ Hook unit test coverage > 80%
- ✅ Integration tests pass
- ✅ All hooks have JSDoc comments

**Branch**: `sprint/unified-settings-05-documentation-testing`

---

## Architecture Context

### Domain Hooks Pattern

**Hook Structure**:
```typescript
export const useWordSearch = (vscode: VSCodeAPI) => {
  const [settings, setSettings] = React.useState({
    contextWords: 3,
    clusterWindow: 50,
    minClusterSize: 2,
    caseSensitive: false
  });

  const handleMessage = (message) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      setSettings(message.data.wordSearch);
    }
  };

  const updateSetting = (key, value) => {
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      key: `wordSearch.${key}`,
      value
    });
  };

  return {
    settings,
    updateSetting,
    handleMessage,
    persistedState: { wordSearch: settings }
  };
};
```

**App.tsx Composition**:
```typescript
const wordSearch = useWordSearch(vscode);

useMessageRouter({
  [MessageType.SETTINGS_DATA]: wordSearch.handleMessage,
});

usePersistence({
  ...wordSearch.persistedState,
});
```

**Backend**:
```typescript
// ConfigurationHandler
public getWordSearchSettings() {
  return {
    contextWords: this.config.get('wordSearch.contextWords', 3),
    // ...
  };
}

// MessageHandler
private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.contextWords',
  // ...
] as const;

private shouldBroadcastWordSearchSettings(event) {
  return this.WORD_SEARCH_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}
```

---

## Code Locations

### Files to Create

**Hooks** (Phases 0-3):
- `src/presentation/webview/hooks/domain/useWordSearch.ts`
- `src/presentation/webview/hooks/domain/useWordFrequency.ts`
- `src/presentation/webview/hooks/domain/useContextPaths.ts`
- `src/presentation/webview/hooks/domain/useModels.ts`
- `src/presentation/webview/hooks/domain/useTokens.ts`

**Tests** (Phase 4):
- `src/tests/hooks/` (5 test files)
- `src/tests/integration/` (3 test files)

**Documentation** (Phase 4):
- `docs/guides/ADDING_SETTINGS.md`
- `docs/TESTING.md` (or update existing)

### Files to Modify

**Phase 0**:
- `src/presentation/webview/components/SearchTab.tsx`
- `src/presentation/webview/App.tsx`
- `src/application/handlers/domain/ConfigurationHandler.ts`
- `src/application/handlers/MessageHandler.ts`
- `package.json`

**Phase 1**:
- `src/application/handlers/MessageHandler.ts`

**Phase 2**:
- `src/presentation/webview/components/MetricsTab.tsx`
- `src/presentation/webview/App.tsx`
- `src/application/handlers/domain/ConfigurationHandler.ts`

**Phase 3**:
- `src/presentation/webview/hooks/domain/useSettings.ts`
- `src/presentation/webview/App.tsx`
- Various components

**Phase 4**:
- `docs/ARCHITECTURE.md`
- All domain hook files (JSDoc)

---

## Related Documentation

### ADRs
- [ADR-2025-11-03: Unified Settings Architecture](../docs/adr/2025-11-03-unified-settings-architecture.md) - **NEW** (this session)
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) - Pattern foundation
- [ADR-2025-10-28: Message Envelope Architecture](../docs/adr/2025-10-28-message-envelope-architecture.md) - Message routing

### Epics
- [Epic: Unified Settings Architecture](../.todo/epics/epic-unified-settings-architecture-2025-11-03/) - **NEW** (this session)
- [Epic: Presentation Layer Refactor](../.todo/epics/epic-presentation-refactor-2025-10-27/) - Established hooks pattern

### Architecture Debt (Resolved by This Epic)
- [Settings Architecture Analysis](../.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md) - Comprehensive analysis
- [Settings Architecture Summary](../.todo/architecture-debt/2025-11-02-settings-architecture-SUMMARY.md) - Executive summary
- [SearchTab Critical Issues](../.todo/architecture-debt/2025-11-02-settings-architecture-ADDENDUM.md) - SearchTab deep-dive
- [Settings Sync Registration](../.todo/architecture-debt/2025-11-02-settings-sync-registration.md) - Backend duplication
- [Configuration Strategy Inconsistency](../.todo/architecture-debt/2025-11-02-configuration-strategy-inconsistency.md) - Pattern confusion

### Memory Bank
- [20251102-settings-architecture-analysis-complete.md](./20251102-settings-architecture-analysis-complete.md) - Analysis session
- [20251103-1230-state-of-repo-snapshot.md](./20251103-1230-state-of-repo-snapshot.md) - Repository state
- [20251103-unified-settings-architecture-planning.md](./20251103-unified-settings-architecture-planning.md) - **THIS FILE**

---

## Success Metrics

### Phase 0 Complete When
- ✅ SearchTab settings sync with Settings Overlay
- ✅ SearchTab settings sync with native VSCode settings panel
- ✅ SearchTab settings persist across webview reload
- ✅ `minClusterSize` default is 2 (not 3)
- ✅ All 4 word search settings work correctly

### Full Epic Complete When
- ✅ All settings use domain hooks (0 message-based)
- ✅ 100% persistence coverage (29/29 settings)
- ✅ Backend config watcher uses semantic methods
- ✅ `useSettings` reduced to 150 lines
- ✅ Clear architectural guidelines documented
- ✅ Automated tests pass

---

## Expected Outcomes

### Immediate (Phase 0)
- ✅ Fix critical user-facing bug
- ✅ No more data loss
- ✅ Correct defaults applied

### Short-Term (Phases 1-2)
- ✅ Backend maintainability improved (50% faster to add settings)
- ✅ MetricsTab follows pattern

### Long-Term (Phases 3-4)
- ✅ One unified architecture pattern
- ✅ 100% persistence coverage
- ✅ Clear documentation for contributors
- ✅ Automated test coverage

---

## Next Session Tasks

### Immediate (Before v1.0)
1. ✅ Review ADR with team (this document)
2. ⬜ **Implement Sprint 01**: SearchTab urgent fix (2 hours)
3. ⬜ Test SearchTab fixes thoroughly (7-point checklist)
4. ⬜ Create PR for Sprint 01
5. ⬜ Merge to main

### Short Term (Next Week)
6. ⬜ **Implement Sprint 02**: Backend semantic methods (30 min)
7. ⬜ Create PR for Sprint 02
8. ⬜ Merge to main

### Medium Term (v1.1)
9. ⬜ Plan Sprints 03-05 timing
10. ⬜ Implement remaining phases
11. ⬜ Update ARCHITECTURE.md

---

## Open Questions

1. **Timeline for Phase 0**: Start immediately or after other v1.0 work?
   - **Recommendation**: Immediately (critical user-facing bug)

2. **Timeline for Phases 1-4**: v1.0 or v1.1?
   - **Recommendation**: Phase 1 before v1.0 (quick win), Phases 2-4 for v1.1

3. **Testing Strategy**: Manual only or add automated?
   - **Recommendation**: Manual for Phases 0-3, automated in Phase 4

4. **Code Review**: Single reviewer or full team?
   - **Recommendation**: Single reviewer for Phases 0-2, full team for Phase 3

---

## Key Takeaways

1. **Critical Bug Found**: SearchTab settings completely broken, must fix before v1.0
2. **Clear Solution**: Domain Hooks pattern is proven and works well
3. **Phased Approach**: Reduces risk, allows incremental progress
4. **Low Risk**: Following established pattern, small sprints
5. **High Impact**: Fixes critical bug, improves maintainability by 50%
6. **Alpha Freedom**: No backward compatibility required, clean refactor possible

---

## Lessons Learned

1. **Comprehensive Planning Pays Off**: Previous analysis (2025-11-02) made planning this epic straightforward
2. **Document Everything**: ADRs, epics, sprints, memory bank all contribute to continuity
3. **Small Sprints**: Phase 0 (2 hours) is achievable and low-risk
4. **Proven Patterns**: Following usePublishing as a model reduces uncertainty
5. **User Focus**: Critical bug must be fixed before v1.0, even if architecture work is deferred

---

**Status**: 📋 Planning Complete - Ready for Implementation
**Documents Created**: 8 (ADR + Epic + 5 Sprints + README + Memory Bank)
**Total Lines**: ~2,500 lines of planning documentation
**Next**: Begin Sprint 01 implementation

---

**Session End**: 2025-11-03
**Claude Code Session**: Settings Architecture Planning
**User Feedback**: (To be collected)

---

## Quick Reference

**Start Implementation**:
1. Read: [ADR](../docs/adr/2025-11-03-unified-settings-architecture.md)
2. Understand: [Epic Overview](../.todo/epics/epic-unified-settings-architecture-2025-11-03/epic-unified-settings-architecture.md)
3. Begin: [Sprint 01](../.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/01-searchtab-urgent-fix.md)

**Reference Implementations**:
- `src/presentation/webview/hooks/domain/usePublishing.ts` - Clean hook model
- `src/presentation/webview/hooks/domain/useSettings.ts` - Larger hook (to be refactored)
- `src/presentation/webview/hooks/useMessageRouter.ts` - Strategy pattern
- `src/presentation/webview/hooks/usePersistence.ts` - State composition
