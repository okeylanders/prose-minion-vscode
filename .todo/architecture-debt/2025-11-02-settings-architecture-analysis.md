# Settings Architecture Comprehensive Analysis

**Date**: 2025-11-02
**Status**: Analysis Complete
**Priority**: High
**Complexity**: High

## Executive Summary

The Prose Minion extension has **three distinct patterns** for managing settings across the webview-extension boundary, creating significant architectural inconsistency. This analysis maps every settings flow, identifies where hooks exist vs message-based approaches, documents bidirectional sync mechanisms, and proposes a unified architecture.

**Critical Finding**: Settings management is split across:
1. **Domain hooks pattern** (5 hooks) - Modern, persistence-aware
2. **Message-based pattern** (1 setting) - Legacy, no persistence
3. **Hybrid pattern** (API key) - Special case using SecretStorage

---

## Table of Contents

1. [Current Architecture Map](#current-architecture-map)
2. [Settings Flow Diagrams](#settings-flow-diagrams)
3. [Pattern Analysis](#pattern-analysis)
4. [Hook vs Message Comparison](#hook-vs-message-comparison)
5. [Bidirectional Sync Mechanisms](#bidirectional-sync-mechanisms)
6. [Persistence Architecture](#persistence-architecture)
7. [Inconsistencies and Problems](#inconsistencies-and-problems)
8. [Recommended Unified Architecture](#recommended-unified-architecture)
9. [Migration Plan](#migration-plan)
10. [Test Strategy](#test-strategy)

---

## Current Architecture Map

### Backend Components

#### ConfigurationHandler.ts
**Responsibilities:**
- Listens to VSCode workspace configuration changes
- Handles webview messages: `UPDATE_SETTING`, `REQUEST_SETTINGS_DATA`, `SET_MODEL_SELECTION`
- Manages echo prevention via `webviewOriginatedUpdates` Set (100ms timeout)
- Broadcasts config changes when they originate from native VSCode settings panel

**Key Methods:**
```typescript
handleRequestSettingsData()    // Sends SETTINGS_DATA to webview
handleUpdateSetting()          // Updates VSCode config, marks as webview-originated
shouldBroadcastConfigChange()  // Echo prevention logic
sendModelData()                // Sends MODEL_DATA to webview
```

**Settings Exposed** (lines 110-148):
```typescript
// Core settings
'includeCraftGuides', 'temperature', 'maxTokens', 'applyContextWindowTrimming'
'ui.showTokenWidget'

// Publishing standards
'publishingStandards.preset', 'publishingStandards.pageSizeKey'

// Word Frequency (13 settings)
'wordFrequency.topN', 'wordFrequency.includeHapaxList',
'wordFrequency.hapaxDisplayMax', 'wordFrequency.includeStopwordsTable',
'wordFrequency.contentWordsOnly', 'wordFrequency.posEnabled',
'wordFrequency.includeBigrams', 'wordFrequency.includeTrigrams',
'wordFrequency.enableLemmas', 'wordFrequency.lengthHistogramMaxChars',
'wordFrequency.minCharacterLength'  // ⚠️ Message-based in webview

// Word Search (5 settings)
'wordSearch.defaultTargets', 'wordSearch.contextWords',
'wordSearch.clusterWindow', 'wordSearch.minClusterSize',
'wordSearch.caseSensitive', 'wordSearch.enableAssistantExpansion'

// Context Paths (8 settings)
'contextPaths.characters', 'contextPaths.locations', 'contextPaths.themes',
'contextPaths.things', 'contextPaths.chapters', 'contextPaths.manuscript',
'contextPaths.projectBrief', 'contextPaths.general'
```

#### MessageHandler.ts
**Responsibilities:**
- Config watcher for bidirectional sync (lines 86-160)
- Detects changes from native VSCode settings panel
- Calls `shouldBroadcastConfigChange()` to prevent echo
- Broadcasts `SETTINGS_DATA` when native settings change

**Config Watcher Logic**:
```typescript
// Watches nested prefixes
if (event.affectsConfiguration('proseMinion.wordFrequency')) {
  if (configurationHandler.shouldBroadcastConfigChange('proseMinion.wordFrequency')) {
    // Send SETTINGS_DATA to webview
  }
}
```

### Frontend Components

#### useSettings Hook (Domain Hook Pattern)
**File**: `src/presentation/webview/hooks/domain/useSettings.ts`
**Responsibilities:**
- Settings overlay visibility
- General settings state (core settings, model selections, token usage)
- API key UI state (input, hasSavedKey)

**State Managed:**
```typescript
showSettings: boolean              // Overlay visibility
settingsData: Record<string, any>  // All settings from backend
tokenTotals: TokenUsage           // Running totals
showTokenWidget: boolean          // UI preference
apiKeyInput: string               // Transient input
hasSavedKey: boolean              // SecretStorage status
modelOptions: ModelOption[]       // Available models
modelSelections: Record<ModelScope, string>  // Per-scope model choices
```

**Message Handlers:**
```typescript
handleSettingsData()       // SETTINGS_DATA
handleApiKeyStatus()       // API_KEY_STATUS
handleModelOptionsData()   // MODEL_DATA
handleTokenUsageUpdate()   // TOKEN_USAGE_UPDATE
```

**Actions:**
```typescript
updateSetting(key, value)  // Optimistic update + UPDATE_SETTING message
setModelSelection()        // Optimistic update + SET_MODEL_SELECTION message
resetTokens()              // RESET_TOKEN_USAGE message
toggleTokenWidget()        // UPDATE_SETTING with 'ui.showTokenWidget'
```

**Persistence:**
```typescript
persistedState: {
  settingsData,
  tokenTotals,
  showTokenWidget,
  modelSelections
}
```

#### usePublishing Hook (Domain Hook Pattern)
**File**: `src/presentation/webview/hooks/domain/usePublishing.ts`
**Responsibilities:**
- Publishing standards state (preset, trim size, genres)

**State Managed:**
```typescript
publishingPreset: string   // Genre preset key
publishingTrimKey: string  // Page size key
publishingGenres: Genre[]  // Available genres + trim sizes
```

**Message Handlers:**
```typescript
handlePublishingStandardsData()  // PUBLISHING_STANDARDS_DATA
```

**Actions:**
```typescript
setPublishingPreset(preset)      // SET_PUBLISHING_PRESET message
setPublishingTrim(pageSizeKey?)  // SET_PUBLISHING_TRIM_SIZE message
```

**Persistence:**
```typescript
persistedState: {
  publishingPreset,
  publishingTrimKey
}
```

#### MetricsTab Component (Message-Based Pattern)
**File**: `src/presentation/webview/components/MetricsTab.tsx`
**Responsibilities:**
- Word length filter state (minCharacterLength)
- Direct message passing without hook

**State Managed:**
```typescript
const [minCharLength, setMinCharLength] = React.useState<number>(1);
```

**Message Handlers** (lines 73-92):
```typescript
React.useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data.type === MessageType.SETTINGS_DATA) {
      const settings = event.data.payload?.settings || {};
      if (settings['wordFrequency.minCharacterLength'] !== undefined) {
        setMinCharLength(settings['wordFrequency.minCharacterLength']);
      }
    }
  };
  window.addEventListener('message', handler);

  // Request initial settings on mount
  vscode.postMessage({ type: MessageType.REQUEST_SETTINGS_DATA, ... });

  return () => window.removeEventListener('message', handler);
}, []);
```

**Actions** (lines 103-112):
```typescript
const handleFilterChange = (minLength: number) => {
  setMinCharLength(minLength);  // Optimistic local update
  vscode.postMessage({
    type: MessageType.UPDATE_SETTING,
    payload: {
      key: 'wordFrequency.minCharacterLength',
      value: minLength
    }
  });
};
```

**Persistence**: ❌ **NONE** - State lost on reload unless synced from backend

#### SettingsOverlay Component
**File**: `src/presentation/webview/components/SettingsOverlay.tsx`
**Responsibilities:**
- Settings UI rendering
- Receives all settings via props from hooks
- Calls `onUpdate()` callback for all settings changes

**Settings UI Mapping**:
```typescript
// Uses useSettings hook via props
onUpdate('includeCraftGuides', value)
onUpdate('temperature', value)
onUpdate('maxTokens', value)
onUpdate('applyContextWindowTrimming', value)
onUpdate('ui.showTokenWidget', value)

// Word Frequency settings
onUpdate('wordFrequency.topN', value)
onUpdate('wordFrequency.minCharacterLength', value)  // ⚠️ Also in MetricsTab
// ... all other wordFrequency settings

// Word Search settings
onUpdate('wordSearch.defaultTargets', value)
// ... all other wordSearch settings

// Context Paths
onUpdate('contextPaths.characters', value)
// ... all other contextPaths settings

// Publishing Standards (uses usePublishing hook)
publishing.setPublishingPreset(value)
publishing.setPublishingTrim(value)

// Model selections (uses useSettings hook)
onModelChange(scope, modelId)  // Calls settings.setModelSelection()

// API Key (uses useSettings hook)
apiKey.onSave()   // Calls settings.saveApiKey()
apiKey.onClear()  // Calls settings.clearApiKey()
```

#### App.tsx (Orchestration)
**File**: `src/presentation/webview/App.tsx`
**Responsibilities:**
- Composes all domain hooks
- Routes messages via `useMessageRouter`
- Composes persistence via `usePersistence`
- Passes hook props to components

**Hook Composition**:
```typescript
const settings = useSettings();
const publishing = usePublishing();
const analysis = useAnalysis();
const metrics = useMetrics();
const dictionary = useDictionary();
const context = useContext();
const search = useSearch();
const selection = useSelection();
```

**Message Router**:
```typescript
useMessageRouter({
  [MessageType.SETTINGS_DATA]: settings.handleSettingsData,
  [MessageType.API_KEY_STATUS]: settings.handleApiKeyStatus,
  [MessageType.MODEL_DATA]: settings.handleModelOptionsData,
  [MessageType.TOKEN_USAGE_UPDATE]: settings.handleTokenUsageUpdate,
  [MessageType.PUBLISHING_STANDARDS_DATA]: publishing.handlePublishingStandardsData,
  // ... other domain handlers
});
```

**Persistence**:
```typescript
usePersistence({
  activeTab,
  ...settings.persistedState,
  ...publishing.persistedState,
  ...analysis.persistedState,
  ...metrics.persistedState,
  // ... other domain persisted states
});
```

**Props Passed to Components**:
```typescript
<SettingsOverlay
  settings={settings.settingsData}
  onUpdate={settings.updateSetting}         // ✅ Hook method
  modelOptions={settings.modelOptions}
  modelSelections={settings.modelSelections}
  onModelChange={settings.setModelSelection}  // ✅ Hook method
  publishing={{
    preset: publishing.publishingPreset,
    trimKey: publishing.publishingTrimKey,
    genres: publishing.publishingGenres,
    onPresetChange: publishing.setPublishingPreset,  // ✅ Hook method
    onTrimChange: publishing.setPublishingTrim        // ✅ Hook method
  }}
  // ... other props
/>

<MetricsTab
  publishing={{
    preset: publishing.publishingPreset,      // ✅ From hook
    trimKey: publishing.publishingTrimKey,    // ✅ From hook
    genres: publishing.publishingGenres,      // ✅ From hook
    onPresetChange: publishing.setPublishingPreset,  // ✅ Hook method
    onTrimChange: publishing.setPublishingTrim       // ✅ Hook method
  }}
  // ❌ minCharLength NOT passed - managed internally via messages
/>
```

---

## Settings Flow Diagrams

### Flow 1: Hook-Based Settings (useSettings + SettingsOverlay)

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Changes Setting in SettingsOverlay UI                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SettingsOverlay calls onUpdate('temperature', 0.9)                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ useSettings.updateSetting('temperature', 0.9)                       │
│ 1. Optimistic update: setSettingsData({ temperature: 0.9 })         │
│ 2. Send message: UPDATE_SETTING                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ConfigurationHandler.handleUpdateSetting()                          │
│ 1. Mark as webview-originated: webviewOriginatedUpdates.add(...)    │
│ 2. Update VSCode config: config.update('temperature', 0.9)          │
│ 3. Send MODEL_DATA if UI setting (showTokenWidget only)             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Config Watcher in MessageHandler (lines 86-160)                     │
│ 1. Detects: event.affectsConfiguration('proseMinion.temperature')   │
│ 2. Check: shouldBroadcastConfigChange() → FALSE (webview-originated)│
│ 3. NO SETTINGS_DATA sent (prevents echo)                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ UI Updates Immediately (optimistic update already applied)          │
│ State persisted via usePersistence({ ...settings.persistedState })  │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Native VSCode Settings Panel Changes

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Changes Setting in Native VSCode Settings UI                   │
│ File > Preferences > Settings > proseMinion.temperature             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Config Watcher in MessageHandler (lines 86-160)                     │
│ 1. Detects: event.affectsConfiguration('proseMinion.temperature')   │
│ 2. Check: shouldBroadcastConfigChange() → TRUE (not webview-origin) │
│ 3. Call: configurationHandler.handleRequestSettingsData()           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ConfigurationHandler.handleRequestSettingsData()                    │
│ 1. Read all settings from VSCode workspace config                   │
│ 2. Build settings object with 30+ keys                              │
│ 3. Send SETTINGS_DATA message to webview                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ useSettings.handleSettingsData(message)                             │
│ 1. Extract: settings = message.payload.settings                     │
│ 2. Update state: setSettingsData(settings)                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ usePersistence({ ...settings.persistedState })                      │
│ 1. State persisted to vscode.setState()                             │
│ 2. UI re-renders with new settings                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Message-Based Settings (MetricsTab minCharLength)

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Clicks Filter Tab in MetricsTab (e.g., "5+ characters")        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ WordLengthFilterTabs calls onFilterChange(5)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ MetricsTab.handleFilterChange(5)                                    │
│ 1. Optimistic update: setMinCharLength(5)                           │
│ 2. Send message: UPDATE_SETTING with key='wordFrequency.min...'     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ConfigurationHandler.handleUpdateSetting()                          │
│ 1. Mark as webview-originated                                       │
│ 2. Update VSCode config                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Config Watcher in MessageHandler                                    │
│ 1. Detects: event.affectsConfiguration('proseMinion.wordFrequency') │
│ 2. Check: shouldBroadcastConfigChange() → FALSE                     │
│ 3. NO SETTINGS_DATA sent (prevents echo)                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ UI Updates Immediately (optimistic update already applied)          │
│ ❌ State NOT persisted (no hook, no usePersistence integration)     │
│ ⚠️  Lost on webview reload unless re-requested from backend         │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Publishing Standards (usePublishing Hook)

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Changes Genre in SettingsOverlay or MetricsTab                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Component calls publishing.setPublishingPreset('literary_fiction')  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ usePublishing.setPublishingPreset('literary_fiction')               │
│ 1. Optimistic update: setPublishingPresetState(...)                 │
│ 2. Send message: SET_PUBLISHING_PRESET                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PublishingHandler.handleSetPublishingPreset()                       │
│ 1. Update VSCode config: publishingStandards.preset                 │
│ 2. Send PUBLISHING_STANDARDS_DATA back to webview                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ usePublishing.handlePublishingStandardsData(message)                │
│ 1. Update state: setPublishingPresetState(...)                      │
│ 2. Update state: setPublishingGenres(...)                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ usePersistence({ ...publishing.persistedState })                    │
│ 1. State persisted to vscode.setState()                             │
│ 2. Both SettingsOverlay and MetricsTab render with same state ✅    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Pattern Analysis

### Pattern 1: Domain Hooks (5 hooks)

**Hooks Using This Pattern:**
1. `useSettings` - General settings, model selections, tokens, API key UI
2. `usePublishing` - Publishing standards (preset, trim size)
3. `useAnalysis` - Analysis results and loading state
4. `useMetrics` - Metrics results cache
5. `useDictionary` - Dictionary results and inputs
6. `useContext` - Context generation state
7. `useSearch` - Search results
8. `useSelection` - Selection and paste state

**Characteristics:**
- ✅ State encapsulated in custom hook
- ✅ Registered with `useMessageRouter` in App.tsx
- ✅ Persistence via `usePersistence` composition
- ✅ Single source of truth across multiple components
- ✅ Optimistic updates
- ✅ Clean React patterns

**Example: useSettings**
```typescript
// Hook definition
export const useSettings = () => {
  const [settingsData, setSettingsData] = useState({...});

  const updateSetting = useCallback((key, value) => {
    setSettingsData(prev => ({ ...prev, [key]: value }));  // Optimistic
    vscode.postMessage({ type: MessageType.UPDATE_SETTING, ... });
  }, [vscode]);

  const handleSettingsData = useCallback((message) => {
    setSettingsData(message.payload.settings);
  }, []);

  return {
    settingsData,
    updateSetting,
    handleSettingsData,
    persistedState: { settingsData }  // ✅ Persisted
  };
};

// App.tsx composition
const settings = useSettings();

useMessageRouter({
  [MessageType.SETTINGS_DATA]: settings.handleSettingsData  // ✅ Routed
});

usePersistence({
  ...settings.persistedState  // ✅ Persisted
});

// Component usage
<SettingsOverlay
  settings={settings.settingsData}
  onUpdate={settings.updateSetting}
/>
```

### Pattern 2: Message-Based (1 setting)

**Settings Using This Pattern:**
1. `wordFrequency.minCharacterLength` - MetricsTab only

**Characteristics:**
- ⚠️  State local to component (not shared)
- ⚠️  Manual message listener setup in useEffect
- ⚠️  Manual REQUEST_SETTINGS_DATA on mount
- ❌ No persistence (state lost on reload)
- ❌ Duplication if multiple components need it
- ❌ Not registered with useMessageRouter

**Example: MetricsTab minCharLength**
```typescript
// Component state
const [minCharLength, setMinCharLength] = React.useState<number>(1);

// Manual listener in useEffect
React.useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data.type === MessageType.SETTINGS_DATA) {
      const settings = event.data.payload?.settings || {};
      if (settings['wordFrequency.minCharacterLength'] !== undefined) {
        setMinCharLength(settings['wordFrequency.minCharacterLength']);
      }
    }
  };
  window.addEventListener('message', handler);

  // Request settings on mount
  vscode.postMessage({ type: MessageType.REQUEST_SETTINGS_DATA, ... });

  return () => window.removeEventListener('message', handler);
}, []);

// Update handler
const handleFilterChange = (minLength: number) => {
  setMinCharLength(minLength);  // Optimistic
  vscode.postMessage({
    type: MessageType.UPDATE_SETTING,
    payload: { key: 'wordFrequency.minCharacterLength', value: minLength }
  });
};

// ❌ No persistedState property
// ❌ Not registered with useMessageRouter
// ❌ Lost on webview reload
```

### Pattern 3: Hybrid (API Key via SecretStorage)

**Settings Using This Pattern:**
1. OpenRouter API Key - Secure storage, special UI

**Characteristics:**
- ✅ Managed via `useSettings` hook
- ✅ Uses SecretStorage (OS-level encryption)
- ✅ Never exposed in settings payload
- ✅ Dedicated message types: `UPDATE_API_KEY`, `DELETE_API_KEY`, `REQUEST_API_KEY`
- ✅ Status-based UI (hasSavedKey boolean)
- ⚠️  Input state (apiKeyInput) is transient, not persisted (security)

**Flow:**
```typescript
// useSettings hook
const [apiKeyInput, setApiKeyInput] = useState('');  // Transient
const [hasSavedKey, setHasSavedKey] = useState(false);

const saveApiKey = useCallback(() => {
  vscode.postMessage({
    type: MessageType.UPDATE_API_KEY,
    payload: { apiKey: apiKeyInput.trim() }
  });
  setApiKeyInput('');  // Clear after send (security)
}, [vscode, apiKeyInput]);

const handleApiKeyStatus = useCallback((message) => {
  setHasSavedKey(message.payload.hasSavedKey);  // Boolean only
}, []);

// ConfigurationHandler backend
async handleUpdateApiKey(message) {
  await secretsService.setApiKey(message.payload.apiKey);
  await refreshServiceConfiguration();
  postMessage({ type: MessageType.API_KEY_STATUS, payload: { hasSavedKey: true } });
}
```

---

## Hook vs Message Comparison

### State Sharing Across Components

| Setting | Pattern | SettingsOverlay | MetricsTab | Other Components | Shared? |
|---------|---------|----------------|-----------|------------------|---------|
| `publishingStandards.preset` | Hook (usePublishing) | ✅ Via props | ✅ Via props | N/A | ✅ YES |
| `publishingStandards.pageSizeKey` | Hook (usePublishing) | ✅ Via props | ✅ Via props | N/A | ✅ YES |
| `temperature` | Hook (useSettings) | ✅ Via props | N/A | N/A | ✅ YES |
| `wordFrequency.minCharacterLength` | Message-based | ✅ Via props | ❌ Local state | N/A | ❌ NO |
| `wordFrequency.topN` | Hook (useSettings) | ✅ Via props | N/A | N/A | ✅ YES |

**Problem Illustrated:**

If a future "Advanced Metrics Panel" component needs `minCharacterLength`:
- **Hook pattern**: Just spread `{...settings}` or `{...wordFrequency}` ✅
- **Message pattern**: Duplicate state + listener + handler ❌

### Persistence Comparison

| Setting | Pattern | Persisted? | Where? | Lost on Reload? |
|---------|---------|-----------|--------|-----------------|
| `publishingStandards.preset` | Hook | ✅ YES | `vscode.setState()` via usePersistence | ❌ NO |
| `temperature` | Hook | ✅ YES | `vscode.setState()` via usePersistence | ❌ NO |
| `wordFrequency.minCharacterLength` | Message-based | ❌ NO | Nowhere | ✅ YES* |

\* *Synced from backend on mount via REQUEST_SETTINGS_DATA, so effectively restored, but not via webview persistence.*

### Code Complexity Comparison

**Hook Pattern** (usePublishing):
```typescript
// Hook: 125 lines (includes all logic, persistence, types)
export const usePublishing = () => { /* ... */ };

// App.tsx: 3 lines
const publishing = usePublishing();
useMessageRouter({ [MessageType.PUBLISHING_STANDARDS_DATA]: publishing.handlePublishingStandardsData });
usePersistence({ ...publishing.persistedState });

// Component: 1 line (spread props)
<MetricsTab publishing={publishing} />
```

**Message-Based Pattern** (minCharLength):
```typescript
// Component: 30+ lines of setup per component
const [minCharLength, setMinCharLength] = React.useState<number>(1);

React.useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data.type === MessageType.SETTINGS_DATA) {
      const settings = event.data.payload?.settings || {};
      if (settings['wordFrequency.minCharacterLength'] !== undefined) {
        setMinCharLength(settings['wordFrequency.minCharacterLength']);
      }
    }
  };
  window.addEventListener('message', handler);
  vscode.postMessage({ type: MessageType.REQUEST_SETTINGS_DATA, ... });
  return () => window.removeEventListener('message', handler);
}, []);

const handleFilterChange = (minLength: number) => {
  setMinCharLength(minLength);
  vscode.postMessage({
    type: MessageType.UPDATE_SETTING,
    payload: { key: 'wordFrequency.minCharacterLength', value: minLength }
  });
};

// If another component needs it: Copy-paste all 30+ lines ❌
```

---

## Bidirectional Sync Mechanisms

### Echo Prevention System

**Problem**: When the webview changes a setting, VSCode fires a config change event. Without echo prevention, this would trigger a SETTINGS_DATA message back to the webview, causing:
- Unnecessary re-renders
- Potential state conflicts
- Wasted bandwidth

**Solution**: `webviewOriginatedUpdates` Set in ConfigurationHandler

```typescript
// ConfigurationHandler.ts
private webviewOriginatedUpdates = new Set<string>();

private markWebviewOriginatedUpdate(configKey: string): void {
  this.webviewOriginatedUpdates.add(configKey);
  setTimeout(() => {
    this.webviewOriginatedUpdates.delete(configKey);
  }, 100);  // ⏱️ 100ms timeout
}

public shouldBroadcastConfigChange(configKey: string): boolean {
  // Exact match
  if (this.webviewOriginatedUpdates.has(configKey)) {
    return false;
  }

  // Prefix match (for nested settings like wordFrequency.*)
  for (const key of this.webviewOriginatedUpdates) {
    if (key.startsWith(configKey + '.')) {
      return false;
    }
  }

  return true;
}
```

**Flow:**
1. Webview sends `UPDATE_SETTING` for `wordFrequency.minCharacterLength`
2. `handleUpdateSetting()` calls `markWebviewOriginatedUpdate('proseMinion.wordFrequency.minCharacterLength')`
3. Key added to Set with 100ms timeout
4. VSCode workspace config updated
5. Config watcher fires: `event.affectsConfiguration('proseMinion.wordFrequency')`
6. Check: `shouldBroadcastConfigChange('proseMinion.wordFrequency')`
7. Prefix match finds `proseMinion.wordFrequency.minCharacterLength` in Set
8. Returns `false` → No SETTINGS_DATA broadcast ✅
9. After 100ms, key removed from Set
10. Future changes from native panel will broadcast correctly ✅

**Edge Cases Handled:**
- ✅ Nested settings (`wordFrequency.*`, `contextPaths.*`)
- ✅ Top-level settings (`temperature`, `maxTokens`)
- ✅ Prefix detection (detects `proseMinion.wordFrequency` change from `proseMinion.wordFrequency.minCharacterLength` update)
- ✅ Race conditions (100ms buffer ensures config update completes before echo check expires)

### Config Watcher Logic

**MessageHandler.ts** (lines 86-160):
```typescript
const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
  // Model changes: Refresh service, NO broadcast
  if (event.affectsConfiguration('proseMinion.assistantModel') /* ... */) {
    void this.refreshServiceConfiguration();
    // Do NOT send MODEL_DATA (handleSetModelSelection will send it)
  }

  // UI settings: Send MODEL_DATA if not webview-originated
  if (event.affectsConfiguration('proseMinion.ui.showTokenWidget')) {
    if (this.configurationHandler.shouldBroadcastConfigChange('proseMinion.ui.showTokenWidget')) {
      void this.configurationHandler.sendModelData();
    }
  }

  // General settings: Send SETTINGS_DATA if not webview-originated
  if (event.affectsConfiguration('proseMinion.temperature') /* ... */) {
    // Top-level check
    let shouldBroadcast = topLevelKeys.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );

    // Nested prefix check
    if (!shouldBroadcast) {
      shouldBroadcast = nestedPrefixes.some(prefix =>
        event.affectsConfiguration(prefix) &&
        this.configurationHandler.shouldBroadcastConfigChange(prefix)
      );
    }

    if (shouldBroadcast) {
      void this.configurationHandler.handleRequestSettingsData({...});
    }
  }
});
```

**Key Insight**: The config watcher is the **only** way settings changed in the native VSCode panel reach the webview.

### Optimistic Updates

Both patterns use optimistic updates to provide instant UI feedback:

```typescript
// Hook pattern (useSettings)
const updateSetting = useCallback((key, value) => {
  setSettingsData(prev => ({ ...prev, [key]: value }));  // 1. Optimistic
  vscode.postMessage({ type: MessageType.UPDATE_SETTING, ... });  // 2. Persist
}, []);

// Message-based pattern (MetricsTab)
const handleFilterChange = (minLength: number) => {
  setMinCharLength(minLength);  // 1. Optimistic
  vscode.postMessage({ type: MessageType.UPDATE_SETTING, ... });  // 2. Persist
};
```

**Why Optimistic Updates Work:**
- UI responds instantly (no lag)
- Backend persists asynchronously
- Echo prevention ensures no conflict
- If backend fails, error message overrides optimistic state

---

## Persistence Architecture

### usePersistence Hook

**File**: `src/presentation/webview/hooks/usePersistence.ts`

```typescript
export const usePersistence = <T extends Record<string, any>>(state: T): void => {
  const vscode = useVSCodeApi();

  React.useEffect(() => {
    vscode.setState(state);  // Persist to VSCode webview storage
  }, [vscode, state]);
};

export const usePersistedState = <T>(): T | undefined => {
  const vscode = useVSCodeApi();
  const [persistedState] = React.useState(() => vscode.getState?.() as T | undefined);
  return persistedState;
};
```

### App.tsx Persistence Composition

```typescript
// App.tsx
const settings = useSettings();
const publishing = usePublishing();
const analysis = useAnalysis();
// ... other hooks

usePersistence({
  activeTab,

  // Settings hook persisted state
  settingsData: settings.settingsData,
  tokenTotals: settings.tokenTotals,
  showTokenWidget: settings.showTokenWidget,
  modelSelections: settings.modelSelections,

  // Publishing hook persisted state
  publishingPreset: publishing.publishingPreset,
  publishingTrimKey: publishing.publishingTrimKey,

  // Analysis hook persisted state
  analysisResult: analysis.result,
  analysisToolName: analysis.toolName,
  // ... etc
});
```

**How It Works:**
1. Each domain hook exposes `persistedState` property
2. App.tsx composes all `persistedState` objects into single state object
3. `usePersistence` calls `vscode.setState()` whenever composed state changes
4. On webview reload, `usePersistedState()` reads from `vscode.getState()`
5. Hooks initialize from persisted state:
   ```typescript
   const persisted = usePersistedState<{settingsData?: any}>();
   const [settingsData, setSettingsData] = useState(persisted?.settingsData ?? {});
   ```

### Persistence Gaps

**Settings With Persistence ✅:**
- All settings in `useSettings.settingsData` (temperature, maxTokens, etc.)
- `useSettings.tokenTotals`
- `useSettings.showTokenWidget`
- `useSettings.modelSelections`
- `usePublishing.publishingPreset`
- `usePublishing.publishingTrimKey`

**Settings Without Persistence ❌:**
- `MetricsTab.minCharLength` - Message-based, not in any hook's `persistedState`

**Workaround:** MetricsTab requests settings on mount via `REQUEST_SETTINGS_DATA`, so filter value is effectively restored from backend. But this is **not** webview persistence—it's backend sync.

**Result:**
- Webview persisted state: ❌ Does not include minCharLength
- Backend sync on mount: ✅ Restores minCharLength
- Functionally equivalent for user experience ✅
- Architecturally inconsistent ❌

---

## Inconsistencies and Problems

### Problem 1: Mixed Patterns Create Confusion

**Symptom:** Developers must choose between two patterns when adding settings.

**Example:**
- Publishing Standards: Uses `usePublishing` hook ✅
- Word Length Filter: Uses message-based pattern ❌

**Why This Happened:**
- Publishing Standards refactored during domain hooks migration (ADR 2025-10-27)
- Word Length Filter added later without hook (sprint 2025-11-02)
- No clear architectural guidance documented

**Impact:**
- Code reviews require pattern discussions
- New features default to "whatever was easiest at the time"
- Architectural debt accumulates

### Problem 2: State Duplication Risk

**Scenario:** Future "Metrics Summary Panel" needs word length filter.

**Hook Pattern:**
```typescript
// Create useWordFrequency hook (1 hour)
const wordFreq = useWordFrequency();

// Use in both components (5 minutes)
<MetricsTab wordFreq={wordFreq} />
<MetricsSummaryPanel wordFreq={wordFreq} />
```

**Message-Based Pattern:**
```typescript
// Copy-paste 30 lines of state + listeners to new component (30 minutes)
// Maintain two copies of same logic (ongoing maintenance burden)
```

### Problem 3: Persistence Inconsistency

**Settings with Direct Persistence:**
```typescript
useSettings → persistedState → usePersistence → vscode.setState()
```

**Settings with Indirect Persistence:**
```typescript
MetricsTab minCharLength → (not persisted) → REQUEST_SETTINGS_DATA on mount → backend sync
```

**Why This Matters:**
- Inconsistent state lifecycle
- Different restoration timing (immediate vs async)
- Harder to reason about state management

### Problem 4: No Clear Ownership Boundaries

**Current State:**
- `useSettings` manages 30+ settings (too many?)
- `usePublishing` manages 3 settings (just right)
- `MetricsTab` manages 1 setting (should be in hook)

**Questions Without Clear Answers:**
- Should all settings live in `useSettings`?
- Should domain-specific settings have dedicated hooks?
- When is it okay to manage settings locally?

**Impact:**
- Arbitrary decisions lead to inconsistent architecture
- Hard to enforce patterns without documented guidelines

### Problem 5: Settings Overlay Asymmetry

**SettingsOverlay receives settings via two different mechanisms:**

```typescript
// Via useSettings hook
<SettingsOverlay
  settings={settings.settingsData}  // ✅ All general settings
  onUpdate={settings.updateSetting}  // ✅ Generic update handler
/>

// Via usePublishing hook
<SettingsOverlay
  publishing={{
    preset: publishing.publishingPreset,  // ✅ Specific property
    onPresetChange: publishing.setPublishingPreset  // ✅ Specific handler
  }}
/>
```

**Why This Is Asymmetric:**
- General settings: Flat `settingsData` object + generic `onUpdate(key, value)`
- Publishing settings: Structured object + specific action methods

**Should Be:**
- **Option A**: All settings use structured domain objects
- **Option B**: All settings use flat data + generic update handler
- **Not Both**

### Problem 6: Message Type Proliferation

**Publishing Standards Messages:**
- `REQUEST_PUBLISHING_STANDARDS_DATA`
- `PUBLISHING_STANDARDS_DATA`
- `SET_PUBLISHING_PRESET`
- `SET_PUBLISHING_TRIM_SIZE`

**General Settings Messages:**
- `REQUEST_SETTINGS_DATA`
- `SETTINGS_DATA`
- `UPDATE_SETTING` (generic)

**Why Publishing Has Specific Messages:**
- Legacy design before domain hooks architecture
- Could be unified with generic `UPDATE_SETTING`
- But maintains backwards compatibility

**Trade-off:**
- Specific messages: More explicit, harder to maintain
- Generic messages: Less explicit, easier to maintain

---

## Recommended Unified Architecture

### Proposed Strategy: Migrate All to Domain Hooks

**Principle:** Every setting should live in a domain hook, exposed via `persistedState`, and registered with `useMessageRouter`.

### Proposed Hook Structure

```
hooks/
├── domain/
│   ├── useSettings.ts          # Core settings (temperature, maxTokens, etc.)
│   ├── usePublishing.ts        # Publishing standards (existing ✅)
│   ├── useWordFrequency.ts     # ⭐ NEW: Word frequency settings
│   ├── useWordSearch.ts        # ⭐ NEW: Word search settings
│   ├── useContextPaths.ts      # ⭐ NEW: Context resource paths
│   ├── useModels.ts            # ⭐ EXTRACT from useSettings: Model selections
│   ├── useTokens.ts            # ⭐ EXTRACT from useSettings: Token tracking
│   ├── useAnalysis.ts          # Analysis results (existing ✅)
│   ├── useMetrics.ts           # Metrics results (existing ✅)
│   ├── useDictionary.ts        # Dictionary results (existing ✅)
│   ├── useContext.ts           # Context generation (existing ✅)
│   ├── useSearch.ts            # Search results (existing ✅)
│   └── useSelection.ts         # Selection/paste (existing ✅)
```

### Design Principles

1. **Domain Separation**: Settings grouped by feature domain
2. **Single Responsibility**: Each hook manages one domain's settings
3. **Composability**: Hooks can be used independently or together
4. **Persistence**: All hooks expose `persistedState`
5. **Type Safety**: Clear interfaces for state, actions, persistence
6. **Message Routing**: All handlers registered in `useMessageRouter`

### Example: useWordFrequency Hook

**File**: `src/presentation/webview/hooks/domain/useWordFrequency.ts`

```typescript
import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType } from '../../../../shared/types';
import { SettingsDataMessage } from '../../../../shared/types/messages';

export interface WordFrequencySettings {
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
  minCharacterLength: number;  // ⭐ Migrated from MetricsTab
}

export interface WordFrequencyState {
  settings: WordFrequencySettings;
}

export interface WordFrequencyActions {
  handleSettingsData: (message: SettingsDataMessage) => void;
  updateSetting: (key: keyof WordFrequencySettings, value: any) => void;
  setMinCharLength: (value: number) => void;  // ⭐ Dedicated setter
}

export interface WordFrequencyPersistence {
  wordFrequencySettings: WordFrequencySettings;
}

export type UseWordFrequencyReturn = WordFrequencyState & WordFrequencyActions & { persistedState: WordFrequencyPersistence };

/**
 * Custom hook for managing word frequency settings
 *
 * @example
 * ```tsx
 * const wordFreq = useWordFrequency();
 *
 * // Register message handler
 * useMessageRouter({
 *   [MessageType.SETTINGS_DATA]: wordFreq.handleSettingsData,
 * });
 *
 * // Use in MetricsTab
 * <MetricsTab wordFreq={wordFreq} />
 *
 * // Use in SettingsOverlay
 * <SettingsOverlay wordFreq={wordFreq} />
 * ```
 */
export const useWordFrequency = (): UseWordFrequencyReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ wordFrequencySettings?: WordFrequencySettings }>();

  const defaultSettings: WordFrequencySettings = {
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
  };

  const [settings, setSettings] = React.useState<WordFrequencySettings>(
    persisted?.wordFrequencySettings ?? defaultSettings
  );

  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    const { settings: allSettings } = message.payload;

    // Extract wordFrequency.* settings
    const wordFreqSettings: Partial<WordFrequencySettings> = {};
    Object.keys(defaultSettings).forEach(key => {
      const configKey = `wordFrequency.${key}`;
      if (allSettings[configKey] !== undefined) {
        wordFreqSettings[key as keyof WordFrequencySettings] = allSettings[configKey];
      }
    });

    setSettings(prev => ({ ...prev, ...wordFreqSettings }));
  }, []);

  const updateSetting = React.useCallback(
    (key: keyof WordFrequencySettings, value: any) => {
      // Optimistic update
      setSettings(prev => ({ ...prev, [key]: value }));

      // Persist to backend
      vscode.postMessage({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.hooks.wordFrequency',
        payload: {
          key: `wordFrequency.${key}`,
          value
        },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  const setMinCharLength = React.useCallback(
    (value: number) => {
      updateSetting('minCharacterLength', value);
    },
    [updateSetting]
  );

  return {
    // State
    settings,

    // Actions
    handleSettingsData,
    updateSetting,
    setMinCharLength,

    // Persistence
    persistedState: {
      wordFrequencySettings: settings
    }
  };
};
```

### Updated App.tsx Composition

```typescript
export const App: React.FC = () => {
  // Core hooks
  const settings = useSettings();        // Core settings only
  const models = useModels();            // Model selections (extracted)
  const tokens = useTokens();            // Token tracking (extracted)

  // Domain-specific settings hooks
  const wordFreq = useWordFrequency();   // ⭐ NEW
  const wordSearch = useWordSearch();    // ⭐ NEW
  const contextPaths = useContextPaths();  // ⭐ NEW
  const publishing = usePublishing();    // Existing ✅

  // Domain results hooks
  const analysis = useAnalysis();
  const metrics = useMetrics();
  const dictionary = useDictionary();
  const context = useContext();
  const search = useSearch();
  const selection = useSelection();

  // Message routing
  useMessageRouter({
    [MessageType.SETTINGS_DATA]: (msg) => {
      settings.handleSettingsData(msg);
      wordFreq.handleSettingsData(msg);  // ⭐ NEW
      wordSearch.handleSettingsData(msg);  // ⭐ NEW
      contextPaths.handleSettingsData(msg);  // ⭐ NEW
    },
    [MessageType.MODEL_DATA]: models.handleModelData,
    [MessageType.TOKEN_USAGE_UPDATE]: tokens.handleTokenUsageUpdate,
    [MessageType.PUBLISHING_STANDARDS_DATA]: publishing.handlePublishingStandardsData,
    // ... other domain handlers
  });

  // Persistence composition
  usePersistence({
    activeTab,
    ...settings.persistedState,
    ...models.persistedState,
    ...tokens.persistedState,
    ...wordFreq.persistedState,  // ⭐ NEW
    ...wordSearch.persistedState,  // ⭐ NEW
    ...contextPaths.persistedState,  // ⭐ NEW
    ...publishing.persistedState,
    ...analysis.persistedState,
    ...metrics.persistedState,
    ...dictionary.persistedState,
    ...context.persistedState,
    ...search.persistedState,
    ...selection.persistedState
  });

  return (
    <>
      {/* ... TabBar ... */}

      {activeTab === TabId.METRICS && (
        <MetricsTab
          wordFreq={wordFreq}  // ⭐ NEW: Spread hook props
          publishing={publishing}
          {...metrics}
        />
      )}

      <SettingsOverlay
        coreSettings={settings}
        models={models}
        tokens={tokens}
        wordFreq={wordFreq}  // ⭐ NEW
        wordSearch={wordSearch}  // ⭐ NEW
        contextPaths={contextPaths}  // ⭐ NEW
        publishing={publishing}
      />
    </>
  );
};
```

### Updated MetricsTab Component

**Before** (Message-Based):
```typescript
// ❌ 30+ lines of manual state management
const [minCharLength, setMinCharLength] = React.useState<number>(1);

React.useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data.type === MessageType.SETTINGS_DATA) {
      // ... manual extraction ...
    }
  };
  window.addEventListener('message', handler);
  vscode.postMessage({ type: MessageType.REQUEST_SETTINGS_DATA, ... });
  return () => window.removeEventListener('message', handler);
}, []);

const handleFilterChange = (minLength: number) => {
  setMinCharLength(minLength);
  vscode.postMessage({ type: MessageType.UPDATE_SETTING, ... });
};
```

**After** (Hook-Based):
```typescript
// ✅ 3 lines - hook handles everything
interface MetricsTabProps {
  wordFreq: UseWordFrequencyReturn;  // ⭐ Hook props
  publishing: UsePublishingReturn;
  // ... other props
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  wordFreq,
  publishing,
  // ...
}) => {
  return (
    <>
      {/* Word Length Filter */}
      {activeTool === 'word_frequency' && (
        <WordLengthFilterTabs
          activeFilter={wordFreq.settings.minCharacterLength}  // ⭐ From hook
          onFilterChange={wordFreq.setMinCharLength}  // ⭐ From hook
        />
      )}
    </>
  );
};
```

### Benefits of Unified Architecture

1. **Consistency**: All settings managed via domain hooks
2. **Persistence**: All settings persisted via `usePersistence`
3. **Sharing**: Easy to share settings across components
4. **Testability**: Hooks can be unit tested in isolation
5. **Maintainability**: Clear ownership and boundaries
6. **Scalability**: Adding new settings follows clear pattern
7. **Type Safety**: TypeScript interfaces enforce contracts
8. **Documentation**: Hooks are self-documenting via JSDoc

---

## Migration Plan

### Phase 1: Create New Domain Hooks (Week 1)

**Tasks:**
1. Create `useWordFrequency.ts` (1 hour)
   - Extract 11 word frequency settings from useSettings
   - Implement handleSettingsData, updateSetting, setMinCharLength
   - Add persistedState export
   - Add JSDoc documentation

2. Create `useWordSearch.ts` (1 hour)
   - Extract 6 word search settings from useSettings
   - Implement handleSettingsData, updateSetting
   - Add persistedState export

3. Create `useContextPaths.ts` (1 hour)
   - Extract 8 context path settings from useSettings
   - Implement handleSettingsData, updatePath
   - Add persistedState export

4. Create `useModels.ts` (2 hours)
   - Extract model selections from useSettings
   - Implement handleModelData, setModelSelection
   - Add persistedState export
   - Coordinate with ConfigurationHandler model logic

5. Create `useTokens.ts` (1 hour)
   - Extract token tracking from useSettings
   - Implement handleTokenUsageUpdate, resetTokens
   - Add persistedState export

**Testing:**
- Unit test each hook in isolation
- Verify settings extraction logic
- Check persistence behavior

### Phase 2: Update useSettings (Week 1)

**Tasks:**
1. Remove wordFrequency settings from useSettings (30 min)
2. Remove wordSearch settings from useSettings (30 min)
3. Remove contextPaths settings from useSettings (30 min)
4. Remove model selections from useSettings (30 min)
5. Remove token tracking from useSettings (30 min)
6. Update useSettings to only manage core settings:
   - `includeCraftGuides`
   - `temperature`
   - `maxTokens`
   - `applyContextWindowTrimming`
   - `ui.showTokenWidget`

**Result:** useSettings reduced from ~360 lines to ~150 lines

### Phase 3: Migrate MetricsTab (Week 2)

**Tasks:**
1. Remove local minCharLength state from MetricsTab (15 min)
2. Remove manual message listener (15 min)
3. Remove handleFilterChange (15 min)
4. Add wordFreq prop to MetricsTabProps (5 min)
5. Update WordLengthFilterTabs usage:
   ```typescript
   <WordLengthFilterTabs
     activeFilter={wordFreq.settings.minCharacterLength}
     onFilterChange={wordFreq.setMinCharLength}
   />
   ```
6. Remove REQUEST_SETTINGS_DATA from useEffect (5 min)

**Result:** MetricsTab reduced by ~30 lines, cleaner architecture

### Phase 4: Update App.tsx (Week 2)

**Tasks:**
1. Import new hooks (5 min)
2. Instantiate hooks (5 min)
3. Update useMessageRouter to route SETTINGS_DATA to all hooks (10 min)
4. Update usePersistence to compose all persistedState objects (10 min)
5. Update component props to pass hooks (15 min)

**Testing:**
- Verify all message routing works
- Check persistence across reload
- Test bidirectional sync (webview ↔ native settings)

### Phase 5: Update SettingsOverlay (Week 2)

**Tasks:**
1. Update SettingsOverlayProps to accept domain hooks (15 min)
2. Replace flat `settings` object with structured domain hooks (1 hour)
3. Update all setting inputs to use domain hook methods:
   ```typescript
   // Before
   <input value={settings['wordFrequency.topN']} onChange={(e) => onUpdate('wordFrequency.topN', e.target.value)} />

   // After
   <input value={wordFreq.settings.topN} onChange={(e) => wordFreq.updateSetting('topN', Number(e.target.value))} />
   ```
4. Test all settings changes propagate correctly (30 min)

**Result:** SettingsOverlay cleaner, domain-organized UI

### Phase 6: Documentation & Cleanup (Week 3)

**Tasks:**
1. Update ARCHITECTURE.md with new hooks structure (1 hour)
2. Create migration guide for future settings (30 min)
3. Update .claude/CLAUDE.md with settings patterns (30 min)
4. Add JSDoc examples to all hooks (1 hour)
5. Create memory bank entry documenting migration (30 min)
6. Archive this analysis document in `.todo/architecture-debt/` (5 min)

### Phase 7: Validation & Rollout (Week 3)

**Tasks:**
1. Manual testing in Extension Development Host (2 hours)
   - Test all settings changes in SettingsOverlay
   - Test filter changes in MetricsTab
   - Test native VSCode settings panel sync
   - Test webview reload persistence
   - Test cross-component state sharing
2. Create test plan document (1 hour)
3. Conduct code review (1 hour)
4. Merge to main branch (15 min)
5. Monitor for regressions (ongoing)

---

## Test Strategy

### Unit Tests (Hooks)

**Test File**: `useWordFrequency.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useWordFrequency } from './useWordFrequency';

describe('useWordFrequency', () => {
  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useWordFrequency());
    expect(result.current.settings.minCharacterLength).toBe(1);
    expect(result.current.settings.topN).toBe(100);
  });

  it('should update setting optimistically', () => {
    const { result } = renderHook(() => useWordFrequency());

    act(() => {
      result.current.setMinCharLength(5);
    });

    expect(result.current.settings.minCharacterLength).toBe(5);
  });

  it('should handle SETTINGS_DATA message', () => {
    const { result } = renderHook(() => useWordFrequency());

    const message = {
      type: 'SETTINGS_DATA',
      payload: {
        settings: {
          'wordFrequency.minCharacterLength': 7,
          'wordFrequency.topN': 50
        }
      }
    };

    act(() => {
      result.current.handleSettingsData(message);
    });

    expect(result.current.settings.minCharacterLength).toBe(7);
    expect(result.current.settings.topN).toBe(50);
  });

  it('should expose persistedState', () => {
    const { result } = renderHook(() => useWordFrequency());
    expect(result.current.persistedState).toHaveProperty('wordFrequencySettings');
  });
});
```

### Integration Tests (Components)

**Test File**: `MetricsTab.test.tsx`

```typescript
import { render, fireEvent } from '@testing-library/react';
import { MetricsTab } from './MetricsTab';
import { useWordFrequency } from '../hooks/domain/useWordFrequency';

jest.mock('../hooks/domain/useWordFrequency');

describe('MetricsTab', () => {
  it('should render word length filter with hook value', () => {
    const mockWordFreq = {
      settings: { minCharacterLength: 5 },
      setMinCharLength: jest.fn()
    };

    (useWordFrequency as jest.Mock).mockReturnValue(mockWordFreq);

    const { getByLabelText } = render(<MetricsTab wordFreq={mockWordFreq} />);

    expect(getByLabelText('5+')).toHaveClass('active');
  });

  it('should call hook method when filter changes', () => {
    const mockWordFreq = {
      settings: { minCharacterLength: 1 },
      setMinCharLength: jest.fn()
    };

    (useWordFrequency as jest.Mock).mockReturnValue(mockWordFreq);

    const { getByLabelText } = render(<MetricsTab wordFreq={mockWordFreq} />);

    fireEvent.click(getByLabelText('5+'));

    expect(mockWordFreq.setMinCharLength).toHaveBeenCalledWith(5);
  });
});
```

### Manual Test Plan

**Checklist**:
- [ ] Open Extension Development Host
- [ ] Open SettingsOverlay (gear icon)
- [ ] Change "Minimum Word Length" dropdown → verify MetricsTab filter updates
- [ ] Change filter tab in MetricsTab → verify SettingsOverlay dropdown updates
- [ ] Change "Minimum Word Length" in native VSCode settings → verify both update
- [ ] Reload webview → verify filter value persists
- [ ] Run Word Frequency tool → verify filter applied to results
- [ ] Test all wordFrequency settings in SettingsOverlay
- [ ] Test all wordSearch settings in SettingsOverlay
- [ ] Test all contextPaths settings in SettingsOverlay
- [ ] Verify no console errors or warnings

---

## Success Metrics

### Code Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| useSettings lines | 360 | 150 | -58% |
| MetricsTab settings lines | 30 | 3 | -90% |
| Total settings hooks | 2 | 7 | +250% (intentional) |
| Settings with persistence | 29/30 | 30/30 | 100% |
| Message-based settings | 1 | 0 | -100% |

### Architecture Metrics

| Metric | Before | After |
|--------|--------|-------|
| Settings patterns | 2 (mixed) | 1 (unified) |
| Domain separation | Partial | Complete |
| State sharing complexity | Copy-paste | Props spread |
| Persistence coverage | 97% | 100% |

### Developer Experience Metrics

| Task | Before (hours) | After (hours) |
|------|----------------|---------------|
| Add new setting | 0.5-1.0 | 0.25 |
| Share setting across components | 1.0-2.0 | 0.1 |
| Debug settings sync issue | 1.0-3.0 | 0.5 |
| Understand settings flow | 2.0-4.0 | 0.5 |

---

## Conclusion

The Prose Minion extension currently uses **three distinct patterns** for settings management:
1. **Domain hooks** (5 hooks) - Modern, consistent, persistence-aware
2. **Message-based** (1 setting) - Legacy, inconsistent, persistence gap
3. **Hybrid** (API key) - Special case for security

**Recommended Action:** Migrate all settings to domain hooks pattern for:
- ✅ Architectural consistency
- ✅ 100% persistence coverage
- ✅ Easy state sharing
- ✅ Better maintainability
- ✅ Clearer ownership boundaries

**Estimated Effort:** 3 weeks (part-time)
**ROI:** High - Prevents future architectural debt, improves developer experience, enables scalability

---

## Backend Registration Pattern Issues

### Related Debt: Settings Sync Registration

**See**: `.todo/architecture-debt/2025-11-02-settings-sync-registration.md`

The backend has a parallel issue with **hardcoded settings lists** in the config watcher. This compounds the frontend pattern inconsistency documented above.

**Current Backend Problem** (MessageHandler.ts lines 108-136):
```typescript
// ❌ Hardcoded lists, duplicated keys
if (
  event.affectsConfiguration('proseMinion.includeCraftGuides') ||
  event.affectsConfiguration('proseMinion.temperature') ||
  event.affectsConfiguration('proseMinion.maxTokens') ||
  event.affectsConfiguration('proseMinion.applyContextWindowTrimming')
) {
  const affectedKeys = [
    'proseMinion.includeCraftGuides',
    'proseMinion.temperature',
    'proseMinion.maxTokens',
    'proseMinion.applyContextWindowTrimming'
  ];
  // ...
}
```

**Issues:**
1. ❌ Keys duplicated (in `if` condition AND in array)
2. ❌ Magic strings (no type safety)
3. ❌ All-or-nothing broadcast (can't have granular subscriptions)
4. ❌ Coupling (MessageHandler knows all watched settings)

### Proposed Backend Fix (Minimum)

**Effort**: 30 minutes
**Combines well with frontend domain hooks migration**

```typescript
// MessageHandler.ts
private readonly GENERAL_SETTINGS_KEYS = [
  'proseMinion.includeCraftGuides',
  'proseMinion.temperature',
  'proseMinion.maxTokens',
  'proseMinion.applyContextWindowTrimming'
] as const;

private readonly WORD_FREQUENCY_PREFIX = 'proseMinion.wordFrequency';
private readonly WORD_SEARCH_PREFIX = 'proseMinion.wordSearch';
private readonly CONTEXT_PATHS_PREFIX = 'proseMinion.contextPaths';
private readonly PUBLISHING_STANDARDS_PREFIX = 'proseMinion.publishingStandards';

private shouldBroadcastGeneralSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.GENERAL_SETTINGS_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

private shouldBroadcastDomainSettings(
  event: vscode.ConfigurationChangeEvent,
  prefix: string
): boolean {
  return event.affectsConfiguration(prefix) &&
    this.configurationHandler.shouldBroadcastConfigChange(prefix);
}

// In configWatcher:
if (this.shouldBroadcastGeneralSettings(event) ||
    this.shouldBroadcastDomainSettings(event, this.WORD_FREQUENCY_PREFIX) ||
    this.shouldBroadcastDomainSettings(event, this.WORD_SEARCH_PREFIX) ||
    this.shouldBroadcastDomainSettings(event, this.CONTEXT_PATHS_PREFIX) ||
    this.shouldBroadcastDomainSettings(event, this.PUBLISHING_STANDARDS_PREFIX)) {
  void this.configurationHandler.handleRequestSettingsData({...});
}
```

**Benefits:**
- ✅ Single source of truth per domain
- ✅ No key duplication
- ✅ Semantic domain grouping
- ✅ Easier to maintain
- ✅ 30-minute fix

### Combined Frontend + Backend Migration

**Recommended Approach**: Migrate frontend AND backend together in one cohesive refactor.

**Phase 1: Backend Cleanup** (30 min)
1. Extract hardcoded keys to constants
2. Create semantic methods (`shouldBroadcastGeneralSettings`, etc.)
3. Update config watcher to use methods

**Phase 2: Frontend Domain Hooks** (2 weeks, documented above)
1. Create domain hooks (useWordFrequency, useWordSearch, etc.)
2. Migrate components to use hooks
3. Update App.tsx composition

**Phase 3: Validation** (1 week)
1. Test all bidirectional sync scenarios
2. Verify echo prevention still works
3. Check persistence across all settings

**Result**: Consistent architecture from backend → frontend, clear domain boundaries, maintainable codebase.

---

## Related Documents

- **Architecture Debt - Frontend Patterns**: `.todo/architecture-debt/2025-11-02-configuration-strategy-inconsistency.md`
- **Architecture Debt - Backend Registration**: `.todo/architecture-debt/2025-11-02-settings-sync-registration.md`
- **ADR - Domain Hooks**: `docs/adr/2025-10-27-presentation-layer-domain-hooks.md`
- **Epic**: `.todo/epics/epic-word-length-filter-metrics-2025-11-02/epic-word-length-filter-metrics.md`
- **PR Description**: `.todo/epics/epic-word-length-filter-metrics-2025-11-02/PR-DESCRIPTION.md`

---

**Document Version**: 1.1
**Last Updated**: 2025-11-02
**Author**: Architecture Analysis (Claude Code)
**Status**: Comprehensive Analysis Complete - Ready for Team Review

**Incorporates**:
- Frontend hook vs message patterns
- Backend registration patterns
- Bidirectional sync mechanisms
- Echo prevention system
- Persistence architecture
- Unified migration plan
