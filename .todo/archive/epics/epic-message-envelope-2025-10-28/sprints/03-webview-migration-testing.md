# Sprint 3: Webview Migration + Testing

**Status**: ✅ Complete (Merged: PR #12, November 2025)
**Estimated Time**: 6-8 hours
**Branch**: Same as Sprint 1 & 2 (`sprint/epic-message-envelope-2025-10-28-01-handler-registration-types`)
**Commit Prefix**: `[sprint-3]`

## Goal

Update all webview code to use envelope pattern, migrate persistence to new format, test everything thoroughly, document the changes, and ship.

## Context

Sprint 2 fixed all extension-side code. This sprint completes the migration by:
1. Updating webview hooks to send messages with envelopes
2. Updating webview message handlers to use payload
3. Migrating persistence to drop old state format
4. Comprehensive manual testing
5. Documentation updates

## Task List

### Phase 1: Webview postMessage Updates (2 hours)

Work through hooks **one at a time**:

**1. useSettings hook** (20 min)
- Update ~10+ postMessage calls
- Source: `'webview.settings.overlay'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useSettings.ts`

**2. useAnalysis hook** (15 min)
- Update ~5+ postMessage calls
- Source: `'webview.analysis.tab'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useAnalysis.ts`

**3. useMetrics hook** (20 min)
- Update ~10+ postMessage calls
- Source: `'webview.metrics.tab'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useMetrics.ts`

**4. useSearch hook** (10 min)
- Update ~3+ postMessage calls
- Source: `'webview.search.tab'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useSearch.ts`

**5. useDictionary hook** (10 min)
- Update ~3+ postMessage calls
- Source: `'webview.dictionary.tab'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useDictionary.ts`

**6. useContext hook** (10 min)
- Update ~3+ postMessage calls
- Source: `'webview.context.assistant'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useContext.ts`

**7. useSelection hook** (15 min)
- Update ~5+ postMessage calls
- Source: `'webview.selection'`
- Add envelope: `source`, `payload: {}`, `timestamp`
- File: `src/presentation/webview/hooks/domain/useSelection.ts`

Example:
```typescript
// BEFORE
vscode.postMessage({
  type: MessageType.UPDATE_SETTING,
  key: 'ui.showTokenWidget',
  value: true
});

// AFTER
vscode.postMessage({
  type: MessageType.UPDATE_SETTING,
  source: 'webview.settings.overlay',
  payload: {
    key: 'ui.showTokenWidget',
    value: true
  },
  timestamp: Date.now()
});
```

### Phase 2: Webview Message Handler Updates (2 hours)

**8. Update all message handlers to use payload** (2 hours)
- Pattern: `message.field` → `message.payload.field`
- Update handler functions in `useMessageRouter` registrations
- Work hook by hook
- Estimated ~40+ handler functions across 7 hooks
- Files: All domain hooks (7 files)

Example:
```typescript
// BEFORE
[MessageType.MODEL_DATA]: (msg) => {
  setModelOptions(msg.modelOptions);
  setModelSelections(msg.modelSelections);
}

// AFTER
[MessageType.MODEL_DATA]: (msg) => {
  setModelOptions(msg.payload.modelOptions);
  setModelSelections(msg.payload.modelSelections);
}
```

### Phase 3: Persistence Migration (1 hour)

**9. Update usePersistence to drop old state** (30 min)
- Add version check in `loadPersistedState`:
  ```typescript
  const state = vscode.getState();
  if (state && !state.version) {
    console.log('[Persistence] Dropping old state format after message envelope refactor');
    return undefined;
  }
  return state;
  ```
- File: `src/presentation/webview/hooks/usePersistence.ts`

**10. Add version to persisted state** (30 min)
- Include `version: 1` in persisted state object
- Update state composition in App.tsx if needed
- File: `src/presentation/webview/hooks/usePersistence.ts`, `App.tsx`

### Phase 4: Build Verification (30 min)

**11. Run full build** (30 min)
- Run: `npm run build`
- Verify both extension and webview compile
- Fix any remaining TypeScript errors
- Verify bundle sizes (~380 KiB webview is normal)

### Phase 5: Manual Testing (2-3 hours)

**12. Settings Echo Prevention Testing** (30 min)
Critical test to verify echo prevention works:
- [ ] Open Extension Development Host (F5)
- [ ] Open Prose Minion webview
- [ ] Open Settings overlay (gear icon)
- [ ] Change model selection in dropdown
- [ ] **Verify**: No flicker, value sticks immediately
- [ ] **Verify**: OutputChannel shows "Skipping echo to webview.settings.overlay"
- [ ] Close settings overlay
- [ ] Open VSCode settings.json
- [ ] Change `proseMinion.assistantModel` directly
- [ ] **Verify**: Webview updates from external change
- [ ] Toggle token widget in settings
- [ ] **Verify**: Widget appears/disappears immediately, no flicker
- [ ] **Verify**: No echo logged (UI settings don't need echo prevention)

**13. Analysis Tab Testing** (20 min)
- [ ] Select text in editor
- [ ] Run dialogue analysis
- [ ] **Verify**: Loading spinner appears
- [ ] **Verify**: Result displays when complete
- [ ] **Verify**: Guide info shows if guides used
- [ ] Run prose analysis
- [ ] **Verify**: Works correctly
- [ ] Test context assistant
- [ ] **Verify**: Context generates correctly
- [ ] Test guide selection toggle
- [ ] **Verify**: Updates persist

**14. Metrics Tab Testing** (30 min)
- [ ] Click Metrics tab
- [ ] Run Prose Stats on selection
- [ ] **Verify**: Loading spinner, result displays
- [ ] Switch to Style Flags
- [ ] Run Style Flags
- [ ] **Verify**: Result displays, cached subtool works
- [ ] Switch to Word Frequency
- [ ] Run Word Frequency
- [ ] **Verify**: Result displays
- [ ] Test scope selection buttons:
  - [ ] Active File → **Verify**: Path populates
  - [ ] Manuscripts → **Verify**: Globs populate
  - [ ] Chapters → **Verify**: Globs populate
  - [ ] Selection → **Verify**: Uses selected text
- [ ] Test Copy button on each subtool
- [ ] Test Save button on each subtool
- [ ] **Verify**: Saved files open in editor

**15. Utilities Tab Testing** (15 min)
- [ ] Click Utilities tab
- [ ] Enter word in dictionary input
- [ ] Run lookup
- [ ] **Verify**: Result displays
- [ ] Clear word, refresh page
- [ ] **Verify**: Word persists (new state format)
- [ ] Test paste selection button
- [ ] **Verify**: Populates from selection

**16. Search Tab Testing** (15 min)
- [ ] Click Search tab
- [ ] Select text in editor
- [ ] Run word search
- [ ] **Verify**: Loading spinner appears
- [ ] **Verify**: Results display when complete
- [ ] **Verify**: Loading spinner disappears
- [ ] **Verify**: Old results clear on new search
- [ ] Test target selection (exact, lemma, etc.)
- [ ] **Verify**: Target persists

**17. Persistence Testing** (20 min)
- [ ] Make changes in each tab:
  - Analysis: Run analysis
  - Metrics: Run subtool
  - Dictionary: Enter word
  - Search: Run search
- [ ] Refresh webview (Cmd+R / Ctrl+R)
- [ ] **Verify**: State DOES NOT persist (old format dropped)
- [ ] **Verify**: Console shows "Dropping old state format"
- [ ] Make new changes in each tab
- [ ] Refresh webview again
- [ ] **Verify**: State DOES persist (new format works)

**18. Integration Testing** (30 min)
- [ ] Test all tabs in sequence
- [ ] Test settings overlay open/close multiple times
- [ ] Test token widget toggle on/off
- [ ] Test Copy operations in multiple tabs
- [ ] Test Save operations in multiple tabs
- [ ] **Verify**: Saved files open in editor
- [ ] **Verify**: Copy operations work
- [ ] **Verify**: No console errors
- [ ] **Verify**: No console warnings
- [ ] Check OutputChannel (Prose Minion)
- [ ] **Verify**: Sources appear in logs
- [ ] **Verify**: "Skipping echo" appears for settings changes
- [ ] **Verify**: No error messages

### Phase 6: Documentation (1 hour)

**19. Update ARCHITECTURE.md** (30 min)
- Add MessageRouter pattern section
- Document MessageEnvelope structure
- Document source naming conventions
- Add example message flow
- File: `docs/ARCHITECTURE.md`

**20. Create memory bank entry** (20 min)
- Summarize epic outcomes
- Link to ADR and epic
- Document metrics:
  - MessageHandler line count reduction
  - Settings echo bugs eliminated
  - Message types migrated
- List breaking changes
- Note state format change
- File: `.memory-bank/20251028-HHMM-message-envelope-refactor.md`

**21. Update planning document** (10 min)
- Mark status as IMPLEMENTED
- Add link to memory bank entry
- Add link to merged branch
- Add completion date
- File: `.planning/architecture-refactor-message-routing-and-config-events.md`

## Files Modified

**Presentation Layer**:
- `src/presentation/webview/hooks/domain/useSettings.ts`
- `src/presentation/webview/hooks/domain/useAnalysis.ts`
- `src/presentation/webview/hooks/domain/useMetrics.ts`
- `src/presentation/webview/hooks/domain/useSearch.ts`
- `src/presentation/webview/hooks/domain/useDictionary.ts`
- `src/presentation/webview/hooks/domain/useContext.ts`
- `src/presentation/webview/hooks/domain/useSelection.ts`
- `src/presentation/webview/hooks/usePersistence.ts`

**Documentation**:
- `docs/ARCHITECTURE.md`
- `.memory-bank/20251028-HHMM-message-envelope-refactor.md`
- `.planning/architecture-refactor-message-routing-and-config-events.md`

**Total**: 8 code files + 3 docs

## Acceptance Criteria

**Code**:
- ✅ All webview postMessage calls use envelope with source
- ✅ All webview message handlers use payload pattern
- ✅ Persistence drops old state format
- ✅ Persistence saves new state format with version
- ✅ Full build succeeds (extension + webview)

**Settings Echo Prevention**:
- ✅ Model selection works without flicker
- ✅ OutputChannel logs "Skipping echo"
- ✅ External config changes still propagate
- ✅ UI settings update immediately

**Functionality**:
- ✅ All tabs tested and working
- ✅ Analysis tab works (dialogue, prose, context, guides)
- ✅ Metrics tab works (all 3 subtools, scope selection)
- ✅ Utilities tab works (dictionary, paste)
- ✅ Search tab works (word search, targets)
- ✅ Copy operations work
- ✅ Save operations work, files open
- ✅ Token widget works

**Quality**:
- ✅ No console errors
- ✅ No console warnings
- ✅ OutputChannel logs show sources
- ✅ Persistence works with new format
- ✅ Old state dropped cleanly

**Documentation**:
- ✅ ARCHITECTURE.md updated
- ✅ Memory bank entry created
- ✅ Planning doc marked complete

## Comprehensive Testing Checklist

**Settings Echo Prevention** (CRITICAL):
- [ ] Model selection no echo/flicker
- [ ] External config changes propagate
- [ ] UI toggles work immediately
- [ ] OutputChannel logs "Skipping echo"

**Analysis Tab**:
- [ ] Dialogue analysis works
- [ ] Prose analysis works
- [ ] Context assistant works
- [ ] Guide selection works
- [ ] Loading states correct

**Metrics Tab**:
- [ ] Prose Stats works
- [ ] Style Flags works
- [ ] Word Frequency works
- [ ] Scope selection works (4 modes)
- [ ] Subtool switching works
- [ ] Results cache correctly
- [ ] Loading states correct

**Utilities Tab**:
- [ ] Dictionary lookup works
- [ ] Word input persists
- [ ] Context input persists
- [ ] Paste selection works
- [ ] Loading states correct

**Search Tab**:
- [ ] Word search works
- [ ] Results display correctly
- [ ] Loading widget appears/disappears
- [ ] Old results clear on new search
- [ ] Target selection works

**File Operations**:
- [ ] Copy buttons work (all tabs)
- [ ] Save buttons work (all tabs)
- [ ] Saved files open in editor
- [ ] Metrics subtools have unique filenames
- [ ] Timestamps include seconds

**Persistence**:
- [ ] Old state dropped on first load
- [ ] Console logs state drop
- [ ] New state persists correctly
- [ ] Refresh preserves state

**Token Widget**:
- [ ] Toggle works
- [ ] Widget shows/hides
- [ ] Reset button works
- [ ] Token counts update

**Quality Checks**:
- [ ] No console errors
- [ ] No console warnings
- [ ] OutputChannel logs correct
- [ ] Sources in all logs
- [ ] No flicker anywhere
- [ ] No loading state crossover

## Common Patterns

**postMessage Template**:
```typescript
vscode.postMessage({
  type: MessageType.X,
  source: 'webview.domain.component',
  payload: {
    field1: value1,
    field2: value2
  },
  timestamp: Date.now()
});
```

**Message Handler Template**:
```typescript
[MessageType.X]: (msg) => {
  const { field1, field2 } = msg.payload;
  setState1(field1);
  setState2(field2);
}
```

## Risks/Notes

- **Persistence state will be lost** - Users re-select models, takes 30 seconds (acceptable in alpha)
- **Must test settings echo thoroughly** - This was the primary bug we're fixing
- **Must test all tabs** - Ensure no regressions from refactor
- **OutputChannel logging** - Critical for verifying echo prevention works
- **Console must be clean** - No errors or warnings acceptable

## Post-Sprint Actions

After Sprint 3 completion:
1. Commit all changes with `[sprint-3]` prefix
2. Merge branch back into `sprint/epic-presentation-refactor-2025-10-27-01-domain-hooks`
3. Test integrated refactors together
4. Merge presentation-refactor branch into main when ready

## Links

- Epic: [epic-message-envelope.md](../epic-message-envelope.md)
- Sprint 1: [01-handler-registration-types.md](01-handler-registration-types.md)
- Sprint 2: [02-extension-migration.md](02-extension-migration.md)
- ADR: [docs/adr/2025-10-28-message-envelope-architecture.md](../../../../docs/adr/2025-10-28-message-envelope-architecture.md)
- Planning Doc: [.planning/architecture-refactor-message-routing-and-config-events.md](../../../../.planning/architecture-refactor-message-routing-and-config-events.md)
