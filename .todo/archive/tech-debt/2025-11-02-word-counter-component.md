> **✅ RESOLVED**
> - **PR**: #39
> - **Date**: 2025-11-24
> - **Sprint**: Sub-Epic 2, Sprint 04

# Architecture Debt: Word Counter Component Duplication

**Date Created**: 2025-11-02
**Category**: Presentation Layer / Component Design
**Priority**: Low
**Effort**: Low (< 2h)
**Status**: ✅ RESOLVED (2025-11-24)
**Resolution**: [Sprint 04 - Word Counter Component](../epics/epic-architecture-health-pass-v1.3/sub-epic-2-component-decomposition/sprints/04-word-counter-component.md) | [PR #39](https://github.com/okeylanders/prose-minion-vscode/pull/39)
**Introduced In**: Context Window Trimming feature (Sprint: epic-context-window-safety-2025-11-02-01-trim-limits)

---

## Problem

Word counter logic is duplicated across multiple components with hardcoded thresholds and inline implementations. This violates DRY (Don't Repeat Yourself) principle and makes maintenance difficult.

### Current Implementation

**Duplicated in 3 locations**:

1. **AnalysisTab.tsx** (lines 58-91)
   - Excerpt word counter (500/400 thresholds)
   - Context brief word counter (5000/1000 thresholds)

2. **UtilitiesTab.tsx** (lines 58-73)
   - Dictionary context word counter (500/400 thresholds)

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

### Issues

1. **Code Duplication**: Same logic copy-pasted across 3 locations
2. **Magic Numbers**: Hardcoded thresholds (500, 400, 5000, 1000) scattered throughout
3. **Inconsistent Thresholds**: Different limits for different fields (excerpt vs context brief)
4. **Maintenance Burden**: Changing behavior requires updates in multiple files
5. **No Reusability**: Can't easily add word counters to new inputs
6. **Violates SRP**: Components handle both domain logic and word counting
7. **Testing Difficulty**: Must test word counting logic in multiple component tests

### Impact

- **Current**: Low (works, but fragile)
- **Future**: Medium (will become painful when adding more inputs with word limits)
- **Maintainability**: Poor (manual updates in 3 places)
- **Type Safety**: Good (TypeScript throughout)

---

## Minimum Fix (Quick Win)

**Effort**: ~1 hour
**Priority**: Nice to have for v1.1

Extract word counter into a reusable React component with configurable thresholds.

### Proposed Implementation

**File**: `src/presentation/webview/components/shared/WordCounter.tsx`

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

### Usage in Components

**AnalysisTab.tsx** (simplified):
```typescript
import { WordCounter } from './shared/WordCounter';

// In JSX:
<WordCounter
  text={text}
  maxWords={500}
  warningMessage="Large excerpt"
/>

<WordCounter
  text={contextText}
  maxWords={5000}
  warningWords={1000}
  warningMessage="Large context"
/>
```

**UtilitiesTab.tsx** (simplified):
```typescript
import { WordCounter } from './shared/WordCounter';

// In JSX:
<WordCounter
  text={context}
  maxWords={500}
  warningMessage="Large context"
/>
```

### Benefits of Minimum Fix

- ✅ Single source of truth for word counting logic
- ✅ Configurable thresholds (no magic numbers in components)
- ✅ Reusable across all inputs
- ✅ Easier to maintain (change in one place)
- ✅ Easier to test (single component test)
- ✅ Clear interface via props
- ✅ 1-hour fix, low risk
- ✅ Can add to new inputs easily

### Drawbacks of Minimum Fix

- ⚠️ Still duplicates word counting logic from `src/utils/textUtils.ts`
- ⚠️ Thresholds still hardcoded in each usage (should be constants)
- ⚠️ Doesn't solve deeper architectural issues

---

## Better Solution (Proper Architecture)

**Effort**: 2-3 hours
**Priority**: Consider for v1.1+

Implement word counter component with centralized configuration and alignment with backend utilities.

### Architectural Design

#### 1. Shared Constants

**File**: `src/shared/constants/wordLimits.ts`

```typescript
/**
 * Word count limits for UI feedback
 * Aligned with backend trimming limits in textUtils.ts
 */
export const WORD_LIMITS = {
  /** Excerpt inputs (dialogue, prose samples) */
  EXCERPT: {
    MAX: 500,
    WARNING: 400
  },
  /** Context brief inputs */
  CONTEXT_BRIEF: {
    MAX: 5000,
    WARNING: 1000
  },
  /** Dictionary context inputs */
  DICTIONARY_CONTEXT: {
    MAX: 500,
    WARNING: 400
  }
} as const;

export type WordLimitKey = keyof typeof WORD_LIMITS;
```

#### 2. Unified Word Counting Utility

**Option A**: Keep in presentation layer (current approach)
- `src/presentation/webview/utils/wordCount.ts`

**Option B**: Share with backend (avoid duplication)
- Extract core word counting to `src/shared/utils/textUtils.ts`
- Both backend and frontend import from shared location
- Requires webpack/esbuild configuration to include shared utils in webview bundle

**Recommendation**: Option A for simplicity (word counting is cheap, duplication is acceptable)

#### 3. Enhanced WordCounter Component

**File**: `src/presentation/webview/components/shared/WordCounter.tsx`

```typescript
import * as React from 'react';
import { WORD_LIMITS, WordLimitKey } from '../../../shared/constants/wordLimits';

export interface WordCounterProps {
  /** The text to count words in */
  text: string;
  /** Preset limit key (or custom limits) */
  limitKey?: WordLimitKey;
  /** Custom max words (overrides limitKey) */
  maxWords?: number;
  /** Custom warning words (overrides limitKey) */
  warningWords?: number;
  /** Warning message to show when over limit */
  warningMessage?: string;
  /** Custom class name */
  className?: string;
}

export const WordCounter: React.FC<WordCounterProps> = ({
  text,
  limitKey,
  maxWords: customMax,
  warningWords: customWarning,
  warningMessage = 'Large input',
  className = ''
}) => {
  // Determine limits from preset or custom values
  const limits = React.useMemo(() => {
    if (customMax !== undefined) {
      return {
        max: customMax,
        warning: customWarning ?? Math.floor(customMax * 0.8)
      };
    }
    if (limitKey) {
      const preset = WORD_LIMITS[limitKey];
      return {
        max: preset.MAX,
        warning: preset.WARNING
      };
    }
    // Default fallback
    return { max: 500, warning: 400 };
  }, [limitKey, customMax, customWarning]);

  // ... rest of implementation
};
```

#### 4. Usage with Presets

```typescript
import { WordCounter } from './shared/WordCounter';

// Using preset
<WordCounter
  text={text}
  limitKey="EXCERPT"
  warningMessage="Large excerpt"
/>

// Using custom limits (for future flexibility)
<WordCounter
  text={text}
  maxWords={1000}
  warningWords={800}
  warningMessage="Approaching limit"
/>
```

### Benefits of Better Solution

- ✅ Centralized limit configuration
- ✅ No magic numbers in components
- ✅ Consistent limits across features
- ✅ Easy to adjust limits globally
- ✅ Preset keys provide semantic meaning
- ✅ Still allows custom limits for edge cases
- ✅ Type-safe via `WordLimitKey`
- ✅ Aligned with Clean Architecture (shared constants)

### Drawbacks of Better Solution

- ⚠️ More complex (adds constants file + preset system)
- ⚠️ Requires understanding preset keys
- ⚠️ Overkill if we don't add many more inputs

---

## Even Better Solution (Configuration-Driven)

**Effort**: 4-6 hours
**Priority**: Future (v2.0+)

Make word limits configurable via VS Code settings with UI awareness.

### Features

- Settings: `proseMinion.ui.wordLimits.excerpt`, `proseMinion.ui.wordLimits.contextBrief`, etc.
- WordCounter component reads from settings context
- Power users can adjust limits to match their workflow
- Default presets still apply for 95% of users

### Example

```typescript
// Settings
"proseMinion.ui.wordLimits.excerpt": 1000,  // User prefers larger excerpts

// Component automatically respects setting
<WordCounter text={text} limitKey="EXCERPT" />
// Shows: "450 / 1000 words" (green)
```

---

## Recommendation

**For v1.0**: **Defer** (ship as-is, document debt)
- Feature works correctly
- Duplication is acceptable for 3 locations
- No bugs reported
- Focus on shipping v1.0

**For v1.1**: Implement **Minimum Fix** (1 hour, low risk)
- Extract WordCounter component
- Configurable thresholds via props
- Easy to add to new inputs

**For v1.2+**: Consider **Better Solution** if we add 5+ more inputs with word limits
- Centralized constants
- Preset system
- Justify 2-3 hour investment

**For v2.0+**: **Configuration-Driven** only if users request customizable limits
- Requires user research to validate need

---

## Related Files

### Current Implementation
- `src/presentation/webview/components/AnalysisTab.tsx` (lines 58-91)
- `src/presentation/webview/components/UtilitiesTab.tsx` (lines 58-73)
- `src/presentation/webview/index.css` (lines 869-888, word-counter styles)

### Would Be Created (Minimum Fix)
- `src/presentation/webview/components/shared/WordCounter.tsx` (new)

### Would Be Created (Better Solution)
- `src/presentation/webview/components/shared/WordCounter.tsx` (new)
- `src/shared/constants/wordLimits.ts` (new)

### Related
- `src/utils/textUtils.ts` (backend word counting, could be unified)
- `src/application/services/AIResourceOrchestrator.ts` (backend trimming uses different limits: 50K words)

---

## Decision Log

### 2025-11-02: Debt Identified
- **Decision**: Document as architecture debt, defer fix until v1.1
- **Rationale**: Feature is functional, duplication is acceptable for v1.0 ship
- **Action**: Created this tracking document

### Future Decision Points
- [ ] **Before v1.1**: Decide on minimum fix (1 hour investment)
- [ ] **After adding 5+ inputs**: Revisit better solution
- [ ] **If users request customization**: Consider configuration-driven approach

---

## Testing Considerations

### Current Implementation
- Manual testing only (visual verification)
- No unit tests for word counting logic

### Minimum Fix
- Unit tests: WordCounter component (props, thresholds, color classes)
- Visual regression tests: Storybook stories for all states

### Better Solution
- Unit tests: WordCounter component + preset system
- Unit tests: WORD_LIMITS constants validation
- Integration tests: Settings context integration

---

## Related Architecture Debt

- [Settings Sync Registration](2025-11-02-settings-sync-registration.md) - Hardcoded settings watcher

---

**Status**: ✅ RESOLVED
**Resolved**: 2025-11-24
**Resolution**: Implemented "Minimum Fix" - WordCounter component extracted to `src/presentation/webview/components/shared/WordCounter.tsx`
**PR**: [#39](https://github.com/okeylanders/prose-minion-vscode/pull/39)
**Related ADR**: [Context Window Trim Limits](../../docs/adr/2025-11-02-context-window-trim-limits.md)
