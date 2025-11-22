# Sprint 00: Component Organization

**Sub-Epic**: [Component Decomposition](../epic-component-decomposition.md)
**Status**: 🟢 Ready
**Priority**: HIGH (blocks all other sprints)
**Duration**: 30-45 minutes
**Branch**: `sprint/component-decomposition-00-organization`

---

## Problem

The components directory is flat and unorganized, mixing top-level tabs with shared widgets. Before extracting new components in Sprints 01-04, we need to organize the existing 12 components into a clear, scalable structure.

**Current State** (Flat, unorganized):
```
components/
├─ AnalysisTab.tsx            (15.9 KB)
├─ SearchTab.tsx              (24.5 KB)
├─ MetricsTab.tsx             (16.3 KB)
├─ UtilitiesTab.tsx           (11.3 KB)
├─ SuggestionsTab.tsx         (762 B)
├─ SettingsOverlay.tsx        (71.8 KB)
├─ LoadingWidget.tsx          (2.2 KB)
├─ ModelSelector.tsx          (1.4 KB)
├─ TabBar.tsx                 (1.0 KB)
├─ WordLengthFilterTabs.tsx   (1.3 KB)
└─ MarkdownRenderer.tsx       (821 B)
```

**Issues**:
- ❌ Tabs mixed with shared widgets (hard to find "all tabs")
- ❌ No clear home for new shared components (ScopeBox, LoadingIndicator, WordCounter)
- ❌ No domain organization for upcoming panels (search/, metrics/)
- ❌ 71.8 KB SettingsOverlay violates SRP (note for later)

---

## Solution

Organize components by purpose using domain-oriented structure:

```
components/
├─ tabs/              # Top-level orchestrators (5 files)
├─ shared/            # Shared widgets (5 existing + 3 new from sprints)
├─ search/            # Search domain panels (Sprint 03)
├─ metrics/           # Metrics domain panels (Sprint 03)
└─ SettingsOverlay.tsx  # Unique overlay (stays at root)
```

**Benefits**:
- ✅ Clear separation: orchestrators vs widgets vs domain panels
- ✅ Mirrors backend domain organization (search/, metrics/)
- ✅ Scalable (add new domains easily)
- ✅ `shared/` ready for Sprint 01-04 extractions

---

## Tasks

### Part 1: Create Directory Structure (5 min)

#### 1A: Create Directories
- [ ] Create `src/presentation/webview/components/tabs/`
- [ ] Create `src/presentation/webview/components/shared/`
- [ ] Create `src/presentation/webview/components/search/` (empty, Sprint 03 will populate)
- [ ] Create `src/presentation/webview/components/metrics/` (empty, Sprint 03 will populate)

```bash
mkdir -p src/presentation/webview/components/tabs
mkdir -p src/presentation/webview/components/shared
mkdir -p src/presentation/webview/components/search
mkdir -p src/presentation/webview/components/metrics
```

---

### Part 2: Move Tab Components (10 min)

#### 2A: Move Tabs to tabs/
- [ ] Move `AnalysisTab.tsx` → `tabs/AnalysisTab.tsx`
- [ ] Move `SearchTab.tsx` → `tabs/SearchTab.tsx`
- [ ] Move `MetricsTab.tsx` → `tabs/MetricsTab.tsx`
- [ ] Move `UtilitiesTab.tsx` → `tabs/UtilitiesTab.tsx`
- [ ] Move `SuggestionsTab.tsx` → `tabs/SuggestionsTab.tsx`

```bash
git mv src/presentation/webview/components/AnalysisTab.tsx src/presentation/webview/components/tabs/
git mv src/presentation/webview/components/SearchTab.tsx src/presentation/webview/components/tabs/
git mv src/presentation/webview/components/MetricsTab.tsx src/presentation/webview/components/tabs/
git mv src/presentation/webview/components/UtilitiesTab.tsx src/presentation/webview/components/tabs/
git mv src/presentation/webview/components/SuggestionsTab.tsx src/presentation/webview/components/tabs/
```

---

### Part 3: Move Shared Components (10 min)

#### 3A: Move Shared Widgets to shared/
- [ ] Move `LoadingWidget.tsx` → `shared/LoadingWidget.tsx`
- [ ] Move `ModelSelector.tsx` → `shared/ModelSelector.tsx`
- [ ] Move `TabBar.tsx` → `shared/TabBar.tsx`
- [ ] Move `WordLengthFilterTabs.tsx` → `shared/WordLengthFilterTabs.tsx`
- [ ] Move `MarkdownRenderer.tsx` → `shared/MarkdownRenderer.tsx`

```bash
git mv src/presentation/webview/components/LoadingWidget.tsx src/presentation/webview/components/shared/
git mv src/presentation/webview/components/ModelSelector.tsx src/presentation/webview/components/shared/
git mv src/presentation/webview/components/TabBar.tsx src/presentation/webview/components/shared/
git mv src/presentation/webview/components/WordLengthFilterTabs.tsx src/presentation/webview/components/shared/
git mv src/presentation/webview/components/MarkdownRenderer.tsx src/presentation/webview/components/shared/
```

#### 3B: Create Barrel Export
- [ ] Create `shared/index.ts` with barrel exports:

```typescript
// src/presentation/webview/components/shared/index.ts
export { LoadingWidget } from './LoadingWidget';
export { ModelSelector } from './ModelSelector';
export { TabBar } from './TabBar';
export { WordLengthFilterTabs } from './WordLengthFilterTabs';
export { MarkdownRenderer } from './MarkdownRenderer';
```

---

### Part 4: Update Imports (15 min)

#### 4A: Update App.tsx
- [ ] Update tab imports:

```typescript
// Before
import { AnalysisTab } from './components/AnalysisTab';
import { SearchTab } from './components/SearchTab';
import { MetricsTab } from './components/MetricsTab';
import { UtilitiesTab } from './components/UtilitiesTab';
import { SuggestionsTab } from './components/SuggestionsTab';

// After
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { SearchTab } from './components/tabs/SearchTab';
import { MetricsTab } from './components/tabs/MetricsTab';
import { UtilitiesTab } from './components/tabs/UtilitiesTab';
import { SuggestionsTab } from './components/tabs/SuggestionsTab';
```

#### 4B: Find and Update Shared Component Imports
- [ ] Search for imports of `LoadingWidget`:
```bash
grep -r "from.*LoadingWidget" src/presentation/webview/
```

- [ ] Search for imports of `ModelSelector`:
```bash
grep -r "from.*ModelSelector" src/presentation/webview/
```

- [ ] Search for imports of `TabBar`:
```bash
grep -r "from.*TabBar" src/presentation/webview/
```

- [ ] Search for imports of `WordLengthFilterTabs`:
```bash
grep -r "from.*WordLengthFilterTabs" src/presentation/webview/
```

- [ ] Search for imports of `MarkdownRenderer`:
```bash
grep -r "from.*MarkdownRenderer" src/presentation/webview/
```

- [ ] Update each import to use `shared/` path or barrel export:

```typescript
// Option 1: Direct import
import { LoadingWidget } from '../shared/LoadingWidget';

// Option 2: Barrel import (preferred)
import { LoadingWidget, ModelSelector } from '../shared';
```

---

### Part 5: Verify and Test (10 min)

#### 5A: TypeScript Compilation
- [ ] Run: `npm run build`
- [ ] Verify: Zero TypeScript errors

#### 5B: Webpack Build
- [ ] Extension build successful
- [ ] Webview build successful

#### 5C: Automated Tests
- [ ] Run: `npm test`
- [ ] Verify: All 244 tests passing

#### 5D: Manual Smoke Test
- [ ] Launch extension in dev mode (F5)
- [ ] Verify all 5 tabs render correctly
- [ ] Verify SettingsOverlay opens
- [ ] Verify no console errors

---

## Acceptance Criteria

### Directory Structure
- ✅ `components/tabs/` exists with 5 tab files
- ✅ `components/shared/` exists with 5 shared widget files
- ✅ `components/shared/index.ts` barrel export exists
- ✅ `components/search/` exists (empty, ready for Sprint 03)
- ✅ `components/metrics/` exists (empty, ready for Sprint 03)
- ✅ `SettingsOverlay.tsx` remains at components root

### Code Quality
- ✅ Zero files at components root except SettingsOverlay.tsx
- ✅ All imports updated to new paths
- ✅ TypeScript compilation succeeds
- ✅ All tests pass

### Functionality
- ✅ All tabs render correctly
- ✅ All shared widgets work (LoadingWidget, ModelSelector, etc.)
- ✅ No regressions in behavior
- ✅ No console errors

---

## Files to Create

```
src/presentation/webview/components/
├─ tabs/ (directory)
├─ shared/ (directory)
│  └─ index.ts (barrel export)
├─ search/ (directory, empty)
└─ metrics/ (directory, empty)
```

---

## Files to Move

### To tabs/
- `AnalysisTab.tsx`
- `SearchTab.tsx`
- `MetricsTab.tsx`
- `UtilitiesTab.tsx`
- `SuggestionsTab.tsx`

### To shared/
- `LoadingWidget.tsx` (will be merged into LoadingIndicator in Sprint 02)
- `ModelSelector.tsx`
- `TabBar.tsx`
- `WordLengthFilterTabs.tsx`
- `MarkdownRenderer.tsx`

---

## Files to Update

### Definite Updates
- `App.tsx` - Tab imports (5 imports)

### Potential Updates (search to find)
- Any component importing `LoadingWidget`
- Any component importing `ModelSelector`
- Any component importing `TabBar`
- Any component importing `WordLengthFilterTabs`
- Any component importing `MarkdownRenderer`

---

## Testing Checklist

### TypeScript Verification
- [ ] Run: `npm run build`
- [ ] Check: Zero errors
- [ ] Check: Zero warnings about missing modules

### Automated Testing
- [ ] Run: `npm test`
- [ ] Verify: All 244 tests pass
- [ ] Check: No new test failures

### Manual Testing
- [ ] Open extension in dev mode
- [ ] Test each tab:
  - [ ] Analysis tab renders
  - [ ] Search tab renders
  - [ ] Metrics tab renders
  - [ ] Utilities tab renders
  - [ ] Suggestions tab renders (if populated)
- [ ] Test SettingsOverlay opens/closes
- [ ] Check browser console for errors
- [ ] Verify LoadingWidget appears during operations
- [ ] Verify ModelSelector works in settings
- [ ] Verify TabBar navigation works

---

## Notes

### Why This Structure?

**Domain-Oriented**:
- Mirrors backend organization (search handlers → search panels)
- Scalable (add `analysis/`, `utilities/` panels later)
- Clear ownership (each domain owns its panels)

**Separation of Concerns**:
- `tabs/` = Orchestrators (thin, delegate to panels/hooks)
- `shared/` = Reusable widgets (used across multiple domains)
- `search/`, `metrics/` = Domain-specific panels (used by one tab)

**Future-Proof**:
- Ready for Sprint 01-04 additions (ScopeBox, LoadingIndicator, WordCounter)
- Ready for Sprint 03 panel extractions (5 new panels)
- SettingsOverlay decomposition can happen in Sub-Epic 3/4

### SettingsOverlay Note

**SettingsOverlay.tsx is 71.8 KB** - this violates SRP and should be decomposed in a future sprint (Sub-Epic 3 or 4). For now, leave at root as it's a unique overlay component.

Potential future structure:
```
components/
├─ settings/
│  ├─ SettingsOverlay.tsx (orchestrator)
│  ├─ ModelSettingsPanel.tsx
│  ├─ TokenSettingsPanel.tsx
│  └─ PublishingSettingsPanel.tsx
```

---

## References

**Parent Epic**:
- [Sub-Epic 2: Component Decomposition](../epic-component-decomposition.md)

**Related Sprints**:
- [Sprint 01: Scope Box Extraction](01-scope-box-extraction.md) - Creates `shared/ScopeBox.tsx`
- [Sprint 02: Loading Indicator](02-loading-indicator-integration.md) - Merges LoadingWidget → LoadingIndicator
- [Sprint 03: Subtab Panels](03-subtab-panel-extraction.md) - Populates `search/` and `metrics/`
- [Sprint 04: Word Counter](04-word-counter-component.md) - Creates `shared/WordCounter.tsx`

**Related ADRs**:
- [Presentation Layer Domain Hooks](../../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)

---

## Outcomes (Post-Sprint)

**Completion Date**: TBD
**Actual Duration**: TBD
**PR**: TBD
**Branch**: `sprint/component-decomposition-00-organization`

### Final Structure
```
components/
├─ tabs/                          # 5 files
│  ├─ AnalysisTab.tsx
│  ├─ SearchTab.tsx
│  ├─ MetricsTab.tsx
│  ├─ UtilitiesTab.tsx
│  └─ SuggestionsTab.tsx
├─ shared/                        # 5 files + barrel
│  ├─ LoadingWidget.tsx
│  ├─ ModelSelector.tsx
│  ├─ TabBar.tsx
│  ├─ WordLengthFilterTabs.tsx
│  ├─ MarkdownRenderer.tsx
│  └─ index.ts
├─ search/                        # Empty (Sprint 03)
├─ metrics/                       # Empty (Sprint 03)
└─ SettingsOverlay.tsx            # Stays at root
```

---

**Created**: 2025-11-22
**Status**: 🟢 Ready to Start
**Blocks**: All other sprints in Sub-Epic 2
**Next**: [Sprint 01: Scope Box Extraction](01-scope-box-extraction.md)
