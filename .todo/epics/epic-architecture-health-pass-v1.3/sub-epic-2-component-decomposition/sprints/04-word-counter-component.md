# Sprint 04: Word Counter Component

**Sub-Epic**: [Component Decomposition](../epic-component-decomposition.md)
**Status**: Pending
**Priority**: LOW
**Duration**: 1-2 hours
**Branch**: `sprint/component-decomposition-04-word-counter`

---

## Problem

Word counter logic is duplicated across three locations with hardcoded thresholds and inconsistent implementations, violating the DRY (Don't Repeat Yourself) principle.

**Current Duplications**:

1. **AnalysisTab.tsx** (lines 58-91)
   - Excerpt word counter (500/400 thresholds)
   - Context brief word counter (5000/1000 thresholds)

2. **UtilitiesTab.tsx** (lines 58-73)
   - Dictionary context word counter (500/400 thresholds)

3. **Analysis tools** (throughout codebase)
   - Excerpt word counter (75K threshold for context window safety)

**Each implementation duplicates**:
```typescript
// Word counting logic (useMemo)
const wordCount = React.useMemo(() => {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}, [text]);

// Color determination logic (useMemo)
const wordCountColor = React.useMemo(() => {
  if (wordCount >= 500) {
    return 'word-counter-red';
  }
  if (wordCount >= 400) {
    return 'word-counter-yellow';
  }
  return 'word-counter-green';
}, [wordCount]);

// JSX rendering
<div className={`word-counter ${wordCountColor}`}>
  {wordCount} / 500 words
  {wordCount > 500 && ' ⚠️ Large excerpt'}
</div>
```

**Impact**:
- ❌ Code duplication in 3 locations
- ❌ Magic numbers scattered throughout (500, 400, 5000, 1000, 75000)
- ❌ Inconsistent thresholds for different fields
- ❌ Hard to maintain (changes require updates in multiple files)
- ❌ No reusability for future inputs
- ❌ Violates SRP (components handle both domain logic and word counting)

---

## Solution

Extract a reusable `<WordCounter>` component with configurable thresholds and color-coded visual feedback.

**Component Spec**:
```typescript
interface WordCounterProps {
  text: string;
  maxWords: number;
  warningWords?: number;  // Defaults to 80% of maxWords
  warningMessage?: string;
  className?: string;
}
```

---

## Tasks

### Part 1: Setup (10 min)

- [ ] Create branch: `sprint/component-decomposition-04-word-counter`
- [ ] Create directory: `src/presentation/webview/components/shared/` (if not exists)

### Part 2: Create WordCounter Component (30 min)

- [ ] Create file: `src/presentation/webview/components/shared/WordCounter.tsx`
- [ ] Implement component:
  ```typescript
  import * as React from 'react';

  export interface WordCounterProps {
    /** The text to count words in */
    text: string;
    /** Maximum recommended word count (red threshold) */
    maxWords: number;
    /** Warning word count (yellow threshold), defaults to 80% of maxWords */
    warningWords?: number;
    /** Warning message to show when over limit */
    warningMessage?: string;
    /** Custom class name */
    className?: string;
  }

  /**
   * Reusable word counter component with color-coded visual feedback
   * - Green: 0 to warningWords-1
   * - Yellow: warningWords to maxWords-1
   * - Red: maxWords+
   */
  export const WordCounter: React.FC<WordCounterProps> = ({
    text,
    maxWords,
    warningWords = Math.floor(maxWords * 0.8),
    warningMessage = 'Large input',
    className = ''
  }) => {
    const wordCount = React.useMemo(() => {
      if (!text || text.trim().length === 0) {
        return 0;
      }
      return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }, [text]);

    const colorClass = React.useMemo(() => {
      if (wordCount >= maxWords) {
        return 'word-counter-red';
      }
      if (wordCount >= warningWords) {
        return 'word-counter-yellow';
      }
      return 'word-counter-green';
    }, [wordCount, maxWords, warningWords]);

    const showWarning = wordCount > maxWords;

    return (
      <div className={`word-counter ${colorClass} ${className}`.trim()}>
        {wordCount} / {maxWords} words
        {showWarning && ` ⚠️ ${warningMessage}`}
      </div>
    );
  };
  ```

- [ ] Verify component compiles
- [ ] Test: Create manual test with different threshold values

### Part 3: Update Barrel Export (10 min)

- [ ] Open `src/presentation/webview/components/shared/index.ts`
- [ ] Add export:
  ```typescript
  export { WordCounter } from './WordCounter';
  export type { WordCounterProps } from './WordCounter';
  ```

- [ ] Verify barrel export works

### Part 4: Update AnalysisTab.tsx (20 min)

- [ ] Open `src/presentation/webview/components/AnalysisTab.tsx`
- [ ] Find and remove duplicate word counter logic (~30 lines)
- [ ] Add import:
  ```typescript
  import { WordCounter } from './shared';
  ```

- [ ] Replace excerpt counter JSX:
  ```typescript
  // Before: ~15 lines of useMemo + JSX
  // After: Single line
  <WordCounter
    text={excerptText}
    maxWords={500}
    warningMessage="Large excerpt"
  />
  ```

- [ ] Replace context brief counter JSX:
  ```typescript
  <WordCounter
    text={contextText}
    maxWords={5000}
    warningWords={1000}
    warningMessage="Large context"
  />
  ```

- [ ] Verify component renders correctly
- [ ] Test: Different word counts for both counters

### Part 5: Update UtilitiesTab.tsx (20 min)

- [ ] Open `src/presentation/webview/components/UtilitiesTab.tsx`
- [ ] Find and remove duplicate word counter logic (~15 lines)
- [ ] Add import:
  ```typescript
  import { WordCounter } from './shared';
  ```

- [ ] Replace dictionary context counter JSX:
  ```typescript
  <WordCounter
    text={dictionaryContext}
    maxWords={500}
    warningMessage="Large context"
  />
  ```

- [ ] Verify component renders correctly
- [ ] Test: Different word counts

### Part 6: Verify Identical Behavior (15 min)

- [ ] Test AnalysisTab excerpt counter:
  - [ ] 250 words → green
  - [ ] 450 words → yellow
  - [ ] 600 words → red with warning

- [ ] Test AnalysisTab context counter:
  - [ ] 800 words → green
  - [ ] 3000 words → yellow
  - [ ] 6000 words → red with warning

- [ ] Test UtilitiesTab dictionary context counter:
  - [ ] 250 words → green
  - [ ] 450 words → yellow
  - [ ] 600 words → red with warning

- [ ] Visual verification: Colors match CSS classes (green/yellow/red)
- [ ] Verify warning icons (⚠️) appear correctly

### Part 7: Cleanup and Validation (10 min)

- [ ] Run: `npm test` - all tests pass
- [ ] Run: `npm run build` - no errors
- [ ] Search codebase: `grep -r "wordCount = React.useMemo" src/presentation/webview/components/`
  - Should return zero results (all duplicates removed)

- [ ] Visual inspection of AnalysisTab and UtilitiesTab
- [ ] Verify webview renders without errors in Output Channel

---

## Acceptance Criteria

### Component Implementation
- ✅ WordCounter component created with configurable thresholds
- ✅ Component located at `src/presentation/webview/components/shared/WordCounter.tsx`
- ✅ Exported from `shared/index.ts` barrel export
- ✅ TypeScript compiles without errors
- ✅ All props have JSDoc comments

### Code Quality
- ✅ No code duplication (all 3 original implementations replaced)
- ✅ Component uses `useMemo` for performance (word count calculation)
- ✅ Color logic matches original implementations exactly
- ✅ Component < 50 lines (lean and focused)

### Visual Appearance & Behavior
- ✅ Green threshold behavior matches original (≤ 80% of max)
- ✅ Yellow threshold behavior matches original (80-100% of max)
- ✅ Red threshold behavior matches original (≥ 100% of max)
- ✅ Warning message displays correctly when over limit
- ✅ CSS class names match original (word-counter-green/yellow/red)

### Integration
- ✅ AnalysisTab uses WordCounter for excerpt (500/400 thresholds)
- ✅ AnalysisTab uses WordCounter for context brief (5000/1000 thresholds)
- ✅ UtilitiesTab uses WordCounter for dictionary context (500/400 thresholds)
- ✅ All original duplication removed

### Testing
- ✅ All tests pass: `npm test`
- ✅ No TypeScript errors
- ✅ No console warnings or errors
- ✅ Manual smoke test: All three counters work identically

---

## Files to Create

```
src/presentation/webview/components/shared/
└─ WordCounter.tsx
```

## Files to Update

```
src/presentation/webview/components/
├─ shared/
│  └─ index.ts (add WordCounter export)
├─ AnalysisTab.tsx (remove duplication, add import, use component)
└─ UtilitiesTab.tsx (remove duplication, add import, use component)
```

---

## Testing Checklist

### Unit Testing
- [ ] Run: `npm test`
- [ ] Verify: All tests pass
- [ ] Check: No new test failures
- [ ] Check: Coverage maintained or improved

### Visual Testing
- [ ] Open webview in Extension Development Host (F5)
- [ ] AnalysisTab → Test Analysis tool → verify excerpt counter
  - [ ] Green at 200 words
  - [ ] Yellow at 450 words
  - [ ] Red at 600 words

- [ ] AnalysisTab → Context tab → verify context counter
  - [ ] Green at 800 words
  - [ ] Yellow at 3000 words
  - [ ] Red at 6000 words

- [ ] UtilitiesTab → Test Context Generation → verify counter
  - [ ] Green at 200 words
  - [ ] Yellow at 450 words
  - [ ] Red at 600 words

### Automated Verification
- [ ] Search: `grep -r "wordCount = React.useMemo" src/presentation/webview/components/`
  - Should return: 0 results

- [ ] Search: `grep -r "word-counter-" src/presentation/webview/components/`
  - Should only appear in ComponentCounter component and CSS imports

- [ ] Build check: `npm run build`
  - Should succeed with no errors

### Regression Testing
- [ ] Analysis tab still works
- [ ] Dictionary tab still works
- [ ] Search tab still works
- [ ] Metrics tab still works
- [ ] Settings overlay still works
- [ ] All previous features unaffected

---

## References

**Architecture Debt**:
- [2025-11-02-word-counter-component.md](../../../architecture-debt/2025-11-02-word-counter-component.md)

**Related ADRs**:
- [ADR: Presentation Layer Domain Hooks](../../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- [ADR: Context Window Trim Limits](../../../../docs/adr/2025-11-02-context-window-trim-limits.md)

**Related Files**:
- [src/presentation/webview/components/AnalysisTab.tsx](../../../../src/presentation/webview/components/AnalysisTab.tsx)
- [src/presentation/webview/components/UtilitiesTab.tsx](../../../../src/presentation/webview/components/UtilitiesTab.tsx)
- [src/presentation/webview/components/shared/](../../../../src/presentation/webview/components/shared/)
- [src/presentation/webview/index.css](../../../../src/presentation/webview/index.css) (word-counter styles)

---

## Outcomes (Post-Sprint)

**Completion Date**: 2025-11-24
**Actual Duration**: ~30 minutes
**PR**: [#39](https://github.com/okeylanders/prose-minion-vscode/pull/39)
**Branch**: `sprint/component-decomposition-04-word-counter`

**Deliverables**:

- [x] WordCounter component created and integrated (62 lines)
- [x] All 3 duplication sites replaced:
  - AnalysisTab excerpt counter (500/400 thresholds)
  - AnalysisTab context counter (5000/1000 thresholds)
  - UtilitiesTab dictionary context counter (500/400 thresholds)
- [x] All tests passing (244/244)
- [x] Build successful (webpack compiled with warnings only)

**Line Count Impact**:

| File | Before | After | Change |
|------|--------|-------|--------|
| AnalysisTab.tsx | 486 | 454 | -32 lines |
| UtilitiesTab.tsx | 352 | 335 | -17 lines |
| WordCounter.tsx | - | 62 | +62 lines (new) |
| **Net** | 838 | 851 | +13 lines |

**Note**: Net line increase is acceptable - goal was DRY (eliminating 3 duplications), not line count reduction. The centralized component provides:

- Configurable thresholds (maxWords, warningWords)
- Optional max display (showMax prop)
- Custom warning messages
- Consistent color-coded feedback

**Architecture Debt Resolved**:

- [x] `.todo/architecture-debt/2025-11-02-word-counter-component.md` - Word counter duplication eliminated

---

**Created**: 2025-11-22
**Status**: ✅ Complete (2025-11-24)
**Can Run Independently**: Yes (doesn't depend on other Sub-Epic 2 sprints)
**Previous**: [03-subtab-panel-extraction.md](03-subtab-panel-extraction.md)
**Next Sprint**: Sub-Epic 2 Complete! 🎉
