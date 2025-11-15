# Epic: Technical Debt Cleanup

**Created**: 2025-11-15
**Status**: 🟢 Active
**Priority**: High
**Estimated Duration**: 2-3 days

---

## Context

Following the successful completion of the Infrastructure Testing Epic (PR #25), we now have a solid testing foundation (124 tests, 43.1% coverage). This epic addresses 3 remaining medium-priority architecture debt items that will improve code quality, maintainability, and test coverage.

**Architecture Debt Status**:
- ✅ 5 RESOLVED (all settings-related, completed via Unified Settings Architecture epic)
- 🟡 7 PENDING (1 HIGH, 4 MEDIUM, 1 LOW, 1 DOC)

This epic targets 3 of the pending items in priority order.

---

## Goals

1. **Fix StandardsService Responsibility Violation** (MEDIUM)
   - Move `computePerFileStats()` from StandardsService to ProseStatsService
   - Restore Single Responsibility Principle
   - Write tests before refactoring (test-first approach)

2. **Add Settings Hooks Unit Tests** (HIGH)
   - Create comprehensive unit tests for all 6 settings hooks
   - Achieve >80% coverage for settings hooks
   - Establish testing patterns for future hooks

3. **Extract useEffect Logic to Named Methods** (MEDIUM)
   - Extract inline useEffect logic across domain hooks
   - Improve testability and code readability
   - Apply consistent pattern (self-documenting method names)

---

## Success Criteria

- ✅ StandardsService only handles standards concerns (no measurement orchestration)
- ✅ ProseStatsService owns all prose stats analysis (single file or multiple files)
- ✅ Manuscript mode tested and working (no regressions)
- ✅ All 6 settings hooks have comprehensive unit tests
- ✅ Settings hooks coverage >80%
- ✅ useEffect logic extracted to named methods across domain hooks
- ✅ No regressions in existing functionality

---

## References

**Architecture Debt Items**:
- [2025-11-13: StandardsService Responsibility Violation](.todo/architecture-debt/2025-11-13-standards-service-responsibility-violation.md)
- [2025-11-06: Settings Hooks Unit Tests](.todo/architecture-debt/2025-11-06-settings-hooks-unit-tests.md)
- [2025-11-05: useEffect Extraction Pattern](.todo/architecture-debt/2025-11-05-useeffect-extraction-pattern.md)

**Related Documents**:
- [Architecture Debt Status Summary](.todo/architecture-debt/STATUS-SUMMARY.md)
- [Testing Documentation](docs/TESTING.md)
- [Infrastructure Testing Epic](.todo/epics/epic-infrastructure-testing-2025-11-15/epic-infrastructure-testing.md)

---

## Sprints

### Sprint 01: StandardsService Responsibility Fix (2-3 hours)
**Status**: 🟢 Active
**Branch**: `epic/technical-debt-cleanup-2025-11-15`

**Scope**: Move `computePerFileStats()` from StandardsService to ProseStatsService using test-first approach.

**Tasks**:
1. Write test for current `computePerFileStats()` behavior
2. Add `analyzeMultipleFiles()` to ProseStatsService
3. Move `findUriByRelativePath` helper to ProseStatsService
4. Update MetricsHandler to use new method
5. Remove `computePerFileStats` from StandardsService
6. Remove `ProseStatsAnalyzer` interface
7. Test manuscript mode (multi-file aggregation)

**See**: [sprints/01-standards-service-responsibility-fix.md](sprints/01-standards-service-responsibility-fix.md)

---

### Sprint 02: Settings Hooks Unit Tests (1 day)
**Status**: ⏳ Pending
**Branch**: TBD

**Scope**: Create comprehensive unit tests for all 6 settings hooks.

**Tasks**:
1. Set up hook testing infrastructure (mocks, utilities)
2. Create test template from first hook
3. Write tests for all 6 hooks (6 test cases minimum each)
4. Achieve >80% coverage for settings hooks
5. Document testing patterns

**See**: [sprints/02-settings-hooks-unit-tests.md](sprints/02-settings-hooks-unit-tests.md)

---

### Sprint 03: useEffect Extraction Pattern (2-4 hours)
**Status**: ⏳ Pending
**Branch**: TBD

**Scope**: Extract inline useEffect logic to named, testable methods.

**Tasks**:
1. Extract effects in domain hooks (8 hooks)
2. Establish consistent naming pattern (`request*`, `sync*`, `initialize*`)
3. Update hook implementations
4. Verify no regressions (existing tests should pass)
5. Document pattern in CLAUDE.md

**See**: [sprints/03-useeffect-extraction-pattern.md](sprints/03-useeffect-extraction-pattern.md)

---

## Epic Timeline

**Day 1**:
- Morning: Sprint 01 (StandardsService fix) - 2-3 hours
- Afternoon: Sprint 02 start (Settings Hooks tests setup + first hook) - 3-4 hours

**Day 2**:
- Full day: Sprint 02 completion (remaining 5 hooks + CI integration) - 6-8 hours

**Day 3**:
- Morning: Sprint 03 (useEffect extraction) - 2-4 hours
- Afternoon: Epic completion, documentation, archival

**Total**: 2-3 days

---

## Risks and Mitigation

**Risk 1**: StandardsService refactor breaks manuscript mode
- **Mitigation**: Test-first approach (write test before moving code)
- **Validation**: Manual testing of manuscript mode with multiple chapters

**Risk 2**: Settings hooks tests take longer than estimated
- **Mitigation**: Create template from first hook, copy pattern to remaining 5
- **Fallback**: Complete 3-4 hooks in this epic, defer remaining to future sprint

**Risk 3**: useEffect extraction introduces regressions
- **Mitigation**: Run existing tests after each extraction
- **Validation**: Settings Hooks tests (from Sprint 02) will catch regressions

---

## Notes

**Why This Order?**

1. **StandardsService First**:
   - Quick win (2-3 hours)
   - Test-first approach (30 min investment protects critical feature)
   - Cleans up Single Responsibility violation

2. **Settings Hooks Tests Second**:
   - High priority (catches regressions automatically)
   - Foundation for future testing
   - Will validate useEffect extractions in Sprint 03

3. **useEffect Extraction Last**:
   - Tests exist to prevent regression (from Sprint 02)
   - Lower risk with test coverage in place
   - Improves maintainability without breaking functionality

**Post-Epic State**:
- Architecture debt: 4 items remaining (2 MEDIUM, 1 LOW, 1 DOC)
- Test coverage: >50% (estimated, up from 43.1%)
- Code quality: Improved (SRP violations fixed, better testability)
- Velocity: Faster (automated tests catch regressions)

---

**Last Updated**: 2025-11-15
**Next Review**: After Sprint 01 completion
