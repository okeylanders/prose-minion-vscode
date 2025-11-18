# Sprint 02: Custom Model IDs for Power Users

**Epic**: [epic-ux-polish](../epic-ux-polish.md)
**Date**: 2025-11-17
**Status**: 📝 Planned
**Branch**: `sprint/epic-ux-polish-2025-11-17-02-custom-models`
**Estimated Time**: 1-2 hours
**Priority**: LOW (power user feature)
**Depends On**: Sprint 01 (optional dependency)

---

## Goals

Enable power users to specify any OpenRouter model ID via VSCode Settings while maintaining curated dropdown in Settings Overlay for normal users.

---

## Problem

**Current State**:
- Model selection restricted to `RECOMMENDED_MODELS` enum (18 models)
- Both VSCode Settings pane and Settings Overlay use same enum
- Power users cannot experiment with new/unlisted OpenRouter models
- Extension update required to add new models

**User Impact**:
- Cannot try new models (e.g., `meta-llama/llama-3.2-90b-vision`)
- Locked to 18 curated models
- Extension updates needed when OpenRouter adds models

---

## Solution

**Dual-Tier Approach**:
1. **VSCode Settings Pane** (Advanced): Free-text input, any OpenRouter model ID
2. **Settings Overlay** (Normal): Curated dropdown with custom model detection

**Benefits**:
- ✅ Power users: Experiment with any model without extension update
- ✅ Normal users: Unchanged experience (curated dropdown)
- ✅ Future-proof: No updates needed when OpenRouter adds models

---

## Tasks

### Phase 1: Remove Enum from package.json (5 min)

- [ ] Open `package.json`
- [ ] Find `proseMinion.assistantModel` setting
- [ ] Remove `enum` array
- [ ] Remove `enumDescriptions` array
- [ ] Update `description` to mention custom IDs
- [ ] Repeat for `proseMinion.dictionaryModel`
- [ ] Repeat for `proseMinion.contextModel`
- [ ] Save and verify JSON is valid

**Before**:
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

**After**:
```json
"proseMinion.assistantModel": {
  "type": "string",
  "default": "anthropic/claude-sonnet-4.5",
  "description": "AI model for assistant tools. See Settings Overlay for curated list, or enter any OpenRouter model ID."
}
```

---

### Phase 2: Update Settings Overlay (45-60 min)

- [ ] Open `src/presentation/webview/components/SettingsOverlay.tsx`
- [ ] Find model dropdown sections (3 total: assistant, dictionary, context)
- [ ] Add custom model detection logic for each
- [ ] Update dropdown rendering to show custom models
- [ ] Test with custom model ID
- [ ] Verify switching between custom and recommended works

**Logic** (for each model dropdown):
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

**Apply to**:
- Assistant Model dropdown
- Dictionary Model dropdown
- Context Model dropdown

---

### Phase 3: Optional Error Messages (15-30 min)

- [ ] Open `src/infrastructure/api/OpenRouterClient.ts`
- [ ] Find API error handling in `chat()` method
- [ ] Add specific handling for "model not found" errors
- [ ] Show user-friendly message with model ID
- [ ] Test with invalid model ID

**Error Handling**:
```typescript
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

---

### Phase 4: Testing (20-30 min)

- [ ] **VSCode Settings Pane**:
  - [ ] Shows free-text input (not dropdown)
  - [ ] Can enter custom model ID
  - [ ] Settings save correctly

- [ ] **Settings Overlay**:
  - [ ] Curated dropdown still shows recommended models
  - [ ] Custom model appears with "(Custom)" label
  - [ ] Can switch from custom to recommended model
  - [ ] Can switch from recommended to custom (via VSCode pane)

- [ ] **Functionality**:
  - [ ] Custom model ID entered in VSCode pane works in tools
  - [ ] Invalid model ID shows clear error message
  - [ ] Recommended models still work correctly

- [ ] **Edge Cases**:
  - [ ] Empty custom model ID (should use default)
  - [ ] Very long custom model ID (should display with ellipsis)
  - [ ] Custom model ID with special characters

---

### Phase 5: Documentation (10-15 min)

- [ ] Update `.todo/models-advanced-features/custom-model-ids.md` with reference to this sprint
- [ ] Mark sprint as complete
- [ ] Add memory bank entry (optional)
- [ ] Commit changes with descriptive message

---

## Acceptance Criteria

- [ ] VSCode Settings pane shows free-text input (not dropdown)
- [ ] Settings Overlay shows curated dropdown
- [ ] Custom model ID entered in VSCode pane works in tools
- [ ] Custom model displayed in Settings Overlay dropdown (with "Custom" label)
- [ ] Switching from custom to recommended model works
- [ ] Switching from recommended to custom works
- [ ] Invalid model ID shows clear error message
- [ ] RECOMMENDED_MODELS still appear in Settings Overlay
- [ ] No regressions in normal user experience

---

## Files Modified

**Required**:
1. `package.json` - Remove enum from 3 model settings
2. `src/presentation/webview/components/SettingsOverlay.tsx` - Custom model detection

**Optional**:
3. `src/infrastructure/api/OpenRouterClient.ts` - Error messages

---

## Testing Checklist

### VSCode Settings Pane
- [ ] `proseMinion.assistantModel`: Free-text input (no dropdown)
- [ ] `proseMinion.dictionaryModel`: Free-text input (no dropdown)
- [ ] `proseMinion.contextModel`: Free-text input (no dropdown)
- [ ] Can type any string value
- [ ] Settings save and persist

### Settings Overlay
- [ ] Curated dropdown shows all 18 recommended models
- [ ] Custom model appears with "(Custom)" suffix
- [ ] Can select custom model from dropdown (if already set)
- [ ] Can select recommended model (switches from custom)
- [ ] Dropdown label shows model name for recommended
- [ ] Dropdown label shows full ID for custom

### Functionality
- [ ] Valid custom model: Analysis works, no errors
- [ ] Invalid custom model: Clear error message shown
- [ ] Recommended model: Works as before (no regression)
- [ ] Switch custom → recommended: Works immediately
- [ ] Switch recommended → custom: Requires VSCode pane entry

### Edge Cases
- [ ] Empty model ID: Uses default model
- [ ] Very long ID (>50 chars): Displays with ellipsis in UI
- [ ] Special characters in ID: Handles correctly
- [ ] Non-existent model: Shows helpful error

---

## Benefits

- ✅ **Power User Flexibility**: Try any OpenRouter model
- ✅ **Future-Proof**: No extension updates for new models
- ✅ **Normal Users Unchanged**: Curated dropdown experience preserved
- ✅ **Clear Errors**: Helpful messages for invalid models

---

## Tradeoffs

**Pros**:
- ✅ No extension updates needed
- ✅ Flexibility for advanced users
- ✅ Easy to experiment

**Cons**:
- ❌ No validation at settings time (fails at API call)
- ❌ Slightly more complex UI logic
- ❌ User confusion risk (mitigated by clear descriptions)

---

## Related

**Reference Documents**:
- [Original Spec](.todo/models-advanced-features/custom-model-ids.md)
- [OpenRouter Models](../../../src/infrastructure/api/OpenRouterModels.ts)

**ADR**:
- [ADR-2025-11-17: UX Polish Enhancements](../../../docs/adr/2025-11-17-ux-polish-enhancements.md)

**OpenRouter**:
- Model Catalog: https://openrouter.ai/models

---

## Future Enhancements (v1.1+)

- Auto-complete suggestions from OpenRouter API
- Model metadata fetching (context length, pricing)
- "Recently used custom models" list
- Validation via OpenRouter API before saving
- "Validate Model" button in Settings Overlay

---

## Completion Summary

*(To be filled in after sprint completion)*

**Status**: 📝 Planned
**Files Modified**: TBD
**Time Spent**: TBD
**Outcome**: TBD

---

**Last Updated**: 2025-11-17
**Previous Sprint**: Sprint 01 - N-Gram Filter Description
