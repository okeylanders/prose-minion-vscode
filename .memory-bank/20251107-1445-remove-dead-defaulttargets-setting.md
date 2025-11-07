# Remove Dead Setting: defaultTargets

**Date**: 2025-11-07
**Time**: 14:45
**Type**: Code Cleanup (Dead Code Removal)

## Summary

Removed the unused `proseMinion.wordSearch.defaultTargets` setting. This setting was defined in package.json and synced through the settings system, but was never actually used by the SearchTab UI.

## Problem

The `defaultTargets` setting had the following issues:

1. **Not connected to UI**: SearchTab's targets textarea used `wordSearchTargets` from `useSearch` hook, never initialized from `defaultTargets`
2. **Backend fallback unused**: ProseAnalysisService had fallback logic (`defaults.defaultTargets`), but UI always provided explicit targets
3. **Dead code**: Setting existed in 7+ places but had zero functional impact
4. **User confusion**: Setting in UI did nothing when changed

## Changes Made

### Files Modified

1. **package.json**
   - Removed `proseMinion.wordSearch.defaultTargets` setting definition
   - Order numbers auto-adjusted (contextWords now order 30)

2. **useWordSearchSettings.ts** (`src/presentation/webview/hooks/domain/`)
   - Removed `defaultTargets` from `WordSearchSettings` interface
   - Removed from defaults object
   - Removed from `handleSettingsData` extraction logic

3. **SettingsOverlay.tsx** (`src/presentation/webview/components/`)
   - Removed "Default Targets" textarea control and label

4. **ProseAnalysisService.ts** (`src/infrastructure/api/`)
   - Removed `defaultTargets` from defaults object
   - Removed fallback logic: `targetsInput` now returns `[]` if no targets provided (was: `[defaults.defaultTargets]`)

5. **MessageHandler.ts** (`src/application/handlers/`)
   - Removed `'proseMinion.wordSearch.defaultTargets'` from `WORD_SEARCH_KEYS` array

6. **ConfigurationHandler.ts** (`src/application/handlers/domain/`)
   - Removed `'wordSearch.defaultTargets'` from SETTINGS_DATA payload

## Verification

✅ No remaining references to `defaultTargets` in:
- `src/` directory
- `package.json`

❌ References remain in (documentation only):
- `.memory-bank/` entries (historical records)
- `docs/` files (examples, will update if needed)

## Impact

- **User-facing**: None (setting never worked)
- **Settings UI**: "Default Targets" field removed from Word Search section
- **Behavior change**: Word search with empty targets now returns empty results instead of searching for "just" (aligned with UI expectations)
- **Code quality**: 6 files cleaned, ~20 lines removed

## Current Behavior (After Removal)

1. User opens SearchTab
2. Targets field starts **empty**
3. User types targets (persisted via `useSearch.wordSearchTargets`)
4. User clicks "Run Search"
5. Backend receives explicit targets or empty array

**Before**: Backend would fallback to `defaultTargets` setting if no targets provided (but UI always provided targets, so fallback never triggered)

**After**: Backend receives empty array if no targets (cleaner, matches UI behavior)

## Related Work

- Identified during review of SearchTab settings architecture
- Part of ongoing settings cleanup and unification

## Testing

- [ ] Test SearchTab with empty targets (should show "No results")
- [ ] Test SearchTab with manual targets (should work as before)
- [ ] Verify Settings overlay doesn't show Default Targets field
- [ ] Verify no TypeScript errors in extension build

## References

- User question: "How is defaultTarget being used in the Search component?"
- Answer: It wasn't! Dead code removed.
