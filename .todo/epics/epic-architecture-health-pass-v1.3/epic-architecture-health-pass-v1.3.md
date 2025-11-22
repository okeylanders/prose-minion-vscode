# Epic: Architecture Health Pass (v1.3)

**Created**: 2025-11-21
**Status**: Planning → In Progress
**Target**: Post-v1.2.0 Architecture Cleanup
**Duration**: 7-11 days (estimated)

---

## Overview

Comprehensive architecture debt resolution across all layers before adding new features. This epic consists of 4 sequential sub-epics that build on each other to achieve a healthy, maintainable architecture.

**Goal**: Fix foundations → Decompose components → Establish standards → Add polish

---

## Problem Statement

After v1.2.0 release, 20 architecture debt items have accumulated:
- 3 HIGH priority (grab bags, type safety, token centralization)
- 12 MEDIUM priority (component decomposition, DRY violations, patterns)
- 5 LOW priority (polish, documentation)

**User Requirement**: "I want to make a healthy architecture pass before marching forward."

**Key Insight**: Even features like request cancellation should wait for clean architecture (component decomposition, DRY fixes, message organization).

---

## Sub-Epics

### Sub-Epic 1: Foundation Cleanup ✅ Ready
**Status**: Ready to start
**Duration**: 2-3 days
**Sprints**: 3
**Why First**: Type safety and organized code unblock everything else

**Deliverables**:
- ✅ Result Formatter: 763 lines → 7 focused files
- ✅ Shared Types: Clean organization, import aliases
- ✅ Type Safety: Typed VSCode API, typed message handlers

**Blocks**: All component extraction work

📁 [sub-epic-1-foundation-cleanup/](sub-epic-1-foundation-cleanup/)

---

### Sub-Epic 2: Component Decomposition ⏳ Pending
**Status**: Waiting for Sub-Epic 1
**Duration**: 2-3 days
**Sprints**: 4

**Deliverables**:
- Extract shared components (ScopeBox, LoadingIndicator, WordCounter)
- Decompose SearchTab (666 → 150 lines)
- Decompose MetricsTab (413 → 150 lines)

**Requires**: Type safety from Sub-Epic 1

📁 *Will be created after Sub-Epic 1 completion*

---

### Sub-Epic 3: Standards & Testing ⏳ Pending
**Status**: Waiting for Sub-Epic 2
**Duration**: 2-3 days
**Sprints**: 5

**Deliverables**:
- Architectural compliance (StandardsService)
- Centralized token tracking (AIOrchestrator)
- Comprehensive documentation (JSDoc)
- Pattern standardization (useEffect extraction)
- Robust testing (if needed)

**Requires**: Clean components from Sub-Epic 2

📁 *Will be created after Sub-Epic 2 completion*

---

### Sub-Epic 4: Polish & UX ⏳ Pending
**Status**: Waiting for Sub-Epic 3
**Duration**: 1-2 days
**Sprints**: 4

**Deliverables**:
- Error boundary (graceful degradation)
- Performance optimization (React.memo)
- Request cancellation UI
- CSS pattern standardization

**Requires**: Clean architecture from Sub-Epic 3

📁 *Will be created after Sub-Epic 3 completion*

---

## Architecture Debt Summary

### HIGH Priority (3 items)
1. **Result Formatter Grab Bag** (Sub-Epic 1, Sprint 01)
2. **Prop Drilling & Type Safety** (Sub-Epic 1, Sprint 03)
3. **Token Usage Centralization** (Sub-Epic 3, Sprint 02)

### MEDIUM Priority (12 items)
- Shared Types & Imports (Sub-Epic 1, Sprint 02)
- Subtab Panel Extraction (Sub-Epic 2, Sprint 03)
- Scope Box Extraction (Sub-Epic 2, Sprint 01)
- Loading Widget Integration (Sub-Epic 2, Sprint 02)
- Request Cancellation UI (Sub-Epic 4, Sprint 03)
- Error Boundary (Sub-Epic 4, Sprint 01)
- React.memo Performance (Sub-Epic 4, Sprint 02)
- StandardsService Violation (Sub-Epic 3, Sprint 01)
- useEffect Extraction (Sub-Epic 3, Sprint 04)
- Domain Hooks JSDoc (Sub-Epic 3, Sprint 03)
- Settings Hooks Tests (Sub-Epic 3, Sprint 05)
- Settings Integration Tests (Deferred)

### LOW Priority (5 items)
- Word Counter Component (Sub-Epic 2, Sprint 04)
- Tailwind Pattern (Sub-Epic 4, Sprint 04)
- Large File Review (Deferred)

---

## Success Criteria

### After Sub-Epic 1 (Foundation)
- ✅ No grab bag files > 400 lines
- ✅ All types in domain files
- ✅ Zero `../../../` imports
- ✅ All VSCode API calls typed
- ✅ All message handlers typed

### After Sub-Epic 2 (Components)
- ✅ SearchTab ~150 lines (down from 666)
- ✅ MetricsTab ~150 lines (down from 413)
- ✅ 4 shared components extracted
- ✅ No DRY violations in UI

### After Sub-Epic 3 (Standards)
- ✅ Architectural compliance (SRP)
- ✅ Centralized token tracking
- ✅ Comprehensive JSDoc
- ✅ Robust test coverage

### After Sub-Epic 4 (Polish)
- ✅ Graceful error handling
- ✅ Optimized performance
- ✅ User-cancellable operations
- ✅ Consistent CSS patterns

**Final Architecture Score**: 9.8/10 → **10/10**

---

## Timeline

```
Week 1:
├─ Day 1-2: Sub-Epic 1 (Foundation Cleanup)
├─ Day 3-4: Sub-Epic 2 (Component Decomposition)
└─ Day 5: Sub-Epic 3 Start

Week 2:
├─ Day 6-7: Sub-Epic 3 Complete (Standards & Testing)
└─ Day 8-9: Sub-Epic 4 (Polish & UX)
```

---

## Dependencies Flow

```
Sub-Epic 1: Foundation Cleanup
  ├─ Result Formatter → Clean imports
  ├─ Shared Types → Clean organization
  └─ Type Safety → Safe refactoring
           ↓
Sub-Epic 2: Component Decomposition
  ├─ Scope Box → Shared component
  ├─ Loading Indicator → Unified UX
  ├─ Subtab Panels → REQUIRES Scope Box + Loading Indicator
  └─ Word Counter → Quick win
           ↓
Sub-Epic 3: Standards & Testing
  ├─ StandardsService → Compliance
  ├─ Token Centralization → DRY
  ├─ JSDoc → Documentation
  ├─ useEffect Extraction → Testability
  └─ Unit Tests → Quality
           ↓
Sub-Epic 4: Polish & UX
  ├─ Error Boundary → Resilience
  ├─ React.memo → Performance
  ├─ Request Cancellation → REQUIRES Loading Indicator
  └─ Tailwind Pattern → Consistency
```

---

## References

**Planning Documents**:
- [Comprehensive Plan](../../ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md)
- [Quick Start Guide](../../QUICKSTART-EPIC-1.md)
- [Memory Bank Entry](../../../.memory-bank/20251121-1830-architecture-health-pass-planning.md)

**Architecture Debt**:
- [Architecture Debt Directory](../../architecture-debt/)
- [Status Summary](../../architecture-debt/STATUS-SUMMARY.md)

**Related ADRs**:
- [ADR: Message Envelope Architecture](../../../docs/adr/2025-10-28-message-envelope-architecture.md)
- [ADR: Presentation Layer Domain Hooks](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- [ADR: Unified Settings Architecture](../../../docs/adr/2025-11-03-unified-settings-architecture.md)

---

## Progress Tracking

| Sub-Epic | Status | Progress | Completion Date |
|----------|--------|----------|-----------------|
| 1. Foundation Cleanup | 🔵 Ready | 0/3 sprints | - |
| 2. Component Decomposition | ⏸️ Blocked | 0/4 sprints | - |
| 3. Standards & Testing | ⏸️ Blocked | 0/5 sprints | - |
| 4. Polish & UX | ⏸️ Blocked | 0/4 sprints | - |

**Overall Progress**: 0/16 sprints complete (0%)

---

## Next Steps

1. **Start Sub-Epic 1**: [Foundation Cleanup](sub-epic-1-foundation-cleanup/)
2. **Begin Sprint 01**: Result Formatter Decomposition
3. **Branch**: `sprint/foundation-cleanup-01-result-formatter`

---

**Last Updated**: 2025-11-21
**Created By**: Claude Code (AI Agent)
**Status**: Ready to begin Sub-Epic 1
