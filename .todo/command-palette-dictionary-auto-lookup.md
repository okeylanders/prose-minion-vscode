# Todo: Command Palette Dictionary Auto-Lookup

**Priority**: Medium
**Type**: Enhancement
**Created**: 2025-11-20
**Area**: Dictionary / Commands

## Issue

The Command Palette action **"Prose Minion: Lookup Word"** currently only populates the dictionary input field with the selected word but does **not** trigger the dictionary lookup automatically.

**Current Behavior**:
1. User selects text in editor
2. User runs "Prose Minion: Lookup Word" from Command Palette
3. Dictionary tab opens
4. Selected word appears in input field
5. ❌ User must manually click "Look Up" button

**Expected Behavior**:
1. User selects text in editor
2. User runs "Prose Minion: Lookup Word" from Command Palette
3. Dictionary tab opens
4. Selected word appears in input field
5. ✅ Dictionary lookup **automatically executes**

## Acceptance Criteria

- [ ] Running "Prose Minion: Lookup Word" from Command Palette triggers automatic lookup
- [ ] Dictionary results display immediately (no additional button click needed)
- [ ] Loading state shows while lookup is in progress
- [ ] Behavior matches user expectation (command name implies lookup, not just populate)

## Implementation Notes

**Files to Modify**:
- `src/extension.ts` - Command registration for `proseMinion.lookupWord`
- `src/application/handlers/domain/UIHandler.ts` - Message handling for dictionary auto-trigger
- `src/presentation/webview/hooks/domain/useDictionary.ts` - Auto-trigger logic when word is injected
- `src/shared/types/messages/ui.ts` - Add flag to indicate auto-trigger vs manual input

**Suggested Approach**:
1. Add `autoTrigger?: boolean` flag to `InjectDictionaryInputMessage`
2. When `autoTrigger: true`, `useDictionary` hook automatically calls lookup after setting word
3. Update `proseMinion.lookupWord` command to send `autoTrigger: true`

**Alternative Approach** (simpler):
- Add new message type: `DICTIONARY_LOOKUP_AND_RUN` (combines inject + run)
- Command sends this message instead of just `INJECT_DICTIONARY_INPUT`
- UIHandler routes to DictionaryHandler which injects word AND runs lookup

## Related

- Command: `proseMinion.lookupWord` ([package.json](../package.json))
- UIHandler: [UIHandler.ts](../src/application/handlers/domain/UIHandler.ts)
- Dictionary Hook: [useDictionary.ts](../src/presentation/webview/hooks/domain/useDictionary.ts)

## Estimated Effort

~1 hour (simple enhancement, clear scope)

## User Impact

**High** - This is a common workflow expectation. Users expect "Lookup Word" to actually look up the word, not just prepare the input.
