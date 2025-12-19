# Testing Guide

**Prose Minion VSCode Extension** - Testing strategy and guidelines

**Last Updated**: November 2025 (Sprint 05)

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Strategy](#testing-strategy)
3. [Running Tests](#running-tests)
4. [Writing Hook Unit Tests](#writing-hook-unit-tests)
5. [Writing Integration Tests](#writing-integration-tests)
6. [Mocking VSCode API](#mocking-vscode-api)
7. [Manual Testing](#manual-testing)
8. [Test Coverage Guidelines](#test-coverage-guidelines)

---

## Overview

Prose Minion uses a **token-disciplined testing approach** during alpha development:

- **Automated tests** for infrastructure patterns, domain handlers, and business logic (124 tests)
- **Manual testing** for UI components and integration flows (checklists in sprint docs)
- **Comprehensive UI test suite** deferred to v1.0+

**Testing Framework**:
- **Jest** with **ts-jest** for unit and integration tests
- **Coverage**: 43.1% statement coverage (target: 40%)
- **3-Tier Architecture**: Infrastructure patterns → Domain handlers → Business logic
- React Testing Library for component tests (planned for v1.0+)

**Current Status**: Infrastructure testing complete (Nov 2025). UI component testing deferred to v1.0.

---

## Testing Strategy

### Three-Tier Approach

#### 1. Infrastructure Patterns (Tier 1) - ✅ Complete

**Protects core architectural patterns** that every feature depends on:

- `MessageRouter` - Strategy-based message routing (no switch statements)
- Domain handlers - Route registration for all 10 handlers
- Message envelope pattern - Source tracking, echo prevention

**Status**: ✅ Implemented (15 tests)
**Coverage**: Infrastructure layer patterns

---

#### 2. Domain Handlers (Tier 2) - ✅ Complete

**Tests domain-specific message handling**:

- AnalysisHandler, MetricsHandler, DictionaryHandler
- ContextHandler, SearchHandler, PublishingHandler
- ConfigurationHandler, SourcesHandler, UIHandler, FileOperationsHandler

**Status**: ✅ Implemented (10 tests)
**Coverage**: Handler route registration

---

#### 3. Business Logic (Tier 3) - ✅ Complete

**Tests critical algorithms and services**:

- Word clustering algorithm (WordSearchService)
- Publishing standards lookup (PublishingStandardsRepository)
- Prose statistics calculations (ProseStatsService)
- Category search orchestration (CategorySearchService)

**Status**: ✅ Implemented (99 tests)
**Coverage**: Core business logic

---

#### UI Components - Deferred to v1.0

React component tests deferred to comprehensive test suite post-alpha.

---

## Running Tests

### Automated Tests

```bash
# Run all tests (124 tests)
npm test

# Run tests in watch mode (re-runs on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only infrastructure tests (Tier 1)
npm run test:tier1

# Run specific test file
npm test -- WordSearchService.test.ts
```

**Coverage Report**:
- Coverage report saved to `coverage/` directory (gitignored)
- Open `coverage/index.html` in browser for detailed report
- Current coverage: **43.1% statements** (target: 40%) ✅

---

### Manual Testing

```bash
# Run extension in debug mode
npm run watch

# Press F5 in VSCode to launch Extension Development Host
# Follow manual testing checklists in sprint docs
```

**Manual Test Checklists**:
- [Adding Settings Guide](./guides/ADDING_SETTINGS.md#testing-your-changes)
- Sprint completion checklists in `.todo/epics/*/sprints/`

---

## Writing Hook Unit Tests

### Test Structure

All hook tests should follow this structure:

```typescript
// src/tests/hooks/useWordSearchSettings.test.ts

import { renderHook, act } from '@testing-library/react-hooks';
import { useWordSearchSettings } from '@/presentation/webview/hooks/domain/useWordSearchSettings';
import { MessageType } from '@/shared/types/messages';

describe('useWordSearchSettings', () => {
  let mockVSCode: any;

  beforeEach(() => {
    // Create fresh mock for each test
    mockVSCode = {
      postMessage: jest.fn(),
      getState: jest.fn(() => ({})),
      setState: jest.fn()
    };
  });

  describe('initialization', () => {
    it('should initialize with correct defaults', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      expect(result.current.settings).toEqual({
        defaultTargets: 'just',
        contextWords: 7,
        clusterWindow: 150,
        minClusterSize: 2,
        caseSensitive: false,
        enableAssistantExpansion: false
      });
    });

    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      expect(result.current.persistedState).toHaveProperty('wordSearch');
      expect(result.current.persistedState.wordSearch).toEqual(result.current.settings);
    });
  });

  describe('updateSetting', () => {
    it('should send UPDATE_SETTING message when updateSetting called', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      act(() => {
        result.current.updateSetting('contextWords', 10);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.domain.useWordSearchSettings',
        payload: {
          key: 'wordSearch.contextWords',
          value: 10
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('handleSettingsMessage', () => {
    it('should update state on SETTINGS_DATA message', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      const message = {
        type: MessageType.SETTINGS_DATA,
        source: 'extension.handler.configuration',
        payload: {
          wordSearch: {
            defaultTargets: 'really',
            contextWords: 5,
            clusterWindow: 100,
            minClusterSize: 3,
            caseSensitive: true,
            enableAssistantExpansion: true
          }
        },
        timestamp: Date.now()
      };

      act(() => {
        result.current.handleSettingsMessage(message);
      });

      expect(result.current.settings).toEqual({
        defaultTargets: 'really',
        contextWords: 5,
        clusterWindow: 100,
        minClusterSize: 3,
        caseSensitive: true,
        enableAssistantExpansion: true
      });
    });

    it('should use defaults for missing settings in message', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      const message = {
        type: MessageType.SETTINGS_DATA,
        source: 'extension.handler.configuration',
        payload: {
          wordSearch: {
            contextWords: 5
            // Other settings missing
          }
        },
        timestamp: Date.now()
      };

      act(() => {
        result.current.handleSettingsMessage(message);
      });

      // Should use defaults for missing settings
      expect(result.current.settings.defaultTargets).toBe('just');
      expect(result.current.settings.contextWords).toBe(5); // Updated
      expect(result.current.settings.clusterWindow).toBe(150); // Default
    });

    it('should ignore non-SETTINGS_DATA messages', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      const initialSettings = { ...result.current.settings };

      const message = {
        type: MessageType.ANALYSIS_RESULT,
        source: 'extension.handler.analysis',
        payload: {},
        timestamp: Date.now()
      };

      act(() => {
        result.current.handleSettingsMessage(message);
      });

      expect(result.current.settings).toEqual(initialSettings);
    });
  });

  describe('persistence', () => {
    it('should include all settings in persistedState', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      const persistedKeys = Object.keys(result.current.persistedState.wordSearch);
      expect(persistedKeys).toEqual([
        'defaultTargets',
        'contextWords',
        'clusterWindow',
        'minClusterSize',
        'caseSensitive',
        'enableAssistantExpansion'
      ]);
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      const message = {
        type: MessageType.SETTINGS_DATA,
        source: 'extension.handler.configuration',
        payload: {
          wordSearch: {
            contextWords: 10
          }
        },
        timestamp: Date.now()
      };

      act(() => {
        result.current.handleSettingsMessage(message);
      });

      expect(result.current.persistedState.wordSearch.contextWords).toBe(10);
    });
  });
});
```

---

### Test Coverage Requirements

**Minimum coverage for each hook**:

1. ✅ **Initialization**: Defaults match package.json
2. ✅ **Update**: `updateSetting()` sends correct message
3. ✅ **Message handling**: State updates on SETTINGS_DATA
4. ✅ **Defaults fallback**: Missing settings use defaults
5. ✅ **Message filtering**: Ignores irrelevant messages
6. ✅ **Persistence**: `persistedState` contains all settings

**Target**: > 80% code coverage per hook

---

## Writing Integration Tests

### Settings Sync Tests

Test bidirectional sync between VSCode config and hook state:

```typescript
// src/tests/integration/settings-sync.test.ts

import * as vscode from 'vscode';
import { renderHook, act } from '@testing-library/react-hooks';
import { useWordSearchSettings } from '@/presentation/webview/hooks/domain/useWordSearchSettings';
import { MessageType } from '@/shared/types/messages';

describe('Settings Sync Integration', () => {
  let mockVSCode: any;
  let mockConfig: vscode.WorkspaceConfiguration;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key, defaultValue) => defaultValue),
      update: jest.fn(),
      has: jest.fn(() => true),
      inspect: jest.fn()
    };

    mockVSCode = {
      postMessage: jest.fn(),
      getState: jest.fn(() => ({})),
      setState: jest.fn()
    };
  });

  describe('VSCode config → webview', () => {
    it('should sync VSCode config changes to hook state', async () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      // Simulate backend detecting config change
      const message = {
        type: MessageType.SETTINGS_DATA,
        source: 'extension.handler.configuration',
        payload: {
          wordSearch: {
            contextWords: 10 // Changed in VSCode settings
          }
        },
        timestamp: Date.now()
      };

      act(() => {
        result.current.handleSettingsMessage(message);
      });

      expect(result.current.settings.contextWords).toBe(10);
    });
  });

  describe('Webview → VSCode config', () => {
    it('should send UPDATE_SETTING when webview changes setting', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      act(() => {
        result.current.updateSetting('contextWords', 15);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.UPDATE_SETTING,
          payload: expect.objectContaining({
            key: 'wordSearch.contextWords',
            value: 15
          })
        })
      );
    });
  });

  describe('Echo prevention', () => {
    it('should not create infinite loop when updating from webview', () => {
      const { result } = renderHook(() => useWordSearchSettings(mockVSCode));

      // Update from webview
      act(() => {
        result.current.updateSetting('contextWords', 20);
      });

      // Backend should track this as webview-originated
      // Next config change event should NOT broadcast back
      // (This would be tested in backend ConfigurationHandler tests)

      expect(mockVSCode.postMessage).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

### Persistence Tests

Test state persistence across webview reloads:

```typescript
// src/tests/integration/settings-persistence.test.ts

describe('Settings Persistence Integration', () => {
  it('should persist all domain hook state via usePersistence', () => {
    // This would test the full App.tsx composition
    // Verifying that vscode.setState is called with correct shape

    const expectedState = {
      activeTab: 'search',
      modelsSettings: { /* ... */ },
      wordSearchSettings: { /* ... */ },
      wordFrequencySettings: { /* ... */ },
      contextPathsSettings: { /* ... */ },
      tokensSettings: { /* ... */ },
      publishingSettings: { /* ... */ },
      tokenTracking: { /* ... */ },
      analysis: { /* ... */ },
      metrics: { /* ... */ },
      dictionary: { /* ... */ },
      context: { /* ... */ },
      search: { /* ... */ },
      selection: { /* ... */ }
    };

    // Test that usePersistence composes all persistedState correctly
  });

  it('should restore state on webview reload', () => {
    // Mock vscode.getState to return previous state
    // Verify hooks initialize with persisted values
  });
});
```

---

## Mocking VSCode API

### Mock VSCode API Object

Use this mock for hook tests:

```typescript
// src/tests/mocks/vscode.ts

export const createMockVSCode = () => ({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
});

export type MockVSCodeAPI = ReturnType<typeof createMockVSCode>;
```

Usage:

```typescript
import { createMockVSCode } from '@tests/mocks/vscode';

describe('MyHook', () => {
  let mockVSCode: MockVSCodeAPI;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
  });

  it('should post message', () => {
    const { result } = renderHook(() => useMyHook(mockVSCode));

    act(() => {
      result.current.someAction();
    });

    expect(mockVSCode.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.SOME_TYPE
      })
    );
  });
});
```

---

### Mock Configuration Handler

For backend tests:

```typescript
// src/tests/mocks/configuration.ts

export const createMockConfig = (overrides = {}) => ({
  get: jest.fn((key, defaultValue) => {
    if (key in overrides) {
      return overrides[key];
    }
    return defaultValue;
  }),
  update: jest.fn(),
  has: jest.fn(() => true),
  inspect: jest.fn()
});
```

Usage:

```typescript
import { createMockConfig } from '@tests/mocks/configuration';

describe('ConfigurationHandler', () => {
  it('should get word search settings', () => {
    const mockConfig = createMockConfig({
      'wordSearch.contextWords': 10
    });

    const handler = new ConfigurationHandler(mockConfig);
    const settings = handler.getWordSearchSettings();

    expect(settings.contextWords).toBe(10);
  });
});
```

---

## Manual Testing

### Settings Testing Checklist

When adding or modifying settings, run this checklist:

#### 1. Settings Overlay → Component

- [ ] Open Settings Overlay (gear icon)
- [ ] Change setting
- [ ] Verify component behavior updates
- [ ] Check console for errors

#### 2. VSCode Settings Panel → Component

- [ ] Open VSCode settings (Cmd+, or Ctrl+,)
- [ ] Search for "Prose Minion"
- [ ] Change setting
- [ ] Verify component updates
- [ ] Verify Settings Overlay updates (if open)

#### 3. Persistence

- [ ] Set non-default values
- [ ] Close webview panel
- [ ] Reopen panel
- [ ] Verify settings persist

#### 4. Echo Prevention

- [ ] Open Output Channel (View → Output → Prose Minion)
- [ ] Change setting in Settings Overlay
- [ ] Verify only ONE broadcast message
- [ ] No infinite loop in logs

#### 5. Type Safety

```bash
npx tsc --noEmit
```

- [ ] Zero TypeScript errors
- [ ] Zero warnings

#### 6. Build

```bash
npm run build
```

- [ ] Build succeeds
- [ ] Check output sizes

---

### Feature Testing Checklist

When adding new features:

#### 1. Happy Path

- [ ] Feature works with default settings
- [ ] Feature works with custom settings
- [ ] Results display correctly
- [ ] No console errors

#### 2. Edge Cases

- [ ] Empty input
- [ ] Very large input
- [ ] Invalid input (if applicable)
- [ ] Concurrent operations

#### 3. Error Handling

- [ ] Network errors (if API calls)
- [ ] Invalid data
- [ ] Missing resources
- [ ] User sees helpful error messages

#### 4. Performance

- [ ] No excessive re-renders
- [ ] Smooth UI updates
- [ ] Acceptable response times

---

## Test Coverage Guidelines

### Priority Levels

**HIGH PRIORITY** (must have tests):
- Infrastructure hooks (useVSCodeApi, usePersistence, useMessageRouter)
- Settings hooks (all 6)
- Integration tests (sync, persistence, echo prevention)

**MEDIUM PRIORITY** (should have tests):
- State hooks (useTokenTracking, useAnalysis, etc.)
- Message handlers (backend domain handlers)
- Critical business logic

**LOW PRIORITY** (can defer):
- UI components (manual testing acceptable during alpha)
- Styling/layout
- Non-critical utilities

---

### Coverage Targets

**Overall**: > 70% code coverage

**By Layer**:
- Infrastructure: > 90%
- Domain hooks: > 80%
- Integration: Critical paths covered
- Components: Manual testing (defer automated until v1.0)

---

### Running Coverage Reports

When coverage is implemented:

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

**Coverage thresholds** (configured in jest.config.js):

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      statements: 40,  // Lightweight target (infrastructure + handlers)
      branches: 20,    // Lower for infrastructure testing
      functions: 40,
      lines: 40
    }
  }
};
```

**Coverage exclusions**:
- `src/presentation/**` - UI components (manual testing during alpha)
- `src/infrastructure/api/**` - External API clients (manual testing only)

---

## Best Practices

### DO:

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Arrange-Act-Assert pattern
- ✅ Mock external dependencies
- ✅ Test edge cases
- ✅ Keep tests focused (one assertion per test when possible)

### DON'T:

- ❌ Test implementation details
- ❌ Couple tests to each other
- ❌ Mock too much (test real integration when safe)
- ❌ Skip error cases
- ❌ Write flaky tests
- ❌ Test private methods directly

---

## Test Organization

**Directory Structure**:
```
src/__tests__/              # All tests mirror src/ structure
├── setup.ts                # VSCode API mocks and global setup
├── mocks/                  # Shared test mocks
│   └── vscode.ts           # Mock VSCode API
├── application/
│   ├── handlers/
│   │   ├── MessageRouter.test.ts
│   │   └── domain/         # Domain handler tests (10 handlers)
│   └── services/
│       └── AIResourceOrchestrator.test.ts
├── infrastructure/
│   ├── api/services/       # Business logic tests
│   │   ├── measurement/    # ProseStatsService
│   │   └── search/         # WordSearchService, CategorySearchService
│   └── standards/          # PublishingStandardsRepository
└── tools/                  # Tool tests
    ├── assist/             # WritingToolsAssistant
    └── measure/            # PassageProseStats
```

**Test Count**: 124 tests across 30 test files

---

## Future Work

**V1.0+**:

1. React component tests (React Testing Library)
2. Domain hook tests (useAnalysis, useMetrics, etc.)
3. E2E tests (VSCode extension testing framework)
4. CI integration (GitHub Actions)
5. Performance tests
6. Regression test suite

---

## Additional Resources

- [Adding Settings Guide](./guides/ADDING_SETTINGS.md) - Testing checklist for new settings
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture overview
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [@vscode/test-electron](https://www.npmjs.com/package/@vscode/test-electron)

---

**Last Updated**: December 2025
**Status**: Infrastructure testing complete (124 tests, 43.1% coverage)
**Questions**: See [ARCHITECTURE.md](./ARCHITECTURE.md) or open an issue
