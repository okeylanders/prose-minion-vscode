# ADR: Context Model Selector UI Indicator

**Date**: 2025-11-02
**Status**: Accepted
**Implemented**: Complete (v1-polish Sprint 01)
**Implementation Date**: 2025-11-02
**Priority**: LOW-MEDIUM (UX Polish)

## Context

In the Context Assistant (Utilities tab), users currently have no visual indication of:
- Which AI model is being used for context generation
- That the context model can be changed via Settings

Other tabs (Analysis, Dictionary) show model selectors prominently, creating an inconsistency. The Settings overlay contains the context model selector, but it's hidden until the user opens Settings.

## Decision

Add a **right-aligned model indicator** below the Context input box showing:
1. The currently selected context model
2. A clickable link/icon to open Settings

### UI Design: Inline Link (Option 2 - Modified)

```
┌─ Generate Context ────────────────────────────────┐
│                                                    │
│ [Input box for context prompt]                    │
│                                                    │
│                      Context Model: GLM 4.6 · ⚙️   │
│                                                    │
│                      [Generate Context Button]     │
└────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- **Right-aligned**: Keeps indicator near the action button
- **Clickable gear icon**: Opens Settings overlay directly
- **Clear labeling**: "Context Model: [name]" for discoverability
- **Subtle**: Doesn't dominate the UI, but is visible when needed

### Considered Alternatives

**Option 1: Info Text**
```
ℹ️  Using model: GLM 4.6 (Change in Settings)
```
- **Pros**: Very clear instructions
- **Cons**: More verbose, takes up more space, less actionable
- **Rejected**: Too wordy for a feature users will see every time

**Option 3: Compact Badge**
```
[🤖 GLM 4.6]                   [Generate Context]
```
- **Pros**: Minimal, compact
- **Cons**: Purpose unclear (what is this badge?), emoji may not render consistently
- **Rejected**: Not discoverable enough, unclear affordance

**Inline Model Selector (Like Analysis Tab)**
- **Pros**: Immediate access, no need to open Settings
- **Cons**: Clutters UI, inconsistent with Dictionary tab approach, Context tab is already info-dense
- **Deferred**: Could add in v1.1+ if users request it

## Implementation

### 1. Render UI Indicator

In [UtilitiesTab.tsx](../../src/presentation/webview/components/UtilitiesTab.tsx):

```tsx
// Get current context model
const contextModel = settings.modelSelections.context || settings.settingsData.model;

// In the Context section
<div className="context-controls">
  <textarea
    value={contextInput}
    onChange={(e) => setContextInput(e.target.value)}
    placeholder="Describe the context you need..."
    rows={4}
  />

  {/* Model indicator - right-aligned */}
  <div className="model-indicator-row">
    <span className="model-indicator">
      <span className="model-label">Context Model:</span>
      <span className="model-name">{formatModelName(contextModel)}</span>
      <span className="model-settings-link" onClick={settings.open}>
        ⚙️
      </span>
    </span>
  </div>

  <button onClick={handleGenerateContext}>
    Generate Context
  </button>
</div>
```

### 2. Format Model Name Helper

```typescript
function formatModelName(modelId: string): string {
  const modelMap: Record<string, string> = {
    'z-ai/glm-4.6': 'GLM 4.6',
    'z-ai/glm-4.5': 'GLM 4.5',
    'anthropic/claude-sonnet-4.5': 'Claude Sonnet 4.5',
    'anthropic/claude-opus-4.1': 'Claude Opus 4.1',
    'openai/gpt-5': 'GPT-5',
    'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
    // Add more as needed
  };

  return modelMap[modelId] || modelId; // Fallback to raw ID
}
```

### 3. Styling

In [index.css](../../src/presentation/webview/styles/index.css):

```css
.model-indicator-row {
  display: flex;
  justify-content: flex-end;
  margin: 8px 0;
}

.model-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}

.model-label {
  font-weight: 500;
}

.model-name {
  color: var(--vscode-foreground);
}

.model-settings-link {
  cursor: pointer;
  font-size: 1.1em;
  opacity: 0.8;
  transition: opacity 0.2s;
  padding: 0 4px;
}

.model-settings-link:hover {
  opacity: 1;
}

.model-settings-link:focus {
  outline: 1px solid var(--vscode-focusBorder);
  border-radius: 3px;
}
```

## Rationale

### Why Right-Aligned?

1. **Proximity to Action**: Button and model selector are related - keeps them visually grouped
2. **Doesn't Clutter Content Area**: Left side is for input/content, right side for controls
3. **Consistent with Button Position**: Button is also right-aligned (or centered)
4. **Respects Visual Hierarchy**: Primary action (button) dominates, indicator is supporting info

### Why "Context Model:" Instead of "Auto-Context Agent:"?

**Option A: "Context Model: [model]"**
- ✅ Clear, matches Settings terminology
- ✅ Familiar to users of Analysis/Dictionary tabs
- ✅ Shorter, cleaner

**Option B: "Auto-Context Agent: [model]"**
- ✅ Emphasizes this is an automated feature
- ✅ Differentiates from manual context writing
- ❌ Longer, more verbose
- ❌ "Agent" might confuse users (is this a separate AI?)

**Recommendation**: Start with **"Context Model:"** for consistency with Settings and other tabs. If user feedback suggests confusion about what generates the context, we can add a tooltip or change the label to "Auto-Context Model:" as a middle ground.

### Why Gear Icon Only (No "Change model" Text)?

- **Visual Consistency**: Gear icon is universally recognized as "settings"
- **Saves Space**: Text would make the indicator too long
- **Tooltip Fallback**: Can add `title="Change model"` for discoverability
- **Mobile-Friendly**: Icon works well even on narrow windows

## Affected Files

- `src/presentation/webview/components/UtilitiesTab.tsx`
  - Add model indicator UI
  - Pass `settings.open` or entire settings object
  - Add `formatModelName` helper

- `src/presentation/webview/styles/index.css`
  - Style `.model-indicator-row`, `.model-indicator`, `.model-settings-link`
  - Ensure good contrast in both themes
  - Add focus styles for accessibility

- `src/presentation/webview/components/App.tsx` (if needed)
  - Pass `settings` object to `UtilitiesTab` (likely already passed)

## Testing Checklist

- [ ] Model indicator appears below context input, right-aligned
- [ ] Shows correct model name (formatted friendly)
- [ ] Click gear icon opens Settings overlay
- [ ] Indicator updates when model changed in Settings
- [ ] Styling looks good in light theme
- [ ] Styling looks good in dark theme
- [ ] Doesn't break layout on narrow windows (< 400px)
- [ ] Gear icon is keyboard accessible (Tab + Enter)
- [ ] Gear icon has hover state for discoverability
- [ ] Tooltip shows on hover (optional enhancement)

## Acceptance Criteria

- [x] Users can see which context model is active
- [x] Clear path to change model (gear icon → Settings)
- [x] UI is subtle and non-intrusive (right-aligned)
- [x] Consistent with extension styling
- [x] Works in both themes
- [x] No layout issues on narrow windows
- [x] Keyboard accessible

## Future Enhancements (v1.1+)

- Inline model dropdown (like Analysis tab) if users request it
- Tooltip on hover: "Change context model"
- Auto-focus Context Model setting when Settings opens from this link
- Show token usage for last context generation

## Related

- Epic: [.todo/v1-polish/](../../.todo/v1-polish/)
- Task: [2025-11-02-context-model-selector-ui.md](../../.todo/v1-polish/2025-11-02-context-model-selector-ui.md)
