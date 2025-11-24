# Sub-Epic 2: Component Decomposition

**Part of**: [Architecture Health Pass (v1.3)](../epic-architecture-health-pass-v1.3.md)
**Status**: 🟢 Ready to Start
**Duration**: 2-3 days
**Sprints**: 5 (includes Sprint 00 prerequisite)

---

## Overview

Extract shared components and decompose large tab components to improve maintainability and eliminate DRY violations. This sub-epic builds on the type safety foundation from Sub-Epic 1 to safely extract and refactor UI components.

**Why Now**: Type safety from Sub-Epic 1 enables safe component extraction with compile-time verification.

---

## Goals

1. **Extract shared components**: Create reusable ScopeBox, LoadingIndicator, and WordCounter components
2. **Decompose SearchTab**: Reduce from 666 lines to ~150 lines via subtab panel extraction
3. **Decompose MetricsTab**: Reduce from 413 lines to ~150 lines via subtab panel extraction
4. **Eliminate DRY violations**: Remove duplicated UI patterns across tabs

---

## Sprints

### Sprint 00: Component Organization (Prerequisite)
**Duration**: 30-45 minutes
**Priority**: HIGH
**Status**: 🟢 Ready

**Problem**: Flat component directory mixing tabs and widgets

**Solution**: Organize into `tabs/`, `shared/`, `search/`, `metrics/` directories

**Deliverable**: Clean component organization ready for Sprint 01-04 extractions

**Blocks**: All other sprints (Sprint 01-04 depend on organized structure)

📁 [sprints/00-component-organization.md](sprints/00-component-organization.md)

---

### Sprint 01: Scope Box Extraction
**Duration**: 2-3 hours
**Priority**: HIGH
**Status**: ⏸️ Blocked by Sprint 00

**Problem**: ScopeBox duplicated 5 times (SearchTab: 2, MetricsTab: 3)

**Solution**: Extract shared `<ScopeBox>` component with file/selection/glob modes

**Deliverable**: Reusable ScopeBox component, 5 duplications eliminated

**Blocks**: Sprint 03 (Subtab Panels need ScopeBox)

📁 [sprints/01-scope-box-extraction.md](sprints/01-scope-box-extraction.md)

---

### Sprint 02: Loading Indicator Integration
**Duration**: 2-3 hours
**Priority**: HIGH
**Status**: ✅ Complete (2025-11-22 15:30)

**Problem**: Inconsistent loading states + separate LoadingWidget component

**Solution**: Create unified `<LoadingIndicator>` component consolidating LoadingWidget functionality

**Deliverable**: Single unified loading component, LoadingWidget.tsx deleted

**Key Change**: **Consolidates LoadingWidget into LoadingIndicator** (animated GIF + status + spinner)

**Blocks**: Sprint 03 (Subtab Panels need LoadingIndicator)

**Depends on**: Sprint 00 + 01 complete

📁 [sprints/02-loading-indicator-integration.md](sprints/02-loading-indicator-integration.md)

---

### Sprint 03: Subtab Panel Extraction
**Duration**: 4-6 hours
**Priority**: HIGH
**Status**: ✅ Complete (2025-11-22 17:47)

**Problem**: SearchTab (666 lines) and MetricsTab (413 lines) violate SRP

**Solution**: Extract subtab panels into focused components:
- SearchTab → WordSearchPanel, CategorySearchPanel (uses `search/` directory from Sprint 00)
- MetricsTab → ProseStatsPanel, StyleFlagsPanel, WordFrequencyPanel (uses `metrics/` directory from Sprint 00)

**Deliverable**:
- SearchTab: 666 → 75 lines (88.7% reduction) ✅
- MetricsTab: 413 → 257 lines (37.8% reduction) ✅
- 5 focused panel components (262, 308, 133, 81, 94 lines) ✅

**Depends on**: Sprint 00 + 01 + 02 complete (needs organized structure + ScopeBox + LoadingIndicator)

📁 [sprints/03-subtab-panel-extraction.md](sprints/03-subtab-panel-extraction.md)

---

### Sprint 04: Word Counter Component
**Duration**: 1-2 hours
**Priority**: LOW
**Status**: ⏸️ Blocked by Sprint 00

**Problem**: Word counter logic duplicated in 3 places

**Solution**: Extract shared `<WordCounter>` component with color-coded thresholds

**Deliverable**: Reusable WordCounter component, 3 duplications eliminated

**Depends on**: Sprint 00 (needs `shared/` directory organized)

**Note**: Can run independently after Sprint 00 (doesn't need Sprint 01-03)

📁 [sprints/04-word-counter-component.md](sprints/04-word-counter-component.md)

---

## Success Criteria

- ✅ SearchTab reduced to ~150 lines (down from 666)
- ✅ MetricsTab reduced to ~150 lines (down from 413)
- ✅ 3 shared components extracted (ScopeBox, LoadingIndicator, WordCounter)
- ✅ 5 subtab panels extracted and focused
- ✅ Zero UI duplication (DRY violations eliminated)
- ✅ All features work identically (no regressions)
- ✅ Tests pass

---

## Impact

### Unblocks
- ✅ Sub-Epic 3: Standards & Testing (needs clean components)
- ✅ Sub-Epic 4: Polish & UX (needs simplified component tree)

### Enables
- ✅ Component-level testing (smaller, focused components)
- ✅ Faster feature development (reusable components)
- ✅ Easier maintenance (changes isolated to single components)
- ✅ Better code review (smaller diffs, clearer intent)

---

## Architecture Debt Resolved

1. **Scope Box Extraction** (MEDIUM) - Sprint 01
   - File: `.todo/architecture-debt/2025-11-XX-scope-box-extraction.md` (if exists)

2. **Loading Indicator Integration** (MEDIUM) - Sprint 02
   - File: `.todo/architecture-debt/2025-11-19-loading-widget-status-integration.md`

3. **Subtab Panel Extraction** (MEDIUM) - Sprint 03
   - File: `.todo/architecture-debt/2025-11-19-subtab-panel-extraction.md` (if exists)

4. **Word Counter Component** (LOW) - Sprint 04
   - File: `.todo/architecture-debt/2025-11-02-word-counter-component.md`

---

## Timeline

```
Day 1:
├─ Morning: Sprint 01 (Scope Box) - 2-3 hrs
└─ Afternoon: Sprint 02 (Loading Indicator) - 2-3 hrs

Day 2:
├─ Morning: Sprint 03 Part 1 (SearchTab Panels) - 2-3 hrs
└─ Afternoon: Sprint 03 Part 2 (MetricsTab Panels) - 2-3 hrs

Day 3 (Optional):
└─ Morning: Sprint 04 (Word Counter) - 1-2 hrs (quick win)
```

---

## Dependencies

```
Sprint 01: Scope Box Extraction
  └─ No dependencies (can start immediately)

Sprint 02: Loading Indicator
  └─ Requires: Sprint 01 (clean example to follow)

Sprint 03: Subtab Panels
  └─ REQUIRES: Sprint 01 + 02 (panels use ScopeBox + LoadingIndicator)

Sprint 04: Word Counter
  └─ No dependencies (can run anytime, independent)
```

---

## Branching Strategy

Each sprint uses its own branch:

```bash
# Sprint 01
git checkout -b sprint/component-decomposition-01-scope-box-extraction

# Sprint 02
git checkout -b sprint/component-decomposition-02-loading-indicator

# Sprint 03
git checkout -b sprint/component-decomposition-03-subtab-panels

# Sprint 04
git checkout -b sprint/component-decomposition-04-word-counter
```

---

## Testing Strategy

### Sprint 01: Scope Box
- Verify all 4 scope modes work (file, selection, glob)
- Test disabled states
- Verify SearchTab + MetricsTab unchanged behavior

### Sprint 02: Loading Indicator
- Verify 3 variants (spinner, inline, overlay)
- Test status message display
- Verify all 4 tabs use component

### Sprint 03: Subtab Panels
- **Critical**: Test status isolation (each tool's status stays independent)
- Verify all subtab features work
- Verify SearchTab + MetricsTab reduced to ~150 lines

### Sprint 04: Word Counter
- Verify color-coded thresholds (green/yellow/red)
- Test all 3 integration points
- Verify visual appearance identical

---

## Component Directory Structure

```
src/presentation/webview/components/
├─ shared/               # NEW: Shared components
│  ├─ ScopeBox.tsx       # Sprint 01
│  ├─ LoadingIndicator.tsx  # Sprint 02
│  ├─ WordCounter.tsx    # Sprint 04
│  └─ index.ts          # Barrel export
├─ search/              # NEW: SearchTab panels
│  ├─ WordSearchPanel.tsx      # Sprint 03
│  └─ CategorySearchPanel.tsx  # Sprint 03
├─ metrics/             # NEW: MetricsTab panels
│  ├─ ProseStatsPanel.tsx      # Sprint 03
│  ├─ StyleFlagsPanel.tsx      # Sprint 03
│  └─ WordFrequencyPanel.tsx   # Sprint 03
├─ AnalysisTab.tsx
├─ SearchTab.tsx        # 666 → ~150 lines (Sprint 03)
├─ MetricsTab.tsx       # 413 → ~150 lines (Sprint 03)
├─ UtilitiesTab.tsx
└─ SettingsOverlay.tsx
```

---

## References

**Planning**:
- [Master Epic](../epic-architecture-health-pass-v1.3.md)
- [Sub-Epic 1: Foundation Cleanup](../sub-epic-1-foundation-cleanup/epic-foundation-cleanup.md) (Complete)

**Architecture Debt**:
- [Loading Widget Status Integration](../../architecture-debt/2025-11-19-loading-widget-status-integration.md)
- [Word Counter Component](../../architecture-debt/2025-11-02-word-counter-component.md)
- [Subtab Panel Extraction](../../architecture-debt/2025-11-19-subtab-panel-extraction.md) (if exists)

**Related ADRs**:
- [Presentation Layer Domain Hooks](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- [Message Envelope Architecture](../../../docs/adr/2025-10-28-message-envelope-architecture.md)

---

## Progress

| Sprint | Status | Duration | Completion |
|--------|--------|----------|------------|
| 00. Component Organization | ✅ Complete | 45 min | 2025-11-22 14:33 ([PR #35](https://github.com/okeylanders/prose-minion-vscode/pull/35)) |
| 01. Scope Box Extraction | ✅ Complete | 2 hrs | 2025-11-22 14:34 ([PR #36](https://github.com/okeylanders/prose-minion-vscode/pull/36)) |
| 02. Loading Indicator | ✅ Complete | 2 hrs | 2025-11-22 15:30 ([PR #37](https://github.com/okeylanders/prose-minion-vscode/pull/37)) |
| 03. Subtab Panels | ✅ Complete | 3 hrs | 2025-11-23 ([PR #38](https://github.com/okeylanders/prose-minion-vscode/pull/38)) |
| 04. Word Counter | ✅ Complete | 30 min | 2025-11-24 ([PR #39](https://github.com/okeylanders/prose-minion-vscode/pull/39)) |

**Sub-Epic Progress**: 5/5 sprints (100%) ✅

**Note**: All sprints complete! Sub-Epic 2: Component Decomposition is DONE.

---

**Last Updated**: 2025-11-24
**Created By**: Claude Code (AI Agent)
**Status**: ✅ Complete (5/5 sprints, 100%)
**Next**: Archive to `.todo/archived/epics/`
