# Quick Start: Epic 1 - Foundation Cleanup

**Start Here** → This is your entry point for the Architecture Health Pass (v1.3)

---

## What You're About To Do

Fix the **3 foundational issues** that are blocking all other architecture improvements:

1. 🔴 **Result Formatter Grab Bag** (763-line monster) → 7 focused files
2. 🟡 **Shared Types & Imports Hygiene** (base.ts bloat + deep imports) → Clean organization
3. 🔴 **Prop Drilling & Type Safety** (untyped APIs) → Compile-time safety

**Duration**: 2-3 days
**Impact**: Unblocks Epic 2 (Component Decomposition), Epic 3 (Standards), Epic 4 (Polish)

---

## Why Epic 1 First?

❌ **Can't do this yet**:
- Component extraction (needs typed interfaces from Sprint 03)
- Request cancellation (needs LoadingIndicator from Epic 2)
- Performance optimization (needs clean components from Epic 2)

✅ **After Epic 1, you can**:
- Safely extract components (typed interfaces)
- Refactor without breaking things (type safety)
- Import cleanly everywhere (aliases)
- Work faster (better IDE support)

---

## Sprint 01: Result Formatter Decomposition

**File**: `.todo/architecture-debt/2025-11-19-result-formatter-grab-bag.md`
**Duration**: 3-4 hours
**Branch**: `sprint/epic-foundation-cleanup-2025-11-21-01-result-formatter`

### The Problem

`resultFormatter.ts` is **763 lines** mixing 6 unrelated domains:

```
src/presentation/webview/utils/resultFormatter.ts (763 lines)
├─ Word Search formatting        (102 lines)
├─ Prose Statistics formatting   (107 lines)
├─ Style Flags formatting        (33 lines)
├─ Word Frequency formatting     (219 lines)
├─ Category Search formatting    (132 lines)
└─ Analysis formatting           (7 lines)
```

### The Solution

Extract into focused files:

```
src/presentation/webview/utils/formatters/
├─ index.ts                    # Barrel export
├─ helpers.ts                  # Shared helpers (~60 lines)
├─ wordSearchFormatter.ts      # ~110 lines
├─ proseStatsFormatter.ts      # ~120 lines
├─ styleFlagsFormatter.ts      # ~40 lines
├─ wordFrequencyFormatter.ts   # ~220 lines
├─ categorySearchFormatter.ts  # ~140 lines
└─ analysisFormatter.ts        # ~20 lines
```

### Checklist

- [ ] Create `formatters/` directory
- [ ] Extract `helpers.ts` (buildMetricsLegend, formatGap, escapePipes)
- [ ] Extract `wordSearchFormatter.ts`
- [ ] Extract `proseStatsFormatter.ts`
- [ ] Extract `styleFlagsFormatter.ts`
- [ ] Extract `wordFrequencyFormatter.ts`
- [ ] Extract `categorySearchFormatter.ts`
- [ ] Extract `analysisFormatter.ts`
- [ ] Create barrel export `index.ts`
- [ ] Update imports in SearchTab.tsx
- [ ] Update imports in MetricsTab.tsx
- [ ] Update imports in AnalysisTab.tsx
- [ ] Update imports in UtilitiesTab.tsx
- [ ] Delete original `resultFormatter.ts`
- [ ] Run tests: `npm test`
- [ ] Verify no regressions

### Acceptance Criteria

✅ 7 focused formatter files (each < 250 lines)
✅ All tab components import from barrel export
✅ No functionality regressions
✅ Tests pass

---

## Sprint 02: Shared Types & Imports Hygiene

**File**: `.todo/architecture-debt/2025-11-19-shared-types-imports-hygiene.md`
**Duration**: 4-6 hours (3 phases)
**Branch**: `sprint/epic-foundation-cleanup-2025-11-21-02-types-imports`

### The Problem

1. `base.ts` bloated with domain-specific types (should be in domain files)
2. 46 occurrences of `../../../` deep imports
3. No import aliases configured

### The Solution (3 Phases)

#### Phase 1: Type Relocation (1-2 hrs)

Move types to their domain files:

- `CategoryRelevance`, `CategoryWordLimit` → `search.ts`
- `ModelScope`, `ModelOption` → `configuration.ts`
- `SaveResultMetadata` → `results.ts`
- `TabId`, `SelectionTarget` → `ui.ts`

#### Phase 2: Import Aliases (2-3 hrs)

Add to both `tsconfig.json` and `tsconfig.webview.json`:

```json
"paths": {
  "@shared/*": ["src/shared/*"],
  "@messages": ["src/shared/types/messages/index.ts"],
  "@messages/*": ["src/shared/types/messages/*"]
}
```

Configure webpack and jest to respect aliases.
Migrate 46 deep imports to aliases.

#### Phase 3: Documentation (1 hr)

Document where to put new types in CLAUDE.md.

### Checklist

**Phase 1: Type Relocation**
- [ ] Move category types to `search.ts`
- [ ] Move model types to `configuration.ts`
- [ ] Move save metadata to `results.ts`
- [ ] Move UI types to `ui.ts`
- [ ] Update all imports

**Phase 2: Import Aliases**
- [ ] Add paths to `tsconfig.json`
- [ ] Add paths to `tsconfig.webview.json`
- [ ] Configure webpack for aliases
- [ ] Configure jest for aliases
- [ ] Migrate deep imports in presentation layer (10+ files)
- [ ] Migrate deep imports in infrastructure layer (4 files)
- [ ] Migrate deep imports in tests
- [ ] Run tests: `npm test`

**Phase 3: Documentation**
- [ ] Add "Type Locations" section to CLAUDE.md
- [ ] Document conventions

### Acceptance Criteria

✅ base.ts only contains truly shared base types
✅ All domain types live in domain files
✅ No `../../../` imports (use aliases)
✅ Import aliases work in both builds
✅ Documentation updated

---

## Sprint 03: Prop Drilling & Type Safety

**File**: `.todo/architecture-debt/2025-11-19-prop-drilling-and-type-safety.md`
**Duration**: 4-6 hours
**Branch**: `sprint/epic-foundation-cleanup-2025-11-21-03-type-safety`

### The Problem

1. Tab components have 30-52 props each (prop drilling)
2. VSCode API untyped (`any`) throughout
3. Message handlers untyped (`message: any`)

### The Solution

1. Create typed `VSCodeAPI` interface
2. Type all message handlers
3. Update all component props

### Checklist

**Part 1: VSCode API Typing (1.5 hrs)**
- [ ] Create `src/presentation/webview/types/vscode.ts`
- [ ] Define `VSCodeAPI` interface
- [ ] Update `useVSCodeApi` hook to return typed API
- [ ] Update App.tsx prop type
- [ ] Update AnalysisTab prop type
- [ ] Update SearchTab prop type
- [ ] Update MetricsTab prop type
- [ ] Update UtilitiesTab prop type
- [ ] Update SettingsOverlay prop type

**Part 2: Message Handler Typing (2-3 hrs)**
- [ ] Import message types in `useAnalysis.ts`
- [ ] Type all message handlers in `useAnalysis.ts`
- [ ] Import message types in `useDictionary.ts`
- [ ] Type all message handlers in `useDictionary.ts`
- [ ] Import message types in `useContext.ts`
- [ ] Type all message handlers in `useContext.ts`
- [ ] Import message types in `useSearch.ts`
- [ ] Type all message handlers in `useSearch.ts`
- [ ] Import message types in `useMetrics.ts`
- [ ] Type all message handlers in `useMetrics.ts`
- [ ] Import message types in `useSettings.ts`
- [ ] Type all message handlers in `useSettings.ts`
- [ ] Import message types in other domain hooks

**Part 3: Verify & Test (1 hr)**
- [ ] Check for remaining `any` types
- [ ] Run tests: `npm test`
- [ ] Test IDE autocomplete
- [ ] Verify no regressions

### Acceptance Criteria

✅ `VSCodeAPI` interface defined and exported
✅ All components use typed VSCode API
✅ All message handlers have explicit types
✅ No `any` types in message handling (except documented exceptions)
✅ IDE autocomplete works for message payloads

---

## After Epic 1

**You'll have**:
- ✅ Clean, organized formatter files (no 763-line grab bags)
- ✅ Clean type organization (domain types in domain files)
- ✅ Clean imports everywhere (aliases, no `../../../`)
- ✅ Type safety (catch bugs at compile time)
- ✅ Better IDE support (autocomplete, refactoring)

**You can start**:
- ✅ Epic 2: Component Decomposition (extract components safely)
- ✅ Epic 3: Standards & Testing (build on clean architecture)
- ✅ Epic 4: Polish & UX (performance, error handling)

---

## Getting Help

**Full Plan**: `.todo/ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md`
**Architecture Debt Details**: `.todo/architecture-debt/`
**ADRs**: `docs/adr/`

**Questions?**
- Check the full plan for context
- Review architecture debt documents
- Reference existing ADRs for patterns

---

**Good luck! Start with Sprint 01** 🚀
