# Settings Integration Tests

**Date Identified**: 2025-11-06
**Identified During**: Sprint 05 - Documentation & Testing
**Priority**: High
**Estimated Effort**: 4 hours

---

## Problem

While unit tests verify individual hook behavior, integration tests are needed to verify end-to-end flows:
- Bidirectional sync (VSCode config ↔ hook state ↔ components)
- Persistence (webview state across reloads)
- Echo prevention (no infinite update loops)
- Message routing (correct handlers invoked)

**Current State**: No automated integration tests. Manual testing only.

---

## Current Implementation

Integration testing is done manually:
1. Change setting in SettingsOverlay → verify component updates
2. Change setting in VSCode panel → verify SettingsOverlay updates
3. Reload webview → verify settings persist
4. Watch Output Channel → verify no echo loops

**Manual Process**: Works but slow, not automated, requires human observation

---

## Recommendation

Add automated integration tests for critical settings flows.

### Test Suite 1: Settings Sync Integration

**File**: `src/tests/integration/settings-sync.test.ts`

**Test Cases**:

1. **VSCode Config → Webview**
   ```typescript
   it('should sync VSCode config changes to hook state', async () => {
     // Simulate backend detecting config change
     // Send SETTINGS_DATA message to hook
     // Verify hook state updates
   });
   ```

2. **Webview → VSCode Config**
   ```typescript
   it('should send UPDATE_SETTING when webview changes setting', () => {
     // Call hook.updateSetting()
     // Verify UPDATE_SETTING message posted
     // Verify message contains correct key and value
   });
   ```

3. **Echo Prevention**
   ```typescript
   it('should not create infinite loop when updating from webview', () => {
     // Update from webview
     // Backend should track as webview-originated
     // Next config change should NOT broadcast back
     // Verify postMessage called exactly once
   });
   ```

4. **Bidirectional Sync Chain**
   ```typescript
   it('should sync changes through full chain', async () => {
     // SettingsOverlay → updateSetting()
     // → UPDATE_SETTING message
     // → Backend updates VSCode config
     // → Config watcher broadcasts SETTINGS_DATA
     // → Hook updates state
     // → Component re-renders
     // Verify entire flow works
   });
   ```

---

### Test Suite 2: Persistence Integration

**File**: `src/tests/integration/settings-persistence.test.ts`

**Test Cases**:

1. **Compose All Persistence**
   ```typescript
   it('should persist all domain hook state via usePersistence', () => {
     // Render App.tsx (or equivalent composition)
     // Verify vscode.setState called with correct shape
     // Verify all 13 hooks included in persisted state
   });
   ```

2. **Restore State on Reload**
   ```typescript
   it('should restore state on webview reload', () => {
     // Mock vscode.getState to return previous state
     // Render hooks
     // Verify hooks initialize with persisted values (not defaults)
   });
   ```

3. **Partial State Restore**
   ```typescript
   it('should handle missing persisted state gracefully', () => {
     // Mock vscode.getState with partial state
     // Verify hooks use defaults for missing values
   });
   ```

---

### Test Suite 3: Message Routing Integration

**File**: `src/tests/integration/message-routing.test.ts`

**Test Cases**:

1. **Strategy Pattern Routing**
   ```typescript
   it('should route SETTINGS_DATA to all settings hooks', () => {
     // Trigger SETTINGS_DATA message
     // Verify all 6 settings hooks' handleSettingsMessage called
   });
   ```

2. **Domain-Specific Messages**
   ```typescript
   it('should route MODEL_DATA to useModelsSettings only', () => {
     // Trigger MODEL_DATA message
     // Verify only useModelsSettings.handleModelData called
   });
   ```

3. **Message Filtering**
   ```typescript
   it('should not route messages to wrong handlers', () => {
     // Send ANALYSIS_RESULT message
     // Verify settings hooks NOT invoked
   });
   ```

---

## Testing Framework & Mocks

### VSCode API Mock

```typescript
// src/tests/mocks/vscode.ts
export const createMockVSCode = () => ({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
});
```

### Configuration Mock

```typescript
// src/tests/mocks/configuration.ts
export const createMockConfig = (overrides = {}) => ({
  get: jest.fn((key, defaultValue) => overrides[key] ?? defaultValue),
  update: jest.fn(),
  has: jest.fn(() => true),
  inspect: jest.fn()
});
```

### Message Envelope Mock

```typescript
// src/tests/mocks/messages.ts
export const createSettingsDataMessage = (settings: any) => ({
  type: MessageType.SETTINGS_DATA,
  source: 'extension.handler.configuration',
  payload: { settings },
  timestamp: Date.now()
});
```

---

## Impact

**Benefits of Fixing**:
- ✅ **Critical Flow Coverage**: Verify bidirectional sync works end-to-end
- ✅ **Echo Prevention**: Automated verification (no manual Output Channel watching)
- ✅ **Persistence**: Verify state restoration across reloads
- ✅ **Regression Prevention**: Catch integration bugs before they reach users
- ✅ **Confidence**: Safe to refactor message routing and persistence

**Risks of Not Fixing**:
- ⚠️ **Critical Bugs**: Echo loops, sync failures, persistence issues not caught
- ⚠️ **Manual Testing Burden**: Every change requires full manual test checklist
- ⚠️ **User Impact**: Integration bugs ship to users (worse than unit test failures)
- ⚠️ **Refactoring Fear**: Can't safely refactor without breaking sync/persistence

**Priority Justification**: HIGH because integration tests catch bugs that unit tests miss:
- Unit tests verify `updateSetting()` sends message ✅
- Integration tests verify entire sync chain works ✅ (more critical)

---

## References

- **Test Documentation**: [docs/testing.md](../../docs/testing.md) - Integration test examples and patterns
- **Sprint**: [Sprint 05 - Documentation & Testing](../epics/epic-unified-settings-architecture-2025-11-03/sprints/05-documentation-testing.md)
- **Architecture**: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#settings-management-architecture) - Bidirectional sync flow
- **ADR**: [2025-11-03: Unified Settings Architecture](../../docs/adr/2025-11-03-unified-settings-architecture.md)

---

**Status**: Deferred to future sprint
**Next Steps**:
1. Create integration test directory structure
2. Write settings sync tests (3 test cases)
3. Write persistence tests (3 test cases)
4. Write message routing tests (3 test cases)
5. Add to CI pipeline

**Estimated Breakdown**:
- Mocks and test utilities: 1 hour
- Settings sync tests: 1.5 hours
- Persistence tests: 1 hour
- Message routing tests: 30 minutes
- **Total**: 4 hours

**Can be done in parallel with**: Hook unit tests (different test suites)
