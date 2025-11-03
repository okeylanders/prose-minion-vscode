# Sprint 01: Backend Settings Infrastructure

**Epic**: [epic-word-length-filter-metrics](../epic-word-length-filter-metrics.md)
**Date**: 2025-11-02
**Status**: ✅ Complete
**Branch**: `sprint/epic-word-length-filter-metrics-2025-11-02-01-backend-settings-infrastructure`
**Estimated Time**: 1 hour
**Actual Time**: 1.5 hours (including bidirectional sync fix)

## Goals

Add the `proseMinion.wordFrequency.minCharacterLength` setting to package.json, Settings overlay, and ConfigurationHandler to enable backend filtering of word frequency results by minimum character count.

## Problem

Writers need to filter word frequency results to focus on longer words, but currently there's no setting to control this. We need the backend infrastructure in place before implementing the UI and filtering logic.

## Solution

Add a new setting that:
- Defaults to `1` (all words)
- Allows values [1, 2, 3, 4, 5, 6]
- Appears in Settings overlay (Metrics section)
- Is handled by ConfigurationHandler
- Persists across sessions

## Implementation Plan

### 1. Add Setting Schema to package.json

Location: `package.json` → `contributes.configuration.properties`

```json
"proseMinion.wordFrequency.minCharacterLength": {
  "type": "number",
  "default": 1,
  "enum": [1, 2, 3, 4, 5, 6],
  "markdownDescription": "Minimum character length for words in Word Frequency results. Filter helps identify longer, more distinctive word patterns by excluding short common words. **1+** = all words, **3+** = excludes 'it', 'is', 'an', **5+** = multi-syllable words, **6+** = distinctive vocabulary. Applied to Top Words, POS, Bigrams/Trigrams, Hapax List, and Lemmas. Does NOT filter Stop Words or Length Histogram.",
  "order": 72
}
```

**Key Points**:
- `enum` restricts values to valid options
- `markdownDescription` provides clear user guidance
- `order: 72` places it near other word frequency settings

### 2. Add to Settings Overlay UI

Location: `src/presentation/webview/components/SettingsOverlay.tsx`

Add to the **Metrics Settings** section (after other word frequency settings):

```tsx
{/* Word Length Filter */}
<div className="setting-row">
  <label htmlFor="min-char-length">Minimum Word Length</label>
  <select
    id="min-char-length"
    value={settingsData.wordFrequency?.minCharacterLength || 1}
    onChange={(e) => handleSettingChange('wordFrequency.minCharacterLength', parseInt(e.target.value))}
  >
    <option value="1">1+ characters (all words)</option>
    <option value="2">2+ characters</option>
    <option value="3">3+ characters</option>
    <option value="4">4+ characters</option>
    <option value="5">5+ characters</option>
    <option value="6">6+ characters</option>
  </select>
  <p className="setting-help">
    Filter word frequency by minimum character count. Higher values focus on longer,
    more distinctive words (3+ removes "it", "is"; 5+ shows multi-syllable words).
  </p>
</div>
```

**Key Points**:
- Nested under `wordFrequency` object in settings data
- `parseInt()` converts string value to number
- Clear help text explains what each filter does

### 3. Verify ConfigurationHandler Routing

Location: `src/application/handlers/domain/ConfigurationHandler.ts`

Ensure the handler can receive and process nested `wordFrequency.*` settings. If needed, add:

```typescript
case MessageType.UPDATE_SETTING:
  const { key, value } = message.payload;

  // Handle nested settings like 'wordFrequency.minCharacterLength'
  if (key.includes('.')) {
    const [parent, child] = key.split('.');
    const config = vscode.workspace.getConfiguration('proseMinion');
    await config.update(`${parent}.${child}`, value, vscode.ConfigurationTarget.Global);
  } else {
    const config = vscode.workspace.getConfiguration('proseMinion');
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }
  break;
```

**Note**: ConfigurationHandler likely already supports this. Verify it works with nested keys.

### 4. Test Setting Persistence

Manual testing checklist:
- [ ] Open Settings overlay
- [ ] Change "Minimum Word Length" dropdown
- [ ] Click "Save Settings"
- [ ] Reload VS Code window
- [ ] Open Settings overlay again
- [ ] Verify dropdown shows saved value
- [ ] Check VSCode native settings (`Cmd+,` → search "minCharacterLength")
- [ ] Verify setting appears and has correct value

## Tasks Breakdown

### Phase 1: Schema & Definition (15 min)
1. **Add setting to package.json** (10 min)
   - Add property under `contributes.configuration.properties`
   - Set type, default, enum, description, order
   - Verify JSON is valid (no syntax errors)

2. **Reload extension** (5 min)
   - Press `F5` to rebuild and reload
   - Verify no errors in Extension Development Host console

### Phase 2: Settings Overlay UI (30 min)
3. **Add dropdown to SettingsOverlay** (20 min)
   - Find Metrics settings section
   - Add setting row with label, select, help text
   - Wire up `onChange` handler
   - Position after other word frequency settings

4. **Test UI integration** (10 min)
   - Open Settings overlay
   - Verify dropdown appears and is populated
   - Test changing value
   - Verify `settingsData` updates
   - Test Save Settings button

### Phase 3: Handler & Persistence (15 min)
5. **Verify ConfigurationHandler** (5 min)
   - Check if nested key handling exists
   - Add if necessary
   - Verify `UPDATE_SETTING` message type works

6. **Test persistence** (10 min)
   - Change setting in UI
   - Save settings
   - Reload VSCode window
   - Verify setting persists
   - Check native VSCode settings UI

## Acceptance Criteria

### Schema
- [ ] Setting exists in package.json under `proseMinion.wordFrequency.minCharacterLength`
- [ ] Type is `number`
- [ ] Default is `1`
- [ ] Enum is `[1, 2, 3, 4, 5, 6]`
- [ ] Description is clear and mentions what gets filtered

### Settings Overlay
- [ ] Dropdown appears in Metrics section
- [ ] Dropdown shows all 6 options (1+, 2+, 3+, 4+, 5+, 6+)
- [ ] Default value is "1+ characters (all words)"
- [ ] Help text explains filter behavior
- [ ] Dropdown is visually consistent with other settings

### Persistence
- [ ] Setting saves when "Save Settings" clicked
- [ ] Setting persists across VSCode window reload
- [ ] Setting appears in native VSCode settings UI
- [ ] Setting can be changed in native VSCode settings UI
- [ ] Frontend and backend read same value

### Configuration Handler
- [ ] `UPDATE_SETTING` message handles nested key `wordFrequency.minCharacterLength`
- [ ] Setting update doesn't cause errors
- [ ] Setting writes to `vscode.ConfigurationTarget.Global`

## Related

### ADR
- [2025-11-02-word-length-filter-metrics.md](../../../docs/adr/2025-11-02-word-length-filter-metrics.md)

### Epic
- [epic-word-length-filter-metrics.md](../epic-word-length-filter-metrics.md)

### Files to Modify
- `package.json` - Add setting schema
- `src/presentation/webview/components/SettingsOverlay.tsx` - Add dropdown UI
- `src/application/handlers/domain/ConfigurationHandler.ts` - Verify nested key handling (likely already works)

### Next Sprint
- [02-frontend-ui-and-backend-filtering.md](02-frontend-ui-and-backend-filtering.md) - Build tab bar and filtering logic

## Testing Checklist

### Schema Validation
- [ ] Extension builds without errors after adding setting
- [ ] No TypeScript errors in Extension Development Host
- [ ] Setting appears in Intellisense (type `proseMinion.wordFrequency.minCharacterLength`)

### UI Functionality
- [ ] Settings overlay opens without errors
- [ ] Dropdown renders in correct location (Metrics section)
- [ ] All 6 options are present
- [ ] Selecting option triggers `onChange`
- [ ] Help text is visible and readable

### Persistence Flow
1. [ ] Open Settings overlay
2. [ ] Change dropdown to "3+ characters"
3. [ ] Click "Save Settings"
4. [ ] Message sent: `UPDATE_SETTING` with `{ key: 'wordFrequency.minCharacterLength', value: 3 }`
5. [ ] ConfigurationHandler receives message
6. [ ] Setting writes to VSCode config
7. [ ] Reload window (`Cmd+R` or `Ctrl+R`)
8. [ ] Open Settings overlay
9. [ ] Dropdown shows "3+ characters" (persisted value)

### Native Settings UI
- [ ] Open VSCode settings (`Cmd+,`)
- [ ] Search "minCharacterLength"
- [ ] Setting appears with dropdown
- [ ] Change value in native UI
- [ ] Open extension Settings overlay
- [ ] Verify dropdown reflects new value

## Success Metrics

- Setting schema is valid and well-documented
- Settings overlay dropdown is intuitive
- Setting persists correctly across sessions
- No errors or warnings in console
- ConfigurationHandler routes setting updates correctly

## Notes

- This sprint focuses purely on settings infrastructure (no filtering logic yet)
- Sprint 02 will build the tab bar UI and backend filtering
- Setting is not used anywhere yet (that's intentional)
- Default of `1` ensures backward compatibility (shows all words)

## Completion Summary

**Date Completed**: 2025-11-02
**Commits**: 2 (c1d698f, e030c6a)

### ✅ Implemented

**Files Modified**:
1. **package.json** (line 465-471)
   - Added `proseMinion.wordFrequency.minCharacterLength` setting
   - Type: number, Default: 1, Enum: [1,2,3,4,5,6]
   - Order: 29 (in Metrics section)

2. **src/presentation/webview/components/SettingsOverlay.tsx** (line 367-385)
   - Added dropdown UI for minimum word length
   - 6 options: "1+ characters (all words)" through "6+ characters"
   - Clear help text explaining filter behavior

3. **src/application/handlers/domain/ConfigurationHandler.ts** (line 116)
   - Added `wordFrequency.minCharacterLength` to SETTINGS_DATA response
   - Default value: 1

4. **Bidirectional Sync Fix**:
   - **MessageHandler.ts**: Added wordFrequency, wordSearch, publishingStandards, contextPaths to config watcher
   - **ConfigurationHandler.ts**: Enhanced `shouldBroadcastConfigChange` with prefix matching for nested settings

### Testing Notes

**Manual Testing**:
- ✅ Settings Overlay displays dropdown in correct location (Metrics section)
- ✅ All 6 options render correctly
- ✅ Default value is "1+ characters (all words)"
- ✅ Settings Overlay → VSCode native settings sync works
- ✅ VSCode native settings → Settings Overlay sync works (fixed via bidirectional sync)
- ✅ No echo-back when changing settings in overlay (webview-originated filtering works)
- ✅ Extension builds without errors
- ✅ No TypeScript errors

**Edge Cases Discovered**:
- Settings Overlay and VSCode native settings were not syncing bidirectionally
- Required enhancing config watcher to monitor nested settings (wordFrequency.*)
- Required prefix matching in `shouldBroadcastConfigChange` to prevent echo-back for nested keys

### Next Steps

1. **Ready for Sprint 02**: Backend settings infrastructure is complete and fully functional
2. **Sprint 02 Tasks**:
   - Create `WordLengthFilterTabs` component
   - Render tab bar in MetricsTab below scope box
   - Wire tab clicks to UPDATE_SETTING
   - Implement backend filtering in `wordFrequency.ts`
3. **Branch Strategy**: Keep Sprint 01 branch separate, create new branch for Sprint 02
4. **Memory Bank**: Update with Sprint 01 completion summary
