# Epic: Word Length Filter for Metrics

**Date**: 2025-11-02
**Status**: Planned
**Priority**: MEDIUM-HIGH (v1.0 Polish)
**Target**: v1.0 Release

## Overview

Add a word length filter to Word Frequency metrics, allowing writers to focus on longer, more distinctive words and identify stylistic patterns by filtering out short common words.

## Vision

**As a creative writer**, I want to filter word frequency results by word length, so that I can quickly spot overused modifiers and stylistic tics that are hidden in the noise of short common words.

**As a prose editor**, I want to help writers identify repetitive multi-syllable words (very, just, really, actually, suddenly) without manually scanning through hundreds of short word instances.

## Business Value

### User Experience
- ✅ **Faster pattern discovery** - Filter out noise to see what matters
- ✅ **Reduced cognitive load** - Don't scan through "it", "is", "an" to find "suddenly"
- ✅ **Better writing insights** - Focus on words readers actually notice
- ✅ **Intuitive UI** - Tab bar makes filtering obvious and one-click

### Technical Value
- ✅ **Clean architecture** - Segregated component, backend filtering
- ✅ **Consistent patterns** - Follows existing word frequency settings model
- ✅ **Smaller payloads** - Backend filters before sending data
- ✅ **Easy to maintain** - Filter logic in one place (backend)

## Success Metrics

### Primary Metrics
- **Users discover stylistic tics faster** (qualitative feedback)
- **"4+" and "5+" are most used filters** (telemetry in v1.1+)
- **Positive feedback on tab bar UI** (intuitive, discoverable)

### Secondary Metrics
- **No performance issues** with backend filtering
- **Tab bar works well in both themes**
- **Setting persists correctly** across sessions

## Scope

### In Scope

1. **Backend Settings Infrastructure** (Sprint 1)
   - Add `proseMinion.wordFrequency.minCharacterLength` setting (default: `1`)
   - Add setting to Settings overlay (Metrics section)
   - Wire ConfigurationHandler to handle updates

2. **Frontend Tab Bar UI** (Sprint 2a)
   - Create `WordLengthFilterTabs` component
   - Render below scope box in Metrics tab
   - Active tab highlight
   - Update setting on tab click

3. **Backend Filtering Logic** (Sprint 2b)
   - Read setting in `wordFrequency.ts`
   - Apply filter to: Top Words, POS, Bigrams, Trigrams, Hapax, Lemmas
   - Skip filtering for: Stop Words, Length Histogram
   - Send pre-filtered results to frontend

### Out of Scope

- Auto-refresh on setting change (defer to v1.1+)
- Custom character length input (defer to v1.1+)
- Multiple length ranges (e.g., "3-5 chars") (defer to v1.1+)
- Tooltip explanations on tab hover (defer to v1.1+)

## Planned Sprints

### Sprint 01: Backend Settings Infrastructure
**Status**: Planned
**Branch**: `sprint/epic-word-length-filter-metrics-2025-11-02-01-backend-settings-infrastructure`
**Estimated Time**: 1 hour

Add the `minCharacterLength` setting to package.json, Settings overlay, and ConfigurationHandler.

**Tasks**:
- [ ] Add setting schema to package.json
- [ ] Add dropdown to Settings overlay (Metrics section)
- [ ] Wire ConfigurationHandler to handle setting updates
- [ ] Test setting persistence
- [ ] Verify setting appears in VSCode settings UI

**Sprint Doc**: [sprints/01-backend-settings-infrastructure.md](sprints/01-backend-settings-infrastructure.md)

### Sprint 02: Frontend UI & Backend Filtering
**Status**: Planned
**Branch**: `sprint/epic-word-length-filter-metrics-2025-11-02-02-frontend-ui-and-backend-filtering`
**Estimated Time**: 2-3 hours

Create tab bar component, wire it up, and implement backend filtering logic.

**Tasks**:
- [ ] Create `WordLengthFilterTabs` component
- [ ] Render tab bar in MetricsTab below scope box
- [ ] Wire tab clicks to update setting
- [ ] Read setting in `wordFrequency.ts`
- [ ] Apply filtering to Top Words, POS, Bigrams, Trigrams, Hapax, Lemmas
- [ ] Skip filtering for Stop Words, Length Histogram
- [ ] Test all filter options (1+, 2+, 3+, 4+, 5+, 6+)
- [ ] Verify styling in both themes

**Sprint Doc**: [sprints/02-frontend-ui-and-backend-filtering.md](sprints/02-frontend-ui-and-backend-filtering.md)

## Architecture

### Backend Filtering Approach

Unlike typical UI filters, this uses **backend filtering** for:
- **Consistency** with existing word frequency settings (`contentWordsOnly`, `lemmasEnabled`)
- **Efficiency** (smaller payloads for large texts)
- **Simplicity** (filter logic in one place)
- **Single source of truth** (setting controls everything)

### Component Segregation

`WordLengthFilterTabs` is a separate, reusable component:
- Clear interface (`activeFilter`, `onFilterChange`)
- Self-contained styling
- Easy to test in isolation
- Could be reused for other filter UIs

### Message Flow

```
User clicks tab
    ↓
Frontend sends UPDATE_SETTING
    ↓
ConfigurationHandler updates VSCode config
    ↓
User re-runs Word Frequency
    ↓
Backend reads minCharacterLength
    ↓
Backend filters results
    ↓
Frontend displays pre-filtered data
```

## Related

### ADR
- [2025-11-02-word-length-filter-metrics.md](../../docs/adr/2025-11-02-word-length-filter-metrics.md)

### Original Spec
- [.todo/v1-polish/2025-11-02-word-length-filter-metrics.md](../../.todo/v1-polish/2025-11-02-word-length-filter-metrics.md)

### Other Epics
- [epic-v1-polish-2025-11-02](../epic-v1-polish-2025-11-02/) (parent epic for v1 polish items)

## Notes

- This epic is part of the broader v1 polish effort
- Focuses on a single, well-defined feature
- Two sprints allow for focused work on backend vs frontend concerns
- Backend filtering is a deliberate architectural choice (not UI-only)
- Tab bar UI pattern is intuitive and discoverable

## Acceptance Criteria

- [ ] Setting exists in package.json with enum [1, 2, 3, 4, 5, 6]
- [ ] Setting appears in Settings overlay with clear description
- [ ] Tab bar renders below scope box in Metrics tab
- [ ] Active tab is highlighted
- [ ] Clicking tab updates setting
- [ ] Backend filters results based on setting
- [ ] Filter applies to: Top Words, POS, Bigrams, Trigrams, Hapax, Lemmas
- [ ] Filter does NOT apply to: Stop Words, Length Histogram
- [ ] Default is `1` (all words)
- [ ] Setting persists across sessions
- [ ] Tab bar works in both themes
- [ ] Keyboard accessible

## Future Enhancements (v1.1+)

- Auto-refresh on setting change (immediate update without re-running tool)
- Custom character length input field
- Multiple length ranges (e.g., "3-5 characters", "6-8 characters")
- Tooltip on tab hover explaining what gets filtered
- Combine with POS filter (e.g., "Show 5+ character verbs")
- Export metadata includes active filter information
