# Adding Settings to Prose Minion

**Guide for Contributors**: How to add new configuration settings following the Unified Settings Architecture pattern.

**Last Updated**: November 2025 (Sprint 05)

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use Which Pattern](#when-to-use-which-pattern)
3. [Naming Conventions](#naming-conventions)
4. [Adding a Setting to an Existing Hook](#adding-a-setting-to-an-existing-hook)
5. [Creating a New Settings Hook](#creating-a-new-settings-hook)
6. [Testing Your Changes](#testing-your-changes)
7. [Common Issues](#common-issues)
8. [Examples](#examples)

---

## Overview

Prose Minion uses a **unified Domain Hooks pattern** for all settings management. This architecture provides:

- ✅ **100% persistence coverage**: No lost settings on reload
- ✅ **Bidirectional sync**: VSCode settings panel ↔ Settings Overlay ↔ Components
- ✅ **Type safety**: Full TypeScript compilation checks
- ✅ **Echo prevention**: No infinite update loops
- ✅ **Clean Architecture**: Frontend mirrors backend domain organization

**Architecture References**:
- [ARCHITECTURE.md - Settings Management Architecture](../ARCHITECTURE.md#settings-management-architecture)
- [ADR-2025-11-03: Unified Settings Architecture](../adr/2025-11-03-unified-settings-architecture.md)

---

## When to Use Which Pattern

### Settings Hook (`use[Domain]Settings`)

**Use when**: You need to persist configuration that users can change via VSCode settings panel

**Characteristics**:
- Persists to workspace/user settings (VSCode Configuration API)
- Bidirectional sync with native settings panel
- Shows in VSCode settings UI
- Settings Overlay integration

**Examples**:
- `useWordSearchSettings` - Word search configuration
- `useModelsSettings` - Model selections + agent behavior
- `usePublishingSettings` - Publishing standards

**Naming**: Always end with `Settings` suffix (e.g., `useWordSearchSettings`)

---

### State Hook (`use[Domain]`)

**Use when**: You need to manage UI state or results (not user configuration)

**Characteristics**:
- Persists to webview state only (vscode.setState)
- No VSCode settings panel integration
- Component-specific or feature-specific state
- Ephemeral or temporary data

**Examples**:
- `useTokenTracking` - Ephemeral token usage tracking
- `useAnalysis` - Analysis results and guides
- `useSearch` - Search results

**Naming**: No `Settings` suffix (e.g., `useTokenTracking`, `useAnalysis`)

---

### SecretStorage

**Use when**: You need to store sensitive data (API keys, tokens, passwords)

**Characteristics**:
- OS-level encryption (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Never appears in settings files
- Custom UI required (password-masked input)

**Examples**:
- OpenRouter API key

**When to use**: Only for truly sensitive data that shouldn't be in plain text

---

## Naming Conventions

### Hook Files

**Settings hooks**:
```
src/presentation/webview/hooks/domain/use[Domain]Settings.ts
```

Examples:
- `useWordSearchSettings.ts`
- `useModelsSettings.ts`
- `usePublishingSettings.ts`

**State hooks**:
```
src/presentation/webview/hooks/domain/use[Domain].ts
```

Examples:
- `useTokenTracking.ts`
- `useAnalysis.ts`
- `useSearch.ts`

### Settings Keys

**Format**: `proseMinion.[domain].[settingName]`

Examples:
- `proseMinion.wordSearch.contextWords`
- `proseMinion.wordFrequency.topN`
- `proseMinion.models.assistantModel`

**Rules**:
- Always prefix with `proseMinion.`
- Use camelCase for setting names
- Group by domain (e.g., all word search settings under `wordSearch.*`)

### Persistence Keys

**Settings hooks**:
```typescript
persistedState: {
  [domain]: settings  // e.g., { wordSearch: settings }
}
```

**State hooks**:
```typescript
persistedState: {
  [stateKey]: value  // e.g., { tokenUsage: state }
}
```

---

## Adding a Setting to an Existing Hook

Follow this checklist to add a new setting to an existing settings hook (e.g., adding a setting to `useWordSearchSettings`).

**Estimated Time**: 15 minutes

### Step 1: Add to package.json

Add the setting to `contributes.configuration.properties`:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "proseMinion.wordSearch.newSetting": {
          "type": "boolean",
          "default": true,
          "description": "Enable the new feature for word search",
          "order": 100
        }
      }
    }
  }
}
```

**Types**: `boolean`, `string`, `number`, `array`, `object`

**Best Practices**:
- Write clear, concise descriptions (users see this in settings panel)
- Always provide a default value
- Use `order` to control display order in settings panel
- Match TypeScript type in hook interface

---

### Step 2: Add to ConfigurationHandler (Backend)

Update the semantic getter method in `ConfigurationHandler.ts`:

```typescript
// src/application/handlers/domain/ConfigurationHandler.ts

public getWordSearchSettings() {
  return {
    defaultTargets: this.config.get('wordSearch.defaultTargets', 'just'),
    contextWords: this.config.get('wordSearch.contextWords', 7),
    clusterWindow: this.config.get('wordSearch.clusterWindow', 150),
    minClusterSize: this.config.get('wordSearch.minClusterSize', 2),
    caseSensitive: this.config.get('wordSearch.caseSensitive', false),
    enableAssistantExpansion: this.config.get('wordSearch.enableAssistantExpansion', false),
    newSetting: this.config.get('wordSearch.newSetting', true) // ✅ Add here
  };
}
```

**Important**: Default value must match `package.json`

---

### Step 3: Update Settings Keys Constant (Backend)

Add the key to the constant array in `MessageHandler.ts`:

```typescript
// src/application/handlers/MessageHandler.ts

private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.defaultTargets',
  'proseMinion.wordSearch.contextWords',
  'proseMinion.wordSearch.clusterWindow',
  'proseMinion.wordSearch.minClusterSize',
  'proseMinion.wordSearch.caseSensitive',
  'proseMinion.wordSearch.enableAssistantExpansion',
  'proseMinion.wordSearch.newSetting' // ✅ Add here
] as const;
```

**Purpose**: Config watcher uses this to detect changes and broadcast updates

---

### Step 4: Add to Domain Hook Interface (Frontend)

Update the settings interface in the hook file:

```typescript
// src/presentation/webview/hooks/domain/useWordSearchSettings.ts

export interface WordSearchSettings {
  defaultTargets: string;
  contextWords: number;
  clusterWindow: number;
  minClusterSize: number;
  caseSensitive: boolean;
  enableAssistantExpansion: boolean;
  newSetting: boolean; // ✅ Add here
}
```

**Important**: Type must match `package.json` type

---

### Step 5: Update Hook Defaults (Frontend)

Add to the default state in the hook:

```typescript
// src/presentation/webview/hooks/domain/useWordSearchSettings.ts

const [settings, setSettings] = React.useState<WordSearchSettings>({
  defaultTargets: 'just',
  contextWords: 7,
  clusterWindow: 150,
  minClusterSize: 2,
  caseSensitive: false,
  enableAssistantExpansion: false,
  newSetting: true // ✅ Add here (matches package.json default)
});
```

**Important**: Default must match `package.json` to prevent first-paint flicker

---

### Step 6: Update Message Handler (Frontend)

Add to the settings extraction in `handleSettingsMessage`:

```typescript
// src/presentation/webview/hooks/domain/useWordSearchSettings.ts

const handleSettingsMessage = React.useCallback((message: MessageEnvelope) => {
  if (message.type === MessageType.SETTINGS_DATA) {
    const payload = message.payload as SettingsDataPayload;

    const wordSearchSettings = {
      defaultTargets: payload.wordSearch?.defaultTargets ?? 'just',
      contextWords: payload.wordSearch?.contextWords ?? 7,
      clusterWindow: payload.wordSearch?.clusterWindow ?? 150,
      minClusterSize: payload.wordSearch?.minClusterSize ?? 2,
      caseSensitive: payload.wordSearch?.caseSensitive ?? false,
      enableAssistantExpansion: payload.wordSearch?.enableAssistantExpansion ?? false,
      newSetting: payload.wordSearch?.newSetting ?? true // ✅ Add here
    };

    setSettings(wordSearchSettings);
  }
}, []);
```

**Important**: Use nullish coalescing (`??`) with same defaults as `useState`

---

### Step 7: Add to SettingsOverlay UI (Frontend)

Add the UI control in `SettingsOverlay.tsx`:

```typescript
// src/presentation/webview/components/SettingsOverlay.tsx

<div className="setting-row">
  <label>
    <input
      type="checkbox"
      checked={wordSearchSettings.settings.newSetting}
      onChange={(e) => wordSearchSettings.updateSetting('newSetting', e.target.checked)}
    />
    <span>Enable New Feature</span>
  </label>
  <p className="setting-description">
    Description of what this setting does (matches package.json)
  </p>
</div>
```

**UI Control Types**:
- `boolean`: `<input type="checkbox">`
- `number`: `<input type="number">`
- `string`: `<input type="text">` or `<select>` (for enums)

---

### Step 8: Test Bidirectional Sync

Run these tests manually:

1. **SettingsOverlay → Feature Component**
   - [ ] Change setting in Settings Overlay (gear icon)
   - [ ] Verify feature component behavior updates
   - [ ] Check console for errors

2. **VSCode Settings Panel → Feature Component**
   - [ ] Open VSCode settings (Cmd+,)
   - [ ] Search for "Prose Minion: Word Search: New Setting"
   - [ ] Toggle the setting
   - [ ] Verify feature component updates

3. **Persistence**
   - [ ] Set value in SettingsOverlay
   - [ ] Reload webview (close and reopen panel)
   - [ ] Verify setting value persists

4. **Echo Prevention**
   - [ ] Open Output Channel (View → Output → Prose Minion)
   - [ ] Change setting in SettingsOverlay
   - [ ] Verify only ONE broadcast message (no loop)

5. **TypeScript Compilation**
   - [ ] Run `npx tsc --noEmit`
   - [ ] Verify zero errors

**All tests must pass before merging**

---

## Creating a New Settings Hook

Follow these steps to create a completely new settings hook for a new domain.

**Estimated Time**: 2-3 hours (for a hook with 5-8 settings)

### Step 1: Plan the Domain

**Questions to answer**:
1. What is the domain? (e.g., "spell check", "export", "formatting")
2. How many settings? (aim for 5-10 per hook)
3. Who consumes these settings? (which components/tabs)
4. Where are settings used? (feature logic location)

**Example**: Creating `useSpellCheckSettings`
- Domain: Spell checking configuration
- Settings: 5 (enabled, language, customDictionary, ignoreUppercase, ignoreNumbers)
- Consumers: New SpellCheckTab, SettingsOverlay
- Usage: New SpellCheckHandler, SpellCheckService

---

### Step 2: Add Settings to package.json

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "proseMinion.spellCheck.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable spell checking",
          "order": 10
        },
        "proseMinion.spellCheck.language": {
          "type": "string",
          "default": "en-US",
          "description": "Spell check language",
          "enum": ["en-US", "en-GB", "fr", "es"],
          "order": 20
        },
        "proseMinion.spellCheck.customDictionary": {
          "type": "array",
          "default": [],
          "description": "Custom words to ignore",
          "items": { "type": "string" },
          "order": 30
        },
        "proseMinion.spellCheck.ignoreUppercase": {
          "type": "boolean",
          "default": true,
          "description": "Ignore words in all uppercase",
          "order": 40
        },
        "proseMinion.spellCheck.ignoreNumbers": {
          "type": "boolean",
          "default": true,
          "description": "Ignore words containing numbers",
          "order": 50
        }
      }
    }
  }
}
```

---

### Step 3: Create Backend Semantic Methods

**ConfigurationHandler.ts**:

```typescript
// src/application/handlers/domain/ConfigurationHandler.ts

public getSpellCheckSettings() {
  return {
    enabled: this.config.get('spellCheck.enabled', true),
    language: this.config.get('spellCheck.language', 'en-US'),
    customDictionary: this.config.get('spellCheck.customDictionary', []),
    ignoreUppercase: this.config.get('spellCheck.ignoreUppercase', true),
    ignoreNumbers: this.config.get('spellCheck.ignoreNumbers', true)
  };
}
```

**MessageHandler.ts**:

```typescript
// src/application/handlers/MessageHandler.ts

private readonly SPELL_CHECK_KEYS = [
  'proseMinion.spellCheck.enabled',
  'proseMinion.spellCheck.language',
  'proseMinion.spellCheck.customDictionary',
  'proseMinion.spellCheck.ignoreUppercase',
  'proseMinion.spellCheck.ignoreNumbers'
] as const;

private shouldBroadcastSpellCheckSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.SPELL_CHECK_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}
```

**Update config watcher**:

```typescript
// MessageHandler.ts - onDidChangeConfiguration

if (this.shouldBroadcastSpellCheckSettings(event)) {
  const spellCheckSettings = this.configurationHandler.getSpellCheckSettings();
  this.broadcastSettings({
    spellCheck: spellCheckSettings,
    // ... other settings
  });
}
```

---

### Step 4: Create Frontend Hook

Create `src/presentation/webview/hooks/domain/useSpellCheckSettings.ts`:

```typescript
import React from 'react';
import { MessageType, MessageEnvelope, SettingsDataPayload } from '@/shared/types/messages';
import { VSCodeAPI } from '../useVSCodeApi';

// ==================== Interfaces ====================

export interface SpellCheckSettings {
  enabled: boolean;
  language: string;
  customDictionary: string[];
  ignoreUppercase: boolean;
  ignoreNumbers: boolean;
}

export interface SpellCheckSettingsState {
  settings: SpellCheckSettings;
}

export interface SpellCheckSettingsActions {
  updateSetting: (key: keyof SpellCheckSettings, value: any) => void;
  handleSettingsMessage: (message: MessageEnvelope) => void;
}

export interface SpellCheckSettingsPersistence {
  persistedState: {
    spellCheck: SpellCheckSettings;
  };
}

export type UseSpellCheckSettingsReturn =
  SpellCheckSettingsState &
  SpellCheckSettingsActions &
  SpellCheckSettingsPersistence;

// ==================== Hook ====================

export const useSpellCheckSettings = (vscode: VSCodeAPI): UseSpellCheckSettingsReturn => {
  // Default settings (must match package.json defaults)
  const [settings, setSettings] = React.useState<SpellCheckSettings>({
    enabled: true,
    language: 'en-US',
    customDictionary: [],
    ignoreUppercase: true,
    ignoreNumbers: true
  });

  // Handle SETTINGS_DATA messages from backend
  const handleSettingsMessage = React.useCallback((message: MessageEnvelope) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const payload = message.payload as SettingsDataPayload;

      // Extract spell check settings from payload
      const spellCheckSettings: SpellCheckSettings = {
        enabled: payload.spellCheck?.enabled ?? true,
        language: payload.spellCheck?.language ?? 'en-US',
        customDictionary: payload.spellCheck?.customDictionary ?? [],
        ignoreUppercase: payload.spellCheck?.ignoreUppercase ?? true,
        ignoreNumbers: payload.spellCheck?.ignoreNumbers ?? true
      };

      setSettings(spellCheckSettings);
    }
  }, []);

  // Send UPDATE_SETTING message to backend
  const updateSetting = React.useCallback(
    (key: keyof SpellCheckSettings, value: any) => {
      vscode.postMessage({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.domain.useSpellCheckSettings',
        payload: {
          key: `spellCheck.${key}`,
          value
        },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  return {
    settings,
    updateSetting,
    handleSettingsMessage,
    persistedState: {
      spellCheck: settings
    }
  };
};
```

---

### Step 5: Wire into App.tsx

**Instantiate hook**:

```typescript
// src/presentation/webview/App.tsx

const spellCheckSettings = useSpellCheckSettings(vscode);
```

**Register with message router**:

```typescript
// App.tsx - useMessageRouter

useMessageRouter({
  [MessageType.SETTINGS_DATA]: (msg) => {
    // ... existing handlers
    spellCheckSettings.handleSettingsMessage(msg);
  },
  // ... other message types
});
```

**Add to persistence composition**:

```typescript
// App.tsx - usePersistence

usePersistence({
  activeTab,
  ...modelsSettings.persistedState,
  // ... existing persisted state
  ...spellCheckSettings.persistedState, // ✅ Add here
});
```

**Pass to components**:

```typescript
// App.tsx - component props

<SpellCheckTab
  spellCheckSettings={spellCheckSettings}
  // ... other props
/>

<SettingsOverlay
  // ... existing props
  spellCheckSettings={spellCheckSettings}
/>
```

---

### Step 6: Add to SettingsOverlay UI

```typescript
// src/presentation/webview/components/SettingsOverlay.tsx

// Add to props interface
interface SettingsOverlayProps {
  // ... existing props
  spellCheckSettings: UseSpellCheckSettingsReturn;
}

// Add settings section in render
<div className="settings-section">
  <h3>Spell Check</h3>

  <div className="setting-row">
    <label>
      <input
        type="checkbox"
        checked={spellCheckSettings.settings.enabled}
        onChange={(e) => spellCheckSettings.updateSetting('enabled', e.target.checked)}
      />
      <span>Enable Spell Check</span>
    </label>
  </div>

  <div className="setting-row">
    <label>
      <span>Language</span>
      <select
        value={spellCheckSettings.settings.language}
        onChange={(e) => spellCheckSettings.updateSetting('language', e.target.value)}
      >
        <option value="en-US">English (US)</option>
        <option value="en-GB">English (UK)</option>
        <option value="fr">French</option>
        <option value="es">Spanish</option>
      </select>
    </label>
  </div>

  <div className="setting-row">
    <label>
      <input
        type="checkbox"
        checked={spellCheckSettings.settings.ignoreUppercase}
        onChange={(e) => spellCheckSettings.updateSetting('ignoreUppercase', e.target.checked)}
      />
      <span>Ignore Uppercase Words</span>
    </label>
  </div>

  <div className="setting-row">
    <label>
      <input
        type="checkbox"
        checked={spellCheckSettings.settings.ignoreNumbers}
        onChange={(e) => spellCheckSettings.updateSetting('ignoreNumbers', e.target.checked)}
      />
      <span>Ignore Words with Numbers</span>
    </label>
  </div>
</div>
```

---

### Step 7: Test Thoroughly

Follow the [Testing Your Changes](#testing-your-changes) section below.

---

## Testing Your Changes

### Manual Testing Checklist

Run all these tests before submitting a PR:

#### 1. Settings Overlay → Component

- [ ] Open Settings Overlay (gear icon)
- [ ] Change each setting
- [ ] Verify component behavior updates immediately
- [ ] Check for visual bugs
- [ ] Verify no console errors

#### 2. VSCode Settings Panel → Component

- [ ] Open VSCode settings (Cmd+, or Ctrl+,)
- [ ] Search for "Prose Minion: [Your Domain]"
- [ ] Change each setting
- [ ] Verify component updates
- [ ] Verify SettingsOverlay reflects change (if open)

#### 3. Component → Settings

- [ ] Use feature component
- [ ] If component has setting controls, verify updates propagate
- [ ] Check both SettingsOverlay and VSCode panel

#### 4. Persistence

- [ ] Set non-default values in SettingsOverlay
- [ ] Close webview panel
- [ ] Reopen panel
- [ ] Verify all settings persist

#### 5. Echo Prevention

- [ ] Open Output Channel (View → Output → Prose Minion)
- [ ] Change setting in SettingsOverlay
- [ ] Watch for `[ConfigurationHandler]` log messages
- [ ] Verify only ONE broadcast per change (no loops)

#### 6. TypeScript Compilation

```bash
npx tsc --noEmit
```

- [ ] Zero errors
- [ ] Zero warnings

#### 7. Build

```bash
npm run build
```

- [ ] Build succeeds
- [ ] Check output sizes (Extension: ~2 MiB, Webview: ~400 KiB)

---

### Common Test Failures

**Settings don't update in component**:
- Check: Is message handler registered in `useMessageRouter`?
- Check: Does backend broadcast include this domain?
- Check: Are setting keys correct in backend?

**Settings don't persist on reload**:
- Check: Is `persistedState` added to `usePersistence`?
- Check: Does hook return `persistedState` interface?

**Infinite update loop (echo)**:
- Check: Is setting key in constant array in `MessageHandler`?
- Check: Does backend call `shouldBroadcastConfigChange()`?

**TypeScript errors**:
- Check: Do all defaults match `package.json` types?
- Check: Is interface exported from hook?
- Check: Does SettingsOverlay props include new hook?

---

## Common Issues

### Issue 1: First Paint Flicker

**Symptom**: Settings briefly show defaults, then update to persisted values

**Cause**: Hook defaults don't match `package.json` defaults

**Fix**: Ensure useState defaults exactly match package.json defaults

```typescript
// ❌ Wrong
const [settings, setSettings] = React.useState({
  enabled: false  // package.json default is true
});

// ✅ Correct
const [settings, setSettings] = React.useState({
  enabled: true  // matches package.json
});
```

---

### Issue 2: Settings Don't Appear in VSCode Panel

**Symptom**: Settings work in SettingsOverlay but don't show in native panel

**Cause**: Missing or incorrect `package.json` entry

**Fix**: Add to `contributes.configuration.properties` in package.json

---

### Issue 3: Settings Lost on Reload

**Symptom**: Settings work during session but reset on webview reload

**Cause**: Missing persistence composition

**Fix**: Add to `usePersistence` in App.tsx

```typescript
usePersistence({
  activeTab,
  ...yourNewHook.persistedState, // ✅ Add here
});
```

---

### Issue 4: Echo Loop (Infinite Updates)

**Symptom**: Logs show repeated broadcasts, settings keep updating

**Cause**: Echo prevention not configured

**Fix**: Add setting keys to constant array in MessageHandler.ts

```typescript
private readonly YOUR_DOMAIN_KEYS = [
  'proseMinion.yourDomain.setting1',
  'proseMinion.yourDomain.setting2'
] as const;
```

---

### Issue 5: Wrong Default Values

**Symptom**: Settings show incorrect defaults on first load

**Cause**: Defaults mismatch between package.json, backend, and frontend

**Fix**: Ensure consistency across all 3 locations:
1. package.json `default` property
2. Backend `config.get()` fallback
3. Frontend `useState` initial value
4. Frontend `handleSettingsMessage` nullish coalescing fallback

All four must match exactly.

---

## Examples

### Example 1: Boolean Setting

**package.json**:
```json
"proseMinion.wordSearch.caseSensitive": {
  "type": "boolean",
  "default": false,
  "description": "Enable case-sensitive word search"
}
```

**Backend**:
```typescript
caseSensitive: this.config.get('wordSearch.caseSensitive', false)
```

**Frontend hook**:
```typescript
const [settings, setSettings] = React.useState({
  caseSensitive: false
});

// In handleSettingsMessage:
caseSensitive: payload.wordSearch?.caseSensitive ?? false
```

**SettingsOverlay UI**:
```typescript
<input
  type="checkbox"
  checked={wordSearchSettings.settings.caseSensitive}
  onChange={(e) => wordSearchSettings.updateSetting('caseSensitive', e.target.checked)}
/>
```

---

### Example 2: Number Setting

**package.json**:
```json
"proseMinion.wordFrequency.topN": {
  "type": "number",
  "default": 100,
  "minimum": 10,
  "maximum": 500,
  "description": "Number of top words to display"
}
```

**Backend**:
```typescript
topN: this.config.get('wordFrequency.topN', 100)
```

**Frontend hook**:
```typescript
const [settings, setSettings] = React.useState({
  topN: 100
});

// In handleSettingsMessage:
topN: payload.wordFrequency?.topN ?? 100
```

**SettingsOverlay UI**:
```typescript
<input
  type="number"
  min={10}
  max={500}
  value={wordFrequencySettings.settings.topN}
  onChange={(e) => wordFrequencySettings.updateSetting('topN', parseInt(e.target.value, 10))}
/>
```

---

### Example 3: String Enum Setting

**package.json**:
```json
"proseMinion.publishing.preset": {
  "type": "string",
  "default": "manuscript",
  "enum": ["manuscript", "middle-grade", "young-adult", "literary"],
  "description": "Publishing standards preset"
}
```

**Backend**:
```typescript
preset: this.config.get('publishingStandards.preset', 'manuscript')
```

**Frontend hook**:
```typescript
const [settings, setSettings] = React.useState({
  preset: 'manuscript' as string
});

// In handleSettingsMessage:
preset: payload.publishingStandards?.preset ?? 'manuscript'
```

**SettingsOverlay UI**:
```typescript
<select
  value={publishingSettings.settings.preset}
  onChange={(e) => publishingSettings.updateSetting('preset', e.target.value)}
>
  <option value="manuscript">Manuscript</option>
  <option value="middle-grade">Middle Grade</option>
  <option value="young-adult">Young Adult</option>
  <option value="literary">Literary Fiction</option>
</select>
```

---

### Example 4: Array Setting

**package.json**:
```json
"proseMinion.spellCheck.customDictionary": {
  "type": "array",
  "default": [],
  "items": { "type": "string" },
  "description": "Custom words to ignore during spell check"
}
```

**Backend**:
```typescript
customDictionary: this.config.get('spellCheck.customDictionary', [])
```

**Frontend hook**:
```typescript
const [settings, setSettings] = React.useState({
  customDictionary: [] as string[]
});

// In handleSettingsMessage:
customDictionary: payload.spellCheck?.customDictionary ?? []
```

**SettingsOverlay UI** (textarea for array editing):
```typescript
<textarea
  value={spellCheckSettings.settings.customDictionary.join('\n')}
  onChange={(e) => {
    const words = e.target.value.split('\n').filter(w => w.trim());
    spellCheckSettings.updateSetting('customDictionary', words);
  }}
  placeholder="Enter custom words (one per line)"
  rows={5}
/>
```

---

## Summary

**Quick Checklist for Adding a Setting**:

1. [ ] Add to `package.json` (with default and description)
2. [ ] Add to backend `ConfigurationHandler` getter method
3. [ ] Add to backend `MessageHandler` keys constant
4. [ ] Add to frontend hook interface
5. [ ] Add to frontend hook defaults (`useState`)
6. [ ] Add to frontend hook message handler
7. [ ] Add to SettingsOverlay UI
8. [ ] Test bidirectional sync (3 sources: Overlay, VSCode panel, persistence)

**Estimated Time**: 15 minutes per setting (following checklist)

**Reference Implementation**: See `useWordSearchSettings.ts` for a clean, simple example

---

## Additional Resources

- [ARCHITECTURE.md - Settings Management](../ARCHITECTURE.md#settings-management-architecture)
- [ADR-2025-11-03: Unified Settings Architecture](../adr/2025-11-03-unified-settings-architecture.md)
- [Sprint 04: Domain Hooks Extraction](../../.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/04-domain-hooks-extraction.md)

**Code References**:
- Frontend hooks: [src/presentation/webview/hooks/domain/](../../src/presentation/webview/hooks/domain/)
- Backend handler: [src/application/handlers/domain/ConfigurationHandler.ts](../../src/application/handlers/domain/ConfigurationHandler.ts)
- Message routing: [src/application/handlers/MessageHandler.ts](../../src/application/handlers/MessageHandler.ts)
- Settings UI: [src/presentation/webview/components/SettingsOverlay.tsx](../../src/presentation/webview/components/SettingsOverlay.tsx)

---

**Last Updated**: November 2025 (Sprint 05)
**Maintainer**: Development Team
**Questions**: See [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) or open an issue
