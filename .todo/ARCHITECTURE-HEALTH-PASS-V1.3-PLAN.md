# Architecture Health Pass (v1.3) - Comprehensive Plan

**Created**: 2025-11-21
**Status**: Planning
**Goal**: Resolve architecture debt across all layers before adding new features

---

## Executive Summary

**Total Items**: 20 architecture debt items
**Total Effort**: 7-11 days (16 sprints across 4 epics)
**Strategy**: Sequential epics building on each other

**Key Principle**: Fix foundations first → Component decomposition → Standards & testing → Polish

---

## Architecture Debt Inventory

### Resolved (5 items from STATUS-SUMMARY)

✅ Configuration Strategy Inconsistency
✅ Settings Architecture Analysis
✅ Settings Architecture SUMMARY
✅ Settings Architecture ADDENDUM
✅ Settings Sync Registration

### Pending (20 items)

#### 🔴 HIGH Priority (3 items)

1. **Result Formatter Grab Bag** - 3-4 hrs - Epic 1
   - 763-line grab bag mixing 6 unrelated domains
   - Largest architectural violation in codebase

2. **Prop Drilling & Type Safety** - 4-6 hrs - Epic 1
   - Tab components have 30-52 props
   - VSCode API untyped (`any`) throughout
   - No autocomplete or compile-time validation

3. **Token Usage Centralization** - 3-4 hrs - Epic 3
   - **Updated 2025-11-21**: AIOrchestrator should emit TOKEN_USAGE messages automatically
   - Single source of truth for token parsing
   - Eliminates duplication across 10+ services

#### 🟡 MEDIUM Priority (12 items)

4. **Shared Types & Imports Hygiene** - 4-6 hrs (3 phases) - Epic 1
   - base.ts bloated with domain-specific types
   - 46 occurrences of `../../../` deep imports
   - No import aliases configured

5. **Subtab Panel Extraction** - 3-4 hrs - Epic 2
   - SearchTab: 666 lines → extract WordSearchPanel, CategorySearchPanel
   - MetricsTab: 413 lines → extract metrics panels

6. **Scope Box Component Extraction** - 2-3 hrs - Epic 2
   - ~100 lines duplicated between SearchTab and MetricsTab
   - Should be shared component + domain hook

7. **Loading Widget Status Integration** - 3-4 hrs - Epic 2
   - **Updated 2025-11-21**: Single unified component with progress bar
   - Integrates: status + spinner + progress bar + token cost + guide ticker
   - Progress bar from Fast Dictionary should be available to all features

8. **Request Cancellation UI Exposure** - 4-6 hrs - Epic 4
   - Backend infrastructure complete (PR #31)
   - Need UI layer: cancel buttons, abort signal wiring

9. **Error Boundary Needed** - 1-2 hrs - Epic 4
   - No React error boundaries
   - Single component error crashes entire UI

10. **React.memo Performance** - 2-3 hrs - Epic 4
    - Tab components not memoized
    - Unnecessary re-renders on every state change

11. **StandardsService Responsibility Violation** - 1-2 hrs - Epic 3
    - `computePerFileStats()` belongs in ProseStatsService
    - Violates Single Responsibility Principle

12. **useEffect Extraction Pattern** - 2-4 hrs - Epic 3
    - Inline useEffect logic should be named methods
    - Better testability and reusability

13. **Domain Hooks JSDoc Completion** - 1-2 hrs - Epic 3
    - 6 settings hooks need comprehensive JSDoc
    - Copy template from `useWordSearchSettings`

14. **Settings Hooks Unit Tests** - 1 day - Epic 3 (if needed)
    - 6 settings hooks have no automated tests
    - Partially addressed by testing epic

15. **Settings Integration Tests** - 1-2 days - Epic 3 (deferred)
    - Complex workflows not covered by unit tests
    - Lower ROI than unit tests

#### 🔵 LOW Priority (4 items)

16. **Word Counter Component** - < 2 hrs - Epic 2
    - Duplicated in 3 places
    - Quick win DRY violation

17. **Tailwind + Custom CSS Pattern** - 2-4 hrs - Epic 4
    - Document pattern (custom vs utility classes)
    - Refactor opportunistically

18. **Large File Review** - TBD - Future
    - 10 files exceed size guidelines
    - Review when adding functionality

---

## Epic Structure

### 🎯 Epic 1: Foundation Cleanup (Prerequisites)

**Duration**: 2-3 days
**Why First**: Type safety and organized code unblock everything else

#### Sprint 01: Result Formatter Decomposition (3-4 hrs) - HIGH

**Problem**: 763-line grab bag mixing 6 unrelated domains

**Tasks**:
- Extract `helpers.ts` (buildMetricsLegend, formatGap, escapePipes)
- Extract `wordSearchFormatter.ts` (~110 lines)
- Extract `proseStatsFormatter.ts` (~120 lines)
- Extract `styleFlagsFormatter.ts` (~40 lines)
- Extract `wordFrequencyFormatter.ts` (~220 lines)
- Extract `categorySearchFormatter.ts` (~140 lines)
- Extract `analysisFormatter.ts` (~20 lines)
- Create barrel export `formatters/index.ts`
- Update imports in 4 tab components
- Delete original `resultFormatter.ts`

**Acceptance Criteria**:
- ✅ 7 focused formatter files (each < 250 lines)
- ✅ All tab components import from barrel export
- ✅ No functionality regressions
- ✅ Tests pass

**Blocks**: Component extraction (needed for clean imports)

---

#### Sprint 02: Shared Types & Imports Hygiene (4-6 hrs, 3 phases) - MEDIUM

**Problem**: base.ts bloated, deep imports everywhere, no aliases

**Phase 1: Type Relocation (1-2 hrs)**
- Move `CategoryRelevance`, `CategoryWordLimit`, `CATEGORY_RELEVANCE_OPTIONS` → `search.ts`
- Move `ModelScope`, `ModelOption` → `configuration.ts`
- Move `SaveResultMetadata` → `results.ts`
- Move `TabId`, `SelectionTarget` → `ui.ts`
- Update all imports

**Phase 2: Import Aliases (2-3 hrs)**
- Add to `tsconfig.json` and `tsconfig.webview.json`:
  ```json
  "paths": {
    "@shared/*": ["src/shared/*"],
    "@messages": ["src/shared/types/messages/index.ts"],
    "@messages/*": ["src/shared/types/messages/*"]
  }
  ```
- Configure webpack to respect aliases
- Configure jest to respect aliases
- Migrate 46 deep imports (`../../../`) to aliases

**Phase 3: Documentation (1 hr)**
- Add "Type Locations" section to CLAUDE.md
- Document where to put new types
- Add convention for when base.ts additions are acceptable

**Acceptance Criteria**:
- ✅ base.ts only contains truly shared base types
- ✅ All domain types live in domain files
- ✅ No `../../../` imports (use aliases)
- ✅ Import aliases work in both extension and webview builds
- ✅ Documentation updated

**Blocks**: Everything (cleaner imports for all future work)

---

#### Sprint 03: Prop Drilling & Type Safety (4-6 hrs) - HIGH

**Problem**: 30-52 props per tab, untyped VSCode API, untyped message handlers

**Tasks**:
1. Create `VSCodeAPI` interface (1 hr)
   - Define typed interface for postMessage/getState/setState
   - Create `src/presentation/webview/types/vscode.ts`

2. Update `useVSCodeApi` hook (30 min)
   - Return typed `VSCodeAPI` instead of `any`

3. Type message handlers in domain hooks (2-3 hrs)
   - Import message types from `@messages`
   - Update all `(message: any)` → `(message: SpecificMessageType)`
   - 10+ domain hooks to update

4. Update component prop interfaces (1 hr)
   - Change `vscode: any` → `vscode: VSCodeAPI`
   - 5 tab components + SettingsOverlay

5. (Optional) Reduce prop count via composition (1-2 hrs)
   - Pass entire hook returns instead of individual props
   - Or use Context API for deeply-nested settings

**Acceptance Criteria**:
- ✅ `VSCodeAPI` interface defined and exported
- ✅ All components use typed VSCode API
- ✅ All message handlers have explicit types
- ✅ No `any` types in message handling (except documented exceptions)
- ✅ IDE autocomplete works for message payloads

**Blocks**: Component extraction (need typed interfaces first)

---

**Epic 1 Outcome**: Clean type system, organized formatters, typed APIs, clean imports

---

### 🎯 Epic 2: Component Decomposition (Eliminate God Components)

**Duration**: 2-3 days
**Why Second**: Builds on Epic 1 foundations (typed interfaces, clean imports)

#### Sprint 01: Scope Box Extraction (2-3 hrs) - MEDIUM

**Problem**: ~100 lines duplicated between SearchTab and MetricsTab

**Tasks**:
- Create `src/presentation/webview/components/shared/ScopeBox.tsx`
- Define `ScopeBoxProps` interface
- Extract shared UI (4 tab buttons + path input)
- Create `useScopeBox` hook (follows Tripartite Interface pattern)
  - State: sourceMode, pathText
  - Actions: requestActiveFile, requestManuscriptGlobs, requestChapterGlobs
  - Persistence: ScopeBoxPersistence
- Update SearchTab to use `<ScopeBox />`
- Update MetricsTab to use `<ScopeBox />`
- Consider removing `scopeRequester` pattern from App.tsx (each hook owns scope)

**Acceptance Criteria**:
- ✅ Single `<ScopeBox />` component
- ✅ `useScopeBox` hook follows domain hooks pattern
- ✅ SearchTab and MetricsTab use shared component
- ✅ No duplication of scope selector UI
- ✅ Tests pass

**Unlocks**: Subtab panel extraction (shared component ready)

---

#### Sprint 02: Loading Widget Status Integration (3-4 hrs) - MEDIUM

**Problem**: ~40 lines duplicated, no unified loading UX, progress bar only in Fast Dictionary

**Tasks**:
- Create `src/presentation/webview/components/shared/LoadingIndicator.tsx`
- **Single unified component** integrating:
  1. Status message display
  2. Spinner animation
  3. Progress bar (from Fast Dictionary pattern)
  4. Loading widget (token cost tracking)
  5. Guide ticker (for Analysis tab)
  6. Cancel button (optional)
- Define `LoadingIndicatorProps` interface:
  ```typescript
  {
    isLoading: boolean;
    statusMessage?: string;
    defaultMessage: string;
    guideNames?: string;
    progress?: { current: number; total: number; label?: string };
    onCancel?: () => void;
  }
  ```
- Update 4 tab components to use `<LoadingIndicator />`
- Remove inline loading UI from AnalysisTab, UtilitiesTab, SearchTab, MetricsTab

**Acceptance Criteria**:
- ✅ Single `<LoadingIndicator />` component
- ✅ Includes progress bar support
- ✅ All 4 tabs use shared component
- ✅ Progress bar available to all features (not just Fast Dictionary)
- ✅ Consistent UX across all loading states
- ✅ Tests pass

**Unlocks**: Error boundary (consistent loading UI), Request cancellation (place for cancel button)

---

#### Sprint 03: Subtab Panel Extraction (3-4 hrs) - MEDIUM

**Problem**: SearchTab 666 lines, MetricsTab 413 lines - inline subtab content

**Tasks**:
- Create `src/presentation/webview/components/search/WordSearchPanel.tsx` (~210 lines)
- Create `src/presentation/webview/components/search/CategorySearchPanel.tsx` (~260 lines)
- Create `src/presentation/webview/components/metrics/ProseStatsPanel.tsx`
- Create `src/presentation/webview/components/metrics/StyleFlagsPanel.tsx`
- Create `src/presentation/webview/components/metrics/WordFrequencyPanel.tsx`
- Refactor SearchTab to orchestrate panels (~150 lines)
- Refactor MetricsTab to orchestrate panels (~150 lines)
- **Important**: Each panel owns its own status/loading state
  - Status messages scoped per panel (word search status ≠ category search status)
  - No status bleeding across subtabs

**Acceptance Criteria**:
- ✅ SearchTab orchestrates 2 panels (~150 lines total)
- ✅ MetricsTab orchestrates 3 panels (~150 lines total)
- ✅ Each panel has focused props interface
- ✅ Status messages scoped per subtab (no bleeding)
- ✅ ScopeBox and LoadingIndicator shared by panels
- ✅ Tests pass

**Requires**: ScopeBox, LoadingIndicator

---

#### Sprint 04: Word Counter Component (< 2 hrs) - LOW (Quick Win!)

**Problem**: Word counter logic duplicated in 3 components

**Tasks**:
- Create `src/presentation/webview/components/shared/WordCounter.tsx`
- Define `WordCounterProps` interface
- Extract threshold logic (green/yellow/red)
- Update AnalysisTab, UtilitiesTab to use `<WordCounter />`
- Remove inline word counter implementations

**Acceptance Criteria**:
- ✅ Single `<WordCounter />` component
- ✅ Consistent thresholds across all uses
- ✅ DRY violation fixed
- ✅ Tests pass

---

**Epic 2 Outcome**: SearchTab/MetricsTab readable (~150 lines each), shared components library, no DRY violations

---

### 🎯 Epic 3: Standards & Testing (Architectural Compliance)

**Duration**: 2-3 days
**Why Third**: Build on clean architecture from Epics 1-2

#### Sprint 01: StandardsService Responsibility Violation (1-2 hrs) - MEDIUM

**Problem**: `computePerFileStats()` belongs in ProseStatsService

**Tasks**:
- Move `computePerFileStats()` from StandardsService → `ProseStatsService.analyzeMultipleFiles()`
- Update MetricsHandler to call `ProseStatsService.analyzeMultipleFiles()` instead
- Remove orphaned method from StandardsService
- Update tests

**Acceptance Criteria**:
- ✅ `computePerFileStats()` removed from StandardsService
- ✅ `ProseStatsService.analyzeMultipleFiles()` handles multi-file stats
- ✅ MetricsHandler uses correct service
- ✅ Single Responsibility Principle restored
- ✅ Tests pass

---

#### Sprint 02: Token Usage Centralization (3-4 hrs) - MEDIUM

**Problem**: Token tracking duplicated across 10+ services and handlers

**Tasks**:
1. **AIResourceOrchestrator emits token messages** (1-2 hrs)
   - Add `postMessageCallback` to constructor
   - Emit `TOKEN_USAGE` messages in all 3 execution methods
   - Add `calculateCost()` helper

2. **Wire message callback through MessageHandler** (30 min)
   - Pass `this.postMessage` to AIResourceOrchestrator

3. **Remove token tracking from services** (1 hr)
   - Remove `usage?` field from all service result interfaces
   - Remove token tracking logic from 4+ services

4. **Remove token extraction from handlers** (1 hr)
   - Remove `applyTokenUsage()` calls from 5+ handlers
   - Handlers just use domain data

**Acceptance Criteria**:
- ✅ AIResourceOrchestrator emits TOKEN_USAGE automatically
- ✅ All services return only domain data (no `usage` field)
- ✅ All handlers simplified (no token extraction)
- ✅ Frontend token tracking still works
- ✅ Single source of truth for token parsing
- ✅ Tests pass

---

#### Sprint 03: Domain Hooks JSDoc Completion (1-2 hrs) - MEDIUM

**Problem**: Only `useWordSearchSettings` has comprehensive JSDoc

**Tasks**:
- Copy JSDoc template from `useWordSearchSettings`
- Add JSDoc to:
  - `useWordFrequencySettings`
  - `useModelsSettings`
  - `useContextPathsSettings`
  - `useTokensSettings`
  - `usePublishingSettings`
  - `useTokenTracking`

**Acceptance Criteria**:
- ✅ All 6 hooks have comprehensive JSDoc
- ✅ Consistent documentation across domain hooks
- ✅ Better developer experience

---

#### Sprint 04: useEffect Extraction Pattern (2-4 hrs) - MEDIUM

**Problem**: Inline useEffect logic with comments explaining intent

**Tasks**:
- Extract inline logic to named methods wrapped in `useCallback`
- Semantic naming: `request*`, `sync*`, `clear*When*`, `initialize*`, `validate*`
- Apply pattern to 6+ domain hooks with complex useEffects
- Update tests (easier to test named methods)

**Acceptance Criteria**:
- ✅ No inline useEffect logic (extract to named methods)
- ✅ Self-documenting method names
- ✅ Testable without mocking React lifecycle
- ✅ Tests pass

---

#### Sprint 05: Settings Hooks Unit Tests (1 day, if needed) - HIGH

**Problem**: 6 settings hooks have no automated tests

**Note**: Infrastructure Testing Epic (PR #25) added tests for tripartite interface pattern. May only need business logic tests.

**Tasks**:
- Review existing test coverage from Infrastructure Testing Epic
- Add unit tests for settings hooks business logic:
  - `useWordSearchSettings`
  - `useWordFrequencySettings`
  - `useModelsSettings`
  - `useContextPathsSettings`
  - `useTokensSettings`
  - `usePublishingSettings`

**Acceptance Criteria**:
- ✅ Comprehensive unit tests for all 6 hooks
- ✅ Settings sync tested
- ✅ Persistence tested
- ✅ Regressions caught automatically

---

**Epic 3 Outcome**: Architectural compliance, centralized token tracking, comprehensive docs, robust testing

---

### 🎯 Epic 4: Polish & UX Enhancements (Production Ready)

**Duration**: 1-2 days
**Why Last**: Enhancements building on clean architecture

#### Sprint 01: Error Boundary (1-2 hrs) - MEDIUM

**Problem**: No React error boundaries - component errors crash entire UI

**Tasks**:
- Create `src/presentation/webview/components/shared/ErrorBoundary.tsx`
- Create `src/presentation/webview/components/shared/TabErrorFallback.tsx`
- Wrap tabs in `<ErrorBoundary>` in App.tsx
- Wrap MarkdownRenderer separately (high-risk for parsing errors)
- Add `WEBVIEW_ERROR` message type for logging

**Acceptance Criteria**:
- ✅ `<ErrorBoundary>` class component created
- ✅ Friendly fallback UI with retry button
- ✅ All tabs wrapped in boundary
- ✅ MarkdownRenderer wrapped separately
- ✅ Errors logged to extension via postMessage
- ✅ State preservation on errors

---

#### Sprint 02: React.memo Performance (2-3 hrs) - MEDIUM

**Problem**: Tab components not memoized - unnecessary re-renders

**Tasks**:
- Wrap SearchTab in `React.memo`
- Wrap AnalysisTab in `React.memo`
- Wrap MetricsTab in `React.memo`
- Wrap UtilitiesTab in `React.memo`
- Wrap SettingsOverlay in `React.memo`
- Ensure callback stability in App.tsx (use `useCallback`)
- Verify with React DevTools Profiler

**Acceptance Criteria**:
- ✅ All 5 components wrapped in React.memo
- ✅ Callbacks stable (useCallback in App.tsx)
- ✅ Fewer re-renders verified with Profiler
- ✅ Smoother UX

---

#### Sprint 03: Request Cancellation UI Exposure (4-6 hrs) - MEDIUM

**Problem**: Backend infrastructure complete, no UI exposure

**Tasks**:
1. **Domain hooks cancellation state** (2 hrs)
   - Add `cancelAnalysis`, `cancelDictionary`, etc. to domain hooks
   - Track `AbortController` in hook state
   - Send `CANCEL_REQUEST` messages

2. **Backend signal registry** (2 hrs)
   - Track `AbortController` by request ID in handlers
   - Add `CANCEL_REQUEST` handler to domain handlers
   - Abort on cancel message

3. **UI cancel buttons** (1-2 hrs)
   - Add `onCancel` prop to `<LoadingIndicator>`
   - Wire cancel buttons in tab components
   - Show cancel button during long-running operations

4. **Message contracts** (30 min)
   - Add `CANCEL_REQUEST` message type
   - Create `CancelRequest` interface

**Acceptance Criteria**:
- ✅ Cancel buttons in loading indicators
- ✅ Domain hooks handle cancellation
- ✅ Backend handlers abort on cancel
- ✅ Graceful cancellation (no orphaned promises)
- ✅ Better UX and cost control

**Requires**: LoadingIndicator extraction (Epic 2)

---

#### Sprint 04: Tailwind + Custom CSS Pattern (2-4 hrs) - LOW

**Problem**: Tailwind configured but unused, inline styles everywhere

**Tasks**:
1. Document pattern in CLAUDE.md (30 min)
   - Custom CSS for reusable components (3+ uses)
   - Tailwind utilities for one-offs
   - Never inline styles (except dynamic values)

2. Refactor SettingsOverlay as example (1-2 hrs)
   - Convert inline styles to Tailwind utilities
   - Keep custom classes for reusable patterns

3. Add to agent guidance (15 min)

4. Review and validate (30 min)

**Acceptance Criteria**:
- ✅ Pattern documented in CLAUDE.md
- ✅ SettingsOverlay refactored (example)
- ✅ No linter warnings
- ✅ Clear guidance for future code

---

**Epic 4 Outcome**: Production-ready polish, excellent UX, performance optimized

---

## Summary Statistics

| Epic | Sprints | Duration | Debt Items | Impact |
|------|---------|----------|------------|--------|
| Epic 1: Foundation | 3 | 2-3 days | 3 HIGH + 1 MED | Unblocks everything |
| Epic 2: Components | 4 | 2-3 days | 4 MED + 1 LOW | Readability, DRY |
| Epic 3: Standards | 5 | 2-3 days | 1 HIGH + 4 MED | Quality, compliance |
| Epic 4: Polish | 4 | 1-2 days | 4 MED + 1 LOW | UX, performance |
| **TOTAL** | **16** | **7-11 days** | **20 items** | **Healthy architecture** |

---

## Dependencies Flow

```
Epic 1: Foundation Cleanup
  ├─ Result Formatter → Enables clean imports
  ├─ Shared Types → Enables clean imports everywhere
  └─ Prop Drilling & Type Safety → Enables safe component extraction
           ↓
Epic 2: Component Decomposition
  ├─ Scope Box → Enables subtab extraction
  ├─ Loading Indicator → Enables error boundary + cancellation
  ├─ Subtab Panels → REQUIRES Scope Box + Loading Indicator
  └─ Word Counter → Quick win
           ↓
Epic 3: Standards & Testing
  ├─ StandardsService → Architectural compliance
  ├─ Token Centralization → DRY + single source of truth
  ├─ JSDoc → Documentation
  ├─ useEffect Extraction → Testability
  └─ Unit Tests → Quality
           ↓
Epic 4: Polish & UX
  ├─ Error Boundary → Graceful degradation
  ├─ React.memo → Performance
  ├─ Request Cancellation → REQUIRES Loading Indicator
  └─ Tailwind Pattern → Code quality
```

---

## Deferred Items

**Settings Integration Tests** (1-2 days) - MEDIUM priority
- Complex workflows not covered by unit tests
- Lower ROI than unit tests
- Defer to v1.4 or later

**Large File Review** (TBD) - LOW priority
- 10 files exceed size guidelines
- Review opportunistically when adding functionality
- No immediate action needed

---

## Next Steps

**Recommended**: Start with Epic 1, Sprint 01 (Result Formatter Decomposition)

**Why Epic 1 First?**
1. ✅ Fixes biggest architectural violation (763-line grab bag)
2. ✅ Establishes type safety (catch bugs at compile time)
3. ✅ Cleans imports (cleaner code for all future work)
4. ✅ Unblocks all component extraction work

**What to defer?**
- ❌ Request cancellation UI (needs LoadingIndicator from Epic 2)
- ❌ Component decomposition (needs type safety from Epic 1)
- ❌ Performance optimization (needs clean components from Epic 2)

---

## Updated Items (2025-11-21)

### Loading Widget Status Integration
- **Was**: 2-3 hrs, separate component from LoadingWidget
- **Now**: 3-4 hrs, **single unified component** integrating status + spinner + progress bar + token cost
- **Rationale**: Progress bar from Fast Dictionary should be available to all features

### Token Usage Standardization
- **Was**: 1-2 hrs, LOW priority, return format standardization only
- **Now**: 3-4 hrs, MEDIUM priority, centralized in AIOrchestrator
- **Rationale**: Token parsing should happen once in AIOrchestrator, automatically for all requests

---

**Last Updated**: 2025-11-21 18:30
**Author**: Claude Code (AI Agent)
**Status**: Ready for Epic 1 ADR creation
