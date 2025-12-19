# Sprint 02: Word Length Filter for Word Frequency

**Epic**: [epic-v1-polish](../epic-v1-polish.md)
**Date**: 2025-11-02
**Status**: Planned
**Branch**: `sprint/epic-v1-polish-2025-11-02-02-word-length-filter-metrics`
**Estimated Time**: 2-3 hours

## Goals

Add a word length filter dropdown to the Word Frequency subtool, allowing users to filter results by minimum word length to focus on longer, more distinctive words and identify stylistic patterns.

## Problem

Word Frequency results are dominated by short, common words (it, is, an, the, a), making it difficult to spot:
- Multi-syllable word repetition (very, just, really, actually, suddenly)
- Distinctive vocabulary (6+ character words)
- Stylistic tics buried in noise
- Single-character word overuse patterns

Writers care more about longer word repetition, but these are lost in the noise of hundreds of short word instances.

**Example**: "just" appears 47 times in a chapter - very noticeable when filtered to 4+ char words, but lost when viewing all words.

## Solution

Add a dropdown filter with options:
- **All** - No filter (current behavior)
- **1** - Single-character words only (I, a)
- **2+** - 2+ characters
- **3+** - 3+ characters (removes it, is, an)
- **4+** - 4+ characters (substantial words)
- **5+** - 5+ characters (multi-syllable)
- **6+** - 6+ characters (distinctive vocabulary)

Filter applies to:
- ✅ Top Words table (with recalculated percentages)
- ✅ Hapax list (with updated count/percentage)
- ✅ Bigrams/Trigrams (filter component words)
- ✅ Top Lemmas (if enabled)
- ❌ Stopwords (inherently short, filtering doesn't make sense)
- ❌ Length Histogram (already shows length breakdown)

## Implementation Plan

### 1. Epic & Sprint Setup
- [ ] Update epic document to reference Sprint 02
- [ ] Create sprint document
- [ ] Verify ADR is complete
- [ ] Create Git branch

### 2. Hook Changes (`useMetrics.ts`)
- [ ] Add `wordLengthFilter` state (default: 'all')
- [ ] Add `setWordLengthFilter` action
- [ ] Add `metricsWordLengthFilter` to persisted state
- [ ] Initialize from persisted state on mount

### 3. Component Changes (`MetricsTab.tsx`)
- [ ] Add filter dropdown UI in Word Frequency section
- [ ] Wire up dropdown to `wordLengthFilter` state
- [ ] Pass filter value to result formatter (or filter in component)
- [ ] Position dropdown above results table

### 4. Filtering Logic (`resultFormatter.ts` or component)
- [ ] Create `filterWordsByLength()` helper
- [ ] Apply filter to `topWords` array
- [ ] Apply filter to `hapaxList` array
- [ ] Apply filter to `topLemmaWords` array (if enabled)
- [ ] Recalculate `hapaxCount` after filtering
- [ ] Apply filter to bigrams/trigrams (filter by min component word length)
- [ ] Skip filtering for stopwords and histogram

### 5. Styling (`index.css`)
- [ ] Add `.word-frequency-controls` container
- [ ] Style dropdown to match VSCode theme
- [ ] Add hover and focus states
- [ ] Test in light theme
- [ ] Test in dark theme
- [ ] Ensure responsive layout

### 6. Testing
- [ ] Test all filter options (All, 1, 2+, 3+, 4+, 5+, 6+)
- [ ] Verify Top Words filters correctly
- [ ] Verify Hapax list filters correctly
- [ ] Verify Hapax count updates in header
- [ ] Verify Bigrams/Trigrams respect filter
- [ ] Verify Lemmas filter (if enabled)
- [ ] Verify Stopwords NOT filtered
- [ ] Verify Histogram NOT filtered
- [ ] Test filter persistence across sessions
- [ ] Test keyboard accessibility
- [ ] Test in both themes

### 7. Documentation
- [ ] Update memory bank with sprint completion
- [ ] Create PR description with examples

## Tasks Breakdown

### Phase 1: State Management (45 min)
1. **Update useMetrics hook** (30 min)
   - Add `wordLengthFilter` state
   - Add persistence
   - Export new action and state

2. **Wire up MetricsTab** (15 min)
   - Pass filter state from App → MetricsTab
   - Add props to MetricsTab interface

### Phase 2: UI Implementation (45 min)
3. **Add Filter Dropdown** (20 min)
   - Create dropdown in Word Frequency section
   - Wire up onChange handler
   - Position correctly in layout

4. **Add Styling** (25 min)
   - Style filter controls container
   - Style dropdown to match VSCode theme
   - Add hover/focus states
   - Test in both themes

### Phase 3: Filtering Logic (60 min)
5. **Create Filter Helper** (20 min)
   - Write `filterWordsByLength()` function
   - Handle exact match (filter="1") vs min length (filter="3+")
   - Add unit tests (optional)

6. **Apply Filtering** (40 min)
   - Filter `topWords` before rendering
   - Filter `hapaxList` before rendering
   - Filter `topLemmaWords` (if enabled)
   - Recalculate `hapaxCount` and `hapaxPercent`
   - Handle bigrams/trigrams filtering
   - Ensure stopwords/histogram NOT filtered

### Phase 4: Testing & Polish (30 min)
7. **Manual Testing** (20 min)
   - Test all filter options on real content
   - Verify percentages recalculate correctly
   - Test persistence across reload
   - Test keyboard navigation

8. **Documentation** (10 min)
   - Update memory bank
   - Create PR description with examples

## Acceptance Criteria

### Functionality
- [ ] Filter dropdown appears in Word Frequency section, above results
- [ ] Dropdown has all 7 options (All, 1, 2+, 3+, 4+, 5+, 6+)
- [ ] "All" shows complete results (preserves current behavior)
- [ ] "1" shows only single-character words (I, a, etc.)
- [ ] "3+" excludes words like "it", "is", "an" but includes "the", "and"
- [ ] "6+" shows only 6+ character words
- [ ] Top Words table filters correctly
- [ ] Top Words percentages recalculate after filtering
- [ ] Hapax list filters correctly
- [ ] Hapax count and percentage update in header after filtering
- [ ] Bigrams/Trigrams respect filter (filter by component word length)
- [ ] Top Lemmas filter correctly (if lemmas enabled)
- [ ] Top Stopwords NOT filtered (always shows all)
- [ ] Length Histogram NOT filtered (always shows all)

### State Management
- [ ] Filter selection persists across tab switches
- [ ] Filter selection persists across sessions (vscode.setState)
- [ ] Default is "All" for new users
- [ ] Filter applies only to Word Frequency, not Prose Stats or Style Flags

### UI/UX
- [ ] Dropdown is clearly labeled ("Show words:")
- [ ] Dropdown is keyboard accessible (Tab + Arrow keys + Enter)
- [ ] Dropdown has focus outline when focused
- [ ] Dropdown styling matches VSCode theme (light and dark)
- [ ] No layout shifts when changing filter
- [ ] Filter UI appears only when viewing Word Frequency results

### Edge Cases
- [ ] Empty results handled gracefully (no words match filter)
- [ ] Very long word lists filter instantly (< 100ms perceived lag)
- [ ] Filter works correctly with "content words only" toggle
- [ ] Filter works correctly with lemmas enabled/disabled

## Related

### ADR
- [2025-11-02-word-length-filter-metrics.md](../../../docs/adr/2025-11-02-word-length-filter-metrics.md)

### Files to Modify
- `src/presentation/webview/hooks/domain/useMetrics.ts` - Add filter state
- `src/presentation/webview/components/MetricsTab.tsx` - Add filter UI
- `src/presentation/webview/components/App.tsx` - Wire up filter state
- `src/presentation/webview/utils/resultFormatter.ts` - Add filtering logic
- `src/presentation/webview/styles/index.css` - Add filter styles

### Reference
- [.todo/v1-polish/2025-11-02-word-length-filter-metrics.md](../../../.todo/v1-polish/2025-11-02-word-length-filter-metrics.md) - Original feature spec

## Testing Checklist

### Filter Options
- [ ] **All** - Shows complete word list (current behavior)
- [ ] **1** - Shows only I, a, A, etc.
- [ ] **2+** - Removes single letters, shows "it", "is", "an", etc.
- [ ] **3+** - Removes "it", "is", "an", shows "the", "and", etc.
- [ ] **4+** - Shows substantial words (very, just, said, etc.)
- [ ] **5+** - Shows multi-syllable words (really, almost, etc.)
- [ ] **6+** - Shows distinctive vocabulary (suddenly, somehow, etc.)

### Sections Affected
- [ ] **Top Words** - Filters correctly, percentages recalculate
- [ ] **Hapax List** - Filters correctly, count updates in header
- [ ] **Bigrams** - Filters by component word length (e.g., "3+" excludes "it was")
- [ ] **Trigrams** - Filters by component word length
- [ ] **Top Lemmas** - Filters correctly (if enabled)
- [ ] **Top Stopwords** - NOT filtered (always shows all)
- [ ] **Length Histogram** - NOT filtered (always shows all)
- [ ] **POS Breakdown** - NOT filtered (optional for v1.0)

### Persistence
- [ ] Filter persists when switching to Prose Stats and back
- [ ] Filter persists when switching to Style Flags and back
- [ ] Filter persists across webview reload
- [ ] Filter persists across VSCode restart
- [ ] Default is "All" for first-time users

### Styling
- [ ] Dropdown aligned correctly (left or centered)
- [ ] Label is clear and readable
- [ ] Good contrast in light theme
- [ ] Good contrast in dark theme
- [ ] Hover effect on dropdown
- [ ] Focus outline visible
- [ ] No layout issues on narrow windows (< 400px)

### Accessibility
- [ ] Dropdown is tabbable
- [ ] Arrow keys navigate options
- [ ] Enter selects option
- [ ] Screen reader announces label and value
- [ ] Color contrast meets WCAG AA

## Success Metrics

- Users can quickly filter word lists to find repetitive longer words
- "4+" and "5+" filters are most commonly used
- Positive feedback on discoverability of stylistic tics
- Reduces time spent manually scanning word lists

## Use Case Examples

### Example 1: Find Overused Modifiers
**Setup**: Author has a 5000-word chapter
**Action**: Select "4+ characters" filter
**Results**:
```
Top Words (4+ characters):
1. very (34 occurrences, 0.7%)
2. just (28 occurrences, 0.6%)
3. really (19 occurrences, 0.4%)
4. actually (15 occurrences, 0.3%)
5. suddenly (12 occurrences, 0.2%)
```
**Outcome**: Author identifies overused modifiers and reduces repetition

### Example 2: Check "I" Overuse in First Person
**Setup**: Author suspects too many "I" instances in narrative
**Action**: Select "1 character" filter
**Results**:
```
Top Words (1 character):
1. I (487 occurrences, 9.7%)
2. a (234 occurrences, 4.7%)
```
**Outcome**: Confirms "I" overuse, revises to vary sentence structure

### Example 3: Identify Hedge Words
**Setup**: Editor feedback mentions too much hedging
**Action**: Select "5+ characters" filter
**Results**:
```
Top Words (5+ characters):
1. somehow (23 occurrences)
2. slightly (18 occurrences)
3. perhaps (16 occurrences)
4. almost (14 occurrences)
```
**Outcome**: Author identifies and removes unnecessary qualifiers

## Notes

- UI-only filtering recommended for v1.0 (simple, fast, no backend changes)
- Backend filtering can be added in v1.1+ if performance issues arise
- Filtering is instant for typical word lists (< 1000 words)
- Filter state should be part of metrics domain hook (not global)
- Consider adding filter info to export metadata (v1.1+)

## Potential Issues & Mitigations

### Issue: Percentages become meaningless after filtering
**Mitigation**: Recalculate percentages based on filtered total, OR show both filtered and total percentages

### Issue: Empty results confuse users
**Mitigation**: Show message "No words match the selected filter" when results are empty

### Issue: Bigram/Trigram filtering is ambiguous
**Mitigation**: Filter by minimum component word length (e.g., "3+" requires ALL words in bigram to be 3+ chars)

### Issue: Filter affects export
**Mitigation**: Include filter info in export metadata, OR always export unfiltered data with note about active filter

## Completion Summary

_To be filled in after implementation_

### ✅ Implemented

_Files modified, features added, testing results_

### Testing Notes

_Manual testing observations, edge cases found_

### Next Steps

_PR creation, memory bank update, next sprint planning_
