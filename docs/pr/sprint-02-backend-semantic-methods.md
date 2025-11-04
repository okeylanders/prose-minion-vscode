# PR: Sprint 02 - Backend Semantic Methods

**Branch**: `sprint/unified-settings-02-backend-semantic-methods`
**Epic**: [Unified Settings Architecture](.todo/epics/epic-unified-settings-architecture-2025-11-03/)
**Sprint**: [Sprint 02](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/02-backend-semantic-methods.md)
**ADR**: [ADR-2025-11-03: Unified Settings Architecture](../adr/2025-11-03-unified-settings-architecture.md)
**Priority**: HIGH
**Status**: Ready for Review

---

## Summary

Eliminates hardcoded settings key duplication in `MessageHandler` config watcher by extracting constants and creating semantic methods. **Includes critical bug fix** that prevented VS Code Settings Pane → webview sync from working.

**Impact**:
- ✅ **Before**: Adding new setting required manual updates in 3+ places (error-prone)
- ✅ **After**: Adding new setting requires 1 change (add to constant array)
- ✅ **Code duplication**: Eliminated
- ✅ **VSCSP → webview sync**: **NOW WORKS** (was completely broken)

---

## Problem Statement

From [Sprint 02 Doc](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/02-backend-semantic-methods.md):

Settings keys were hardcoded in multiple places in config watcher:

```typescript
// ❌ Duplication
if (
  event.affectsConfiguration('proseMinion.includeCraftGuides') ||
  event.affectsConfiguration('proseMinion.temperature') ||
  event.affectsConfiguration('proseMinion.maxTokens')
  // ...
) {
  const affectedKeys = [
    'proseMinion.includeCraftGuides',  // Same keys repeated!
    'proseMinion.temperature',
    'proseMinion.maxTokens'
    // ...
  ];
}
```

**Problems**:
1. Adding new setting = 3+ manual updates
2. Easy to miss keys or make typos
3. No single source of truth

**CRITICAL**: Initial implementation had **completely wrong setting names**, preventing all VSCSP → webview sync:
- Used `minLength` instead of `minCharacterLength`
- Used `includeLemmas` instead of `enableLemmas`
- Missing 9 out of 11 word frequency settings
- Used fake `contextSourceMode`/`contextSourcePath` instead of real `contextPaths.*` settings

---

## Changes Made

### 1. Extracted Settings Keys to Constants
**File**: [src/application/handlers/MessageHandler.ts](../../src/application/handlers/MessageHandler.ts)

Added 7 constant arrays (lines 72-127):
```typescript
private readonly GENERAL_SETTINGS_KEYS = [
  'proseMinion.includeCraftGuides',
  'proseMinion.temperature',
  'proseMinion.maxTokens',
  'proseMinion.applyContextWindowTrimming'
] as const;

private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.defaultTargets',
  'proseMinion.wordSearch.contextWords',
  'proseMinion.wordSearch.clusterWindow',
  'proseMinion.wordSearch.minClusterSize',
  'proseMinion.wordSearch.caseSensitive',
  'proseMinion.wordSearch.enableAssistantExpansion'
] as const;

private readonly WORD_FREQUENCY_KEYS = [
  'proseMinion.wordFrequency.topN',
  'proseMinion.wordFrequency.includeHapaxList',
  'proseMinion.wordFrequency.hapaxDisplayMax',
  'proseMinion.wordFrequency.includeStopwordsTable',
  'proseMinion.wordFrequency.contentWordsOnly',
  'proseMinion.wordFrequency.posEnabled',
  'proseMinion.wordFrequency.includeBigrams',
  'proseMinion.wordFrequency.includeTrigrams',
  'proseMinion.wordFrequency.enableLemmas',  // ✅ Was: includeLemmas (WRONG!)
  'proseMinion.wordFrequency.lengthHistogramMaxChars',
  'proseMinion.wordFrequency.minCharacterLength'  // ✅ Was: minLength (WRONG!)
] as const;

private readonly CONTEXT_PATH_KEYS = [
  'proseMinion.contextPaths.characters',  // ✅ Was: contextSourceMode (FAKE!)
  'proseMinion.contextPaths.locations',
  'proseMinion.contextPaths.themes',
  'proseMinion.contextPaths.things',
  'proseMinion.contextPaths.chapters',
  'proseMinion.contextPaths.manuscript',
  'proseMinion.contextPaths.projectBrief',
  'proseMinion.contextPaths.general'
] as const;

private readonly MODEL_KEYS = [
  'proseMinion.assistantModel',
  'proseMinion.dictionaryModel',
  'proseMinion.contextModel'
] as const;

private readonly UI_KEYS = [
  'proseMinion.ui.showTokenWidget'
] as const;

private readonly PUBLISHING_STANDARDS_KEYS = [
  'proseMinion.publishingStandards.preset',
  'proseMinion.publishingStandards.pageSizeKey'
] as const;
```

**Coverage**: 35/37 settings (100% functional coverage)
- ✅ All user-facing settings
- ⚠️ Intentionally excluded: `proseMinion.model` (legacy fallback), `proseMinion.openRouterApiKey` (deprecated)

### 2. Created Semantic Helper Methods
**File**: [src/application/handlers/MessageHandler.ts](../../src/application/handlers/MessageHandler.ts)

Added 7 semantic methods (lines 339-387):
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

// ... 5 more methods for word frequency, context paths, models, UI, publishing
```

**Pattern**: Each method checks if any key in the group is affected AND should be broadcast (echo prevention)

### 3. Refactored Config Watcher
**File**: [src/application/handlers/MessageHandler.ts](../../src/application/handlers/MessageHandler.ts)

**Before** (73 lines, hardcoded):
```typescript
if (
  event.affectsConfiguration('proseMinion.includeCraftGuides') ||
  event.affectsConfiguration('proseMinion.temperature') ||
  event.affectsConfiguration('proseMinion.maxTokens') ||
  // ... 50 more lines of hardcoded checks
) {
  // Complex nested logic
}
```

**After** (35 lines, clean):
```typescript
if (
  this.shouldBroadcastGeneralSettings(event) ||
  this.shouldBroadcastWordSearchSettings(event) ||
  this.shouldBroadcastWordFrequencySettings(event) ||
  this.shouldBroadcastContextPathSettings(event) ||
  this.shouldBroadcastPublishingSettings(event)
) {
  void this.configurationHandler.handleRequestSettingsData({
    type: MessageType.REQUEST_SETTINGS_DATA,
    source: 'extension.config_watcher',
    payload: {},
    timestamp: Date.now()
  });
}
```

**Reduction**: 52% smaller, infinitely more maintainable

### 4. Added Comprehensive Debug Logging
**Files**:
- [src/application/handlers/MessageHandler.ts](../../src/application/handlers/MessageHandler.ts) (lines 144-190)
- [src/application/handlers/domain/ConfigurationHandler.ts](../../src/application/handlers/domain/ConfigurationHandler.ts) (lines 90-130)

**Logging Added**:
```typescript
// ConfigWatcher
'[ConfigWatcher] Config change detected'
'[ConfigWatcher] Broadcasting SETTINGS_DATA (general:true, wordSearch:false, ...)'
'[ConfigWatcher] Config change detected but not broadcasting (likely echo prevention)'

// ConfigurationHandler
'[ConfigurationHandler] Marking proseMinion.temperature as webview-originated (will clear in 100ms)'
'[ConfigurationHandler] Cleared webview-originated flag for proseMinion.temperature'
'[ConfigurationHandler] Blocking broadcast for proseMinion.temperature (exact match in webview-originated set)'
```

**Purpose**: Diagnose settings sync issues (which revealed the critical bug!)

### 5. Fixed Critical Bug: Wrong Setting Names
**Commit**: `d73170e`

**Root Cause**: Constant arrays had completely wrong setting names

**Example Bug**:
```typescript
// ❌ BEFORE (BROKEN)
private readonly WORD_FREQUENCY_KEYS = [
  'proseMinion.wordFrequency.minLength',      // WRONG! Should be minCharacterLength
  'proseMinion.wordFrequency.includeLemmas'   // WRONG! Should be enableLemmas
] // Only 2 settings, missing 9 others!

// ✅ AFTER (FIXED)
private readonly WORD_FREQUENCY_KEYS = [
  'proseMinion.wordFrequency.topN',
  'proseMinion.wordFrequency.includeHapaxList',
  'proseMinion.wordFrequency.hapaxDisplayMax',
  'proseMinion.wordFrequency.includeStopwordsTable',
  'proseMinion.wordFrequency.contentWordsOnly',
  'proseMinion.wordFrequency.posEnabled',
  'proseMinion.wordFrequency.includeBigrams',
  'proseMinion.wordFrequency.includeTrigrams',
  'proseMinion.wordFrequency.enableLemmas',           // ✅ Correct!
  'proseMinion.wordFrequency.lengthHistogramMaxChars',
  'proseMinion.wordFrequency.minCharacterLength'      // ✅ Correct!
] // All 11 settings
```

**Impact**:
- User changes `minCharacterLength` in VSCSP
- Config watcher checks: `event.affectsConfiguration('proseMinion.wordFrequency.minLength')` → **false** (wrong name!)
- `shouldBroadcastWordFrequencySettings()` → false
- No SETTINGS_DATA sent to webview
- **Webview never updates** ❌

**All Fixed Settings**:
- GENERAL_SETTINGS_KEYS: 6 → 4 (removed non-existent settings)
- WORD_SEARCH_KEYS: 4 → 6 (added 2 missing: defaultTargets, enableAssistantExpansion)
- **WORD_FREQUENCY_KEYS: 2 → 11** (fixed names + added 9 missing)
- **CONTEXT_PATH_KEYS: 2 → 8** (replaced fake with real contextPaths.*)

### 6. Removed Deprecated Setting from package.json
**Commit**: `eecac18`

Removed `proseMinion.openRouterApiKey` from package.json:
- Fully deprecated and migrated to SecretStorage (Oct 27, 2025)
- Migration code still works (config.get() returns undefined gracefully)
- Cleaner settings UI

**Kept**: `proseMinion.model` (still actively used as fallback for scoped models)

---

## Architecture

### Follows Established Patterns

1. **Single Responsibility Principle**
   - Each constant array represents one settings domain
   - Each semantic method has one job: check if domain should broadcast

2. **Open/Closed Principle**
   - Adding new setting: Open constant array, add one line
   - Config watcher logic: Closed, no modification needed

3. **DRY (Don't Repeat Yourself)**
   - Settings keys defined once in constant arrays
   - Semantic methods eliminate copy-paste

### Data Flow (VSCSP → Webview)

```
User changes setting in VS Code Settings Pane
  ↓
Config watcher fires (line 143)
  ↓
shouldBroadcastWordFrequencySettings(event) (line 354)
  ↓
Check: WORD_FREQUENCY_KEYS.some(key => event.affectsConfiguration(key))
  ↓
✅ 'proseMinion.wordFrequency.minCharacterLength' found in array
  ↓
Check: configurationHandler.shouldBroadcastConfigChange(key)
  ↓
✅ Not in webview-originated set (user changed in VSCSP)
  ↓
Return true
  ↓
configurationHandler.handleRequestSettingsData() (line 181)
  ↓
SETTINGS_DATA message → webview
  ↓
Webview updates ✅
```

---

## Testing

### Build Status
✅ **Compiles successfully** - No TypeScript errors

```
webpack 5.102.1 compiled successfully in 27695 ms
```

### Manual Testing

**Test Case 1: VSCSP → Webview Sync** ✅
1. Open VS Code Settings Pane (Cmd+,)
2. Change `proseMinion.wordFrequency.minCharacterLength` to 5
3. Check Output Channel → See: `[ConfigWatcher] Broadcasting SETTINGS_DATA (wordFreq:true, ...)`
4. Return to webview → Setting updated ✅

**Test Case 2: Webview → VSCSP Sync** ✅
1. Change setting in Settings Overlay
2. Check Output Channel → See: `[ConfigurationHandler] Marking proseMinion.wordFrequency.minCharacterLength as webview-originated`
3. Config watcher detects change
4. Check Output Channel → See: `[ConfigWatcher] Config change detected but not broadcasting (likely echo prevention)`
5. No infinite loop ✅

**Test Case 3: Coverage Audit** ✅
Verified all 37 settings from package.json:
- ✅ 35 settings in constant arrays
- ✅ 2 intentionally excluded (model, openRouterApiKey)
- ✅ 100% functional coverage

---

## Files Changed

### Modified (3 files)
- ✅ `src/application/handlers/MessageHandler.ts` (+98 insertions, -58 deletions)
  - Added 7 constant arrays (35 settings)
  - Added 7 semantic methods
  - Refactored config watcher (73 → 35 lines)
  - Added debug logging

- ✅ `src/application/handlers/domain/ConfigurationHandler.ts` (+21 insertions, -7 deletions)
  - Added debug logging to echo prevention methods

- ✅ `package.json` (-8 deletions)
  - Removed deprecated `openRouterApiKey` setting

**Total**: +119 insertions, -73 deletions (net +46 lines for dramatically better maintainability)

---

## Success Metrics

**Before**:
- Adding new setting: 3+ manual updates (error-prone) ❌
- Code duplication: High ❌
- VSCSP → webview sync: **BROKEN** ❌
- Setting names: Wrong (2/11 word frequency settings) ❌
- Coverage: Unknown ❌

**After**:
- Adding new setting: 1 change (add to constant array) ✅
- Code duplication: None ✅
- VSCSP → webview sync: **WORKS** ✅
- Setting names: All correct (verified against package.json) ✅
- Coverage: 35/37 (100% functional) ✅

---

## Commits

1. **`449c783`** - feat(settings): extract settings keys to constants and create semantic methods
   - Initial implementation (had wrong names)

2. **`d4e2017`** - fix(settings): complete refactor by adding publishing standards to semantic methods
   - Completed pattern (added PUBLISHING_STANDARDS_KEYS)

3. **`883ef47`** - debug(settings): add comprehensive logging to config watcher and echo prevention
   - Added logging that revealed the bug

4. **`d73170e`** - fix(settings): correct all setting key names in constant arrays
   - 🚨 **CRITICAL BUG FIX** - Fixed all wrong setting names

5. **`eecac18`** - chore(settings): remove deprecated openRouterApiKey from package.json
   - Cleanup

---

## Sprint Progress

**Epic**: Unified Settings Architecture (5 sprints)
**Phase 1** (Backend Cleanup):
- ✅ Sprint 01: SearchTab Urgent Fix (merged)
- ✅ Sprint 02: Backend Semantic Methods (THIS PR)

**Next**: Sprint 03 - MetricsTab Migration (frontend domain hooks)

---

## References

- [ADR-2025-11-03: Unified Settings Architecture](../adr/2025-11-03-unified-settings-architecture.md)
- [Epic: Unified Settings Architecture](.todo/epics/epic-unified-settings-architecture-2025-11-03/)
- [Sprint 02 Doc](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/02-backend-semantic-methods.md)
- [Sprint 01 Doc](.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/01-searchtab-urgent-fix.md) (merged)

---

**Status**: ✅ Implementation Complete, Ready for Merge
**Commits**: 5 (449c783, d4e2017, 883ef47, d73170e, eecac18)
