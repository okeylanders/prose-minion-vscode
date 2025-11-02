# PR: Context Model Selector UI Indicator

**Branch**: `sprint/epic-v1-polish-2025-11-02-01-context-model-selector-ui`
**Target**: `main`
**Type**: Feature (v1.0 Polish)
**Priority**: LOW-MEDIUM (UX Enhancement)

---

## Summary

Adds a visual indicator in the Context Brief section showing which AI model is being used for context generation, with a clickable gear icon that opens Settings. Improves discoverability and provides one-click access to change the context model without digging through settings.

## Changes

### Core Feature
- **Model Indicator**: Displays "Context Model: [model-id] ⚙️" on the same line as word counter
- **Clickable Gear Icon**: Opens Settings overlay when clicked
- **Smart Layout**: Word counter (left) + model indicator (right) in single row
- **Full Accessibility**: Keyboard navigation (Tab + Enter/Space), focus outlines, hover states

### Visual Design

**Layout** (After refinement):
```
0 words                      Context Model: x-ai/grok-code-fast-1 ⚙️
└─ Left                                                    Right ─┘
```

- Uses flexbox `space-between` to maximize space efficiency
- Right-aligned indicator stays near the 🤖 generate button
- Saves vertical space compared to stacked layout

### Technical Implementation

**Component Changes** (2 files):

- **AnalysisTab.tsx**
  - Added `contextModel` and `onOpenSettings` props
  - Wrapped word counter + model indicator in `.context-meta-row` flex container
  - Gear icon supports click, keyboard (Enter/Space), and focus

- **App.tsx**
  - Passed `settings.modelSelections.context` to show current model
  - Passed `settings.open` callback for gear icon click
  - No new message types needed - reuses existing Settings infrastructure

**Styling** (1 file):

- **index.css**
  - Added `.context-meta-row` flex container (space-between layout)
  - Added `.model-indicator` inline flex for label + model + gear
  - Added `.model-label`, `.model-name` semantic styles
  - Added `.model-settings-link` with hover/focus states
  - Smooth transitions (opacity + scale on hover)
  - VSCode theme variables for dark/light mode compatibility

### Design Decisions

**Why Show Raw Model ID?**
- Deferred model name formatter (e.g., "GLM 4.6" instead of "z-ai/glm-4.6")
- Raw ID is accurate and unambiguous
- Can add friendly formatter in v1.1+ if users request it

**Why Right-Aligned on Same Row?**
- Keeps indicator near the generate button (visual grouping)
- Saves vertical space (no extra line)
- Word counter and model info are related metadata
- Cleaner, more balanced layout

**Why Gear Icon Instead of Text Link?**
- Universally recognized as "settings"
- Saves space vs "Change model" text
- Consistent with Settings overlay icon in title bar
- Works well on narrow windows

## Implementation Notes

### No Heavy Dependency Injection Required! 🎉

This was remarkably simple to implement thanks to the existing `useSettings` hook:
- `settings.open()` already available - just pass it down
- `settings.modelSelections.context` already exposed - just read it
- No new handlers, no new message types, no constructor changes

The clean architecture + domain hooks pattern made this a ~45 minute implementation.

### Accessibility

- ✅ **Keyboard Navigation**: Tab to gear icon, Enter/Space to activate
- ✅ **Focus Outline**: Visible focus indicator using `--vscode-focusBorder`
- ✅ **ARIA Attributes**: `role="button"`, `tabIndex={0}`, `title` for tooltip
- ✅ **Hover Feedback**: Opacity + scale transition for discoverability
- ✅ **Screen Reader Friendly**: Semantic HTML with clear labels

## Files Changed

**3 files changed, 87 insertions(+), 13 deletions(-)**

### Modified Files
- `src/presentation/webview/components/AnalysisTab.tsx` (+52, -1)
  - Props interface extended with contextModel and onOpenSettings
  - Component signature updated to destructure new props
  - Rendered model indicator in flex row with word counter

- `src/presentation/webview/App.tsx` (+2, -0)
  - Passed settings.modelSelections.context to AnalysisTab
  - Passed settings.open callback to AnalysisTab

- `src/presentation/webview/index.css` (+33, -12)
  - Added .context-meta-row flex container
  - Added .model-indicator styles
  - Added .model-settings-link with hover/focus states

### New Files
- `docs/adr/2025-11-02-context-model-selector-ui.md` (ADR)
- `.todo/epics/epic-v1-polish-2025-11-02/epic-v1-polish.md` (Epic overview)
- `.todo/epics/epic-v1-polish-2025-11-02/sprints/01-context-model-selector-ui.md` (Sprint doc)

## Testing

### Build Status
✅ TypeScript compilation successful
✅ Webpack production build successful
✅ No errors or type issues

### Manual Testing Checklist
- [x] Indicator appears below context textarea
- [x] Shows correct context model ID
- [x] Gear icon opens Settings overlay on click
- [x] Keyboard navigation works (Tab + Enter/Space)
- [x] Hover effect visible (opacity + scale)
- [x] Focus outline visible when tabbed to gear
- [x] Layout responsive on narrow windows
- [x] Word counter and model indicator on same line
- [x] Right-aligned placement near generate button

### Screenshots
See:
- `Screenshot 2025-11-02 at 5.13.40 PM.png` (After layout refinement)

## Architecture Alignment ✅

### Clean Architecture Adherence
- ✅ **Presentation Layer**: Component props and UI rendering only
- ✅ **Domain Hooks Pattern**: Reuses existing `useSettings` hook
- ✅ **No Business Logic in UI**: Settings management stays in domain hook
- ✅ **Dependency Flow**: App → AnalysisTab (props down, callbacks up)

### Pattern Consistency
- Matches existing gear icon in title bar (Settings overlay toggle)
- Same hover/focus treatment as other interactive elements
- VSCode theme variables like all other components
- Keyboard accessibility pattern consistent with resource pills

## Related

### Documentation
- **ADR**: [docs/adr/2025-11-02-context-model-selector-ui.md](../adr/2025-11-02-context-model-selector-ui.md)
- **Epic**: [.todo/epics/epic-v1-polish-2025-11-02/epic-v1-polish.md](../../.todo/epics/epic-v1-polish-2025-11-02/epic-v1-polish.md)
- **Sprint**: [.todo/epics/epic-v1-polish-2025-11-02/sprints/01-context-model-selector-ui.md](../../.todo/epics/epic-v1-polish-2025-11-02/sprints/01-context-model-selector-ui.md)

### Other Epics
- [epic-clickable-resource-pills-2025-11-02](../../.todo/epics/epic-clickable-resource-pills-2025-11-02/) ✅ (Completed)
- [epic-context-window-safety-2025-11-02](../../.todo/epics/epic-context-window-safety-2025-11-02/) ✅ (Completed)

## Success Metrics

- ✅ Users can immediately see which context model is active
- ✅ One-click access to change model (gear → Settings)
- ✅ No visual clutter (single row layout)
- ✅ Consistent with extension UI patterns
- ✅ Fully accessible (keyboard + screen readers)

## Future Enhancements (v1.1+)

- Model name formatter (e.g., "GLM 4.6" instead of raw ID)
- Auto-focus Context Model setting when Settings opens from this link
- Inline model dropdown (like Analysis tab) if users request it
- Show token usage per model scope

---

**Actual Time**: ~45 minutes (under 1 hour estimate)
**Commits**: 3 (Setup, Implementation, Layout Refinement)
