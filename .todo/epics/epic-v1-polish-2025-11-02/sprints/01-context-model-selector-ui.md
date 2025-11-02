# Sprint 01: Context Model Selector UI

**Epic**: [epic-v1-polish](../epic-v1-polish.md)
**Date**: 2025-11-02
**Status**: In Progress
**Branch**: `sprint/epic-v1-polish-2025-11-02-01-context-model-selector-ui`
**Estimated Time**: 1 hour

## Goals

Add a visual indicator in the Context Assistant showing which AI model is being used for context generation, with a quick link to open Settings and change it.

## Problem

Users currently have no indication of:
- Which model is generating their context
- That they can change the context model
- Where to go to change it

This creates a discoverability issue, especially since Analysis and Dictionary tabs show model selection prominently.

## Solution

Add a right-aligned model indicator below the context input:

```
[Context input textarea................................] [🤖]

                               Context Model: GLM 4.6 ⚙️
```

- **Right-aligned**: Keeps indicator near the generate button
- **Clear label**: "Context Model: [name]" for discoverability
- **Clickable gear**: Opens Settings overlay directly (via `settings.open()`)
- **Subtle styling**: VSCode colors, doesn't dominate the UI

## Implementation Plan

### 1. Epic & Sprint Setup ✅
- [x] Create epic structure
- [x] Create sprint document
- [x] Create ADR
- [x] Create Git branch

### 2. Component Changes
- [ ] Update `UtilitiesTab.tsx` to add model indicator
- [ ] Add `formatModelName()` helper function
- [ ] Pass `settings` object to component (likely already available)
- [ ] Wire up gear icon click to `settings.open()`

### 3. Styling
- [ ] Add `.model-indicator-row` (right-aligned flex container)
- [ ] Add `.model-indicator` (inline flex, subtle color)
- [ ] Add `.model-label`, `.model-name` styles
- [ ] Add `.model-settings-link` (clickable gear with hover/focus)
- [ ] Test in both light and dark themes

### 4. Testing
- [ ] Verify indicator appears and is right-aligned
- [ ] Verify correct model name displays
- [ ] Verify gear icon opens Settings
- [ ] Verify styling in both themes
- [ ] Test keyboard accessibility (Tab + Enter)
- [ ] Test on narrow window widths

### 5. Documentation
- [ ] Update memory bank with sprint completion
- [ ] Create PR description

## Tasks Breakdown

1. **Add Model Indicator UI** (20 min)
   - Get context model from settings
   - Render indicator row with label, model name, gear icon
   - Add formatModelName helper

2. **Add Styling** (15 min)
   - Create right-aligned container
   - Style indicator text and gear icon
   - Add hover/focus states
   - Test in both themes

3. **Testing & Polish** (15 min)
   - Manual testing in both themes
   - Keyboard accessibility check
   - Responsive layout check

4. **Documentation** (10 min)
   - Memory bank update
   - PR description

## Acceptance Criteria

- [ ] Model indicator appears below context input, right-aligned
- [ ] Shows current context model in friendly format (e.g., "GLM 4.6")
- [ ] Gear icon opens Settings overlay when clicked
- [ ] Indicator updates when model is changed in Settings
- [ ] Styling matches VSCode theme in both light and dark modes
- [ ] No layout issues on narrow windows
- [ ] Gear icon is keyboard accessible (Tab + Enter)
- [ ] Gear icon has visible hover state

## Related

### ADR
- [2025-11-02-context-model-selector-ui.md](../../../docs/adr/2025-11-02-context-model-selector-ui.md)

### Files to Modify
- `src/presentation/webview/components/UtilitiesTab.tsx`
- `src/presentation/webview/styles/index.css`
- `src/presentation/webview/components/App.tsx` (verify settings is passed)

### Reference Implementation
- Analysis tab model selector (for model name formatting)
- Dictionary tab (for settings integration pattern)

## Testing Checklist

- [ ] **Functionality**
  - [ ] Indicator appears in correct location
  - [ ] Displays correct model name
  - [ ] Gear icon opens Settings overlay
  - [ ] Updates when model changed

- [ ] **Styling**
  - [ ] Right-aligned properly
  - [ ] Good contrast in light theme
  - [ ] Good contrast in dark theme
  - [ ] Gear icon has hover effect
  - [ ] Gear icon has focus outline

- [ ] **Responsive**
  - [ ] Works on wide windows (> 800px)
  - [ ] Works on medium windows (400-800px)
  - [ ] Works on narrow windows (< 400px)
  - [ ] Text doesn't overflow or wrap awkwardly

- [ ] **Accessibility**
  - [ ] Gear icon is tabbable
  - [ ] Enter/Space activates gear icon
  - [ ] Focus outline is visible
  - [ ] Color contrast meets WCAG AA

## Success Metrics

- Users can immediately see which context model is active
- One-click access to change the model via Settings
- No visual clutter or layout disruption
- Consistent with rest of extension UI

## Notes

- No heavy dependency injection needed - `settings.open()` already available from `useSettings` hook
- Implementation is very straightforward, mostly UI work
- Can be completed in a single focused session
- Good opportunity to verify Settings integration works smoothly
