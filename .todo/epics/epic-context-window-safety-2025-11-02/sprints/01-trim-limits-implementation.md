# Sprint 01: Context Window Trim Limits Implementation

**Sprint**: 01
**Epic**: [Context Window Safety](../epic-context-window-safety.md)
**Start Date**: 2025-11-02
**Status**: In Progress
**Sprint Goal**: Implement context window trimming with UI awareness and backend limits

---

## Sprint Overview

Implement the complete context window trimming feature in a single focused sprint:
1. Configuration setting for toggle control
2. Word counting utilities (pure functions)
3. Backend trimming logic in AIResourceOrchestrator
4. UI word counter components for excerpt inputs
5. Output Channel logging for transparency

**Estimated Effort**: 2-3 hours
**Target Completion**: Same day

## Sprint Scope

### Must Have (Sprint Goal)
- ✅ Configuration setting: `proseMinion.applyContextWindowTrimming`
- ✅ Word counting utilities (`countWords`, `trimToWordLimit`)
- ✅ Backend trimming for Context Agent (50K words)
- ✅ Backend trimming for Analysis Agents (75K words with prioritization)
- ✅ UI word counter on Analysis tab
- ✅ UI word counter on Context tab (Utilities)
- ✅ UI word counter on Dictionary tab
- ✅ Output Channel logging

### Should Have (Polish)
- ✅ Sentence boundary preservation in trimming
- ✅ Color-coded word counter (green/yellow/red)
- ✅ Clear visual warning at 500+ words
- ✅ Settings overlay integration

### Could Have (Nice to Have)
- ⚠️ Shared word counter component (if time permits)
- ⚠️ Unified styling for word counters
- ⚠️ Unit tests for utilities (recommended but not blocking)

### Won't Have (Out of Scope)
- ❌ Token counting (word count is sufficient for v1.0)
- ❌ Per-model limits (future enhancement)
- ❌ User notifications/popups (silent operation only)
- ❌ Configurable limits (hardcoded for v1.0)

## Tasks Breakdown

### Phase 1: Configuration & Utilities (30 min)

#### Task 1.1: Add Configuration Setting
**File**: `package.json`
**Acceptance Criteria**:
- [ ] Setting `proseMinion.applyContextWindowTrimming` added
- [ ] Type: `boolean`
- [ ] Default: `true`
- [ ] Clear markdown description with limits documented
- [ ] Order: 35 (logical placement)

**Implementation**:
```json
"proseMinion.applyContextWindowTrimming": {
  "type": "boolean",
  "default": true,
  "markdownDescription": "Apply context window trimming to prevent token limit errors. **Limits**: UI recommends 500-word excerpts; Context Agent (50K words), Analysis Agents (75K words total: excerpt + context + guides). Targets 128K token context window. Disable if using models with larger context windows (e.g., 200K+).",
  "order": 35
}
```

#### Task 1.2: Create Word Counting Utilities
**File**: `src/utils/textUtils.ts` (new file)
**Acceptance Criteria**:
- [ ] `countWords(text: string): number` implemented
- [ ] `trimToWordLimit(text: string, maxWords: number): TrimResult` implemented
- [ ] `TrimResult` interface defined
- [ ] Sentence boundary preservation logic
- [ ] Edge cases handled (empty text, no sentence boundaries)
- [ ] Pure functions (no side effects)

**Implementation**:
```typescript
export interface TrimResult {
  trimmed: string;
  originalWords: number;
  trimmedWords: number;
  wasTrimmed: boolean;
}

export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function trimToWordLimit(text: string, maxWords: number): TrimResult {
  const words = text.trim().split(/\s+/);
  const originalWords = words.length;

  if (originalWords <= maxWords) {
    return {
      trimmed: text,
      originalWords,
      trimmedWords: originalWords,
      wasTrimmed: false
    };
  }

  // Trim to max words
  const trimmedWords = words.slice(0, maxWords);
  let trimmed = trimmedWords.join(' ');

  // Try to end at a sentence boundary within last 50 words
  const lastFiftyWords = trimmedWords.slice(-50).join(' ');
  const lastSentenceMatch = lastFiftyWords.match(/[.!?]\s+/);

  if (lastSentenceMatch && lastSentenceMatch.index !== undefined) {
    const cutPoint = trimmed.length - lastFiftyWords.length + lastSentenceMatch.index + 1;
    trimmed = trimmed.substring(0, cutPoint).trim();
  }

  return {
    trimmed,
    originalWords,
    trimmedWords: countWords(trimmed),
    wasTrimmed: true
  };
}
```

---

### Phase 2: Backend Trimming Logic (60 min)

#### Task 2.1: Add Trimming to AIResourceOrchestrator
**File**: `src/application/services/AIResourceOrchestrator.ts`
**Acceptance Criteria**:
- [ ] Import word counting utilities
- [ ] Check `applyContextWindowTrimming` setting
- [ ] Implement Context Agent trimming (50K words)
- [ ] Implement Analysis Agent trimming (75K words with prioritization)
- [ ] Log trim operations to Output Channel
- [ ] No user-facing warnings or popups
- [ ] Excerpt never trimmed by backend (UI handles)

**Context Agent Logic**:
```typescript
// In orchestration method for context generation
const applyTrimming = vscode.workspace.getConfiguration('proseMinion')
  .get<boolean>('applyContextWindowTrimming', true);

if (applyTrimming) {
  const MAX_CONTEXT_WORDS = 50000;

  // Combine all context pieces
  let totalContext = excerpt + generatedContext + requestedResources;
  const totalWords = countWords(totalContext);

  if (totalWords > MAX_CONTEXT_WORDS) {
    const result = trimToWordLimit(totalContext, MAX_CONTEXT_WORDS);
    totalContext = result.trimmed;

    this.outputChannel.appendLine(
      `[Context Trim] Trimmed from ${result.originalWords} to ${result.trimmedWords} words`
    );
  }
}
```

**Analysis Agent Logic (with prioritization)**:
```typescript
// In orchestration method for analysis (dialogue/prose)
const applyTrimming = vscode.workspace.getConfiguration('proseMinion')
  .get<boolean>('applyContextWindowTrimming', true);

if (applyTrimming) {
  const MAX_ANALYSIS_WORDS = 75000;

  // Priority 1: Excerpt (never trim - user's selection)
  const excerptWords = countWords(excerpt);

  // Priority 2: Incoming context
  const contextWords = countWords(incomingContext);

  // Priority 3: Guides (trim if necessary)
  let guidesContent = loadedGuides;
  const guidesWords = countWords(guidesContent);

  const totalWords = excerptWords + contextWords + guidesWords;

  if (totalWords > MAX_ANALYSIS_WORDS) {
    // Calculate how many words to trim from guides
    const wordsToTrim = totalWords - MAX_ANALYSIS_WORDS;
    const remainingGuideWords = Math.max(0, guidesWords - wordsToTrim);

    if (remainingGuideWords < guidesWords) {
      const result = trimToWordLimit(guidesContent, remainingGuideWords);
      guidesContent = result.trimmed;

      this.outputChannel.appendLine(
        `[Analysis Trim] Guides trimmed from ${guidesWords} to ${remainingGuideWords} words (total: ${MAX_ANALYSIS_WORDS})`
      );
    }

    // If still over limit and we have context, trim context next
    const newTotal = excerptWords + contextWords + remainingGuideWords;
    if (newTotal > MAX_ANALYSIS_WORDS && contextWords > 0) {
      const contextToTrim = newTotal - MAX_ANALYSIS_WORDS;
      const remainingContextWords = Math.max(0, contextWords - contextToTrim);

      const contextResult = trimToWordLimit(incomingContext, remainingContextWords);
      incomingContext = contextResult.trimmed;

      this.outputChannel.appendLine(
        `[Analysis Trim] Context trimmed from ${contextWords} to ${remainingContextWords} words`
      );
    }
  }
}
```

---

### Phase 3: UI Word Counter (60 min)

#### Task 3.1: Add Word Counter to Analysis Tab
**File**: `src/presentation/webview/components/AnalysisTab.tsx`
**Acceptance Criteria**:
- [ ] Word counter displayed below excerpt textarea
- [ ] Real-time updates as user types/pastes
- [ ] Color coding: green (<400), yellow (400-499), red (500+)
- [ ] Warning indicator at 500+ words
- [ ] Non-blocking (user can still send)
- [ ] Responsive styling

**Implementation Pattern**:
```tsx
// Add word counter hook (inline or as utility)
const excerptWordCount = React.useMemo(() => {
  if (!excerptText || excerptText.trim().length === 0) return 0;
  return excerptText.trim().split(/\s+/).filter(w => w.length > 0).length;
}, [excerptText]);

const wordCountColor = React.useMemo(() => {
  if (excerptWordCount >= 500) return 'word-counter-red';
  if (excerptWordCount >= 400) return 'word-counter-yellow';
  return 'word-counter-green';
}, [excerptWordCount]);

// In JSX:
<div className="excerpt-input-container">
  <textarea
    value={excerptText}
    onChange={(e) => setExcerptText(e.target.value)}
    placeholder="Paste your excerpt here..."
    rows={8}
  />
  <div className={`word-counter ${wordCountColor}`}>
    {excerptWordCount} / 500 words
    {excerptWordCount > 500 && ' ⚠️ Large excerpt'}
  </div>
</div>
```

#### Task 3.2: Add Word Counter to Context Tab
**File**: `src/presentation/webview/components/UtilitiesTab.tsx` (or wherever context input is)
**Acceptance Criteria**:
- Same as Task 3.1 but for context generation excerpt input

#### Task 3.3: Add Word Counter to Dictionary Tab
**File**: `src/presentation/webview/components/UtilitiesTab.tsx` (Dictionary section)
**Acceptance Criteria**:
- Same as Task 3.1 but for dictionary lookup excerpt input

#### Task 3.4: Add Word Counter Styling
**File**: `src/presentation/webview/styles/index.css`
**Acceptance Criteria**:
- [ ] `.word-counter` base styles
- [ ] `.word-counter-green` styles
- [ ] `.word-counter-yellow` styles
- [ ] `.word-counter-red` styles
- [ ] Light and dark theme compatibility
- [ ] Subtle, non-intrusive appearance

**Implementation**:
```css
.word-counter {
  font-size: 0.85em;
  margin-top: 4px;
  font-family: var(--vscode-font-family);
}

.word-counter-green {
  color: var(--vscode-terminal-ansiGreen);
}

.word-counter-yellow {
  color: var(--vscode-terminal-ansiYellow);
}

.word-counter-red {
  color: var(--vscode-errorForeground);
  font-weight: 500;
}
```

---

### Phase 4: Testing & Verification (30 min)

#### Task 4.1: Manual Testing Checklist
- [ ] UI word counter appears on all tabs (Analysis, Context, Dictionary)
- [ ] Counter updates in real-time as user types
- [ ] Green color for 0-399 words
- [ ] Yellow color for 400-499 words
- [ ] Red color + warning for 500+ words
- [ ] Works in both light and dark themes
- [ ] Setting appears in Settings overlay
- [ ] Setting default is `true`
- [ ] Create 60K word test file for context agent
- [ ] Verify context agent trims to 50K words
- [ ] Check Output Channel for trim log
- [ ] Create 100K word test (excerpt + guides) for analysis
- [ ] Verify guides trimmed first
- [ ] Verify excerpt never trimmed
- [ ] Verify total ≤ 75K words
- [ ] Toggle setting off → no trimming
- [ ] Toggle setting on → trimming works

#### Task 4.2: Edge Case Testing
- [ ] Empty excerpt (word count = 0)
- [ ] Single word excerpt
- [ ] Extremely large excerpt (200K+ words)
- [ ] Text with no sentence boundaries (all one sentence)
- [ ] Text with unusual whitespace (tabs, newlines, multiple spaces)
- [ ] Non-English text (Unicode characters)

---

## Acceptance Criteria (Sprint Level)

### Functional Requirements
- [ ] Configuration setting exists and works
- [ ] Word counting utilities are accurate
- [ ] Context Agent respects 50K word limit when setting enabled
- [ ] Analysis Agents respect 75K word limit with prioritization
- [ ] Excerpt never trimmed by backend (UI counter handles user awareness)
- [ ] Guides trimmed before context in analysis agents
- [ ] Output Channel logs trim operations
- [ ] UI word counter visible on all relevant tabs
- [ ] Word counter updates in real-time
- [ ] Color coding works correctly
- [ ] Non-blocking (user can send large excerpts)

### Non-Functional Requirements
- [ ] Follows Clean Architecture principles from architectural review
- [ ] Type-safe implementation (no implicit `any`)
- [ ] Pure functions for utilities (no side effects)
- [ ] Performance impact negligible (word counting is fast)
- [ ] Code is maintainable and well-documented
- [ ] Sentence boundary preservation works (best effort)

### Documentation
- [ ] ADR created and linked
- [ ] Epic overview complete
- [ ] Sprint document complete (this file)
- [ ] Memory bank entry created
- [ ] Code comments explain trimming logic
- [ ] Setting description is clear and helpful

## Implementation Notes

### Architectural Principles to Follow

From the [Presentation Layer Review](../../../../docs/architectural-reviews/2025-11-02-presentation-layer-review.md):

1. **Single Responsibility Principle**
   - Word counter: responsible for UI feedback only
   - AIResourceOrchestrator: responsible for trimming logic only
   - Utilities: responsible for word counting/trimming only

2. **Type Safety**
   - Explicit interfaces for `TrimResult`
   - No implicit `any` types
   - Clear return types on all functions

3. **Domain Separation**
   - Frontend: user awareness (word counter)
   - Backend: resource management (trimming)
   - Clear boundary between UI and business logic

4. **Pure Functions**
   - `countWords` and `trimToWordLimit` have no side effects
   - Deterministic (same input → same output)
   - Easy to test in isolation

5. **Open/Closed Principle**
   - Trimming strategy is extensible (can add per-model limits later)
   - Setting toggle doesn't require changing core logic

### File Organization

```
src/
├── utils/
│   └── textUtils.ts                    # NEW: Word counting utilities
├── application/
│   └── services/
│       └── AIResourceOrchestrator.ts   # MODIFIED: Add trimming logic
└── presentation/
    └── webview/
        ├── components/
        │   ├── AnalysisTab.tsx         # MODIFIED: Add word counter
        │   └── UtilitiesTab.tsx        # MODIFIED: Add word counter
        └── styles/
            └── index.css               # MODIFIED: Add word counter styles
```

### Common Pitfalls to Avoid

1. ❌ **Don't block user input** - Word counter is informational, not a hard limit
2. ❌ **Don't trim excerpt in backend** - UI counter handles user awareness; backend should honor user's full excerpt selection
3. ❌ **Don't show popup warnings** - Silent operation via Output Channel only
4. ❌ **Don't use token counting** - Word counting is good enough for v1.0
5. ❌ **Don't forget edge cases** - Empty text, single word, no sentence boundaries
6. ❌ **Don't violate layer boundaries** - Word counter should not contain trimming logic

### Testing Strategy

#### Unit Tests (Optional but Recommended)
```typescript
describe('textUtils', () => {
  describe('countWords', () => {
    it('counts words correctly', () => {
      expect(countWords('hello world')).toBe(2);
    });

    it('handles empty text', () => {
      expect(countWords('')).toBe(0);
    });

    it('handles multiple spaces', () => {
      expect(countWords('hello    world')).toBe(2);
    });
  });

  describe('trimToWordLimit', () => {
    it('preserves text under limit', () => {
      const result = trimToWordLimit('hello world', 5);
      expect(result.wasTrimmed).toBe(false);
      expect(result.trimmed).toBe('hello world');
    });

    it('trims text over limit', () => {
      const result = trimToWordLimit('one two three four five', 3);
      expect(result.wasTrimmed).toBe(true);
      expect(result.trimmedWords).toBeLessThanOrEqual(3);
    });
  });
});
```

#### Integration Tests
- Test AIResourceOrchestrator with large inputs
- Verify setting toggle works
- Verify Output Channel receives logs

#### Manual Tests
- See Task 4.1 and 4.2 checklists above

---

## Related ADRs

- [ADR: Context Window Trim Limits (2025-11-02)](../../../../docs/adr/2025-11-02-context-window-trim-limits.md)

## Related Sprints

- None (first sprint in epic)

## Blockers

- None identified

## Sprint Retrospective

_(To be filled after sprint completion)_

### What Went Well
- TBD

### What Could Be Improved
- TBD

### Lessons Learned
- TBD

### Sprint Velocity
- TBD (estimated: 2-3 hours, actual: TBD)

---

**Sprint Status**: 🟡 In Progress
**Next Action**: Begin implementation (Phase 1)
**Last Updated**: 2025-11-02
