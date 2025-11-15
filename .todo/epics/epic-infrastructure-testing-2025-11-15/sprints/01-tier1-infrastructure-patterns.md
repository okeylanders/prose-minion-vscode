# Sprint 01: Tier 1 - Infrastructure Patterns

**Epic**: [Infrastructure Testing Framework](../epic-infrastructure-testing.md)
**Status**: Pending
**Branch**: `epic/infrastructure-testing-2025-11-15`
**Commit Prefix**: `[Sprint 01]`
**Estimated Effort**: 1-2 days
**ADR**: [ADR-2025-11-15: Lightweight Testing Framework](../../../docs/adr/2025-11-15-lightweight-testing-framework.md)

---

## Goals

Establish testing infrastructure and write foundational tests for architectural patterns that, if broken, cascade throughout the entire codebase.

**Focus**: Infrastructure patterns used by *every feature* (Message Envelope, Strategy Pattern, Domain Hooks)

---

## Scope

### In Scope
- ✅ Install and configure Jest + ts-jest
- ✅ Configure TypeScript path aliases (`@/` → `src/`)
- ✅ Create `src/__tests__/` directory structure (mirrors `src/`)
- ✅ Message envelope structure validation tests
- ✅ MessageRouter tests (Strategy pattern registration and dispatch)
- ✅ useMessageRouter tests (frontend routing)
- ✅ usePersistence tests (state composition)
- ✅ At least 3 domain hooks tested for contract compliance (State, Actions, Persistence)

### Out of Scope
- ❌ Domain handler testing (Sprint 02)
- ❌ Business logic testing (Sprint 03)
- ❌ UI component testing (Tier 4 - deferred to v1.0)
- ❌ Comprehensive coverage (focus on patterns only)

---

## Tasks

### Setup and Configuration

- [ ] **Install dependencies**
  ```bash
  npm install --save-dev jest ts-jest @types/jest @testing-library/react-hooks
  ```

- [ ] **Create `jest.config.js`**
  ```javascript
  module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/__tests__'],
    testMatch: ['**/*.test.ts', '**/*.spec.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1'
    },
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/__tests__/**',
      '!src/presentation/**',
      '!src/infrastructure/api/**'
    ],
    coverageThreshold: {
      global: {
        statements: 40,
        branches: 35,
        functions: 40,
        lines: 40
      }
    }
  };
  ```

- [ ] **Update `tsconfig.json` with path aliases**
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"]
      }
    }
  }
  ```

- [ ] **Add npm scripts to `package.json`**
  ```json
  {
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage",
      "test:tier1": "jest --testPathPattern='(useMessageRouter|usePersistence|MessageHandler|useAnalysis|useMetrics)'",
      "build": "npm run test:tier1 && webpack --mode production"
    }
  }
  ```

- [ ] **Create `src/__tests__/` directory structure**
  ```bash
  mkdir -p src/__tests__/{application/handlers/domain,presentation/webview/hooks/domain,domain/services,shared/types/messages}
  ```

---

### Test Files to Create

#### 1. Message Envelope Tests

- [ ] **`src/__tests__/shared/types/messages/MessageEnvelope.test.ts`**

  **What to test**:
  - Message envelope factory creates valid envelopes
  - All required fields present (type, source, payload, timestamp)
  - Timestamp is auto-generated
  - Source format validation
  - Type safety (TypeScript catches invalid message types)

  **Example**:
  ```typescript
  import { createMessageEnvelope, MessageType } from '@/shared/types/messages';

  describe('MessageEnvelope', () => {
    it('should create valid envelope with required fields', () => {
      const envelope = createMessageEnvelope({
        type: MessageType.ANALYSIS_RESULT,
        source: 'extension.handler.analysis',
        payload: { result: 'test' }
      });

      expect(envelope).toHaveProperty('type', MessageType.ANALYSIS_RESULT);
      expect(envelope).toHaveProperty('source', 'extension.handler.analysis');
      expect(envelope).toHaveProperty('payload');
      expect(envelope).toHaveProperty('timestamp');
      expect(typeof envelope.timestamp).toBe('number');
    });

    it('should auto-generate timestamp', () => {
      const before = Date.now();
      const envelope = createMessageEnvelope({
        type: MessageType.STATUS,
        source: 'test',
        payload: {}
      });
      const after = Date.now();

      expect(envelope.timestamp).toBeGreaterThanOrEqual(before);
      expect(envelope.timestamp).toBeLessThanOrEqual(after);
    });
  });
  ```

---

#### 2. MessageRouter Tests (Strategy Pattern)

- [ ] **`src/__tests__/application/handlers/MessageRouter.test.ts`**

  **What to test**:
  - Handler registration works correctly
  - Messages route to correct handlers
  - Multiple handlers can be registered
  - Unknown message types handled gracefully
  - Error handling for handler failures

  **Example**:
  ```typescript
  import { MessageRouter } from '@/application/handlers/MessageRouter';
  import { MessageType, createMessageEnvelope } from '@/shared/types/messages';

  describe('MessageRouter', () => {
    let router: MessageRouter;

    beforeEach(() => {
      router = new MessageRouter();
    });

    it('should register and route messages to handlers', () => {
      const handler = jest.fn();
      router.register(MessageType.ANALYSIS_RESULT, handler);

      const msg = createMessageEnvelope({
        type: MessageType.ANALYSIS_RESULT,
        source: 'test',
        payload: { result: 'test' }
      });

      router.route(msg);

      expect(handler).toHaveBeenCalledWith(msg);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown message types gracefully', () => {
      const msg = createMessageEnvelope({
        type: 'UNKNOWN_TYPE' as MessageType,
        source: 'test',
        payload: {}
      });

      expect(() => router.route(msg)).not.toThrow();
    });

    it('should support multiple handler registrations', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      router.register(MessageType.ANALYSIS_RESULT, handler1);
      router.register(MessageType.STATUS, handler2);

      const msg1 = createMessageEnvelope({
        type: MessageType.ANALYSIS_RESULT,
        source: 'test',
        payload: {}
      });
      const msg2 = createMessageEnvelope({
        type: MessageType.STATUS,
        source: 'test',
        payload: {}
      });

      router.route(msg1);
      router.route(msg2);

      expect(handler1).toHaveBeenCalledWith(msg1);
      expect(handler2).toHaveBeenCalledWith(msg2);
    });
  });
  ```

---

#### 3. useMessageRouter Tests (Frontend Strategy Pattern)

- [ ] **`src/__tests__/presentation/webview/hooks/useMessageRouter.test.ts`**

  **What to test**:
  - Handler map registration works
  - Message listener is stable (doesn't re-register on re-render)
  - Cleanup happens on unmount
  - Handlers receive correct message types

  **Example**:
  ```typescript
  import { renderHook } from '@testing-library/react-hooks';
  import { useMessageRouter } from '@/presentation/webview/hooks/useMessageRouter';
  import { MessageType } from '@/shared/types/messages';

  describe('useMessageRouter', () => {
    it('should register handlers and maintain stable listener', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const { rerender } = renderHook(() =>
        useMessageRouter({
          [MessageType.ANALYSIS_RESULT]: handler1,
          [MessageType.STATUS]: handler2
        })
      );

      // Re-render shouldn't re-register listeners
      rerender();

      // Verify no duplicate registrations occurred
      // (Implementation-specific - may need to verify via VSCode API mock)
    });
  });
  ```

---

#### 4. usePersistence Tests (Composed State)

- [ ] **`src/__tests__/presentation/webview/hooks/usePersistence.test.ts`**

  **What to test**:
  - State composition from multiple domains
  - `vscode.setState()` called with correct shape
  - State persists across hook re-renders
  - Handles undefined/partial state gracefully

  **Example**:
  ```typescript
  import { renderHook } from '@testing-library/react-hooks';
  import { usePersistence } from '@/presentation/webview/hooks/usePersistence';

  // Mock vscode API
  const mockSetState = jest.fn();
  global.acquireVsCodeApi = () => ({
    setState: mockSetState,
    getState: () => ({}),
    postMessage: jest.fn()
  });

  describe('usePersistence', () => {
    it('should compose and persist state', () => {
      const state = {
        activeTab: 'analysis',
        lastAnalysisResult: 'test result',
        metricsCache: { wordCount: 1000 }
      };

      renderHook(() => usePersistence(state));

      expect(mockSetState).toHaveBeenCalledWith(state);
    });

    it('should handle partial state gracefully', () => {
      const partialState = { activeTab: 'dictionary' };

      renderHook(() => usePersistence(partialState));

      expect(mockSetState).toHaveBeenCalledWith(partialState);
    });
  });
  ```

---

#### 5. Domain Hook Contract Tests

Test at least 3 domain hooks to validate Tripartite Interface pattern (State, Actions, Persistence).

- [ ] **`src/__tests__/presentation/webview/hooks/domain/useAnalysis.test.ts`**

  **What to test**:
  - Hook returns State interface (result, isLoading, guides, etc.)
  - Hook returns Actions interface (handleMessage, clearResult, etc.)
  - Hook returns persistedState interface
  - State updates correctly when messages received
  - Persistence contract is maintained

  **Example**:
  ```typescript
  import { renderHook, act } from '@testing-library/react-hooks';
  import { useAnalysis } from '@/presentation/webview/hooks/domain/useAnalysis';
  import { MessageType } from '@/shared/types/messages';

  describe('useAnalysis', () => {
    it('should export State, Actions, and Persistence interfaces', () => {
      const { result } = renderHook(() => useAnalysis());

      // State interface
      expect(result.current).toHaveProperty('result');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('guides');

      // Actions interface
      expect(result.current).toHaveProperty('handleMessage');
      expect(result.current).toHaveProperty('clearResult');

      // Persistence interface
      expect(result.current).toHaveProperty('persistedState');
      expect(result.current.persistedState).toHaveProperty('lastResult');
    });

    it('should update state when analysis result received', () => {
      const { result } = renderHook(() => useAnalysis());

      act(() => {
        result.current.handleMessage({
          type: MessageType.ANALYSIS_RESULT,
          source: 'extension.handler.analysis',
          payload: { result: 'Test analysis result' },
          timestamp: Date.now()
        });
      });

      expect(result.current.result).toBe('Test analysis result');
      expect(result.current.isLoading).toBe(false);
    });
  });
  ```

- [ ] **`src/__tests__/presentation/webview/hooks/domain/useMetrics.test.ts`**

  (Similar structure - test State, Actions, Persistence contracts)

- [ ] **`src/__tests__/presentation/webview/hooks/domain/useDictionary.test.ts`**

  (Similar structure - test State, Actions, Persistence contracts)

---

## Acceptance Criteria

- [ ] Jest installed and configured (`npm test` runs successfully)
- [ ] TypeScript path aliases configured (`@/` imports work in tests)
- [ ] `src/__tests__/` directory structure created (mirrors `src/`)
- [ ] All 6-8 test files created and passing
- [ ] Message envelope validation tests pass
- [ ] MessageRouter (Strategy pattern) tests pass
- [ ] useMessageRouter tests pass
- [ ] usePersistence tests pass
- [ ] At least 3 domain hooks tested for contract compliance
- [ ] CI-ready: `npm run test:tier1` passes
- [ ] Build pipeline updated: `npm run build` runs tests before webpack

---

## Implementation Notes

### Pattern: Tripartite Hook Interface

All domain hooks must return three interfaces:

```typescript
export interface DomainState {
  // Read-only state
}

export interface DomainActions {
  // User-triggered operations
}

export interface DomainPersistence {
  // What gets saved to vscode.setState
}

export type UseDomainReturn = DomainState & DomainActions & {
  persistedState: DomainPersistence
};
```

Tests validate that hooks adhere to this contract.

---

### Mocking Strategy

**VSCode API**:
```typescript
global.acquireVsCodeApi = () => ({
  setState: jest.fn(),
  getState: jest.fn(() => ({})),
  postMessage: jest.fn()
});
```

**React Hooks**: Use `@testing-library/react-hooks` for `renderHook` and `act`

---

## Deliverables

- ✅ `jest.config.js`
- ✅ `tsconfig.json` (updated with path aliases)
- ✅ `package.json` (updated with test scripts)
- ✅ `src/__tests__/shared/types/messages/MessageEnvelope.test.ts`
- ✅ `src/__tests__/application/handlers/MessageRouter.test.ts`
- ✅ `src/__tests__/presentation/webview/hooks/useMessageRouter.test.ts`
- ✅ `src/__tests__/presentation/webview/hooks/usePersistence.test.ts`
- ✅ `src/__tests__/presentation/webview/hooks/domain/useAnalysis.test.ts`
- ✅ `src/__tests__/presentation/webview/hooks/domain/useMetrics.test.ts`
- ✅ `src/__tests__/presentation/webview/hooks/domain/useDictionary.test.ts`

---

## Success Metrics

After Sprint 01:
- ✅ Zero regressions in message routing
- ✅ Domain hooks maintain contract compliance
- ✅ CI catches pattern violations before merge
- ✅ ~15-20% code coverage (infrastructure patterns)

---

## Related Documentation

- [Epic: Infrastructure Testing](../epic-infrastructure-testing.md)
- [ADR-2025-11-15: Lightweight Testing Framework](../../../docs/adr/2025-11-15-lightweight-testing-framework.md)
- [ADR-2025-10-28: Message Envelope Architecture](../../../docs/adr/2025-10-28-message-envelope-architecture.md)
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)

---

**Status**: Pending
**Next Action**: Install dependencies and create Jest configuration
