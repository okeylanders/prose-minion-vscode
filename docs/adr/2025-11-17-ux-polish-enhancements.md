# ADR: UX Polish Enhancements - Settings & Power User Features

**Date**: 2025-11-17
**Status**: 🚧 Proposed
**Context**: Post-v1.0 alpha polish
**Decision Makers**: Okey Landers + AI Agent Team
**Implementation**: [UX Polish Epic](.todo/epics/epic-ux-polish-2025-11-17/)

---

## Context and Problem Statement

Two quick-win UX improvements identified during development:

1. **N-Gram Filter Description Missing**: Users don't understand how `minCharacterLength` affects bigrams/trigrams (all-or-nothing filter)
2. **Model Selection Restricted**: Power users cannot experiment with new OpenRouter models without extension updates

**Current Situation**:
- Settings Overlay shows `minCharacterLength` without explaining n-gram impact
- Model selection restricted to 18 hardcoded models via enum in package.json
- Both issues are small but impact user experience and flexibility

**Question**: How can we improve UX with minimal effort while maintaining clean architecture?

---

## Decision Drivers

1. **Low Effort, High Impact**: Both fixes are 15 min - 2 hours each (total ~2-3 hours)
2. **User Understanding**: Settings descriptions should explain non-obvious behavior
3. **Power User Flexibility**: Advanced users should be able to try new models
4. **Future-Proofing**: Extension shouldn't require updates when OpenRouter adds models
5. **Maintain Simplicity**: Normal users keep curated dropdown experience

---

## Considered Options

### Option 1: Fix N-Grams Description Only
**Pros**:
- ✅ Quick win (15-30 min)
- ✅ Improves user understanding immediately

**Cons**:
- ❌ Leaves power user restriction in place
- ❌ Misses opportunity for related polish

### Option 2: Fix Custom Models Only
**Pros**:
- ✅ Future-proofs model selection
- ✅ Empowers power users

**Cons**:
- ❌ Leaves settings documentation gap
- ❌ Larger effort (~2 hours)

### Option 3: Combine Both into UX Polish Epic ✅ **SELECTED**
**Pros**:
- ✅ Addresses both UX issues in one organized effort
- ✅ Total effort still small (~2-3 hours)
- ✅ Follows established epic/sprint workflow
- ✅ Both features related to settings/UX

**Cons**:
- None significant

---

## Decision

**Combine both features into a single "UX Polish" epic with 2 sprints.**

### Feature 1: N-Gram Filter Description (Sprint 01)
**Problem**: Users don't understand that `minCharacterLength` applies an all-or-nothing filter to bigrams/trigrams.

**Solution**: Add clear description to Settings Overlay explaining:
- All-or-nothing rule: ALL words in n-gram must meet minimum length
- Practical impact: 4+ characters filters most prepositional phrases
- Example: "walked through" ✅ (both ≥4), "walked in" ❌ (second < 4)

**Implementation**:
```tsx
// In SettingsOverlay.tsx
<div className="setting-description">
  <strong>Note:</strong> For bigrams and trigrams, ALL words must meet
  the minimum length. Setting to 4+ characters filters most prepositional
  phrases like "in the", "of the", "to the".
</div>
```

**Effort**: 15-30 minutes

---

### Feature 2: Custom Model IDs for Power Users (Sprint 02)
**Problem**: Model selection restricted to enum in package.json. Power users cannot try new models.

**Solution**: Dual-tier approach:
1. **VSCode Settings Pane**: Free-text input (any OpenRouter model ID)
2. **Settings Overlay**: Curated dropdown with custom model detection

**Implementation**:
```json
// package.json - Remove enum constraint
"proseMinion.assistantModel": {
  "type": "string",
  "default": "anthropic/claude-sonnet-4.5",
  "description": "AI model for assistant tools. See Settings Overlay for curated list, or enter any OpenRouter model ID."
}
```

```tsx
// SettingsOverlay.tsx - Detect custom models
const isCustomModel = !RECOMMENDED_MODELS.find(m => m.id === settings.assistantModel);

<select value={settings.assistantModel} onChange={...}>
  {isCustomModel && (
    <option value={settings.assistantModel}>
      {settings.assistantModel} (Custom)
    </option>
  )}
  {RECOMMENDED_MODELS.map(...)}
</select>
```

**Benefits**:
- ✅ Power users experiment with any model
- ✅ Normal users unchanged (curated dropdown)
- ✅ Future-proof (no extension updates needed)
- ✅ Clear error messages for invalid IDs

**Effort**: 1-2 hours

---

## Consequences

### Positive
- ✅ **Better User Understanding**: Settings descriptions explain non-obvious behavior
- ✅ **Power User Empowerment**: Advanced users can try new models
- ✅ **Future-Proof**: No extension updates when OpenRouter adds models
- ✅ **Low Effort**: Total ~2-3 hours for both features
- ✅ **Clean Architecture**: No architectural changes, just UX polish

### Negative
- ⚠️ **Custom Model Validation**: Invalid model IDs fail at API call time (not settings time)
- ⚠️ **Slightly More Complex**: Settings Overlay needs custom model detection logic

### Neutral
- 📝 Documentation updated to reference sprints
- 📝 Both features in `.todo/settings-module/` and `.todo/models-advanced-features/` superseded by this epic

---

## Implementation Plan

### Sprint 01: N-Gram Filter Description (15-30 min)
1. Update `SettingsOverlay.tsx` with n-gram filter description
2. Test in both light/dark themes
3. Verify description clarity
4. Commit and mark sprint complete

### Sprint 02: Custom Model IDs (1-2 hours)
1. Remove `enum` from package.json (3 model settings)
2. Update `SettingsOverlay.tsx` to detect and display custom models
3. Test with valid and invalid custom model IDs
4. Add helpful error messages in `OpenRouterClient.ts`
5. Manual testing (VSCode settings + Settings Overlay)
6. Commit and mark sprint complete

---

## Validation

### Sprint 01 Acceptance Criteria
- [ ] Description added to Settings Overlay under `minCharacterLength`
- [ ] Clear explanation of all-or-nothing filter behavior
- [ ] Example shows practical impact on n-grams
- [ ] UI remains clean and readable
- [ ] Works in both light and dark themes

### Sprint 02 Acceptance Criteria
- [ ] VSCode Settings pane shows free-text input (not dropdown)
- [ ] Settings Overlay shows curated dropdown
- [ ] Custom model ID entered in VSCode pane works in tools
- [ ] Custom model displayed in Settings Overlay with "(Custom)" label
- [ ] Switching from custom to recommended model works
- [ ] Invalid model ID shows clear error message
- [ ] RECOMMENDED_MODELS still appear in Settings Overlay

---

## Related

**Superseded Documents**:
- `.todo/settings-module/minCharacterLength-bigrams-trigrams-description.md` → Sprint 01
- `.todo/models-advanced-features/custom-model-ids.md` → Sprint 02

**Files to Modify**:
- **Sprint 01**: `src/presentation/webview/components/SettingsOverlay.tsx`
- **Sprint 02**:
  - `package.json` (remove enum from 3 settings)
  - `src/presentation/webview/components/SettingsOverlay.tsx` (custom model detection)
  - `src/infrastructure/api/OpenRouterClient.ts` (optional error messages)

**References**:
- [Word Frequency Implementation](src/tools/measure/wordFrequency/index.ts:270-282)
- [OpenRouter Models](src/infrastructure/api/OpenRouterModels.ts)
- [Settings Overlay](src/presentation/webview/components/SettingsOverlay.tsx)

---

## Notes

- **Alpha Freedom**: Both features are additive, no breaking changes
- **Manual Testing**: Both require manual verification (Settings UI, API calls)
- **Documentation**: Reference sprints in `.todo/settings-module/` and `.todo/models-advanced-features/`
- **Future Enhancements**:
  - Auto-complete for custom models
  - Model metadata fetching (pricing, context length)
  - Validation button in Settings Overlay

---

**Last Updated**: 2025-11-17
**Epic**: [epic-ux-polish-2025-11-17](.todo/epics/epic-ux-polish-2025-11-17/)
