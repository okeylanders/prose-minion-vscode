# Todo: Command Palette Dictionary Auto-Lookup

**Priority**: Medium
**Type**: Enhancement
**Created**: 2025-11-20
**Status**: ✅ COMPLETE
**Completed**: 2025-11-29 (part of UX Polish epic)
**Area**: Dictionary / Commands

## Issue

The Command Palette action **"Prose Minion: Lookup Word"** currently only populates the dictionary input field with the selected word but does **not** trigger the dictionary lookup automatically.

**Current Behavior** (before fix):
1. User selects text in editor
2. User runs "Prose Minion: Lookup Word" from Command Palette
3. Dictionary tab opens
4. Selected word appears in input field
5. ❌ User must manually click "Look Up" button

**Expected Behavior** (now implemented):
1. User selects text in editor
2. User runs "Prose Minion: Lookup Word" from Command Palette
3. Dictionary tab opens
4. Selected word appears in input field
5. ✅ Dictionary lookup **automatically executes**

## Acceptance Criteria

- [x] Running "Prose Minion: Lookup Word" from Command Palette triggers automatic lookup
- [x] Dictionary results display immediately (no additional button click needed)
- [x] Loading state shows while lookup is in progress
- [x] Behavior matches user expectation (command name implies lookup, not just populate)

## Implementation Summary

**Approach Used**: Added `autoRun` flag to selection payload (suggested approach #1)

**Files Modified**:
- `src/extension.ts` - `handleWordLookupSelection` passes `autoRun: true` + shows toast notification
- `src/application/providers/ProseToolsViewProvider.ts` - Passes `autoRun` to webview
- `src/presentation/webview/hooks/domain/useSelection.ts` - Includes `autoRun` in dictionary injection
- `src/presentation/webview/components/tabs/UtilitiesTab.tsx` - `autoRunLookupWhenInjected()` triggers `FAST_GENERATE_DICTIONARY`
- `src/shared/types/messages/ui.ts` - Added `autoRun?: boolean` to payload type

**Key Implementation Points**:
- Toast notification: `"Running dictionary lookup for word/phrase "${word}"..."`
- Uses fast dictionary generation (parallel fan-out) for speed
- Proper cleanup of injection state after triggering

## Related

- Command: `prose-minion.wordLookupSelection` ([package.json](../package.json))
- Epic: `epic-ux-polish-2025-11-24` (Sprint 03: Dictionary UX Improvements)

## Estimated Effort

~1 hour (simple enhancement, clear scope) - Actual: Completed as part of larger UX polish work

## User Impact

**High** - This is a common workflow expectation. Users expect "Lookup Word" to actually look up the word, not just prepare the input.
