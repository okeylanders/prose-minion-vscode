# Feature: Custom Model IDs for Advanced Users

**Status**: Pending (Future Release)
**Priority**: Low (Nice-to-have for power users)
**Date Created**: 2025-11-07

## Overview

Enable advanced users to specify custom OpenRouter model IDs via VSCode Settings pane while maintaining curated dropdown in Settings Overlay for normal users.

## Problem

Currently:
- Model selection restricted to `RECOMMENDED_MODELS` list (18 models)
- Both VSCode Settings pane and Settings Overlay use same enum
- Power users cannot experiment with new/unlisted OpenRouter models
- Extension update required to add new models

## Solution

**Dual-tier approach**:
1. **VSCode Settings Pane** (Advanced): Free-text input, any OpenRouter model ID
2. **Settings Overlay** (Normal): Curated dropdown with recommended models only

## Implementation

### 1. Remove Enum from package.json

**Current**:
```json
"proseMinion.assistantModel": {
  "type": "string",
  "default": "anthropic/claude-sonnet-4.5",
  "enum": [
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-opus-4.1",
    // ... 16 more
  ],
  "enumDescriptions": [...]
}
```

**Proposed**:
```json
"proseMinion.assistantModel": {
  "type": "string",
  "default": "anthropic/claude-sonnet-4.5",
  "description": "AI model for assistant tools. Advanced: Enter any OpenRouter model ID. See Settings Overlay for curated list."
}
```

Apply to all three model settings:
- `proseMinion.assistantModel`
- `proseMinion.dictionaryModel`
- `proseMinion.contextModel`

### 2. Enhance Settings Overlay

Detect and display custom models gracefully.

**File**: `src/presentation/webview/components/SettingsOverlay.tsx`

**Logic**:
```typescript
// Detect if current model is custom (not in RECOMMENDED_MODELS)
const isCustomAssistantModel = !RECOMMENDED_MODELS.find(
  m => m.id === settings.assistantModel
);

// Dropdown rendering
<select value={settings.assistantModel} onChange={...}>
  {/* Show current custom model if exists */}
  {isCustomAssistantModel && (
    <option value={settings.assistantModel}>
      {settings.assistantModel} (Custom)
    </option>
  )}

  {/* Recommended models */}
  {RECOMMENDED_MODELS.map(model => (
    <option key={model.id} value={model.id}>
      {model.name}
    </option>
  ))}
</select>
```

**Apply to all three dropdowns**:
- Assistant Model
- Dictionary Model
- Context Model

### 3. Optional: Add Validation Helper

Show warning if custom model fails API call:

```typescript
// In ProseAnalysisService or OpenRouterClient
try {
  const response = await this.client.chat(messages, model);
  // ...
} catch (error) {
  if (error.message.includes('model not found')) {
    vscode.window.showWarningMessage(
      `Model "${model}" not found on OpenRouter. Check model ID or select from recommended list.`
    );
  }
  throw error;
}
```

## Benefits

✅ **Power users**: Experiment with any OpenRouter model without extension update
✅ **Normal users**: Unchanged experience (curated dropdown)
✅ **Flexibility**: Try new models (e.g., `meta-llama/llama-3.2-90b-vision`)
✅ **Future-proof**: No extension update needed when OpenRouter adds models

## Tradeoffs

❌ **No validation**: Invalid model IDs fail at API call time (not settings time)
❌ **UI complexity**: Settings Overlay needs custom model detection
❌ **User confusion**: Advanced users might type invalid IDs

**Mitigation**: Clear description in package.json, error messages from API

## Testing Checklist

- [ ] VSCode Settings pane shows free-text input (not dropdown)
- [ ] Settings Overlay shows curated dropdown
- [ ] Custom model ID entered in VSCode pane works in tools
- [ ] Custom model displayed in Settings Overlay dropdown (with "Custom" label)
- [ ] Switching from custom to recommended model works
- [ ] Invalid model ID shows clear error message
- [ ] RECOMMENDED_MODELS still appear in Settings Overlay

## Files to Modify

1. **package.json** - Remove `enum` and `enumDescriptions` from 3 model settings
2. **SettingsOverlay.tsx** - Add custom model detection for 3 dropdowns
3. **OpenRouterClient.ts** (optional) - Add helpful error messages

## Related

- Current model list: `src/infrastructure/api/OpenRouterModels.ts` (18 models)
- Settings architecture: Unified Settings Architecture Epic
- OpenRouter model catalog: https://openrouter.ai/models

## Future Enhancements

- Auto-complete suggestions from OpenRouter API
- Model metadata fetching (context length, pricing)
- "Recently used custom models" list
- Validation via OpenRouter API (check if model exists before saving)

## Questions

- Should we add a "Validate" button in Settings Overlay for custom models?
- Should we cache custom models for dropdown persistence?
- Should we show pricing/context length for custom models?

---

**Decision**: Defer to future release (v1.1+). Current curated list sufficient for alpha/v1.0.
