# Settings Architecture - ADDENDUM: SearchTab Discovery

**Date**: 2025-11-02
**Status**: Critical Finding
**Priority**: High → **CRITICAL**

---

## Additional Message-Based Settings Found

Following user suggestion to check "scope" settings, discovered **SearchTab has 4 more message-based settings** with the same architectural problem as MetricsTab.

---

## SearchTab Settings Issues

### Local State (No Sync, No Persistence)

**File**: `src/presentation/webview/components/SearchTab.tsx` (lines 45-48)

```typescript
const [wordSearchContextWords, setWordSearchContextWords] = React.useState<number>(7);
const [wordSearchClusterWindow, setWordSearchClusterWindow] = React.useState<number>(150);
const [wordSearchMinCluster, setWordSearchMinCluster] = React.useState<number>(3);  // ⚠️ Wrong default!
const [wordSearchCaseSensitive, setWordSearchCaseSensitive] = React.useState<boolean>(false);
```

### Problems Identified

#### 1. ❌ **No Sync with Backend Settings**

- Settings exist in `package.json` and exposed by ConfigurationHandler
- SettingsOverlay can change them via `settings.updateSetting('wordSearch.contextWords', value)`
- SearchTab has **no message listeners** for `SETTINGS_DATA`
- SearchTab **never sends** `UPDATE_SETTING` messages
- Changes in SettingsOverlay **do not** affect SearchTab ❌
- Changes in SearchTab **do not** persist to VSCode settings ❌

#### 2. ❌ **Wrong Default Value**

**package.json** (line 496):
```json
"proseMinion.wordSearch.minClusterSize": {
  "type": "number",
  "default": 2,  // ⬅️ Official default
  ...
}
```

**SearchTab.tsx** (line 47):
```typescript
const [wordSearchMinCluster, setWordSearchMinCluster] = React.useState<number>(3);  // ⬅️ Wrong!
```

**Impact**: Users changing `minClusterSize` in native VSCode settings to `2` will see SearchTab use `3` instead!

#### 3. ❌ **No Persistence**

- SearchTab settings **NOT** in any hook's `persistedState`
- SearchTab settings **NOT** in `usePersistence` composition
- SearchTab settings **reset to hardcoded defaults** on webview reload
- User must re-enter preferred values every time

#### 4. ❌ **Duplication with SettingsOverlay**

**SettingsOverlay.tsx** (lines 395-468):
- Has inputs for all 4 word search settings
- Calls `onUpdate('wordSearch.contextWords', value)` → `settings.updateSetting()`
- Updates VSCode workspace config ✅
- **But SearchTab never reads these changes** ❌

**Result**: Two completely isolated copies of same settings!

---

## Updated Metrics

### Message-Based Settings Count

| Original Analysis | Actual |
|-------------------|--------|
| 1 setting (minCharLength) | **5 settings** |

**Newly Discovered:**
1. `wordSearch.contextWords` (SearchTab)
2. `wordSearch.clusterWindow` (SearchTab)
3. `wordSearch.minClusterSize` (SearchTab) + wrong default
4. `wordSearch.caseSensitive` (SearchTab)

### Persistence Coverage

| Original Analysis | Actual |
|-------------------|--------|
| 97% (29/30) | **86% (25/29)** |

**Not Persisted:**
1. `wordFrequency.minCharacterLength` (MetricsTab)
2. `wordSearch.contextWords` (SearchTab)
3. `wordSearch.clusterWindow` (SearchTab)
4. `wordSearch.minClusterSize` (SearchTab)
5. `wordSearch.caseSensitive` (SearchTab)

---

## Severity Upgrade

### Original Assessment
- **Priority**: High
- **Severity**: Medium
- **Scope**: 1 component (MetricsTab)

### Revised Assessment
- **Priority**: **CRITICAL**
- **Severity**: **High**
- **Scope**: 2 components (MetricsTab + SearchTab)
- **Data Integrity**: Wrong default in SearchTab
- **User Impact**: Settings changes ignored, reset on reload

---

## User Impact Scenarios

### Scenario 1: Settings Overlay Changes Ignored

**User Story:**
1. User opens Settings Overlay
2. Changes "Context Words" from 7 → 10
3. Clicks SearchTab
4. **SearchTab still shows 7** ❌
5. User confused: "Did my change not save?"

### Scenario 2: Native Settings Panel Changes Ignored

**User Story:**
1. User opens VSCode Settings (Ctrl+,)
2. Changes `proseMinion.wordSearch.contextWords` to 15
3. Opens SearchTab
4. **SearchTab still shows 7** ❌
5. User files bug report: "Settings don't work!"

### Scenario 3: Wrong Default Causes Confusion

**User Story:**
1. User notices clusters too aggressive
2. Checks VSCode Settings: `minClusterSize = 2` ✅
3. SearchTab UI shows `3` ❌
4. User changes SearchTab to `2`
5. Reloads webview
6. **SearchTab resets to 3** ❌
7. User very frustrated

### Scenario 4: No Persistence

**User Story:**
1. User sets custom search params (context: 12, window: 200, min: 4, case: true)
2. Runs search, gets good results
3. Closes VSCode
4. Reopens VSCode
5. **All custom settings lost, back to defaults** ❌
6. User has to re-enter everything

---

## Code Evidence

### SearchTab - Local State Only

```typescript
// SearchTab.tsx lines 45-48
const [wordSearchContextWords, setWordSearchContextWords] = React.useState<number>(7);
const [wordSearchClusterWindow, setWordSearchClusterWindow] = React.useState<number>(150);
const [wordSearchMinCluster, setWordSearchMinCluster] = React.useState<number>(3);
const [wordSearchCaseSensitive, setWordSearchCaseSensitive] = React.useState<boolean>(false);

// SearchTab.tsx lines 197-233 - Direct state updates, no backend sync
onChange={(e) => {
  const val = e.target.value.replace(/\D/g, '');
  setWordSearchContextWords(val ? parseInt(val, 10) : 7);  // ⬅️ Local only
}}
```

### No Message Listeners

```bash
$ grep "addEventListener.*message" src/presentation/webview/components/SearchTab.tsx
# No matches found ❌

$ grep "UPDATE_SETTING" src/presentation/webview/components/SearchTab.tsx
# No matches found ❌

$ grep "SETTINGS_DATA" src/presentation/webview/components/SearchTab.tsx
# No matches found ❌
```

### SettingsOverlay Has Controls (But Disconnected)

```typescript
// SettingsOverlay.tsx lines 407-468
<label className="settings-label">
  <div className="settings-label-title">Context Words</div>
  <input
    type="text"
    value={asNumber('wordSearch.contextWords')}  // ⬅️ From backend
    onChange={(e) => onUpdate('wordSearch.contextWords', Number(e.target.value) || 0)}  // ⬅️ Updates backend
    className="settings-input settings-input-small"
  />
</label>
// ... same for clusterWindow, minClusterSize, caseSensitive
```

**Result**: SettingsOverlay talks to backend, SearchTab talks to itself. Never the two shall meet! 😱

---

## Comparison: MetricsTab vs SearchTab

| Aspect | MetricsTab (minCharLength) | SearchTab (4 settings) |
|--------|----------------------------|------------------------|
| **Local State** | ✅ Yes (1 setting) | ✅ Yes (4 settings) |
| **Message Listeners** | ✅ Yes (SETTINGS_DATA) | ❌ No |
| **Sends UPDATE_SETTING** | ✅ Yes | ❌ No |
| **Persistence** | ⚠️ Via backend sync | ❌ None |
| **Syncs with SettingsOverlay** | ✅ Bidirectional | ❌ None |
| **Syncs with Native Settings** | ✅ Via config watcher | ❌ None |
| **Wrong Defaults** | ❌ No | ✅ Yes (minCluster: 3 vs 2) |
| **Severity** | Medium | **High** |

**Summary**: MetricsTab is partially working (no persistence, but syncs). SearchTab is **completely broken** (no sync, no persistence, wrong defaults).

---

## Updated Migration Priority

### Original Plan
1. Phase 1: Backend cleanup (30 min)
2. Phase 2: Create `useWordFrequency` hook (1 hour)
3. Phase 3: Migrate MetricsTab (1 hour)

### Revised Plan (URGENT)

**Phase 1: Quick Fix (2 hours) - Do ASAP**
1. Backend cleanup (30 min) - Extract hardcoded keys
2. **Create `useWordSearch` hook** (1 hour) - Critical!
3. **Migrate SearchTab** (30 min) - Fix broken settings

**Phase 2: Complete Migration (2 weeks)**
4. Create `useWordFrequency` hook (1 hour)
5. Migrate MetricsTab (30 min)
6. Create remaining domain hooks (1 week)
7. Testing and validation (1 week)

---

## Immediate Action Items

### Critical (Do This Week)

- [ ] **Fix SearchTab settings sync** (2 hours)
  - Create `useWordSearch` hook with all 4 settings
  - Add message handlers for `SETTINGS_DATA`
  - Send `UPDATE_SETTING` on changes
  - Add to `usePersistence` composition
  - **Fix `minClusterSize` default from 3 → 2**

- [ ] **Test bidirectional sync**
  - SettingsOverlay → SearchTab ✅
  - SearchTab → SettingsOverlay ✅
  - Native VSCode settings → SearchTab ✅
  - Persistence across reload ✅

### High Priority (Next Week)

- [ ] Fix MetricsTab settings sync (1 hour)
- [ ] Backend cleanup (30 min)
- [ ] Create comprehensive test plan

---

## Risk Assessment

### Before This Discovery
- **Risk Level**: Medium
- **User Impact**: Minor annoyance (filter resets on reload)
- **Urgency**: Can wait for v1.1

### After This Discovery
- **Risk Level**: **HIGH**
- **User Impact**: **Settings completely broken for Word Search**
- **Urgency**: **Should fix before v1.0**
- **Data Integrity**: Wrong defaults causing incorrect behavior

---

## Recommended Immediate Fix

### Option A: Quick Hook Migration (Recommended)

**Create `useWordSearch.ts` hook:**

```typescript
export const useWordSearch = (): UseWordSearchReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ wordSearchSettings?: WordSearchSettings }>();

  const defaultSettings: WordSearchSettings = {
    contextWords: 7,
    clusterWindow: 150,
    minClusterSize: 2,  // ⬅️ Correct default!
    caseSensitive: false
  };

  const [settings, setSettings] = React.useState<WordSearchSettings>(
    persisted?.wordSearchSettings ?? defaultSettings
  );

  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    const { settings: allSettings } = message.payload;
    const wordSearchSettings: Partial<WordSearchSettings> = {};
    Object.keys(defaultSettings).forEach(key => {
      const configKey = `wordSearch.${key}`;
      if (allSettings[configKey] !== undefined) {
        wordSearchSettings[key] = allSettings[configKey];
      }
    });
    setSettings(prev => ({ ...prev, ...wordSearchSettings }));
  }, []);

  const updateSetting = React.useCallback((key: keyof WordSearchSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));  // Optimistic
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      payload: { key: `wordSearch.${key}`, value },
      timestamp: Date.now()
    });
  }, [vscode]);

  return {
    settings,
    handleSettingsData,
    updateSetting,
    persistedState: { wordSearchSettings: settings }
  };
};
```

**Effort**: 2 hours total
**Risk**: Low (follows existing pattern)
**Fixes**: All 5 issues (sync, persistence, wrong default)

### Option B: Temporary Band-Aid (Not Recommended)

Add message listeners to SearchTab like MetricsTab. **Still no persistence**, but at least syncs with SettingsOverlay.

**Effort**: 30 minutes
**Risk**: Low
**Fixes**: 2/5 issues (sync only, not persistence or wrong default)
**Tech Debt**: Still violates architecture, needs migration later

---

## Updated Bottom Line

**Original**: "You have manageable tech debt affecting 1 setting."

**Revised**: "You have **critical broken functionality** affecting 5 settings across 2 components. Word Search settings are completely disconnected from the settings system. Users cannot configure Word Search reliably."

**Recommendation**: **Fix SearchTab immediately** (2 hours), then plan full migration for v1.1.

---

## Related Documents

- **Main Analysis**: [2025-11-02-settings-architecture-analysis.md](2025-11-02-settings-architecture-analysis.md)
- **Executive Summary**: [2025-11-02-settings-architecture-SUMMARY.md](2025-11-02-settings-architecture-SUMMARY.md)
- **Backend Debt**: [2025-11-02-settings-sync-registration.md](2025-11-02-settings-sync-registration.md)
- **Frontend Debt**: [2025-11-02-configuration-strategy-inconsistency.md](2025-11-02-configuration-strategy-inconsistency.md)

---

**Status**: 🚨 Critical Finding - Immediate Action Required
**Author**: Claude Code
**Version**: 1.0
**Last Updated**: 2025-11-02
**Urgency**: Fix before v1.0 release
