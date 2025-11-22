# Memory Bank: Architecture Health Pass (v1.3) Planning

**Date**: 2025-11-21
**Time**: 18:30
**Event**: Comprehensive architecture debt planning session
**Status**: Planning Complete - Ready to Execute

---

## Context

User just released v1.2.0 and wants to do a "healthy architecture pass" before adding new features. Architecture debt has accumulated:
- 7 items from STATUS-SUMMARY (5 resolved, 7 pending)
- 13 new items identified in November 2025
- **Total**: 20 pending architecture debt items

---

## User Requirements

1. **Resolve architecture debt across all layers** before new features
2. **Component decomposition** (break down god components)
3. **DRY fixes** (eliminate duplication)
4. **Message grab bag corrections** (organize formatters, types)
5. **Even abort/cancellation should wait** for clean architecture

User's instinct: "I want to make a healthy architecture pass before marching forward."

---

## Key Clarifications Received

### 1. Loading Widget Status Integration

**User clarification**: "Should be its own component but integrated with LoadingWidget so they travel together. Add progress bar from fast-dictionary."

**Action taken**:
- Updated debt item to specify **single unified component**
- Integrates: status + spinner + progress bar + token cost + guide ticker
- Increased effort: 2-3 hrs → 3-4 hrs
- Updated plan accordingly

### 2. Token Usage Standardization

**User clarification**: "Token messages should be emitted from AIOrchestrator so parsing tokens/cost only happens in one place, automatically for all requests."

**Action taken**:
- Expanded scope from return format standardization to **centralized orchestrator pattern**
- AIOrchestrator emits TOKEN_USAGE messages automatically
- Services no longer track tokens (single source of truth)
- Priority: LOW → MEDIUM
- Effort: 1-2 hrs → 3-4 hrs
- Updated plan accordingly

---

## Deliverables Created

### 1. Updated Architecture Debt Items

**File**: `.todo/architecture-debt/2025-11-19-loading-widget-status-integration.md`
- Added progress bar requirement
- Single unified component pattern
- Updated effort estimate

**File**: `.todo/architecture-debt/2025-11-18-token-usage-standardization.md`
- Expanded to AIOrchestrator centralization
- 5-phase implementation plan
- Updated priority and effort

### 2. Comprehensive Plan

**File**: `.todo/ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md`

**Structure**: 4 sequential epics, 16 sprints, 7-11 days total

**Epic 1: Foundation Cleanup** (2-3 days)
- Result Formatter Decomposition (3-4 hrs) - HIGH
- Shared Types & Imports Hygiene (4-6 hrs, 3 phases) - MEDIUM
- Prop Drilling & Type Safety (4-6 hrs) - HIGH

**Epic 2: Component Decomposition** (2-3 days)
- Scope Box Extraction (2-3 hrs)
- Loading Widget Status Integration (3-4 hrs)
- Subtab Panel Extraction (3-4 hrs)
- Word Counter Component (< 2 hrs)

**Epic 3: Standards & Testing** (2-3 days)
- StandardsService Responsibility Violation (1-2 hrs)
- Token Usage Centralization (3-4 hrs)
- Domain Hooks JSDoc Completion (1-2 hrs)
- useEffect Extraction Pattern (2-4 hrs)
- Settings Hooks Unit Tests (1 day, if needed)

**Epic 4: Polish & UX** (1-2 days)
- Error Boundary (1-2 hrs)
- React.memo Performance (2-3 hrs)
- Request Cancellation UI (4-6 hrs)
- Tailwind + Custom CSS Pattern (2-4 hrs)

### 3. Quick Start Guide

**File**: `.todo/QUICKSTART-EPIC-1.md`

Provides:
- Why Epic 1 first (foundations)
- Detailed checklists for each sprint
- Acceptance criteria
- What you can do after Epic 1

### 4. Memory Bank Entry

**File**: `.memory-bank/20251121-1830-architecture-health-pass-planning.md` (this file)

---

## Key Decisions

### 1. Sequential Epics (Not Parallel)

**Rationale**: Dependencies flow clearly

```
Epic 1 (Foundation) → Type safety, clean imports
    ↓
Epic 2 (Components) → Needs typed interfaces from Epic 1
    ↓
Epic 3 (Standards) → Builds on clean architecture
    ↓
Epic 4 (Polish) → Enhancements on solid foundation
```

### 2. Epic 1 First (Foundation Cleanup)

**Why?**
- Fixes biggest violation (763-line grab bag)
- Establishes type safety (catch bugs early)
- Cleans imports (better DX)
- Unblocks all component extraction

**What can't be done yet?**
- Component extraction (needs type safety)
- Cancellation UI (needs LoadingIndicator from Epic 2)
- Performance (needs clean components)

### 3. Deferred Items

**Settings Integration Tests** (1-2 days)
- Lower ROI than unit tests
- Defer to v1.4+

**Large File Review** (TBD)
- Review opportunistically
- No immediate action

---

## Architecture Debt Breakdown

| Priority | Count | Items |
|----------|-------|-------|
| 🔴 HIGH | 3 | Result Formatter, Prop Drilling, Token Centralization |
| 🟡 MEDIUM | 12 | Shared Types, Subtab Panels, Scope Box, Loading Widget, etc. |
| 🔵 LOW | 4 | Word Counter, Tailwind Pattern, Large Files |
| ✅ RESOLVED | 5 | Settings architecture items from Unified Settings Epic |

**Total Pending**: 20 items
**Total Effort**: 7-11 days
**Total Sprints**: 16

---

## Dependency Highlights

**Critical Path**:
1. **Result Formatter** → Enables clean imports for component extraction
2. **Shared Types** → Enables clean imports everywhere
3. **Prop Drilling & Type Safety** → Enables safe component refactoring
4. **Scope Box** → Required by Subtab Panel extraction
5. **Loading Indicator** → Required by Error Boundary + Cancellation UI

**Parallel Work Opportunities** (within epics):
- Epic 1: Sprints are sequential (type safety first)
- Epic 2: Scope Box + Loading Indicator can be parallel, then Subtab Panels
- Epic 3: Most sprints can be parallel (independent improvements)
- Epic 4: Most sprints can be parallel (UX enhancements)

---

## Success Metrics

**After Epic 1**:
- ✅ No grab bag files > 400 lines
- ✅ All types in domain files
- ✅ Zero `../../../` imports
- ✅ All VSCode API calls typed
- ✅ All message handlers typed

**After Epic 2**:
- ✅ SearchTab ~150 lines (down from 666)
- ✅ MetricsTab ~150 lines (down from 413)
- ✅ 4 shared components extracted
- ✅ No DRY violations in UI

**After Epic 3**:
- ✅ Architectural compliance (SRP)
- ✅ Centralized token tracking
- ✅ Comprehensive JSDoc
- ✅ Robust test coverage

**After Epic 4**:
- ✅ Graceful error handling
- ✅ Optimized performance
- ✅ User-cancellable operations
- ✅ Consistent CSS patterns

**Final Architecture Score**: 9.8/10 → 10/10

---

## Recommendations for Execution

### Start Here

1. **Read**: `.todo/QUICKSTART-EPIC-1.md`
2. **Create Epic 1 ADR**: `docs/adr/2025-11-21-foundation-cleanup-epic.md`
3. **Create Epic folder**: `.todo/epics/epic-foundation-cleanup-2025-11-21/`
4. **Start Sprint 01**: Result Formatter Decomposition

### Branch Strategy

Each sprint gets its own branch:
- `sprint/epic-foundation-cleanup-2025-11-21-01-result-formatter`
- `sprint/epic-foundation-cleanup-2025-11-21-02-types-imports`
- `sprint/epic-foundation-cleanup-2025-11-21-03-type-safety`

### PR Strategy

Each sprint gets its own PR:
- PR references sprint doc
- PR references architecture debt item(s)
- PR includes before/after metrics
- Merge to main after review

---

## Files Created/Updated

**Created**:
- `.todo/ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md` (comprehensive plan)
- `.todo/QUICKSTART-EPIC-1.md` (quick start guide)
- `.memory-bank/20251121-1830-architecture-health-pass-planning.md` (this file)

**Updated**:
- `.todo/architecture-debt/2025-11-19-loading-widget-status-integration.md`
  - Added progress bar requirement
  - Single unified component
  - Effort: 2-3 hrs → 3-4 hrs

- `.todo/architecture-debt/2025-11-18-token-usage-standardization.md`
  - Expanded to AIOrchestrator centralization
  - Priority: LOW → MEDIUM
  - Effort: 1-2 hrs → 3-4 hrs

---

## Next Session

**Expected Work**: Epic 1, Sprint 01 - Result Formatter Decomposition

**Prepare**:
1. Review debt item: `.todo/architecture-debt/2025-11-19-result-formatter-grab-bag.md`
2. Create ADR for Epic 1
3. Create epic folder structure
4. Start Sprint 01

**Context to Provide**:
- "Working on Epic 1, Sprint 01: Result Formatter Decomposition"
- "Following plan in `.todo/ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md`"
- "Using checklist from `.todo/QUICKSTART-EPIC-1.md`"

---

## Key Quotes from Planning Session

> "I need some planning help :( there's so many architecture-debt items and adrs. I need to decide what order to do them in."

> "I just released version 1.2, and I think I just hold off on new features and we resolve architecture debt issues in all the layers so that it's easier to add new features, functionality, etc."

> "I have lots of ideas but I want to make a healthy architecture pass before marching forward."

> "Even things like connecting aborts to the AIO need to want for the component decomposition, DRY fixes, and message grab bag corrections (i think)."

**User's instinct was correct**: Foundation must come first.

---

**Last Updated**: 2025-11-21 18:30
**Author**: Claude Code (AI Agent)
**Status**: Planning complete, ready for Epic 1 execution
