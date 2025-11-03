# Sprint 01: SearchTab Urgent Fix

**Epic**: Unified Settings Architecture
**Phase**: Phase 0
**Status**: Planned
**Priority**: 🚨 CRITICAL
**Effort**: 2 hours
**Timeline**: This week (before v1.0)
**Owner**: Development Team
**Branch**: `sprint/unified-settings-01-searchtab-urgent-fix`

---

## Sprint Goal

Fix the **critically broken** SearchTab settings by migrating to the Domain Hooks pattern, ensuring settings sync bidirectionally and persist across sessions.

### Problem

SearchTab has 4 settings completely disconnected from the settings system:
- `wordSearch.contextWords` - No sync, no persistence
- `wordSearch.clusterWindow` - No sync, no persistence
- `wordSearch.minClusterSize` - No sync, no persistence, **wrong default** (3 vs 2)
- `wordSearch.caseSensitive` - No sync, no persistence

**User Impact**:
- Users cannot configure Word Search via Settings Overlay ❌
- Settings don't persist across reloads ❌
- Changes in native VSCode settings panel ignored ❌
- Wrong default causes incorrect clustering behavior ❌

**User Story**: User sets custom search params, gets good results, closes VSCode, reopens → all settings lost, back to defaults.

---

## Tasks

### Task 1: Create `useWordSearchSettings` Hook (1 hour)

**File**: `src/presentation/webview/hooks/domain/useWordSearchSettings.ts`

**Implementation**:

```typescript
import React from 'react';
import { MessageType } from '../../../../shared/types/messages';
import { VSCodeAPI } from '../../types';

interface WordSearchSettings {
  contextWords: number;
  clusterWindow: number;
  minClusterSize: number;
  caseSensitive: boolean;
}

export const useWordSearchSettings = (vscode: VSCodeAPI) => {
  const [settings, setSettings] = React.useState<WordSearchSettings>({
    contextWords: 3,
    clusterWindow: 50,
    minClusterSize: 2,  // ✅ Correct default (not 3)
    caseSensitive: false
  });

  // Message handler for SETTINGS_DATA
  const handleMessage = React.useCallback((message: any) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const { wordSearch } = message.data;
      if (wordSearch) {
        setSettings(wordSearch);
      }
    }
  }, []);

  // Register listener
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      handleMessage(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleMessage]);

  // Update setting (send to backend)
  const updateSetting = React.useCallback((key: keyof WordSearchSettings, value: any) => {
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      key: `wordSearch.${key}`,
      value
    });
  }, [vscode]);

  return {
    settings,
    updateSetting,
    handleMessage,  // For useMessageRouter
    persistedState: { wordSearch: settings }  // For usePersistence
  };
};
```

**Acceptance Criteria**:
- ✅ Hook initializes with correct defaults
- ✅ `handleMessage` updates state on `SETTINGS_DATA`
- ✅ `updateSetting` sends `UPDATE_SETTING` with correct key
- ✅ `persistedState` exposes settings for persistence
- ✅ `minClusterSize` default is 2 (not 3)

---

### Task 2: Update `ConfigurationHandler` (15 min)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

**Add method** to expose word search settings:

```typescript
public getWordSearchSettings() {
  return {
    contextWords: this.config.get<number>('wordSearch.contextWords', 3),
    clusterWindow: this.config.get<number>('wordSearch.clusterWindow', 50),
    minClusterSize: this.config.get<number>('wordSearch.minClusterSize', 2),
    caseSensitive: this.config.get<boolean>('wordSearch.caseSensitive', false)
  };
}
```

**Update** `getAllSettings()` to include word search:

```typescript
public getAllSettings() {
  return {
    // ... existing settings
    wordSearch: this.getWordSearchSettings()
  };
}
```

**Acceptance Criteria**:
- ✅ `getWordSearchSettings()` returns all 4 settings
- ✅ Correct defaults match hook
- ✅ Included in `getAllSettings()`

---

### Task 3: Update `MessageHandler` Config Watcher (15 min)

**File**: `src/application/handlers/MessageHandler.ts`

**Add** to config watcher (temporary, will be refactored in Phase 1):

```typescript
private onConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
  // ... existing code

  // Word Search settings
  if (
    event.affectsConfiguration('proseMinion.wordSearch.contextWords') ||
    event.affectsConfiguration('proseMinion.wordSearch.clusterWindow') ||
    event.affectsConfiguration('proseMinion.wordSearch.minClusterSize') ||
    event.affectsConfiguration('proseMinion.wordSearch.caseSensitive')
  ) {
    const affectedKeys = [
      'proseMinion.wordSearch.contextWords',
      'proseMinion.wordSearch.clusterWindow',
      'proseMinion.wordSearch.minClusterSize',
      'proseMinion.wordSearch.caseSensitive'
    ];

    if (affectedKeys.some(key => this.configurationHandler.shouldBroadcastConfigChange(key))) {
      this.webviewProvider.postMessage({
        type: MessageType.SETTINGS_DATA,
        data: this.configurationHandler.getAllSettings()
      });
    }
  }
}
```

**Note**: This is temporary duplication. Phase 1 will extract this to semantic methods.

**Acceptance Criteria**:
- ✅ Config watcher detects word search setting changes
- ✅ Broadcasts `SETTINGS_DATA` when changed
- ✅ Echo prevention works (no loops)

---

### Task 4: Migrate SearchTab Component (30 min)

**File**: `src/presentation/webview/components/SearchTab.tsx`

**Remove** local state and manual listeners:

```typescript
// ❌ REMOVE
const [contextWords, setContextWords] = React.useState(3);
const [clusterWindow, setClusterWindow] = React.useState(50);
const [minClusterSize, setMinClusterSize] = React.useState(3);  // ❌ Wrong default!
const [caseSensitive, setCaseSensitive] = React.useState(false);

// ❌ REMOVE manual listener
React.useEffect(() => {
  const listener = (event: MessageEvent) => {
    // ...manual handling
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}, []);
```

**Replace** with hook props:

```typescript
interface SearchTabProps {
  // ... existing props
  wordSearchSettings: {
    settings: {
      contextWords: number;
      clusterWindow: number;
      minClusterSize: number;
      caseSensitive: boolean;
    };
    updateSetting: (key: string, value: any) => void;
  };
}

export const SearchTab: React.FC<SearchTabProps> = ({ wordSearchSettings, ...props }) => {
  // Use wordSearchSettings.settings.* instead of local state
  // Use wordSearchSettings.updateSetting() to update

  // Example:
  <input
    type="number"
    value={wordSearchSettings.settings.contextWords}
    onChange={(e) => wordSearchSettings.updateSetting('contextWords', parseInt(e.target.value))}
  />
};
```

**Acceptance Criteria**:
- ✅ No local state for word search settings
- ✅ No manual message listeners
- ✅ Uses hook props throughout
- ✅ Correct default (`minClusterSize: 2`)
- ✅ UI updates when settings change

---

### Task 5: Wire Hook into App.tsx (15 min)

**File**: `src/presentation/webview/App.tsx`

**Instantiate hook**:

```typescript
const wordSearchSettings = useWordSearchSettings(vscode);
```

**Register with message router**:

```typescript
useMessageRouter({
  [MessageType.SETTINGS_DATA]: settings.handleMessage,
  [MessageType.SETTINGS_DATA]: wordSearchSettings.handleMessage,  // ✅ Add
  // ... other handlers
});
```

**Add to persistence**:

```typescript
usePersistence({
  activeTab,
  ...settings.persistedState,
  ...publishingSettings.persistedState,
  ...analysis.persistedState,
  ...wordSearchSettings.persistedState,  // ✅ Add
  // ... other persisted state
});
```

**Pass to SearchTab**:

```typescript
<SearchTab
  // ... existing props
  wordSearchSettings={wordSearchSettings}
/>
```

**Acceptance Criteria**:
- ✅ Hook instantiated in App.tsx
- ✅ Handler registered with `useMessageRouter`
- ✅ State included in `usePersistence`
- ✅ Props passed to SearchTab

---

### Task 6: Add `wordSearch.*` Settings to package.json (10 min)

**File**: `package.json`

**Add** to `contributes.configuration.properties`:

```json
"proseMinion.wordSearch.contextWords": {
  "type": "number",
  "default": 3,
  "minimum": 1,
  "maximum": 10,
  "description": "Number of words to show around each word search match for context"
},
"proseMinion.wordSearch.clusterWindow": {
  "type": "number",
  "default": 50,
  "minimum": 10,
  "maximum": 500,
  "description": "Maximum word distance to group matches into a cluster"
},
"proseMinion.wordSearch.minClusterSize": {
  "type": "number",
  "default": 2,
  "minimum": 2,
  "maximum": 10,
  "description": "Minimum number of matches required to form a cluster"
},
"proseMinion.wordSearch.caseSensitive": {
  "type": "boolean",
  "default": false,
  "description": "Enable case-sensitive word search matching"
}
```

**Acceptance Criteria**:
- ✅ All 4 settings defined in package.json
- ✅ Correct defaults match hook
- ✅ Descriptions clear and helpful
- ✅ Settings appear in native VSCode settings panel

---

### Task 7: Test Bidirectional Sync (15 min)

**Manual Testing Checklist**:

1. **SearchTab → Settings Overlay**:
   - ✅ Change `contextWords` in SearchTab
   - ✅ Open Settings Overlay → verify value updated

2. **Settings Overlay → SearchTab**:
   - ✅ Change `clusterWindow` in Settings Overlay
   - ✅ Return to SearchTab → verify value updated

3. **Native VSCode Settings → SearchTab**:
   - ✅ Open VSCode settings panel (Cmd+,)
   - ✅ Search for "proseMinion.wordSearch"
   - ✅ Change `minClusterSize`
   - ✅ Return to SearchTab → verify value updated

4. **Persistence Across Reload**:
   - ✅ Set all 4 word search settings to non-default values
   - ✅ Reload webview (Developer: Reload Webviews)
   - ✅ Verify all settings persist

5. **Correct Defaults**:
   - ✅ Reset settings to defaults
   - ✅ Verify `minClusterSize` is 2 (not 3)

6. **Functional Testing**:
   - ✅ Perform word search with custom settings
   - ✅ Verify settings applied correctly
   - ✅ Check context words displayed
   - ✅ Check cluster grouping

7. **Echo Prevention**:
   - ✅ Change setting in Settings Overlay
   - ✅ Verify no duplicate updates in SearchTab
   - ✅ Check VSCode Output panel (no error logs)

**Acceptance Criteria**:
- ✅ All 7 test scenarios pass

---

## Definition of Done

- ✅ `useWordSearchSettings` hook created and tested
- ✅ SearchTab migrated to use hook (no local state)
- ✅ ConfigurationHandler exposes word search settings
- ✅ MessageHandler config watcher detects changes
- ✅ Settings defined in package.json
- ✅ App.tsx wires hook correctly
- ✅ All 7 manual tests pass
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Code reviewed
- ✅ Committed to branch
- ✅ PR created

---

## Files Changed

### Created
- [ ] `src/presentation/webview/hooks/domain/useWordSearchSettings.ts`

### Modified
- [ ] `src/presentation/webview/components/SearchTab.tsx`
- [ ] `src/presentation/webview/App.tsx`
- [ ] `src/application/handlers/domain/ConfigurationHandler.ts`
- [ ] `src/application/handlers/MessageHandler.ts`
- [ ] `package.json`

---

## Dependencies

### Prerequisites
- ✅ Domain hooks pattern established ([ADR-2025-10-27](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md))
- ✅ Message envelope architecture in place ([ADR-2025-10-28](../../../docs/adr/2025-10-28-message-envelope-architecture.md))
- ✅ `useMessageRouter` and `usePersistence` available

### Blocks
- Sprint 02 (Backend Semantic Methods) - can proceed after this

---

## Risks & Mitigations

### Risk 1: Breaking Existing Search Functionality
**Likelihood**: Low
**Impact**: High

**Mitigation**:
- Follow proven pattern (`usePublishing` model)
- Thorough manual testing
- Test word search functionality after migration

### Risk 2: Echo Prevention Issues
**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
- Echo prevention system already works for other hooks
- Test by changing settings in multiple locations
- Check VSCode Output panel for errors

---

## Success Metrics

**Before**:
- SearchTab settings: 0% functional ❌
- Persistence: 0% ❌
- User data loss: 100% ❌

**After**:
- SearchTab settings: 100% functional ✅
- Persistence: 100% ✅
- User data loss: 0% ✅

---

## Notes

### Why This is Critical

This is a **user-facing bug** that causes data loss. Users lose all search customizations on reload, creating a frustrating experience. This must be fixed before v1.0.

### Pattern Reference

Follow `usePublishingSettings` as the model:
- `src/presentation/webview/hooks/domain/usePublishingSettings.ts` - Clean, simple hook
- Pattern works perfectly for Publishing Standards
- Same approach will work for Word Search

**Naming Convention**: All settings hooks use `use[Domain]Settings` suffix to distinguish from state/service hooks (like `useContext`, `useAnalysis`, etc.)

### Temporary Duplication

Task 3 adds temporary duplication to `MessageHandler` config watcher. This is acceptable because Sprint 02 (Phase 1) will immediately refactor this to semantic methods.

---

## Retrospective

_To be filled after sprint completion_

### What Went Well
-

### What Could Be Improved
-

### Actual Time vs. Estimate
- Estimate: 2 hours
- Actual: ___

### Lessons Learned
-

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-01-searchtab-urgent-fix`
**Started**: TBD
**Completed**: TBD
**PR**: TBD
