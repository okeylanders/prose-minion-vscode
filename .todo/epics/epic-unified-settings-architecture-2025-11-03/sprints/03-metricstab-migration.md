# Sprint 03: MetricsTab Migration

**Epic**: Unified Settings Architecture
**Phase**: Phase 2
**Status**: Planned
**Priority**: MEDIUM
**Effort**: 1 hour
**Timeline**: v1.1
**Owner**: Development Team
**Branch**: `sprint/unified-settings-03-metricstab-migration`

---

## Sprint Goal

Migrate MetricsTab `minCharacterLength` setting from message-based pattern to Domain Hooks pattern for explicit webview persistence.

### Problem

MetricsTab currently has **partial** settings sync:
- ✅ Syncs with Settings Overlay (via `UPDATE_SETTING`)
- ✅ Syncs with native VSCode settings
- ⚠️ **BUT** relies on backend sync on mount (not webview persistence)

**Impact**: Works correctly, but persistence is indirect and not following the established pattern.

---

## Tasks

### Task 1: Create `useWordFrequency` Hook (30 min)

**File**: `src/presentation/webview/hooks/domain/useWordFrequency.ts`

```typescript
import React from 'react';
import { MessageType } from '../../../../shared/types/messages';
import { VSCodeAPI } from '../../types';

interface WordFrequencySettings {
  minLength: number;
  includeLemmas: boolean;
}

export const useWordFrequency = (vscode: VSCodeAPI) => {
  const [settings, setSettings] = React.useState<WordFrequencySettings>({
    minLength: 1,
    includeLemmas: false
  });

  const handleMessage = React.useCallback((message: any) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const { wordFrequency } = message.data;
      if (wordFrequency) {
        setSettings(wordFrequency);
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
      key: `wordFrequency.${key}`,
      value
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

### Task 2: Update ConfigurationHandler (10 min)

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

**Add** method:

```typescript
public getWordFrequencySettings() {
  return {
    minLength: this.config.get<number>('wordFrequency.minLength', 1),
    includeLemmas: this.config.get<boolean>('wordFrequency.includeLemmas', false)
  };
}
```

**Update** `getAllSettings()`:

```typescript
public getAllSettings() {
  return {
    // ... existing
    wordFrequency: this.getWordFrequencySettings()
  };
}
```

---

### Task 3: Migrate MetricsTab (20 min)

**File**: `src/presentation/webview/components/MetricsTab.tsx`

**Remove** manual listener (lines 68-112):

```typescript
// ❌ REMOVE
React.useEffect(() => {
  const messageHandler = (event: MessageEvent) => {
    const message = event.data;
    if (message.type === MessageType.SETTINGS_DATA) {
      setMinCharacterLength(message.data.wordFrequency?.minLength ?? 1);
    }
  };
  window.addEventListener('message', messageHandler);
  return () => window.removeEventListener('message', messageHandler);
}, []);
```

**Add** props:

```typescript
interface MetricsTabProps {
  // ... existing props
  wordFrequency: {
    settings: {
      minLength: number;
      includeLemmas: boolean;
    };
    updateSetting: (key: string, value: any) => void;
  };
}
```

**Use** hook props:

```typescript
// Use wordFrequency.settings.minLength
// Use wordFrequency.updateSetting('minLength', value)
```

---

### Task 4: Wire into App.tsx (10 min)

**File**: `src/presentation/webview/App.tsx`

```typescript
const wordFrequency = useWordFrequency(vscode);

useMessageRouter({
  // ...
  [MessageType.SETTINGS_DATA]: wordFrequency.handleMessage,
});

usePersistence({
  // ...
  ...wordFrequency.persistedState,
});

<MetricsTab
  // ...
  wordFrequency={wordFrequency}
/>
```

---

## Definition of Done

- ✅ `useWordFrequency` hook created
- ✅ MetricsTab migrated (no manual listener)
- ✅ ConfigurationHandler exposes settings
- ✅ App.tsx wires hook
- ✅ Settings persist explicitly
- ✅ Manual tests pass

---

## Testing

1. ✅ Change `minLength` in MetricsTab → verify Settings Overlay
2. ✅ Change in Settings Overlay → verify MetricsTab
3. ✅ Change in VSCode settings → verify MetricsTab
4. ✅ Reload webview → verify persistence
5. ✅ Run word frequency analysis → verify filter applied

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-03-metricstab-migration`
