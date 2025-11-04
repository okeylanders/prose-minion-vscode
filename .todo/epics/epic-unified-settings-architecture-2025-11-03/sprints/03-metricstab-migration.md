# Sprint 03: MetricsTab Migration - All Word Frequency Settings

**Epic**: Unified Settings Architecture
**Phase**: Phase 2
**Status**: ✅ Complete
**Completed**: 2025-11-03
**Priority**: MEDIUM
**Effort**: 1.5 hours (actual: 1.5 hours)
**Timeline**: v1.1
**Owner**: Development Team
**Branch**: `sprint/unified-settings-03-metricstab-migration`
**PR**: docs/pr/sprint-03-metricstab-word-frequency-settings.md (pending merge)

---

## Sprint Goal

Migrate **all 11 word frequency settings** from message-based pattern to Domain Hooks pattern for explicit webview persistence and 100% settings coverage.

### Problem

MetricsTab currently has **partial** settings sync:
- ✅ Syncs with Settings Overlay (via `UPDATE_SETTING`)
- ✅ Syncs with native VSCode settings
- ⚠️ **BUT** relies on backend sync on mount (not webview persistence)
- ⚠️ Only `minCharacterLength` is currently used in MetricsTab UI, but all 11 settings should be in the hook

**Impact**: Works correctly, but persistence is indirect and not following the established pattern. Partial implementation would create technical debt.

### Scope

Implement **all 11 word frequency settings** in `useWordFrequencySettings` hook:

1. `topN` - Top N words to display
2. `includeHapaxList` - Include hapax (frequency=1) list
3. `hapaxDisplayMax` - Max hapax words to display
4. `includeStopwordsTable` - Include stopwords table
5. `contentWordsOnly` - Filter to content words only
6. `posEnabled` - Enable POS tagging sections
7. `includeBigrams` - Include bigrams analysis
8. `includeTrigrams` - Include trigrams analysis
9. `enableLemmas` - Enable lemmatization view
10. `lengthHistogramMaxChars` - Max word length in histogram
11. `minCharacterLength` - Minimum word length filter

**Note**: Backend already supports all 11 settings (completed in Sprint 02). This sprint focuses on frontend hook creation and persistence.

---

## Tasks

### Task 1: Create `useWordFrequencySettings` Hook (45 min)

**File**: `src/presentation/webview/hooks/domain/useWordFrequencySettings.ts`

**Implementation Notes**:

- Follow the pattern from `usePublishingSettings.ts` (clean, focused example)
- Include all 11 settings as specified in ADR (lines 209-220)
- Backend already exposes these via `ConfigurationHandler.getAllSettings()` (completed in Sprint 02)
- Use proper TypeScript interfaces for type safety

```typescript
import React from 'react';
import { MessageType } from '../../../../shared/types/messages';
import { VSCodeAPI } from '../../types';

/**
 * Word Frequency Settings
 * All 11 settings for word frequency analysis configuration
 * Syncs with package.json proseMinion.wordFrequency.* settings
 */
interface WordFrequencySettings {
  topN: number;                       // Top N words to display (default: 100)
  includeHapaxList: boolean;          // Include hapax (frequency=1) list (default: true)
  hapaxDisplayMax: number;            // Max hapax words to display (default: 300)
  includeStopwordsTable: boolean;     // Include stopwords table (default: true)
  contentWordsOnly: boolean;          // Filter to content words only (default: true)
  posEnabled: boolean;                // Enable POS tagging sections (default: true)
  includeBigrams: boolean;            // Include bigrams analysis (default: true)
  includeTrigrams: boolean;           // Include trigrams analysis (default: true)
  enableLemmas: boolean;              // Enable lemmatization view (default: false)
  lengthHistogramMaxChars: number;    // Max word length in histogram (default: 10)
  minCharacterLength: number;         // Minimum word length filter (default: 1)
}

interface WordFrequencySettingsState {
  settings: WordFrequencySettings;
}

interface WordFrequencySettingsActions {
  updateSetting: (key: keyof WordFrequencySettings, value: any) => void;
  handleMessage: (message: any) => void;
}

interface WordFrequencySettingsPersistence {
  wordFrequency: WordFrequencySettings;
}

export type UseWordFrequencySettingsReturn =
  WordFrequencySettingsState &
  WordFrequencySettingsActions &
  { persistedState: WordFrequencySettingsPersistence };

export const useWordFrequencySettings = (vscode: VSCodeAPI): UseWordFrequencySettingsReturn => {
  const [settings, setSettings] = React.useState<WordFrequencySettings>({
    topN: 100,
    includeHapaxList: true,
    hapaxDisplayMax: 300,
    includeStopwordsTable: true,
    contentWordsOnly: true,
    posEnabled: true,
    includeBigrams: true,
    includeTrigrams: true,
    enableLemmas: false,
    lengthHistogramMaxChars: 10,
    minCharacterLength: 1
  });

  const handleMessage = React.useCallback((message: any) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const payload = message.payload || message.data;
      const settingsData = payload?.settings || payload;

      // Extract wordFrequency.* settings from flat or nested structure
      const wordFrequencySettings: Partial<WordFrequencySettings> = {};

      if (settingsData['wordFrequency.topN'] !== undefined) {
        wordFrequencySettings.topN = settingsData['wordFrequency.topN'];
      }
      if (settingsData['wordFrequency.includeHapaxList'] !== undefined) {
        wordFrequencySettings.includeHapaxList = settingsData['wordFrequency.includeHapaxList'];
      }
      if (settingsData['wordFrequency.hapaxDisplayMax'] !== undefined) {
        wordFrequencySettings.hapaxDisplayMax = settingsData['wordFrequency.hapaxDisplayMax'];
      }
      if (settingsData['wordFrequency.includeStopwordsTable'] !== undefined) {
        wordFrequencySettings.includeStopwordsTable = settingsData['wordFrequency.includeStopwordsTable'];
      }
      if (settingsData['wordFrequency.contentWordsOnly'] !== undefined) {
        wordFrequencySettings.contentWordsOnly = settingsData['wordFrequency.contentWordsOnly'];
      }
      if (settingsData['wordFrequency.posEnabled'] !== undefined) {
        wordFrequencySettings.posEnabled = settingsData['wordFrequency.posEnabled'];
      }
      if (settingsData['wordFrequency.includeBigrams'] !== undefined) {
        wordFrequencySettings.includeBigrams = settingsData['wordFrequency.includeBigrams'];
      }
      if (settingsData['wordFrequency.includeTrigrams'] !== undefined) {
        wordFrequencySettings.includeTrigrams = settingsData['wordFrequency.includeTrigrams'];
      }
      if (settingsData['wordFrequency.enableLemmas'] !== undefined) {
        wordFrequencySettings.enableLemmas = settingsData['wordFrequency.enableLemmas'];
      }
      if (settingsData['wordFrequency.lengthHistogramMaxChars'] !== undefined) {
        wordFrequencySettings.lengthHistogramMaxChars = settingsData['wordFrequency.lengthHistogramMaxChars'];
      }
      if (settingsData['wordFrequency.minCharacterLength'] !== undefined) {
        wordFrequencySettings.minCharacterLength = settingsData['wordFrequency.minCharacterLength'];
      }

      if (Object.keys(wordFrequencySettings).length > 0) {
        setSettings(prev => ({ ...prev, ...wordFrequencySettings }));
      }
    }
  }, []);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      handleMessage(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleMessage]);

  const updateSetting = React.useCallback((key: keyof WordFrequencySettings, value: any) => {
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useWordFrequencySettings',
      payload: {
        key: `wordFrequency.${key}`,
        value
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  return {
    settings,
    updateSetting,
    handleMessage,
    persistedState: { wordFrequency: settings }
  };
};
```

---

### Task 2: Verify ConfigurationHandler (5 min)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

**Status**: ✅ Already complete from Sprint 02!

**Verification**:

- All 11 word frequency settings already exposed in `getAllSettings()` (lines 147-157)
- Settings returned with correct keys matching hook interface
- No changes needed - backend is ready

**Example of what's already there**:

```typescript
public getAllSettings() {
  return {
    // ... other settings
    'wordFrequency.topN': config.get<number>('wordFrequency.topN') ?? 100,
    'wordFrequency.includeHapaxList': config.get<boolean>('wordFrequency.includeHapaxList') ?? true,
    'wordFrequency.hapaxDisplayMax': config.get<number>('wordFrequency.hapaxDisplayMax') ?? 300,
    'wordFrequency.includeStopwordsTable': config.get<boolean>('wordFrequency.includeStopwordsTable') ?? true,
    'wordFrequency.contentWordsOnly': config.get<boolean>('wordFrequency.contentWordsOnly') ?? true,
    'wordFrequency.posEnabled': config.get<boolean>('wordFrequency.posEnabled') ?? true,
    'wordFrequency.includeBigrams': config.get<boolean>('wordFrequency.includeBigrams') ?? true,
    'wordFrequency.includeTrigrams': config.get<boolean>('wordFrequency.includeTrigrams') ?? true,
    'wordFrequency.enableLemmas': config.get<boolean>('wordFrequency.enableLemmas') ?? false,
    'wordFrequency.lengthHistogramMaxChars': config.get<number>('wordFrequency.lengthHistogramMaxChars') ?? 10,
    'wordFrequency.minCharacterLength': config.get<number>('wordFrequency.minCharacterLength') ?? 1,
    // ...
  };
}
```

**Task**: Simply verify the settings are there (no code changes)

---

### Task 3: Migrate MetricsTab (20 min)

**File**: `src/presentation/webview/components/MetricsTab.tsx`

**Changes Required**:

**Step 1**: Remove manual listener (lines 73-93):

```typescript
// ❌ REMOVE THIS ENTIRE BLOCK
React.useEffect(() => {
  const handler = (event: MessageEvent) => {
    const msg = event.data;
    if (msg?.type === MessageType.SETTINGS_DATA) {
      const settings = msg.payload?.settings || {};
      if (settings['wordFrequency.minCharacterLength'] !== undefined) {
        setMinCharLength(settings['wordFrequency.minCharacterLength']);
      }
    }
  };
  window.addEventListener('message', handler);
  vscode.postMessage({
    type: MessageType.REQUEST_SETTINGS_DATA,
    source: 'webview.metrics.tab',
    payload: {},
    timestamp: Date.now()
  });
  return () => window.removeEventListener('message', handler);
}, [vscode]);
```

**Step 2**: Remove local state (line 68):

```typescript
// ❌ REMOVE
const [minCharLength, setMinCharLength] = React.useState<number>(1);
```

**Step 3**: Add props to interface:

```typescript
interface MetricsTabProps {
  // ... existing props
  wordFrequencySettings: {
    settings: {
      topN: number;
      includeHapaxList: boolean;
      hapaxDisplayMax: number;
      includeStopwordsTable: boolean;
      contentWordsOnly: boolean;
      posEnabled: boolean;
      includeBigrams: boolean;
      includeTrigrams: boolean;
      enableLemmas: boolean;
      lengthHistogramMaxChars: number;
      minCharacterLength: number;
    };
    updateSetting: (key: string, value: any) => void;
  };
}
```

**Step 4**: Update component to destructure new prop:

```typescript
export const MetricsTab: React.FC<MetricsTabProps> = ({
  vscode,
  // ... existing props
  wordFrequencySettings,  // ✅ ADD THIS
}) => {
```

**Step 5**: Update `handleFilterChange` function (lines 103-114):

```typescript
// ✅ REPLACE with simpler version
const handleFilterChange = (minLength: number) => {
  wordFrequencySettings.updateSetting('minCharacterLength', minLength);
};
```

**Step 6**: Update usage of `minCharLength`:

```typescript
// ❌ OLD: minCharLength
// ✅ NEW: wordFrequencySettings.settings.minCharacterLength
```

**Note**: Currently only `minCharacterLength` is used in the UI (WordLengthFilterTabs). The other 10 settings are available for future use and will be persisted correctly.

---

### Task 4: Wire into App.tsx (20 min)

**File**: `src/presentation/webview/App.tsx`

**Changes**:

**Step 1**: Import the new hook (top of file):

```typescript
import { useWordFrequencySettings } from './hooks/domain/useWordFrequencySettings';
```

**Step 2**: Instantiate hook (in App component, around line 30):

```typescript
const wordFrequencySettings = useWordFrequencySettings(vscode);
```

**Step 3**: Register in message router (in useMessageRouter call):

```typescript
useMessageRouter({
  // ... existing handlers
  [MessageType.SETTINGS_DATA]: (message) => {
    settings.handleMessage(message);
    publishing.handleMessage(message);
    wordSearchSettings.handleMessage(message);
    wordFrequencySettings.handleMessage(message);  // ✅ ADD THIS
  },
  // ... rest of handlers
});
```

**Step 4**: Add to persistence composition (in usePersistence call):

```typescript
usePersistence({
  activeTab,
  ...settings.persistedState,
  ...publishing.persistedState,
  ...wordSearchSettings.persistedState,
  ...wordFrequencySettings.persistedState,  // ✅ ADD THIS
  ...analysis.persistedState,
  ...metrics.persistedState,
  ...dictionary.persistedState,
  ...context.persistedState,
  ...search.persistedState,
  ...selection.persistedState
});
```

**Step 5**: Pass to MetricsTab component (in JSX):

```typescript
<MetricsTab
  vscode={vscode}
  metricsByTool={metrics.metricsByTool}
  isLoading={metrics.isLoading}
  onLoadingChange={metrics.setIsLoading}
  activeTool={metrics.activeTool}
  onActiveToolChange={metrics.setActiveTool}
  sourceMode={metrics.sourceMode}
  pathText={metrics.pathText}
  onSourceModeChange={metrics.setSourceMode}
  onPathTextChange={metrics.setPathText}
  onClearSubtoolResult={metrics.clearSubtoolResult}
  onRequestActiveFile={handleRequestActiveFile}
  onRequestManuscriptGlobs={handleRequestManuscriptGlobs}
  onRequestChapterGlobs={handleRequestChapterGlobs}
  publishingPreset={publishing.preset}
  publishingTrimKey={publishing.trimKey}
  publishingGenres={publishing.genres}
  onPublishingPresetChange={publishing.setPreset}
  onPublishingTrimChange={publishing.setTrimKey}
  wordFrequencySettings={wordFrequencySettings}  // ✅ ADD THIS
/>
```

---

## Definition of Done

- ✅ `useWordFrequencySettings` hook created with all 11 settings
- ✅ ConfigurationHandler verified (already has all 11 settings from Sprint 02)
- ✅ MetricsTab migrated (no manual listener, no local state)
- ✅ App.tsx wires hook (instantiate, register, persist, pass to component)
- ✅ All 11 settings persist explicitly via `usePersistence`
- ✅ Bidirectional sync works (Settings Overlay ↔ MetricsTab ↔ VSCode settings)
- ✅ Manual tests pass

---

## Testing Checklist

### Minimal Test (minCharacterLength only)

1. ✅ Change `minLength` filter in MetricsTab (WordLengthFilterTabs) → verify it updates
2. ✅ Check Settings Overlay → should reflect new value
3. ✅ Change in Settings Overlay → verify MetricsTab filter updates
4. ✅ Change in native VSCode settings panel → verify MetricsTab updates
5. ✅ Reload webview → verify persistence (filter value maintained)
6. ✅ Run word frequency analysis → verify filter applied correctly

### Extended Test (verify all 11 settings sync)

1. ✅ Change any of the 11 settings in VSCode settings panel
2. ✅ Verify `wordFrequencySettings.settings` object updates in React DevTools
3. ✅ Verify persistence: check `vscode.getState()` includes all 11 settings

### Edge Cases

1. ✅ Check echo prevention: Change in MetricsTab shouldn't cause duplicate updates
2. ✅ Verify defaults: Fresh webview should have correct defaults (100, true, 300, etc.)
3. ✅ Verify TypeScript: No type errors in VSCode Problems panel

---

## Success Metrics

**Before Sprint 03**:

- Word frequency settings: 0/11 explicitly persisted in webview ❌
- MetricsTab: Manual listener, local state ❌
- Pattern: Message-based (legacy) ❌

**After Sprint 03**:

- Word frequency settings: 11/11 explicitly persisted in webview ✅
- MetricsTab: Hook-based, no manual listener, no local state ✅
- Pattern: Domain Hooks (modern, consistent) ✅
- Persistence coverage: 100% for word frequency settings ✅

---

## Notes

### Current UI Usage

- **Currently used**: `minCharacterLength` (WordLengthFilterTabs in MetricsTab)
- **Future use**: Other 10 settings (hapax, POS, bigrams, etc.) available when needed
- **Backend ready**: All 11 settings already in `WORD_FREQUENCY_KEYS` and config watcher (Sprint 02)

### Architecture Benefits

- **Complete implementation**: Avoids technical debt of partial implementation
- **Future-proof**: All 11 settings available for Settings Overlay or future UI
- **Consistent pattern**: Follows `usePublishingSettings` and `useWordSearchSettings`
- **Type-safe**: Full TypeScript interfaces exported (State, Actions, Persistence)

---

## Sprint Completion Summary

**Status**: ✅ Complete
**Completed**: 2025-11-03
**Actual Effort**: 1.5 hours (on estimate)
**Branch**: `sprint/unified-settings-03-metricstab-migration`
**PR**: docs/pr/sprint-03-metricstab-word-frequency-settings.md

### Deliverables

- ✅ Created `useWordFrequencySettings.ts` hook with all 11 settings (136 lines)
- ✅ Migrated MetricsTab component (+7, -33 lines = 82% code reduction)
- ✅ Wired into App.tsx (+4, -1 lines)
- ✅ All 11 word frequency settings now explicitly persisted in webview
- ✅ Bidirectional sync working (Settings Overlay ↔ MetricsTab ↔ VSCode settings)
- ✅ Optimistic updates implemented for responsive UI

### Commits

1. **634729b** - docs(sprint-03): update scope to include all 11 word frequency settings
2. **fdead03** - feat(settings): migrate all 11 word frequency settings to domain hooks pattern
3. **3e94f8f** - fix(settings): add optimistic updates to useWordFrequencySettings
4. **1afe21b** - docs(memory-bank): add sprint 03 completion summary

### Testing Results

- ✅ TypeScript compilation: PASS (zero errors)
- ✅ Webpack build: SUCCESS
- ✅ Pattern compliance: Matches `useWordSearchSettings` and `usePublishing`
- ✅ Manual testing: Filter tabs update instantly (optimistic updates)
- ✅ Persistence: Settings maintained across reload
- ✅ VSCode settings panel: Bidirectional sync working

### Architecture Benefits Achieved

- ✅ 100% persistence coverage for word frequency settings (11/11)
- ✅ 82% code reduction in MetricsTab settings management (33 lines → 3 lines)
- ✅ Clean separation of concerns (component is purely presentational)
- ✅ Future-proof (all 11 settings ready for Settings Overlay UI)
- ✅ No technical debt (complete implementation)

### Issues Fixed

- Fixed missing optimistic updates (commit 3e94f8f) - filter tabs now respond instantly

### References

- [PR Document](../../../docs/pr/sprint-03-metricstab-word-frequency-settings.md)
- [Memory Bank Entry](../../../.memory-bank/20251103-2021-sprint-03-metricstab-migration-complete.md)
- [ADR](../../../docs/adr/2025-11-03-unified-settings-architecture.md)

---

**Dependencies**: Sprint 02 complete ✅
