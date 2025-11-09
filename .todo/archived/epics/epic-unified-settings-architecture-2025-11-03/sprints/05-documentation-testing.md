# Sprint 05: Documentation & Testing

**Epic**: Unified Settings Architecture
**Phase**: Phase 4
**Status**: Planned
**Priority**: MEDIUM
**Effort**: 3 days
**Timeline**: v1.1
**Owner**: Development Team
**Branch**: `sprint/unified-settings-05-documentation-testing`

---

## Sprint Goal

Document the unified Domain Hooks architecture and add automated tests to ensure settings sync reliability.

---

## Tasks

### Task 1: Update ARCHITECTURE.md (1 day)

**File**: `docs/ARCHITECTURE.md`

**Add** section: "Settings Management Architecture"

**Content**:
- Domain Hooks pattern explanation
- `useMessageRouter` strategy pattern
- `usePersistence` composition
- Echo prevention system
- Bidirectional sync flow diagrams
- Code examples for adding new settings

**Acceptance Criteria**:
- ✅ Clear explanation of hook pattern
- ✅ Step-by-step guide for adding settings
- ✅ Flow diagrams included
- ✅ Code examples provided

---

### Task 2: Create Migration Guide (1 day)

**File**: `docs/guides/ADDING_SETTINGS.md` (new)

**Content**:
- When to use settings hooks (`use[Domain]Settings`) vs. state hooks (`use[Domain]`) vs. SecretStorage
- Naming convention: All settings hooks end with "Settings" suffix
- Step-by-step checklist for adding settings
- Common pitfalls and how to avoid them
- Testing guidelines
- Examples from existing hooks

**Sections**:
1. Overview
2. Hook Naming Convention
3. Adding a Setting (Step-by-Step)
4. Creating a New Settings Hook
5. Testing Your Changes
6. Common Issues
7. Examples

**Acceptance Criteria**:
- ✅ New contributor can follow guide
- ✅ Covers all common scenarios
- ✅ Includes troubleshooting section

---

### Task 3: Hook Unit Tests (1 day)

**Directory**: `src/tests/hooks/`

**Test Files**:
- `useWordSearchSettings.test.ts`
- `useWordFrequencySettings.test.ts`
- `useContextPathsSettings.test.ts`
- `useModelsSettings.test.ts`
- `useTokensSettings.test.ts`
- `usePublishingSettings.test.ts`

**Test Coverage**:
```typescript
describe('useWordSearchSettings', () => {
  it('initializes with correct defaults', () => {
    // ...
  });

  it('updates state on SETTINGS_DATA message', () => {
    // ...
  });

  it('sends UPDATE_SETTING message when updateSetting called', () => {
    // ...
  });

  it('exposes persistedState for usePersistence', () => {
    // ...
  });

  it('handles missing settings gracefully', () => {
    // ...
  });
});
```

**Acceptance Criteria**:
- ✅ All hooks have unit tests
- ✅ Coverage > 80%
- ✅ All tests pass

---

### Task 4: Integration Tests (1 day)

**Directory**: `src/tests/integration/`

**Test Files**:
- `settings-sync.test.ts` - Bidirectional sync
- `settings-persistence.test.ts` - Webview state persistence
- `echo-prevention.test.ts` - Echo prevention system

**Test Coverage**:
```typescript
describe('Settings Sync', () => {
  it('syncs from VSCode config to webview', async () => {
    // Change VSCode setting
    // Verify webview state updates
  });

  it('syncs from webview to VSCode config', async () => {
    // Change in webview
    // Verify VSCode config updates
  });

  it('prevents echo loops', async () => {
    // Update from webview
    // Verify only one config change event
  });
});

describe('Settings Persistence', () => {
  it('persists all domain hook state', () => {
    // Verify usePersistence includes all hooks
  });

  it('restores state on webview reload', async () => {
    // Set state
    // Reload webview
    // Verify state restored
  });
});
```

**Acceptance Criteria**:
- ✅ Integration tests pass
- ✅ Coverage includes all critical paths
- ✅ Tests run in CI

---

### Task 5: Update Test Documentation (0.5 days)

**File**: `docs/TESTING.md` (new or update existing)

**Content**:
- How to run tests
- Writing tests for hooks
- Testing guidelines
- Mocking VSCode API

**Acceptance Criteria**:
- ✅ Clear instructions for running tests
- ✅ Examples of hook tests
- ✅ Coverage guidelines

---

### Task 6: Add Comments to Complex Code (0.5 days)

**Files**: Domain hooks and related code

**Add** JSDoc comments:
- Hook purpose and usage
- Parameter descriptions
- Return value documentation
- Example usage

**Example**:
```typescript
/**
 * Hook for managing word search settings.
 *
 * Provides bidirectional sync between webview and VSCode configuration,
 * and persists state across webview reloads.
 *
 * @param vscode - VSCode API instance
 * @returns Word search settings, update method, and persisted state
 *
 * @example
 * ```typescript
 * const wordSearchSettings = useWordSearchSettings(vscode);
 *
 * // Use in component
 * <input
 *   value={wordSearchSettings.settings.contextWords}
 *   onChange={(e) => wordSearchSettings.updateSetting('contextWords', e.target.value)}
 * />
 * ```
 */
export const useWordSearchSettings = (vscode: VSCodeAPI) => {
  // ...
};
```

**Acceptance Criteria**:
- ✅ All hooks have JSDoc comments
- ✅ Complex logic explained
- ✅ Usage examples included

---

## Definition of Done

- ✅ ARCHITECTURE.md updated with settings section
- ✅ Migration guide created
- ✅ All domain hooks have unit tests
- ✅ Integration tests pass
- ✅ Test documentation updated
- ✅ JSDoc comments added
- ✅ All tests pass
- ✅ Code reviewed
- ✅ PR merged

---

## Files Changed

### Created
- [ ] `docs/guides/ADDING_SETTINGS.md`
- [ ] `docs/TESTING.md` (or update existing)
- [ ] `src/tests/hooks/useWordSearchSettings.test.ts`
- [ ] `src/tests/hooks/useWordFrequencySettings.test.ts`
- [ ] `src/tests/hooks/useContextPathsSettings.test.ts`
- [ ] `src/tests/hooks/useModelsSettings.test.ts`
- [ ] `src/tests/hooks/useTokensSettings.test.ts`
- [ ] `src/tests/hooks/usePublishingSettings.test.ts`
- [ ] `src/tests/integration/settings-sync.test.ts`
- [ ] `src/tests/integration/settings-persistence.test.ts`
- [ ] `src/tests/integration/echo-prevention.test.ts`

### Modified
- [ ] `docs/ARCHITECTURE.md`
- [ ] All domain hook files (JSDoc comments - all settings hooks with "Settings" suffix)

---

## Success Metrics

**Documentation**:
- ✅ ARCHITECTURE.md has settings section
- ✅ New contributor can add setting in 15 min
- ✅ Migration guide is comprehensive

**Testing**:
- ✅ Hook unit test coverage > 80%
- ✅ Integration tests cover critical paths
- ✅ All tests pass in CI

**Code Quality**:
- ✅ All hooks have JSDoc comments
- ✅ Complex logic explained
- ✅ Examples provided

---

## Notes

### Testing Framework

Use existing VSCode extension testing framework:
- `@vscode/test-electron` for extension host tests
- Jest or Mocha for unit tests
- Mock VSCode API for hook tests

### CI Integration

Ensure tests run on:
- Pull request creation
- Merge to main
- Pre-release checks

---

**Sprint Status**: Planned
**Branch**: `sprint/unified-settings-05-documentation-testing`
