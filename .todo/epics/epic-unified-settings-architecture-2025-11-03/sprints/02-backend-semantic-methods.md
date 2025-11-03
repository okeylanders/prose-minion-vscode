# Sprint 02: Backend Semantic Methods

**Epic**: Unified Settings Architecture
**Phase**: Phase 1
**Status**: Planned
**Priority**: HIGH
**Effort**: 30 minutes
**Timeline**: Next week
**Owner**: Development Team
**Branch**: `sprint/unified-settings-02-backend-semantic-methods`

---

## Sprint Goal

Eliminate hardcoded settings key duplication in `MessageHandler` config watcher by extracting constants and creating semantic methods.

### Problem

Currently, settings keys are hardcoded in multiple places:

```typescript
// ❌ Duplication
if (
  event.affectsConfiguration('proseMinion.includeCraftGuides') ||
  event.affectsConfiguration('proseMinion.temperature') ||
  event.affectsConfiguration('proseMinion.maxTokens')
  // ...
) {
  const affectedKeys = [
    'proseMinion.includeCraftGuides',
    'proseMinion.temperature',
    'proseMinion.maxTokens'
    // ...same keys repeated
  ];
}
```

**Impact**: Adding a new setting requires manual updates in 3+ places, error-prone and slow.

---

## Tasks

### Task 1: Extract Settings Keys to Constants (10 min)

**File**: `src/application/handlers/MessageHandler.ts`

**Add** constant arrays for each settings group:

```typescript
private readonly GENERAL_SETTINGS_KEYS = [
  'proseMinion.includeCraftGuides',
  'proseMinion.temperature',
  'proseMinion.maxTokens',
  'proseMinion.applyContextWindowTrimming',
  'proseMinion.contextAgentWordLimit',
  'proseMinion.analysisAgentWordLimit'
] as const;

private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.contextWords',
  'proseMinion.wordSearch.clusterWindow',
  'proseMinion.wordSearch.minClusterSize',
  'proseMinion.wordSearch.caseSensitive'
] as const;

private readonly WORD_FREQUENCY_KEYS = [
  'proseMinion.wordFrequency.minLength',
  'proseMinion.wordFrequency.includeLemmas'
] as const;

private readonly CONTEXT_PATH_KEYS = [
  'proseMinion.contextSourceMode',
  'proseMinion.contextSourcePath'
] as const;

private readonly MODEL_KEYS = [
  'proseMinion.assistantModel',
  'proseMinion.dictionaryModel',
  'proseMinion.contextModel'
] as const;

private readonly UI_KEYS = [
  'proseMinion.ui.showTokenWidget'
] as const;
```

---

### Task 2: Create Semantic Helper Methods (15 min)

**File**: `src/application/handlers/MessageHandler.ts`

**Add** semantic methods:

```typescript
private shouldBroadcastGeneralSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.GENERAL_SETTINGS_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

private shouldBroadcastWordSearchSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.WORD_SEARCH_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

private shouldBroadcastWordFrequencySettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.WORD_FREQUENCY_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

private shouldBroadcastContextPathSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.CONTEXT_PATH_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

private shouldBroadcastModelSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.MODEL_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}

private shouldBroadcastUISettings(event: vscode.ConfigurationChangeEvent): boolean {
  return this.UI_KEYS.some(key =>
    event.affectsConfiguration(key) &&
    this.configurationHandler.shouldBroadcastConfigChange(key)
  );
}
```

---

### Task 3: Update Config Watcher (5 min)

**File**: `src/application/handlers/MessageHandler.ts`

**Replace** hardcoded `if` conditions:

```typescript
private onConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
  // ✅ Clean, semantic
  if (this.shouldBroadcastGeneralSettings(event)) {
    this.webviewProvider.postMessage({
      type: MessageType.SETTINGS_DATA,
      data: this.configurationHandler.getAllSettings()
    });
  }

  if (this.shouldBroadcastWordSearchSettings(event)) {
    this.webviewProvider.postMessage({
      type: MessageType.SETTINGS_DATA,
      data: this.configurationHandler.getAllSettings()
    });
  }

  if (this.shouldBroadcastWordFrequencySettings(event)) {
    this.webviewProvider.postMessage({
      type: MessageType.SETTINGS_DATA,
      data: this.configurationHandler.getAllSettings()
    });
  }

  if (this.shouldBroadcastContextPathSettings(event)) {
    this.webviewProvider.postMessage({
      type: MessageType.SETTINGS_DATA,
      data: this.configurationHandler.getAllSettings()
    });
  }

  if (this.shouldBroadcastModelSettings(event)) {
    this.webviewProvider.postMessage({
      type: MessageType.SETTINGS_DATA,
      data: this.configurationHandler.getAllSettings()
    });
  }

  if (this.shouldBroadcastUISettings(event)) {
    this.webviewProvider.postMessage({
      type: MessageType.SETTINGS_DATA,
      data: this.configurationHandler.getAllSettings()
    });
  }

  // Publishing standards (already clean)
  if (event.affectsConfiguration('proseMinion.publishing')) {
    // ...
  }
}
```

---

## Definition of Done

- ✅ All settings keys extracted to constants
- ✅ All semantic methods created
- ✅ Config watcher uses semantic methods (no hardcoded keys)
- ✅ No TypeScript errors
- ✅ Existing functionality unchanged (regression test)
- ✅ Code reviewed
- ✅ PR created

---

## Files Changed

### Modified
- [ ] `src/application/handlers/MessageHandler.ts`

---

## Testing

**Regression Testing**:
1. ✅ Change general setting → verify broadcast
2. ✅ Change word search setting → verify broadcast
3. ✅ Change word frequency setting → verify broadcast
4. ✅ Change context path → verify broadcast
5. ✅ Change model selection → verify broadcast
6. ✅ Change UI setting → verify broadcast
7. ✅ Echo prevention still works

---

## Success Metrics

**Before**:
- Adding new setting: 3 manual updates (error-prone)
- Code duplication: High

**After**:
- Adding new setting: 1 change (add to constant array)
- Code duplication: None

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-02-backend-semantic-methods`
