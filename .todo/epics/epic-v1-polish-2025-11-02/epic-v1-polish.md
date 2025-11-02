# Epic: v1 Polish & UX Refinements

**Date**: 2025-11-02
**Status**: In Progress
**Priority**: MEDIUM
**Target**: v1.0 Release Readiness

## Overview

Final polish pass on Prose Minion's UI/UX before the v1.0 release. This epic focuses on small but impactful improvements that enhance discoverability, usability, and overall user experience without adding major new features.

## Goals

1. **Improve Discoverability**: Make features more visible and understandable
2. **Enhance Interaction**: Add interactive elements where they improve workflow
3. **Refine Visual Feedback**: Ensure users understand what's happening and what they can do
4. **Consistency**: Align UI patterns across tabs and features

## Scope

### In Scope

- Small UI enhancements that improve existing features
- Adding visual indicators for model selections
- Making resource references more interactive
- Refining metrics display and filtering
- Aligning UI patterns across tabs

### Out of Scope

- Major new features (save for v1.1+)
- Architectural changes
- Breaking changes to existing workflows
- Performance optimization (separate epic)

## Planned Sprints

### Sprint 01: Context Model Selector UI ✅ (Current)
**Status**: In Progress
**Branch**: `sprint/epic-v1-polish-2025-11-02-01-context-model-selector-ui`

Add a visual indicator showing which AI model is used for context generation, with a quick link to change it in Settings.

**Tasks**:
- ✅ Create ADR for UI design
- [ ] Implement right-aligned model indicator in UtilitiesTab
- [ ] Add styling (right-aligned, subtle, accessible)
- [ ] Wire up gear icon to open Settings
- [ ] Test in both themes
- [ ] Update memory bank

**ADR**: [2025-11-02-context-model-selector-ui.md](../../docs/adr/2025-11-02-context-model-selector-ui.md)

### Sprint 02: Tune Button Refinements (Planned)
**Status**: Planned

Refine the "Tune Dialog Beat" and "Tune Prose" buttons based on user feedback and visual consistency.

**Scope TBD**: To be defined after Sprint 01 completion

### Sprint 03: Word Length Filter in Metrics (Potential)
**Status**: Backlog

Add filtering by word length in the word frequency metrics to help writers identify overused short/long words.

**Reference**: [.todo/v1-polish/2025-11-02-word-length-filter-metrics.md](../../.todo/v1-polish/2025-11-02-word-length-filter-metrics.md)

### Sprint 04: Context Window Trim Limits (Potential)
**Status**: Backlog

Add visual feedback when context approaches token limits and automatic smart trimming.

**Reference**: [.todo/v1-polish/2025-11-02-context-window-trim-limits.md](../../.todo/v1-polish/2025-11-02-context-window-trim-limits.md)

## Success Metrics

- All existing features have clear visual indicators
- Users can discover model selection without reading docs
- Interactive elements respond predictably
- Consistent styling across all tabs
- No regressions in existing functionality
- Positive user feedback on polish improvements

## Related

### ADRs
- [2025-11-02-clickable-resource-pills.md](../../docs/adr/2025-11-02-clickable-resource-pills.md) ✅ (Completed)
- [2025-11-02-context-model-selector-ui.md](../../docs/adr/2025-11-02-context-model-selector-ui.md) (Current)

### Other Epics
- [epic-clickable-resource-pills-2025-11-02](../epic-clickable-resource-pills-2025-11-02/) ✅ (Completed)
- [epic-context-window-safety-2025-11-02](../epic-context-window-safety-2025-11-02/) ✅ (Completed)

## Notes

- This epic collects the remaining items from `.todo/v1-polish/` that weren't part of other epics
- Each sprint is small (1-2 hours) for quick iteration
- Focus on user-facing improvements, not internal refactoring
- All changes should be non-breaking and backward compatible
