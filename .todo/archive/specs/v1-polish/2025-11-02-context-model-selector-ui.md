# Context Model Selector UI Update

**Date**: 2025-11-02
**Priority**: LOW-MEDIUM (UX Polish)
**Status**: DONE
**Estimated Time**: 1 hour

## Problem

In the Context Assistant (Utilities tab):
- Users may not realize which AI model is being used for context generation
- No visual indication that context model can be changed
- Settings overlay has the selector, but it's hidden away
- Other tabs show model selectors prominently (Analysis, Dictionary)

## Solution

Add a subtle UI indicator below the Context input box showing:
1. Which context model is currently selected
2. That it can be adjusted in Settings

### Proposed UI

**Location**: Below the context generation input box, above the "Generate Context" button

**Design Option 1: Info Text** (Simplest)
```
┌─ Generate Context ────────────────────────────────┐
│                                                    │
│ [Input box for context prompt]                    │
│                                                    │
│ ℹ️  Using model: GLM 4.6 (Change in Settings)     │
│                                                    │
│           [Generate Context Button]                │
└────────────────────────────────────────────────────┘
```

**Design Option 2: Inline Link** (More actionable)
```
┌─ Generate Context ────────────────────────────────┐
│                                                    │
│ [Input box for context prompt]                    │
│                                                    │
│ Using: GLM 4.6 · [Change model ⚙️]                 │
│                                                    │
│           [Generate Context Button]                │
└────────────────────────────────────────────────────┘
```
(Clicking "Change model" opens Settings overlay with Context Model focused)

**Design Option 3: Compact Badge** (Minimal)
```
┌─ Generate Context ────────────────────────────────┐
│                                                    │
│ [Input box for context prompt]                    │
│                                                    │
│ [🤖 GLM 4.6]                   [Generate Context]  │
└────────────────────────────────────────────────────┘
```
(Badge shows model, clicking opens Settings)

**Recommendation**: Option 2 (Inline Link) - clear, actionable, not too intrusive

## Implementation

### 1. Get Current Context Model

```typescript
// In useContext hook or UtilitiesTab
const contextModel = settings.contextModel || settings.model; // Fallback to legacy
```

### 2. Render UI Indicator

```tsx
// In UtilitiesTab.tsx, Context section
<div className="context-controls">
  <textarea
    value={contextInput}
    onChange={(e) => setContextInput(e.target.value)}
    placeholder="Describe the context you need..."
    rows={4}
  />

  {/* NEW: Model indicator */}
  <div className="model-indicator">
    <span className="model-name">
      Using: {formatModelName(contextModel)}
    </span>
    <span className="model-change-link" onClick={openSettingsToContextModel}>
      Change model ⚙️
    </span>
  </div>

  <button onClick={handleGenerateContext}>
    Generate Context
  </button>
</div>
```

### 3. Open Settings to Context Model

```typescript
const openSettingsToContextModel = () => {
  // Open settings overlay
  settings.open();

  // Optional: Auto-scroll/focus to Context Model setting
  // Could send a message to focus specific setting
  vscode.postMessage({
    type: MessageType.OPEN_SETTINGS,
    source: 'webview.utilities.tab',
    payload: {
      focusSetting: 'contextModel' // Optional enhancement
    },
    timestamp: Date.now()
  });
};
```

### 4. Format Model Name (Friendly Display)

```typescript
function formatModelName(modelId: string): string {
  // Convert "z-ai/glm-4.6" → "GLM 4.6"
  // Convert "anthropic/claude-sonnet-4.5" → "Claude Sonnet 4.5"

  const modelMap: Record<string, string> = {
    'z-ai/glm-4.6': 'GLM 4.6',
    'z-ai/glm-4.5': 'GLM 4.5',
    'anthropic/claude-sonnet-4.5': 'Claude Sonnet 4.5',
    'anthropic/claude-opus-4.1': 'Claude Opus 4.1',
    'openai/gpt-5': 'GPT-5',
    'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
    // ... etc
  };

  return modelMap[modelId] || modelId; // Fallback to ID if not mapped
}
```

## Affected Files

### Frontend
- `src/presentation/webview/components/UtilitiesTab.tsx`
  - Add model indicator UI
  - Add click handler to open settings

- `src/presentation/webview/hooks/domain/useSettings.ts`
  - Expose `contextModel` (probably already available)
  - Maybe add `openToSetting(settingName)` helper

### Styling
- `src/presentation/webview/styles/index.css`
  - Style `.model-indicator` (subtle, not distracting)
  - Style `.model-change-link` (looks clickable, blue/underlined)
  - Ensure good contrast in both themes

```css
.model-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  margin: 8px 0;
}

.model-name {
  font-weight: 500;
}

.model-change-link {
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9em;
}

.model-change-link:hover {
  color: var(--vscode-textLink-activeForeground);
}
```

## Alternative Approaches

### Option A: Show Model Selector Inline (Like Analysis/Dictionary)
- Add full dropdown for context model in Utilities tab
- Pros: Immediate access, no need to open Settings
- Cons: Clutters UI, inconsistent with Dictionary approach
- **Decision**: Defer to v1.1+ if users request it

### Option B: No Indicator (Status Quo)
- Keep it simple, users can find it in Settings
- Pros: Clean UI
- Cons: Discoverability issue, users don't know they can change it
- **Decision**: Rejected - adds value for minimal cost

### Option C: Only Show When Non-Default
- Only show indicator if context model differs from assistant model
- Pros: Less visual clutter
- Cons: Less discoverable
- **Decision**: Always show for consistency

## Testing Checklist

- [ ] Model indicator appears below context input
- [ ] Shows correct model name (formatted friendly)
- [ ] Click "Change model" opens Settings overlay
- [ ] Settings overlay focuses Context Model section (optional)
- [ ] Indicator updates when model changed in Settings
- [ ] Styling looks good in light theme
- [ ] Styling looks good in dark theme
- [ ] Doesn't break layout on narrow windows
- [ ] Link is keyboard accessible (Tab + Enter)

## Acceptance Criteria

- [ ] Users can see which context model is active
- [ ] Clear path to change model (link to Settings)
- [ ] UI is subtle and non-intrusive
- [ ] Consistent with rest of extension styling
- [ ] Works in both themes
- [ ] No layout issues

## Future Enhancements (v1.1+)

- [ ] Inline model selector (like Analysis tab)
- [ ] Show token usage per model scope
- [ ] Model performance comparison (speed, quality)
- [ ] "Recommended model" suggestions based on task
- [ ] Auto-focus setting in Settings overlay when link clicked

## Success Metrics

- Improved discoverability of context model setting
- Reduced confusion about which model is used
- Increased usage of context model customization
- Positive user feedback on clarity
