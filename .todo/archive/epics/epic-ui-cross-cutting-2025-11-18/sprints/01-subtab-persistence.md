# Sprint 01: Subtab Persistence

**Sprint ID**: 01-subtab-persistence
**Epic**: [UI Cross-Cutting Improvements](../epic-ui-cross-cutting.md)
**Status**: Pending
**Estimated Effort**: 0.25 days
**Branch**: `sprint/epic-ui-cross-cutting-2025-11-18-01-subtab-persistence`
**ADR**: [ADR-2025-11-18](../../../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md)

## Goal

Persist subtab selection across sessions for all modules with subtabs.

## Scope

### In Scope
- SearchTab: word/category subtab persistence
- MetricsTab: audit for subtabs
- Pattern documentation for future modules

### Out of Scope
- Other UI state persistence
- Cancellable loading (Sprint 02)

## Tasks

### 1. Audit Modules for Subtabs
- [ ] SearchTab - confirmed: word/category
- [ ] MetricsTab - check for subtabs
- [ ] AnalysisTab - check for subtabs
- [ ] UtilitiesTab - check for subtabs

### 2. Extend useSearch Persistence
**File**: `src/presentation/webview/hooks/domain/useSearch.ts`

- [ ] Add to `SearchPersistence` interface:
  ```typescript
  interface SearchPersistence {
    // existing...
    activeSubtool?: 'word' | 'category';
  }
  ```
- [ ] Include in `persistedState` return
- [ ] Add to hook state initialization from persistence

### 3. Update SearchTab Component
**File**: `src/presentation/webview/components/SearchTab.tsx`

- [ ] Accept `initialSubtool` prop from parent
- [ ] Use as initial value for useState
- [ ] Report changes back via callback for persistence

### 4. Wire in App.tsx
**File**: `src/presentation/webview/App.tsx`

- [ ] Pass search.activeSubtool to SearchTab
- [ ] Handle subtab change callback
- [ ] Include in persistence composition

### 5. Apply Pattern to Other Modules (if applicable)
- [ ] Repeat for MetricsTab if it has subtabs
- [ ] Document pattern for future reference

## Acceptance Criteria

- [ ] Switch to Category Search tab, reload webview - Category tab still selected
- [ ] Switch to Word Search tab, reload webview - Word tab still selected
- [ ] Pattern works for any module with subtabs

## Testing Checklist

**Test Case 1: SearchTab Persistence**
- Input: Select Category Search, reload webview
- Expected: Category Search still selected
- Result: /

**Test Case 2: Default Behavior**
- Input: Fresh install (no persisted state)
- Expected: Default subtab selected (word)
- Result: /

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] No TypeScript errors
- [ ] PR ready for review

## Outcomes

*To be filled after sprint completion*

- **PR**: #[number]
- **Completion Date**: YYYY-MM-DD
- **Actual Effort**: [hours/days]
- **Modules Updated**: [list]
