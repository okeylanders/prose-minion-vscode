# Sprint 02: Settings Hooks Unit Tests

**Epic**: Technical Debt Cleanup
**Created**: 2025-11-15
**Status**: ⏳ Pending
**Priority**: High
**Estimated Duration**: 1 day (8 hours)
**Branch**: TBD (will branch from epic branch after Sprint 01)

---

## Context

The 6 settings hooks currently have no automated unit tests. While manual testing checklists exist and have been used successfully, automated tests would catch regressions and improve maintainability.

**Hooks Needing Tests** (6 total):
1. `useModelsSettings` (8 settings)
2. `useWordSearchSettings` (6 settings)
3. `useWordFrequencySettings` (11 settings)
4. `useContextPathsSettings` (8 settings)
5. `useTokensSettings` (1 setting)
6. `usePublishingSettings` (2 settings)

**Current Testing**: Manual only (checklists in sprint docs and adding-settings guide)

**Reference**: [Architecture Debt Item](.todo/architecture-debt/2025-11-06-settings-hooks-unit-tests.md)

---

## Goals

1. Create comprehensive unit tests for all 6 settings hooks
2. Achieve >80% code coverage for settings hooks
3. Establish testing patterns for future hooks
4. Catch regressions automatically (no manual testing needed)

---

## Tasks

### Phase 1: Test Infrastructure Setup (1 hour)

- [ ] Create `src/tests/hooks/` directory
- [ ] Create mock utilities:
  - [ ] `src/tests/mocks/vscode.ts` - Mock VSCode API
  - [ ] `src/tests/mocks/postMessage.ts` - Mock message posting
- [ ] Set up @testing-library/react-hooks (if not already installed)
- [ ] Create test helper utilities for common assertions

### Phase 2: First Hook Test Template (2 hours)

- [ ] Choose `useWordSearchSettings` as template (has comprehensive JSDoc)
- [ ] Create `src/tests/hooks/useWordSearchSettings.test.ts`
- [ ] Write 6 required test cases:
  1. **Initialization**: Correct defaults from package.json
  2. **Persistence State**: Exposes persistedState for usePersistence
  3. **Update Setting**: Sends UPDATE_SETTING message when updateSetting called
  4. **Handle Settings Message**: Updates state on SETTINGS_DATA message
  5. **Defaults Fallback**: Uses defaults for missing settings in message
  6. **Message Filtering**: Ignores non-SETTINGS_DATA messages
- [ ] Run tests - ensure all pass
- [ ] Document test pattern in comments for template copying

### Phase 3: Remaining 5 Hooks (5 hours)

- [ ] Copy test template to remaining 5 hooks:
  - [ ] `useModelsSettings.test.ts` (8 settings, 6 test cases)
  - [ ] `useWordFrequencySettings.test.ts` (11 settings, 6 test cases)
  - [ ] `useContextPathsSettings.test.ts` (8 settings, 6 test cases)
  - [ ] `useTokensSettings.test.ts` (1 setting, 6 test cases)
  - [ ] `usePublishingSettings.test.ts` (2 settings + genres array, 6 test cases + 1 extra for REQUEST_PUBLISHING_STANDARDS_DATA)
- [ ] Adapt each test to hook-specific settings
- [ ] Verify all defaults match package.json
- [ ] Run full test suite - ensure all pass

### Phase 4: Coverage Analysis (30 min)

- [ ] Run coverage: `npm run test:coverage`
- [ ] Verify settings hooks coverage >80%
- [ ] Identify any uncovered branches
- [ ] Add tests for uncovered edge cases (if needed)

### Phase 5: CI Integration (30 min)

- [ ] Verify tests run in CI pipeline
- [ ] Ensure coverage reports generated
- [ ] Update epic with final coverage numbers
- [ ] Document testing patterns in docs/TESTING.md (if needed)

### Phase 6: Commit and Document (30 min)

- [ ] Stage changes
- [ ] Commit with message:
  ```
  [Sprint-02] Add comprehensive unit tests for settings hooks

  Add automated tests for all 6 settings hooks

  - Create test infrastructure (mocks, utilities)
  - Add useWordSearchSettings.test.ts (template)
  - Add tests for remaining 5 hooks
  - Achieve >80% coverage for settings hooks
  - Document testing patterns

  Tests cover:
  - Initialization with correct defaults
  - Persistence state exposure
  - Update setting message sending
  - Settings data message handling
  - Defaults fallback for missing settings
  - Message filtering (ignore non-SETTINGS_DATA)

  Total: 36+ test cases (6 per hook minimum)

  Refs: .todo/architecture-debt/2025-11-06-settings-hooks-unit-tests.md
  ```
- [ ] Update sprint status to COMPLETE
- [ ] Update epic with outcomes

---

## Acceptance Criteria

- ✅ All 6 settings hooks have comprehensive unit tests
- ✅ Minimum 6 test cases per hook (36+ total)
- ✅ Settings hooks coverage >80%
- ✅ All tests pass in CI pipeline
- ✅ Test pattern documented for future hooks
- ✅ Mock utilities created and reusable

---

## Test Coverage Requirements

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
     const { result } = renderHook(() => useWordSearchSettings(mockVSCode));
     const message = {
       type: MessageType.SETTINGS_DATA,
       payload: { wordSearch: { contextWords: 10 } } // other settings missing
     };
     act(() => {
       result.current.handleSettingsMessage(message);
     });
     expect(result.current.settings.contextWords).toBe(10);
     expect(result.current.settings.minClusterSize).toBe(2); // default
   });
   ```

6. **Message Filtering**
   ```typescript
   it('should ignore non-SETTINGS_DATA messages', () => {
     const { result } = renderHook(() => useWordSearchSettings(mockVSCode));
     const initialSettings = result.current.settings;
     const message = {
       type: MessageType.ANALYSIS_RESULT,
       payload: {}
     };
     act(() => {
       result.current.handleSettingsMessage(message);
     });
     expect(result.current.settings).toEqual(initialSettings); // unchanged
   });
   ```

---

## Files Created

**Test Files**:
- `src/tests/hooks/useModelsSettings.test.ts`
- `src/tests/hooks/useWordSearchSettings.test.ts`
- `src/tests/hooks/useWordFrequencySettings.test.ts`
- `src/tests/hooks/useContextPathsSettings.test.ts`
- `src/tests/hooks/useTokensSettings.test.ts`
- `src/tests/hooks/usePublishingSettings.test.ts`

**Mock Utilities**:
- `src/tests/mocks/vscode.ts` (if not exists)
- `src/tests/mocks/postMessage.ts` (if needed)

---

## Mock Setup

```typescript
// src/tests/mocks/vscode.ts
export const createMockVSCode = () => ({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
});
```

---

## Benefits

- ✅ Catch regressions automatically (no manual testing needed)
- ✅ Faster development (immediate feedback on changes)
- ✅ Confidence in refactoring (tests verify behavior preserved)
- ✅ Documentation via tests (examples of correct usage)
- ✅ CI/CD integration (prevent broken builds)
- ✅ Foundation for future testing (template for new hooks)

---

## Notes

**Why This Sprint Second?**
- High priority (catches regressions automatically)
- Foundation for future testing
- Will validate useEffect extractions in Sprint 03

**Testing Framework**:
- @testing-library/react-hooks - Hook testing
- Jest - Test runner and assertions
- Existing infrastructure from Infrastructure Testing Epic

**Coverage Targets**:
- Settings hooks: >80% code coverage
- Infrastructure hooks: >90% (already achieved in Infrastructure Testing Epic)
- Overall: >50% (up from 43.1%)

---

**Status**: ⏳ Pending
**Dependencies**: Sprint 01 complete
**Next**: Begin after Sprint 01 merged
