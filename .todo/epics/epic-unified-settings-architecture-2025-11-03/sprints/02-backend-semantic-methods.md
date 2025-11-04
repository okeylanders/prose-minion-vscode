# Sprint 02: Backend Semantic Methods

**Epic**: Unified Settings Architecture
**Phase**: Phase 1
**Status**: Complete
**Priority**: HIGH
**Effort**: 30 minutes
**Timeline**: Completed 2025-11-03
**Owner**: Development Team
**Branch**: `sprint/unified-settings-02-backend-semantic-methods`
**Commit**: `449c783`

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

## Implementation Outcomes

**Completed**: 2025-11-03
**Commits**: `449c783`, `d4e2017`, `883ef47`, `d73170e`, `eecac18` (5 commits)
**Branch**: `sprint/unified-settings-02-backend-semantic-methods`
**PR Doc**: [docs/pr/sprint-02-backend-semantic-methods.md](../../docs/pr/sprint-02-backend-semantic-methods.md)

### Results

✅ **All tasks completed successfully + critical bug fix**

**Code Quality Improvements**:

- Config watcher reduced from 73 lines → 35 lines (52% reduction)
- Total changes: +119 insertions, -73 deletions (net +46 lines for dramatically better maintainability)
- Zero TypeScript errors
- Build passes successfully

**Maintainability Gains**:

- **Before**: Adding new setting required manual updates in 3+ places (error-prone)
- **After**: Adding new setting requires 1 change (add to constant array)
- Code duplication: **Eliminated**
- Single source of truth for all settings keys
- Settings coverage: 35/37 settings (100% functional coverage)

**Pattern Established**:

- 7 constant arrays covering 35 settings
- 7 semantic methods: shouldBroadcastGeneralSettings(), shouldBroadcastWordSearchSettings(), shouldBroadcastPublishingSettings(), etc.
- Clean, declarative config watcher using semantic methods
- **100% consistent pattern** - zero hardcoded settings keys remaining
- Debug logging added for troubleshooting settings sync issues

### Critical Bug Fix (Commit d73170e)

**Problem**: VSCSP → webview sync completely broken due to wrong setting names in constant arrays

**Root Cause**:
- Used 'minLength' instead of 'minCharacterLength'
- Used 'includeLemmas' instead of 'enableLemmas'
- Missing 9 out of 11 word frequency settings
- Had fake 'contextSourceMode'/'contextSourcePath' instead of real 'contextPaths.*' settings

**Fix**: Audited all 37 settings from package.json and corrected:
- GENERAL_SETTINGS_KEYS: 6 → 4 settings (removed non-existent)
- WORD_SEARCH_KEYS: 4 → 6 settings (added 2 missing)
- WORD_FREQUENCY_KEYS: 2 → 11 settings (fixed names + added 9 missing)
- CONTEXT_PATH_KEYS: 2 → 8 settings (replaced fake with real)

**Impact**: VSCSP → webview sync now works correctly

### All Commits

1. **`449c783`** - feat(settings): extract settings keys to constants and create semantic methods
2. **`d4e2017`** - fix(settings): complete refactor by adding publishing standards to semantic methods
3. **`883ef47`** - debug(settings): add comprehensive logging to config watcher and echo prevention
4. **`d73170e`** - fix(settings): correct all setting key names in constant arrays (CRITICAL BUG FIX)
5. **`eecac18`** - chore(settings): remove deprecated openRouterApiKey from package.json

### Verification

- ✅ TypeScript compilation: Passed
- ✅ Webpack build: Passed
- ✅ No runtime errors
- ✅ VSCSP → webview sync: **WORKS** (was completely broken)
- ✅ Webview → VSCSP sync: Works
- ✅ Echo prevention: Works
- ✅ Settings coverage: 35/37 (100% functional)
- ✅ Debug logging: Comprehensive
- ✅ Publishing standards refactored to match pattern

### Files Changed

- `src/application/handlers/MessageHandler.ts` (+98 insertions, -58 deletions)
- `src/application/handlers/domain/ConfigurationHandler.ts` (+21 insertions, -7 deletions)
- `package.json` (-8 deletions - removed deprecated openRouterApiKey)

### Notes

- All semantic methods follow consistent pattern: check `affectsConfiguration()` + `shouldBroadcastConfigChange()`
- Pattern 100% complete - no hardcoded settings keys remaining in config watcher
- Debug logging added helped identify critical bug with wrong setting names
- Intentionally excluded 2 settings: `proseMinion.model` (legacy fallback still used), `proseMinion.openRouterApiKey` (deprecated)
- Ready to merge and serve as reference implementation for future settings groups

---

**Sprint Status**: Complete
**Branch**: `sprint/unified-settings-02-backend-semantic-methods`
