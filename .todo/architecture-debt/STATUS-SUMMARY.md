# Architecture Debt Status Summary

**Last Updated**: 2025-12-06
**Total Items**: 20
**Resolved**: 12 (archived)
**Pending**: 8

---

## ✅ RESOLVED (12 items) → Archived

All resolved items have been moved to `archived/` with resolution headers.

| File | Resolved | PR/Commit | Sprint |
|------|----------|-----------|--------|
| [word-counter-component](archived/2025-11-02-word-counter-component.md) | 2025-11-24 | PR #39 | Sub-Epic 2, Sprint 04 |
| [useeffect-extraction-pattern](archived/2025-11-05-useeffect-extraction-pattern.md) | 2025-11-17 | PR #44 | Sub-Epic 3, Sprint 05 |
| [settings-hooks-unit-tests](archived/2025-11-06-settings-hooks-unit-tests.md) | 2025-11-15 | Commit f0c08ac | Sub-Epic 3, Sprint 06 |
| [standards-service-responsibility-violation](archived/2025-11-13-standards-service-responsibility-violation.md) | 2025-11-15 | PR #41 | Sub-Epic 3, Sprint 01 |
| [error-boundary-needed](archived/2025-11-19-error-boundary-needed.md) | 2025-12-04 | PR #46 | Sub-Epic 4, Sprint 01 |
| [loading-widget-status-integration](archived/2025-11-19-loading-widget-status-integration.md) | 2025-11-22 | PR #37 | Sub-Epic 2, Sprint 02 |
| [prop-drilling-and-type-safety](archived/2025-11-19-prop-drilling-and-type-safety.md) | 2025-11-22 | PR #34 | Sub-Epic 1, Sprint 03 |
| [react-memo-performance](archived/2025-11-19-react-memo-performance.md) | 2025-12-04 | PR #47 | Sub-Epic 4, Sprint 02 |
| [scope-box-component-extraction](archived/2025-11-19-scope-box-component-extraction.md) | 2025-11-22 | PR #36 | Sub-Epic 2, Sprint 01 |
| [subtab-panel-extraction](archived/2025-11-19-subtab-panel-extraction.md) | 2025-11-22 | PR #38 | Sub-Epic 2, Sprint 03 |
| [request-cancellation-ui-exposure](archived/2025-11-21-request-cancellation-ui-exposure.md) | 2025-12-06 | PR #49 | Sub-Epic 4, Sprint 03 (v1.4.0) |
| [airesourcemanager-layer-violation](archived/2025-11-29-airesourcemanager-layer-violation.md) | 2025-11-29 | PR #42 | Sub-Epic 3, Sprint 03 |

---

## 🟡 PENDING (8 items)

### LOW Priority (5 items)

#### 1. Tailwind + Custom CSS Pattern
**File**: [2025-11-20-tailwind-custom-css-pattern.md](2025-11-20-tailwind-custom-css-pattern.md)
**Effort**: 2-4 hours
**Sprint**: Sub-Epic 4, Sprint 04 (Ready)

Tailwind configured but unused. Need to document hybrid pattern (custom CSS for reusables, Tailwind for one-offs).

---

#### 2. Streaming Hook Duplication
**File**: [2025-12-05-streaming-hook-duplication.md](2025-12-05-streaming-hook-duplication.md)
**Effort**: 0.5-1 day
**Identified**: v1.4.0 (PR #49)

~180 lines of streaming orchestration logic duplicated across useAnalysis, useContext, useDictionary. Recommend extracting shared `useDomainStreaming` helper.

---

#### 3. Cancel Message Duplication
**File**: [2025-12-05-cancel-message-duplication.md](2025-12-05-cancel-message-duplication.md)
**Effort**: <0.5 day
**Identified**: v1.4.0 (PR #49)

Cancel message construction repeated across AnalysisTab & UtilitiesTab. Small UI helper extraction.

---

#### 4. AI Orchestrator Loop Duplication
**File**: [2025-11-25-ai-resource-orchestrator-loop-duplication.md](2025-11-25-ai-resource-orchestrator-loop-duplication.md)
**Effort**: 2-3 hours

Multi-turn loop pattern (~200 lines) duplicated in `executeWithAgentCapabilities` and `executeWithContextResources`. Can extract to generic loop when needed.

---

#### 5. Large File Review
**File**: [2025-11-19-large-file-review-needed.md](2025-11-19-large-file-review-needed.md)
**Effort**: TBD

10 files exceed size guidelines. Review opportunistically when modifying.

---

### MEDIUM Priority (3 items)

#### 6. Token Usage Standardization
**File**: [2025-11-18-token-usage-standardization.md](2025-11-18-token-usage-standardization.md)
**Effort**: 3-4 hours

Infrastructure complete for centralization in AIResourceOrchestrator. Services need cleanup to use unified pattern.

---

#### 7. Domain Hooks JSDoc Completion
**File**: [2025-11-06-domain-hooks-jsdoc-completion.md](2025-11-06-domain-hooks-jsdoc-completion.md)
**Effort**: 1-2 hours

Only `useWordSearchSettings` has comprehensive JSDoc. 6 other hooks need enhancement.

---

#### 8. Settings Integration Tests
**File**: [2025-11-06-settings-integration-tests.md](2025-11-06-settings-integration-tests.md)
**Effort**: 4 hours

No integration tests for settings sync flow. Deferred - unit tests provide sufficient coverage.

---

## Summary Statistics

| Category | Count | Notes |
|----------|-------|-------|
| **Resolved** | 12 | All moved to `archived/` |
| **Pending** | 8 | LOW: 5, MEDIUM: 3 |
| **Total** | 20 | - |

---

## Recent Achievements (v1.4.0)

**Sub-Epic 4, Sprint 03** (PR #49, 2025-12-06):
- ✅ Streaming responses for Analysis, Context, Dictionary
- ✅ Request cancellation UI with AbortSignal threading
- ✅ Race condition protection (new request cancels old)
- ✅ Memory leak fix (clear ignored request IDs)

**New Debt Identified**:
- Streaming Hook Duplication (180 lines across 3 hooks)
- Cancel Message Duplication (small extraction)

---

## Recommendation

**Epic Status**: Architecture Health Pass v1.3 is 94% complete (17/18 sprints).

**Remaining Work**:
1. **Sprint 04**: CSS Pattern Standardization (LOW priority, 2-4h)
2. **Future**: Streaming hook extraction when pattern stabilizes

**v1.4.0 Ready**: All critical and high-priority debt resolved. Codebase is healthy.

---

**Last Reviewed**: 2025-12-06
**Next Review**: After Epic completion or v1.5 planning
