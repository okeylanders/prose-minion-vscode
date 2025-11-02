# Architecture Debt: Settings Sync Registration

**Date Created**: 2025-11-02
**Category**: Configuration Management
**Priority**: Medium
**Effort**: Medium (Minimum) / High (Better)
**Status**: Identified
**Introduced In**: Context Window Trimming feature (Sprint: epic-context-window-safety-2025-11-02-01-trim-limits)

---

## Problem

Settings synchronization between VS Code configuration and webviews (Settings Overlay, Metrics settings, Scope selector, etc.) is currently implemented with **hardcoded, inline lists** in the configuration watcher.

### Current Implementation

**File**: `src/application/handlers/MessageHandler.ts` (lines 108-136)

```typescript
// Send SETTINGS_DATA when general settings change (from VS Code settings panel)
if (
  event.affectsConfiguration('proseMinion.includeCraftGuides') ||
  event.affectsConfiguration('proseMinion.temperature') ||
  event.affectsConfiguration('proseMinion.maxTokens') ||
  event.affectsConfiguration('proseMinion.applyContextWindowTrimming')
) {
  // Check if change was webview-originated to prevent echo-back
  const affectedKeys = [
    'proseMinion.includeCraftGuides',
    'proseMinion.temperature',
    'proseMinion.maxTokens',
    'proseMinion.applyContextWindowTrimming'
  ];
  // ...
}
```

### Issues

1. **Duplication**: Keys appear twice (in `if` condition and in `affectedKeys` array)
2. **Magic strings**: Setting names are hardcoded strings, no type safety
3. **Not scalable**: Adding new settings requires manual updates in multiple places
4. **Maintenance burden**: Easy to forget to update when adding settings
5. **No semantic grouping**: All general settings lumped together
6. **Unclear intent**: Not obvious which webviews care about which settings
7. **Coupling**: MessageHandler directly knows about all settings that need syncing

### Impact

- **Current**: Low (works, but fragile)
- **Future**: Medium-High (will become painful as we add more settings)
- **Maintainability**: Poor (manual updates required)
- **Type Safety**: Poor (no compile-time checking)

---

## Minimum Fix (Quick Win)

**Effort**: ~30 minutes
**Priority**: Should do before v1.0

Extract hardcoded lists to semantic methods with single source of truth.

### Proposed Changes

**File**: `src/application/handlers/MessageHandler.ts`

```typescript
/**
 * Settings that should trigger SETTINGS_DATA broadcast to webview
 * when changed in VS Code's native settings panel
 */
private readonly GENERAL_SETTINGS_KEYS = [
  'proseMinion.includeCraftGuides',
  'proseMinion.temperature',
  'proseMinion.maxTokens',
  'proseMinion.applyContextWindowTrimming'
] as const;

/**
 * Check if any general settings changed that should be broadcast to webview
 */
private shouldBroadcastGeneralSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.GENERAL_SETTINGS_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

// In configWatcher:
if (this.shouldBroadcastGeneralSettings(event)) {
  void this.configurationHandler.handleRequestSettingsData({
    type: MessageType.REQUEST_SETTINGS_DATA,
    source: 'extension.config_watcher',
    payload: {},
    timestamp: Date.now()
  });
}
```

### Benefits of Minimum Fix

- ✅ Single source of truth for watched settings
- ✅ No duplication (keys defined once)
- ✅ Clear semantic intent (`shouldBroadcastGeneralSettings`)
- ✅ Easier to maintain (add new keys to array only)
- ✅ Can use `as const` for type safety
- ✅ 30-minute fix, low risk

### Drawbacks of Minimum Fix

- ⚠️ Still hardcoded in MessageHandler (coupling)
- ⚠️ Still all-or-nothing (can't have granular subscriptions)
- ⚠️ Doesn't solve multi-webview scenarios (future)

---

## Better Solution (Proper Architecture)

**Effort**: 4-6 hours
**Priority**: Nice to have for v1.1+

Implement a **Settings Registry** pattern where webviews/handlers can register interest in specific settings.

### Architectural Design

#### 1. Settings Registry (Infrastructure)

**File**: `src/infrastructure/settings/SettingsRegistry.ts`

```typescript
/**
 * Settings synchronization registry
 * Allows handlers/webviews to register interest in specific settings
 */
export class SettingsRegistry {
  private subscriptions = new Map<string, Set<SettingsSubscriber>>();

  /**
   * Register interest in a specific setting
   */
  subscribe(settingKey: string, subscriber: SettingsSubscriber): Disposable {
    if (!this.subscriptions.has(settingKey)) {
      this.subscriptions.set(settingKey, new Set());
    }
    this.subscriptions.get(settingKey)!.add(subscriber);

    // Return disposable for cleanup
    return {
      dispose: () => {
        this.subscriptions.get(settingKey)?.delete(subscriber);
      }
    };
  }

  /**
   * Get all subscribers interested in a setting
   */
  getSubscribers(settingKey: string): SettingsSubscriber[] {
    return Array.from(this.subscriptions.get(settingKey) || []);
  }

  /**
   * Check if any subscribers exist for a setting
   */
  hasSubscribers(settingKey: string): boolean {
    return (this.subscriptions.get(settingKey)?.size ?? 0) > 0;
  }
}

export interface SettingsSubscriber {
  id: string;
  notify: (settingKey: string, value: any) => Promise<void>;
}
```

#### 2. ConfigurationHandler Registration

**File**: `src/application/handlers/domain/ConfigurationHandler.ts`

```typescript
export class ConfigurationHandler implements SettingsSubscriber {
  readonly id = 'configuration.settings_overlay';

  constructor(
    // ... existing params
    private readonly settingsRegistry: SettingsRegistry
  ) {
    // Register interest in settings that Settings Overlay needs
    this.registerSubscriptions();
  }

  private registerSubscriptions(): void {
    const generalSettings = [
      'proseMinion.includeCraftGuides',
      'proseMinion.temperature',
      'proseMinion.maxTokens',
      'proseMinion.applyContextWindowTrimming'
    ];

    generalSettings.forEach(key => {
      this.settingsRegistry.subscribe(key, this);
    });
  }

  async notify(settingKey: string, value: any): Promise<void> {
    // Broadcast SETTINGS_DATA to webview
    await this.handleRequestSettingsData({
      type: MessageType.REQUEST_SETTINGS_DATA,
      source: 'extension.settings_registry',
      payload: {},
      timestamp: Date.now()
    });
  }
}
```

#### 3. MessageHandler Uses Registry

**File**: `src/application/handlers/MessageHandler.ts`

```typescript
const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
  // For each registered setting, notify subscribers
  const config = vscode.workspace.getConfiguration('proseMinion');

  for (const [settingKey, subscribers] of this.settingsRegistry.getAllSubscriptions()) {
    if (event.affectsConfiguration(settingKey)) {
      const value = config.get(settingKey.replace('proseMinion.', ''));

      // Notify all subscribers
      for (const subscriber of subscribers) {
        void subscriber.notify(settingKey, value);
      }
    }
  }
});
```

### Benefits of Better Solution

- ✅ **Decoupled**: MessageHandler doesn't know which settings to watch
- ✅ **Declarative**: Handlers declare their interests
- ✅ **Scalable**: Add new handlers/settings without touching MessageHandler
- ✅ **Granular**: Different handlers can watch different settings
- ✅ **Testable**: Easy to mock registry for testing
- ✅ **Future-proof**: Supports multiple webviews/handlers easily
- ✅ **Type-safe**: Can use enums/constants for setting keys
- ✅ **Disposable**: Clean unsubscribe mechanism

### Drawbacks of Better Solution

- ⚠️ More complex (new infrastructure component)
- ⚠️ Requires refactoring existing code
- ⚠️ Need to handle echo-back prevention per subscriber
- ⚠️ 4-6 hours of work (not trivial)

---

## Even Better Solution (Pub/Sub)

**Effort**: 8-12 hours
**Priority**: Future (v2.0+)

Full pub/sub event bus for configuration changes with filtering and transformations.

### Features

- Setting change events published to event bus
- Handlers subscribe with filters (regex patterns, prefixes, etc.)
- Support for transformations (e.g., convert setting to different format)
- Batching of changes (debounce multiple rapid changes)
- Message envelope pattern for consistency
- Audit trail of configuration changes

### Example

```typescript
// Handler subscribes to all wordFrequency.* settings
eventBus.subscribe('proseMinion.wordFrequency.*', {
  handler: this.handleWordFrequencyChange.bind(this),
  filter: (event) => !event.webviewOriginated,
  debounce: 100
});
```

---

## Recommendation

**For v1.0**: Implement **Minimum Fix** (30 minutes, low risk)
- Extract to semantic method
- Single source of truth for keys
- Improves maintainability significantly
- Easy to do before merge

**For v1.1+**: Consider **Better Solution** if we add more webviews or settings
- Wait until we have 2+ webviews that need different settings
- Or when we have 10+ settings to sync
- Justify the 4-6 hour investment

**For v2.0+**: Full **Pub/Sub** only if we have complex event patterns
- Requires architectural planning session
- Only if we see pain points with Better Solution

---

## Related Files

### Current Implementation
- `src/application/handlers/MessageHandler.ts` (lines 86-137)
- `src/application/handlers/domain/ConfigurationHandler.ts` (lines 92-146)
- `src/presentation/webview/hooks/domain/useSettings.ts` (handles SETTINGS_DATA)

### Would Be Modified (Minimum Fix)
- `src/application/handlers/MessageHandler.ts` (extract method)

### Would Be Created (Better Solution)
- `src/infrastructure/settings/SettingsRegistry.ts` (new)
- `src/infrastructure/settings/SettingsSubscriber.ts` (new interface)

---

## Decision Log

### 2025-11-02: Debt Identified
- **Decision**: Document as architecture debt, defer fix
- **Rationale**: Feature is functional, want to ship context window trimming
- **Action**: Create this tracking document

### Future Decision Points
- [ ] **Before v1.0 merge**: Decide on minimum fix (30 min investment)
- [ ] **After v1.0**: Review if pain points emerge
- [ ] **Before adding 5+ more synced settings**: Revisit Better Solution

---

## Testing Considerations

### Current Implementation
- Manual testing only (toggle in both places)
- No automated tests for sync behavior

### Minimum Fix
- Unit test: `shouldBroadcastGeneralSettings()` logic
- Integration test: Settings sync end-to-end

### Better Solution
- Unit tests: SettingsRegistry subscribe/unsubscribe
- Unit tests: Subscriber notification
- Integration tests: Multi-subscriber scenarios
- E2E tests: VS Code settings → webview sync

---

**Status**: 📝 Documented, awaiting decision on implementation timing
**Owner**: TBD
**Related ADR**: None (pre-ADR debt tracking)
