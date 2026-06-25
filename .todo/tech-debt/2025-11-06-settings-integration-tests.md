# Settings Integration Tests

**Date Identified**: 2025-11-06
**Reviewed**: 2026-06-25
**Status**: Deferred
**Priority**: Medium
**Estimated Effort**: 4-6 hours

## Problem

Settings hooks and message routing have solid unit coverage, but the repository
does not verify the complete settings lifecycle:

`hook → UPDATE_SETTING → ConfigurationHandler → SettingsStore → config watcher → SETTINGS_DATA → router → hook`

The timed echo-suppression behavior and real webview persistence composition
also remain untested.

## Existing Coverage

- Six settings-hook suites cover persisted initialization, update messages, and
  incoming settings data.
- `useAppMessageRouter.test.ts` characterizes `SETTINGS_DATA` fan-out.
- `App.tsx` composes domain persistence through `usePersistence`.
- `ConfigurationHandler.test.ts` verifies route registration.

These tests are valuable but stop at unit boundaries.

## Remaining Tests

### Full Settings Round Trip

- Drive a webview-originated update through `ConfigurationHandler`
- Verify the settings store receives the correct key and value
- Simulate the configuration watcher
- Verify `SETTINGS_DATA` reaches the correct hook consumers

### Echo Suppression

- Exercise `markWebviewOriginatedUpdate()` and
  `shouldBroadcastConfigChange()` with fake timers
- Verify a webview-originated update is not immediately echoed
- Verify a later external configuration change is broadcast normally

### Persistence Composition and Restoration

- Render the application composition and inspect the complete object passed to
  `vscode.setState`
- Restore representative multi-domain state through the real persistence seam
- Verify partial state uses safe defaults
- Clarify and test whether `activeTab` should restore or intentionally reset

## Related Files

- `packages/core/src/application/handlers/domain/ConfigurationHandler.ts`
- `packages/core/src/presentation/webview/App.tsx`
- `packages/core/src/presentation/webview/hooks/usePersistence.ts`
- `packages/core/src/presentation/webview/hooks/useAppMessageRouter.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/`

## Completion Criteria

- Full round-trip settings synchronization is tested
- Echo suppression is covered with deterministic timers
- Persistence composition and reload restoration are tested without mocking
  away the integration boundary
- Existing hook tests remain focused unit tests
