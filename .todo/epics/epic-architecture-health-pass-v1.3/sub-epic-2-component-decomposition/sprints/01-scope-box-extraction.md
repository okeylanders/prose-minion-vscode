# Sprint 01: Scope Box Extraction

**Sub-Epic**: [Component Decomposition](../epic-component-decomposition.md)
**Status**: ⏳ Pending
**Priority**: HIGH
**Duration**: 2-3 hours
**Branch**: `sprint/component-decomposition-01-scope-box-extraction`

---

## Problem

The **ScopeBox UI pattern** is duplicated across multiple tabs:

**Current Duplications**:
```
SearchTab.tsx
├─ Word Search Scope (lines 162-232)     ✗ Inline tab buttons + path input
├─ Category Search Scope (lines 380-462) ✗ Duplicate with accessibility attrs

MetricsTab.tsx
├─ Metrics Scope (lines 224-293)         ✗ Inline tab buttons + path input
└─ [Additional sub-tool panels]          ✗ Potential future duplications
```

**Duplication Count**: 5 instances across 2 files

**Impact**:
- ❌ Violates DRY principle (Don't Repeat Yourself)
- ❌ Hard to maintain (changes required in 5 places)
- ❌ Inconsistent styling/behavior if not kept in sync
- ❌ Blocks Sprint 03 (Subtab Panels) which depends on reusable components

**Architecture Debt Reference**:
- [2025-11-02-scope-box-extraction.md](../../../architecture-debt/2025-11-02-scope-box-extraction.md) (if it exists)

---

## Solution

Extract **shared `ScopeBox` component** with support for 3 modes:

```typescript
// src/presentation/webview/components/shared/ScopeBox.tsx
interface ScopeBoxProps {
  // Source mode: 'activeFile' | 'manuscript' | 'chapters' | 'selection'
  mode: 'file' | 'selection' | 'glob';
  onModeChange: (mode: 'file' | 'selection' | 'glob') => void;

  // Path/Pattern input
  pathText?: string;
  onPathTextChange?: (text: string) => void;

  // Selection display (read-only for selection mode)
  selectedText?: string;

  // UI state
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;

  // Message posting (side effects)
  onRequestActiveFile?: () => void;
  onRequestManuscriptGlobs?: () => void;
  onRequestChapterGlobs?: () => void;
  onSetSelection?: (pathText: string) => void;
}
```

**New Structure**:
```
src/presentation/webview/components/shared/
├─ ScopeBox.tsx       # New shared component (~100 lines)
└─ index.ts           # Barrel export
```

**Replaces**:
- SearchTab.tsx: 2 duplicate scope sections → 1 `<ScopeBox>` per subtool
- MetricsTab.tsx: 1 scope section → 1 `<ScopeBox>`

---

## Tasks

### Part 1: Setup (10 min)

- [ ] Create branch: `sprint/component-decomposition-01-scope-box-extraction`
- [ ] Create directory: `src/presentation/webview/components/shared/`

### Part 2: Create ScopeBox Component (45 min)

- [ ] Create `src/presentation/webview/components/shared/ScopeBox.tsx`
  - [ ] Define `ScopeBoxProps` interface with all required props
  - [ ] Build scope tab bar with 4 buttons: "Active File", "Manuscripts", "Chapters", "Selection"
  - [ ] Implement mode switcher with callbacks
  - [ ] Add path/pattern input field
  - [ ] Handle "Selection" mode placeholder ("Selected text" vs file placeholder)
  - [ ] Support `disabled` prop for loading states
  - [ ] Add accessibility attributes (role, aria-label, aria-selected)
  - [ ] Ensure styling matches existing tabs

- [ ] Create `src/presentation/webview/components/shared/index.ts`
  - [ ] Export ScopeBox and ScopeBoxProps

### Part 3: Update SearchTab (30 min)

**Word Search Scope Box**:
- [ ] Replace lines 162-232 with `<ScopeBox>` component
  - Props: `mode`, `onModeChange`, `pathText`, `onPathTextChange`, `disabled`, etc.
  - Event handlers: `onRequestActiveFile`, `onRequestManuscriptGlobs`, `onRequestChapterGlobs`

**Category Search Scope Box**:
- [ ] Replace lines 380-462 with `<ScopeBox>` component
  - Same props/handlers as Word Search
  - Ensure accessibility attrs preserved (role="tablist", role="tab", etc.)

- [ ] Add imports:
```typescript
import { ScopeBox } from './shared';
```

### Part 4: Update MetricsTab (20 min)

**Metrics Scope Box**:
- [ ] Replace lines 224-293 with `<ScopeBox>` component
  - Props: `mode`, `onModeChange`, `pathText`, `onPathTextChange`, `disabled`
  - Event handlers: Same as SearchTab

- [ ] Add imports:
```typescript
import { ScopeBox } from './shared';
```

### Part 5: Testing & Verification (15 min)

- [ ] Run: `npm test`
- [ ] Verify no broken imports
- [ ] Manual test: All scope selections work identically to before
  - [ ] Active File button → requests active file
  - [ ] Manuscripts button → requests manuscript globs
  - [ ] Chapters button → requests chapter globs
  - [ ] Selection button → sets path to "[selected text]"
  - [ ] Path input → updates pathText state
  - [ ] Disabled state respected during loading
- [ ] Check TypeScript compilation: `npm run build`

---

## Acceptance Criteria

### Code Quality
- ✅ ScopeBox component created with clean API
- ✅ No code duplication (5 duplicates replaced with 1 shared component)
- ✅ ScopeBox < 150 lines
- ✅ Barrel export at `shared/index.ts`
- ✅ Props interface fully typed

### Functionality
- ✅ All 4 modes work identically (activeFile, manuscript, chapters, selection)
- ✅ SearchTab Word Search scope works
- ✅ SearchTab Category Search scope works
- ✅ MetricsTab metrics scope works
- ✅ Disabled state respected during loading
- ✅ Path input accepts any text

### Imports & Accessibility
- ✅ SearchTab imports `ScopeBox` from `./shared`
- ✅ MetricsTab imports `ScopeBox` from `./shared`
- ✅ Accessibility attrs preserved (role, aria-label, aria-selected for tabs)
- ✅ No broken imports or missing dependencies

### Tests
- ✅ All existing tests pass
- ✅ No new errors or warnings
- ✅ TypeScript compilation succeeds

---

## Files to Create

```
src/presentation/webview/components/shared/
├─ ScopeBox.tsx      # New shared scope selector component (~100 lines)
└─ index.ts          # Barrel export
```

## Files to Update

```
src/presentation/webview/components/
├─ SearchTab.tsx     # Replace 2 duplicate scope sections with <ScopeBox>
└─ MetricsTab.tsx    # Replace 1 scope section with <ScopeBox>
```

---

## Testing Checklist

### Manual Testing
- [ ] SearchTab: Open tab, switch between scope modes (Active File, Manuscripts, Chapters, Selection)
- [ ] SearchTab: Run Word Search with different scope modes
- [ ] SearchTab: Run Category Search with different scope modes
- [ ] MetricsTab: Open tab, switch between scope modes
- [ ] MetricsTab: Run metrics (Prose Stats, Style Flags, Word Frequency) with different scopes
- [ ] All tabs: Verify disabled state during loading
- [ ] All tabs: Verify path input accepts and displays text

### Automated Testing
- [ ] Run: `npm test`
- [ ] Verify: All tests pass
- [ ] Check: No new TypeScript errors
- [ ] Check: No console warnings

---

## References

**Related ADRs**:
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) (component organization patterns)

**Related Components**:
- [SearchTab.tsx](../../../../src/presentation/webview/components/SearchTab.tsx)
- [MetricsTab.tsx](../../../../src/presentation/webview/components/MetricsTab.tsx)

**Related Sprints**:
- [Sub-Epic 1: Foundation Cleanup](../sub-epic-1-foundation-cleanup/) (completed result formatter extraction)
- [Sub-Epic 3: Subtab Panels](../sprints/03-subtab-panels.md) (depends on this sprint)

---

## Notes

### Scope Box Mode Mapping

The component supports 4 scope modes corresponding to TextSourceMode types:

| Mode | Button Label | Behavior |
|------|--------------|----------|
| `activeFile` | Active File | Request active file via message |
| `manuscript` | Manuscripts | Request manuscript globs via message |
| `chapters` | Chapters | Request chapter globs via message |
| `selection` | Selection | Show "[selected text]" placeholder, set pathText |

### Message Handling

Component remains **presentation-focused** (no message posting):
- Parent (SearchTab/MetricsTab) handles message posting
- Component provides callbacks: `onRequestActiveFile`, `onRequestManuscriptGlobs`, etc.
- Parent composes callbacks with `vscode.postMessage()` calls

This preserves separation of concerns: component is pure, side effects handled by container.

### Future Extensibility

This extraction enables:
- **Sprint 02**: Other components (utilities, future tabs) can reuse ScopeBox
- **Sprint 03**: Subtab panels with consistent scope controls
- Easier testing: Can test ScopeBox behavior in isolation
- Easier styling: Single place to adjust scope selector appearance

---

## Outcomes (Post-Sprint)

**Status**: ⏳ Pending

_To be completed after sprint execution_

---

**Created**: 2025-11-22
**Sprint Order**: 01 of 03 (Sub-Epic 2)
**Blocks**: [Sprint 03: Subtab Panels](03-subtab-panels.md)
