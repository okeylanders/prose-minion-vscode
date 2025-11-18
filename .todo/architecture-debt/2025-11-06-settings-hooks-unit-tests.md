# Settings Hooks Unit Tests

**Date Identified**: 2025-11-06
**Identified During**: Sprint 05 - Documentation & Testing
**Priority**: High
**Estimated Effort**: 1 day (8 hours)

---

## Problem

The 6 settings hooks have no automated unit tests. While manual testing checklists exist and have been used successfully, automated tests would catch regressions and improve maintainability.

**Hooks Needing Tests** (6 total):
1. `useModelsSettings` (8 settings)
2. `useWordSearchSettings` (6 settings)
3. `useWordFrequencySettings` (11 settings)
4. `useContextPathsSettings` (8 settings)
5. `useTokensSettings` (1 setting)
6. `usePublishingSettings` (2 settings)

**Current Testing**: Manual only (checklists in sprint docs and adding-settings guide)

---

## Current Implementation

No automated tests exist for hooks. Testing is done manually via:
- Settings Overlay interaction
- VSCode settings panel changes
- Webview reload persistence checks
- Output Channel echo prevention verification

**Manual Test Checklist** (from `docs/guides/ADDING_SETTINGS.md`):
1. ✅ SettingsOverlay → Component updates
2. ✅ VSCode Settings Panel → Component updates
3. ✅ Persistence across reload
4. ✅ Echo prevention (no infinite loops)
5. ✅ TypeScript compilation
6. ✅ Build success

---

## Recommendation

Add comprehensive unit tests for all 6 settings hooks following the test patterns documented in `docs/TESTING.md`.

### Test Coverage Requirements

**For Each Hook** (minimum 6 test cases):

1. **Initialization**
   ```typescript
   it('should initialize with correct defaults', () => {
     const { result } = renderHook(() => useWordSearchSettings(mockVSCode));
     expect(result.current.settings).toEqual({
       // ... all defaults matching package.json
     });
   });
   ```

2. **Persistence State**
   ```typescript
   it('should expose persistedState for usePersistence', () => {
     const { result } = renderHook(() => useWordSearchSettings(mockVSCode));
     expect(result.current.persistedState).toHaveProperty('wordSearchSettings');
   });
   ```

3. **Update Setting**
   ```typescript
   it('should send UPDATE_SETTING message when updateSetting called', () => {
     const { result } = renderHook(() => useWordSearchSettings(mockVSCode));
     act(() => {
       result.current.updateSetting('contextWords', 10);
     });
     expect(mockVSCode.postMessage).toHaveBeenCalledWith({
       type: MessageType.UPDATE_SETTING,
       payload: { key: 'wordSearch.contextWords', value: 10 }
     });
   });
   ```

4. **Handle Settings Message**
   ```typescript
   it('should update state on SETTINGS_DATA message', () => {
     const { result } = renderHook(() => useWordSearchSettings(mockVSCode));
     const message = {
       type: MessageType.SETTINGS_DATA,
       payload: { wordSearch: { contextWords: 10 } }
     };
     act(() => {
       result.current.handleSettingsMessage(message);
     });
     expect(result.current.settings.contextWords).toBe(10);
   });
   ```

5. **Defaults Fallback**
   ```typescript
   it('should use defaults for missing settings in message', () => {
     // Verify nullish coalescing works correctly
   });
   ```

6. **Message Filtering**
   ```typescript
   it('should ignore non-SETTINGS_DATA messages', () => {
     // Verify hook doesn't update on wrong message type
   });
   ```

### Test Files to Create

```
src/tests/hooks/
├── useModelsSettings.test.ts
├── useWordSearchSettings.test.ts
├── useWordFrequencySettings.test.ts
├── useContextPathsSettings.test.ts
├── useTokensSettings.test.ts
└── usePublishingSettings.test.ts
```

### Mock Setup

```typescript
// src/tests/mocks/vscode.ts
export const createMockVSCode = () => ({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
});
```

### Testing Framework

- **@testing-library/react-hooks** - Hook testing
- **Jest** - Test runner and assertions
- **@vscode/test-electron** - VSCode extension testing framework (for integration tests)

---

## Impact

**Benefits of Fixing**:
- ✅ Catch regressions automatically (no manual testing needed)
- ✅ Faster development (immediate feedback on changes)
- ✅ Confidence in refactoring (tests verify behavior preserved)
- ✅ Documentation via tests (examples of correct usage)
- ✅ CI/CD integration (prevent broken builds)

**Risks of Not Fixing**:
- ⚠️ Regressions not caught until user testing
- ⚠️ Manual testing required for every change (slow)
- ⚠️ Fear of refactoring (might break something)
- ⚠️ No automated verification of echo prevention, persistence, etc.

**Coverage Targets**:
- Settings hooks: > 80% code coverage
- Infrastructure hooks: > 90% code coverage
- Overall: > 70% code coverage

---

## References

- **Test Documentation**: [docs/TESTING.md](../../docs/TESTING.md) - Complete test patterns and examples
- **Test Examples**: See test documentation for full hook test template
- **Sprint**: [Sprint 05 - Documentation & Testing](../epics/epic-unified-settings-architecture-2025-11-03/sprints/05-documentation-testing.md)
- **ADR**: [2025-11-03: Unified Settings Architecture](../../docs/adr/2025-11-03-unified-settings-architecture.md)

---

---

## Resolution

**Status**: ✅ **RESOLVED**
**Resolution Date**: 2025-11-15
**Resolved By**: [Technical Debt Cleanup Epic - Sprint 02](.todo/epics/epic-technical-debt-cleanup-2025-11-15/sprints/02-settings-hooks-unit-tests.md)
**Commit**: f0c08ac

### What Was Done

✅ **All 6 Settings Hooks Tested**:
- Created comprehensive unit tests for all hooks
- 74 total test cases (12-14 per hook, exceeding minimum 36)
- **91.72% line coverage** (exceeded >80% target)
- 207/207 tests passing (133 existing + 74 new)

✅ **Test Files Created**:
- `src/__tests__/presentation/webview/hooks/domain/useWordSearchSettings.test.ts` (12 tests - template)
- `src/__tests__/presentation/webview/hooks/domain/useTokensSettings.test.ts` (13 tests)
- `src/__tests__/presentation/webview/hooks/domain/usePublishingSettings.test.ts` (14 tests)
- `src/__tests__/presentation/webview/hooks/domain/useModelsSettings.test.ts` (12 tests)
- `src/__tests__/presentation/webview/hooks/domain/useWordFrequencySettings.test.ts` (12 tests)
- `src/__tests__/presentation/webview/hooks/domain/useContextPathsSettings.test.ts` (12 tests)

✅ **Mock Infrastructure**:
- Created `src/__tests__/mocks/vscode.ts` with reusable mock utilities

✅ **Test Categories** (each hook tested for):
1. Initialization - Defaults from package.json, persisted state loading
2. Persistence State - Exposes persistedState, updates on changes
3. Update Setting - Message sending, optimistic updates
4. Handle Settings Data - Update from message, defaults fallback
5. Stability - useCallback references stable across re-renders

### Outcome

✅ Regression detection automated (no manual testing needed)
✅ 91.72% coverage achieved (exceeded 80% target)
✅ Testing foundation established for future hooks
✅ CI-ready (tests run via `npm test`)

### Actual Time

- **Estimated**: 8 hours
- **Actual**: ~4 hours (50% faster due to template approach)
