# ADR: Lightweight Testing Framework for Prose Minion

**Date**: 2025-11-15
**Status**: Proposed
**Context**: Post-refactor, pre-v1.0 alpha
**Decision Makers**: Okey Landers + AI Agent Team

---

## Context and Problem Statement

After completing major architectural refactors (Message Envelope, Domain Hooks, Strategy Pattern), we have **zero automated tests** covering:
- Message routing infrastructure (Strategy pattern)
- Domain hook state management (Tripartite Interface)
- Message envelope structure validation
- Handler registration and lifecycle

**Current Situation**:
- Manual testing during sprints (checklist-based)
- No regression protection for architectural patterns
- Risk of breaking core patterns when adding features
- Token budget concerns (comprehensive testing is expensive)

**Question**: What's the minimum viable testing strategy that protects our architectural patterns without consuming excessive tokens or blocking feature development?

---

## Decision Drivers

1. **Protect Core Patterns**: Infrastructure patterns (Strategy, Message Envelope, Domain Hooks) are foundation - breaking these is catastrophic
2. **Token Budget Discipline**: Comprehensive test coverage is expensive in alpha; focus on high-value tests
3. **Alpha Development Speed**: Tests should accelerate development (catch regressions early), not slow it down
4. **Future-Proof for v1.0**: Establish patterns that can scale to comprehensive coverage later
5. **Low Maintenance Burden**: Simple, focused tests that don't require constant updates

---

## Considered Options

### Option 1: Comprehensive TDD/TLD (Test-Driven Development)
**Pros**:
- Maximum confidence in code correctness
- Tests document intended behavior
- Catches edge cases early

**Cons**:
- ❌ Extremely high token cost (3-5x development time)
- ❌ Overkill for alpha (no users, breaking changes allowed)
- ❌ Slows feature velocity significantly
- ❌ Complex mocking required for VSCode API, React, OpenRouter

**Verdict**: Rejected - wrong phase of development

---

### Option 2: Zero Testing (Status Quo)
**Pros**:
- Fastest short-term feature development
- No token investment in test infrastructure
- No maintenance burden

**Cons**:
- ❌ No regression protection (already broke settings twice)
- ❌ Fear-driven development ("what will this break?")
- ❌ Manual testing is inconsistent and incomplete
- ❌ Hard to refactor with confidence

**Verdict**: Rejected - already experiencing pain from lack of tests

---

### Option 3: **Infrastructure-First Lightweight Testing** (Recommended)
**Pros**:
- ✅ Protects critical architectural patterns (Strategy, Message Envelope, Domain Hooks)
- ✅ Low token cost (focus on infrastructure, defer comprehensive coverage)
- ✅ Enables confident refactoring of core patterns
- ✅ Fast test execution (unit tests, no VSCode extension host)
- ✅ Scalable - can expand to comprehensive coverage for v1.0

**Cons**:
- ⚠️ Doesn't test every feature (accepts risk in alpha)
- ⚠️ Still requires manual testing for UI flows
- ⚠️ Initial setup cost (tooling, patterns)

**Verdict**: **Recommended** - balances risk, cost, and velocity

---

## Decision

**Adopt Infrastructure-First Lightweight Testing** with the following strategy:

### Testing Tiers (Priority Order)

#### **Tier 1: Infrastructure Patterns** (MUST HAVE)
Protect architectural foundations that, if broken, cascade throughout codebase.

**Scope**:
- ✅ Message envelope structure validation
- ✅ Message router (Strategy pattern) registration and dispatch
- ✅ Domain hook interfaces (State, Actions, Persistence contracts)
- ✅ Composed persistence (usePersistence combines all domains correctly)

**Why**: These patterns are used by *every feature*. Breaking them breaks everything.

**Example Tests** (using path aliases):
```typescript
// src/__tests__/shared/types/messages/MessageEnvelope.test.ts
import { createMessageEnvelope, MessageType } from '@/shared/types/messages';

describe('MessageEnvelope', () => {
  it('should require type, source, payload, timestamp', () => {
    const envelope = createMessageEnvelope({
      type: MessageType.ANALYSIS_RESULT,
      source: 'extension.handler.analysis',
      payload: { result: 'test' }
    });
    expect(envelope).toHaveProperty('timestamp');
  });
});

// src/__tests__/application/handlers/MessageHandler.test.ts
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('MessageRouter', () => {
  it('should route messages to registered handlers', () => {
    const handler = jest.fn();
    const router = new MessageRouter();
    router.register(MessageType.ANALYSIS_RESULT, handler);

    const msg = createEnvelope(MessageType.ANALYSIS_RESULT, {});
    router.route(msg);

    expect(handler).toHaveBeenCalledWith(msg);
  });
});

// src/__tests__/presentation/webview/hooks/domain/useAnalysis.test.ts
import { renderHook } from '@testing-library/react-hooks';
import { useAnalysis } from '@/presentation/webview/hooks/domain/useAnalysis';

describe('useAnalysis', () => {
  it('should export State, Actions, Persistence interfaces', () => {
    const { result } = renderHook(() => useAnalysis());

    expect(result.current).toHaveProperty('result');      // State
    expect(result.current).toHaveProperty('handleMessage'); // Actions
    expect(result.current).toHaveProperty('persistedState'); // Persistence
  });
});
```

**Token Cost**: Low (~2-4 hours to establish patterns and write ~20-30 tests)

---

#### **Tier 2: Domain Handler Logic** (SHOULD HAVE)
Test handler registration, message processing, error handling.

**Scope**:
- ✅ Handler registration in MessageHandler
- ✅ Error handling for malformed messages
- ✅ Result caching behavior

**Why**: Handlers orchestrate features. Testing them catches integration issues.

**Example Tests**:
```typescript
// src/__tests__/application/handlers/domain/AnalysisHandler.test.ts
import { AnalysisHandler } from '@/application/handlers/domain/AnalysisHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('AnalysisHandler', () => {
  it('should register routes on initialization', () => {
    const handler = new AnalysisHandler(mockService, mockHelper);
    const router = new MessageRouter();
    handler.registerRoutes(router);

    expect(router.hasRoute(MessageType.ANALYZE_DIALOGUE)).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const handler = new AnalysisHandler(mockFailingService, mockHelper);
    await expect(handler.handleAnalyze(msg)).resolves.not.toThrow();
  });
});
```

**Token Cost**: Medium (~4-6 hours for all domain handlers)

---

#### **Tier 3: Critical Business Logic** (NICE TO HAVE)
Test specific features with high complexity or user impact.

**Scope**:
- ✅ Word search clustering algorithm
- ✅ Context window trimming (sentence boundary preservation)
- ✅ Publishing standards comparison logic
- ✅ Word frequency filtering and POS tagging

**Why**: Complex algorithms are easy to break during refactoring.

**Example Tests**:
```typescript
// src/__tests__/domain/services/wordClustering.test.ts
import { clusterMatches } from '@/domain/services/wordClustering';

describe('WordClusteringService', () => {
  it('should cluster matches within window distance', () => {
    const matches = [
      { position: 10 },
      { position: 15 },
      { position: 100 }
    ];
    const clusters = clusterMatches(matches, { window: 50 });
    expect(clusters).toHaveLength(2); // First two clustered, third separate
  });
});
```

**Token Cost**: Medium (~6-8 hours for all critical logic)

---

#### **Tier 4: UI Components** (DEFER TO v1.0)
Test React components, user interactions, visual rendering.

**Scope**: Deferred - manual testing sufficient for alpha

**Why**:
- UI tests are expensive (React Testing Library, mocking VSCode API)
- High churn rate during alpha (UI changes frequently)
- Visual bugs are caught easily in manual testing
- Focus tokens on backend correctness

**Token Cost**: High (~10-15 hours) - not justified in alpha

---

### Tooling and Setup

**Test Framework**: **Jest** (industry standard, excellent TypeScript support)

**Additional Libraries**:
- `@testing-library/react` - For Tier 4 (deferred to v1.0)
- `@testing-library/react-hooks` - For domain hook testing (Tier 1)
- `ts-jest` - TypeScript preprocessor for Jest

**TypeScript Path Aliases**:
```json
// tsconfig.json (add to compilerOptions)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Jest Configuration**:
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // 'jsdom' for React component tests later
  roots: ['<rootDir>/src/__tests__'], // ← All tests in separate directory
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    // Support path aliases in tests
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',              // Don't cover tests
    '!src/presentation/**',            // Defer UI testing
    '!src/infrastructure/api/**'       // Defer API client mocking
  ],
  coverageThreshold: {
    global: {
      statements: 40, // Lightweight target (infrastructure + handlers)
      branches: 35,
      functions: 40,
      lines: 40
    }
  }
};
```

**File Organization** (Separate Test Directory):
```
src/
├── application/
│   └── handlers/
│       ├── MessageHandler.ts
│       └── domain/
│           └── AnalysisHandler.ts
├── presentation/
│   └── webview/
│       └── hooks/
│           ├── useMessageRouter.ts
│           ├── usePersistence.ts
│           └── domain/
│               └── useAnalysis.ts
├── domain/
│   └── services/
│       └── wordClustering.ts
└── __tests__/                                    ← All tests isolated here
    ├── application/
    │   └── handlers/
    │       ├── MessageHandler.test.ts            ← Tier 1
    │       └── domain/
    │           └── AnalysisHandler.test.ts       ← Tier 2
    ├── presentation/
    │   └── webview/
    │       └── hooks/
    │           ├── useMessageRouter.test.ts      ← Tier 1
    │           ├── usePersistence.test.ts        ← Tier 1
    │           └── domain/
    │               └── useAnalysis.test.ts       ← Tier 1
    ├── domain/
    │   └── services/
    │       └── wordClustering.test.ts            ← Tier 3 (deferred)
    └── shared/
        └── types/
            └── messages/
                └── MessageEnvelope.test.ts       ← Tier 1
```

**Benefits of Separate Test Directory**:
- ✅ Clean separation of production and test code
- ✅ Mirrors `src/` structure (easy to locate corresponding tests)
- ✅ No clutter in source directories
- ✅ Clear "this is infrastructure, not production code" distinction
- ✅ Path aliases (`@/`) keep imports clean and maintainable

**NPM Scripts**:
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

---

## Implementation Approach

### Phase 1: Infrastructure Testing (Tier 1) - **Sprint 01**
**Scope**: Message envelope, routing, domain hook contracts
**Effort**: 1-2 days
**Acceptance Criteria**:
- [ ] Jest installed and configured
- [ ] TypeScript path aliases configured (`@/` → `src/`)
- [ ] `src/__tests__/` directory structure created (mirrors `src/`)
- [ ] Message envelope factory and validator tests
- [ ] MessageRouter tests (registration, dispatch, error handling)
- [ ] useMessageRouter tests (frontend routing)
- [ ] usePersistence tests (state composition)
- [ ] At least 3 domain hooks tested for contract compliance (State, Actions, Persistence)
- [ ] CI-ready: `npm test` passes before build

**Deliverables**:
- `jest.config.js`
- `tsconfig.json` (updated with path aliases)
- `src/__tests__/shared/types/messages/MessageEnvelope.test.ts`
- `src/__tests__/application/handlers/MessageHandler.test.ts`
- `src/__tests__/presentation/webview/hooks/useMessageRouter.test.ts`
- `src/__tests__/presentation/webview/hooks/usePersistence.test.ts`
- `src/__tests__/presentation/webview/hooks/domain/useAnalysis.test.ts` (example for others)

---

### Phase 2: Domain Handler Testing (Tier 2) - **Sprint 02**
**Scope**: Handler registration, message processing, error handling
**Effort**: 2-3 days
**Acceptance Criteria**:
- [ ] All domain handlers tested for route registration
- [ ] Error handling tests for malformed messages
- [ ] Result caching behavior validated

**Deliverables**:
- `src/__tests__/application/handlers/domain/*.test.ts` (10 handlers)

---

### Phase 3: Critical Business Logic (Tier 3) - **v1.0 Candidate**
**Scope**: Complex algorithms (word clustering, trimming, publishing comparison)
**Effort**: Ongoing (add tests when refactoring complex logic)
**Acceptance Criteria**: Case-by-case based on feature complexity

---

### Phase 4: UI Component Testing (Tier 4) - **Post-v1.0**
**Scope**: React components, user interactions
**Effort**: TBD (when UI stabilizes)

---

## Testing Anti-Patterns to Avoid

Based on agent guidance from `.ai/central-agent-setup.md`:

❌ **Don't**:
- Write tests for every function (focus on patterns, not coverage percentage)
- Mock everything (prefer real implementations where feasible)
- Test implementation details (test contracts, not internals)
- Let test writing block feature development (write tests for infrastructure first, features later)

✅ **Do**:
- Test architectural patterns (Strategy, Message Envelope, Domain Hooks)
- Test error paths (handlers should never crash)
- Test public interfaces (State, Actions, Persistence contracts)
- Keep tests simple and focused (one assertion per test when possible)

---

## Success Metrics

**After Phase 1 (Infrastructure Testing)**:
- ✅ Zero regressions in message routing during feature development
- ✅ Domain hooks maintain contract compliance (no god component drift)
- ✅ CI catches pattern violations before merge
- ✅ Faster refactoring (confidence to change infrastructure)

**After Phase 2 (Handler Testing)**:
- ✅ 40%+ code coverage (infrastructure + handlers)
- ✅ Error handling standardized across all handlers
- ✅ Regression protection for handler registration

**Phase 3+**:
- ✅ Complex algorithms have regression tests
- ✅ Refactoring is safe and fast
- ✅ New features can be tested in isolation

---

## Consequences

### Benefits

1. **Regression Protection**: Infrastructure patterns (Strategy, Message Envelope, Domain Hooks) are protected from accidental breakage
2. **Confident Refactoring**: Can refactor handlers and hooks knowing tests will catch breaks
3. **Token Efficiency**: Focused testing strategy (infrastructure-first) maximizes value per token spent
4. **Faster Feature Development**: Catch bugs early (before manual testing phase)
5. **Documentation**: Tests document how infrastructure patterns should be used
6. **Scalable**: Can expand to comprehensive coverage for v1.0 without rework

### Risks and Mitigations

**Risk**: "Tests become maintenance burden during alpha"
**Mitigation**: Focus on infrastructure tests (change rarely). Defer UI and feature tests (change frequently).

**Risk**: "False confidence from low coverage"
**Mitigation**: Acknowledge coverage gaps explicitly. Continue manual testing for untested features.

**Risk**: "Setup cost delays feature work"
**Mitigation**: Phase 1 is 1-2 days. ROI is immediate (caught 2 settings bugs that would've been caught by tests).

**Risk**: "Agents struggle with test authoring"
**Mitigation**: Provide reference implementations (this ADR includes examples). Start with simple pattern-validation tests.

---

## Open Questions

1. **CI Integration**: Should we block PRs on test failures, or just warn?
   **Recommendation**: Block - pattern violations should never merge.

2. **Coverage Enforcement**: Should we enforce 40% coverage threshold in CI?
   **Recommendation**: Yes, but only for `src/application/handlers` and `src/presentation/webview/hooks` (not entire codebase).

3. **VSCode Extension Testing**: Should we test extension activation, commands, webview lifecycle?
   **Recommendation**: Defer to Phase 4 - requires `@vscode/test-electron` (heavy, complex).

4. **Snapshot Testing**: Should we use Jest snapshots for message envelope structures?
   **Recommendation**: Yes - good fit for validating message contract stability.

---

## Related Documentation

- [ADR: Message Envelope Architecture](2025-10-28-message-envelope-architecture.md) - Core pattern being tested
- [ADR: Presentation Layer Domain Hooks](2025-10-27-presentation-layer-domain-hooks.md) - Hook contracts being tested
- [Agent Guide: Testing Strategy](.ai/central-agent-setup.md#testing-strategy--token-budget) - Context for this decision
- [Memory Bank: Architectural Review](.memory-bank/20251102-1845-presentation-layer-architectural-review.md) - 9.8/10 score depends on tests to maintain

---

## Decision

**Adopt Infrastructure-First Lightweight Testing** starting with **Phase 1 (Sprint 01)**.

**Rationale**:
- Post-refactor architecture is solid (9.8/10) - now protect it with tests
- Already experiencing pain from lack of regression protection (settings bugs)
- Token-disciplined approach (focus on high-value infrastructure tests)
- Enables confident feature development and refactoring
- Scalable to comprehensive coverage for v1.0

**Next Steps**:
1. Create epic: `epic-infrastructure-testing-2025-11-15`
2. Sprint 01: Infrastructure Testing (Tier 1) - 1-2 days
3. Sprint 02: Domain Handler Testing (Tier 2) - 2-3 days
4. Integrate into build pipeline (`npm run build` runs `test:tier1`)
5. Document testing patterns in agent guide

---

**Status**: Proposed (awaiting approval)
**Approval Required From**: Okey Landers
**Implementation Owner**: AI Agent Team + Okey Landers
