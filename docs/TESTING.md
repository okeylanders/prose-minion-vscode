# Testing

> **Status**: Current as of June 2026 — 51 suites, 404 tests, ~44.8% statement coverage.

## Overview

Prose Minion uses a **Jest + ts-jest** single-root test setup across the monorepo. The philosophy is **Infrastructure-First Lightweight Testing**: protect core architectural patterns and business logic with 40% coverage targets, defer UI and external API tests to v1.0.

**Reference**: [ADR 2025-11-15: Lightweight Testing Framework](adr/2025-11-15-lightweight-testing-framework.md)

---

## Commands

```bash
# Run all tests
npm test

# Watch mode (re-runs on changes)
npm run test:watch

# Coverage report (saved to coverage/, gitignored)
npm run test:coverage

# Tier 1 — infrastructure pattern tests only
npm run test:tier1

# Run a specific test file
npm test -- WordSearchService.test.ts
```

---

## Test Organization

Tests live in `packages/core/src/__tests__/` and mirror the source tree. The jest config (`jest.config.js`) also includes `apps/vscode-extension/src` as a root for future adapter tests.

```
packages/core/src/__tests__/
├── setup.ts                           # VSCode API mocks + global setup
├── mocks/                             # Shared mocks (platform.ts, vscode.ts)
├── architecture/                      # Boundary/contract guards
│   ├── boundaries.test.ts             # No vscode imports in core
│   ├── resourceStaging.test.ts
│   └── wordSearchDefaultsSync.test.ts
├── application/
│   ├── handlers/
│   │   ├── MessageHandler.test.ts
│   │   ├── MessageRouter.test.ts
│   │   └── domain/                     # 11 domain handler tests
│   └── services/
│       └── AgentRunEngine.test.ts
├── infrastructure/
│   ├── account/                        # Account balance client + service
│   ├── api/orchestration/              # Resource lifecycle, catalogs, capabilities
│   ├── api/services/                   # Dictionary, measurement, search, shared
│   ├── standards/                      # PublishingStandardsRepository
│   ├── storage/                        # pathContainment
│   └── text/                           # TextSourceResolver
├── presentation/webview/
│   ├── components/                     # balanceFormat
│   ├── hooks/                          # useAppMessageRouter, useStreaming
│   │   └── domain/                     # 12 domain hook tests
│   └── utils/formatters/               # proseStats, streaming, wordSearch, helpers
├── tools/
│   ├── assist/                         # writingToolsAssistant
│   ├── measure/                        # passageProseStats, wordFrequency
│   ├── shared/                         # loaderContainment
│   └── utility/                        # dictionaryUtility
└── utils/
    └── textUtils.test.ts
```

---

## What's Tested

### Tier 1 — Infrastructure Patterns

Architectural guards that fail the build on boundary drift:

- **`boundaries.test.ts`** — No `vscode` imports in `packages/core/src`
- **`MessageRouter`** — Strategy pattern registration and routing
- **Domain hooks** — Tripartite Interface (State, Actions, Persistence)
- **`useAppMessageRouter`** — Frontend message routing contract

### Tier 2 — Domain Handlers

Route registration for all 11 domain handlers:

`AnalysisHandler`, `DictionaryHandler`, `ContextHandler`, `MetricsHandler`, `SearchHandler`, `ConfigurationHandler`, `PublishingHandler`, `SourcesHandler`, `UIHandler`, `FileOperationsHandler`, `AccountBalanceHandler`

### Tier 3 — Business Logic

- Word clustering algorithm (`WordSearchService`)
- Category search orchestration (`CategorySearchService`)
- Publishing standards lookup (`PublishingStandardsRepository`)
- Prose statistics calculations (`PassageProseStats`)
- Word frequency analysis
- Account balance formatting
- Streaming stats formatting
- Text source resolution

---

## What's NOT Tested (Intentionally Deferred)

- ❌ **UI components** — React rendering (high churn during alpha, deferred to v1.0)
- ❌ **OpenRouter API integration** — External dependency, manual testing only
- ❌ **VS Code extension activation** — Requires `@vscode/test-electron`

---

## Coverage

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Statements | 40% | 44.8% | ✅ |
| Functions | 40% | 41.6% | ✅ |
| Lines | 40% | 44.8% | ✅ |
| Branches | 20% | 34.4% | ✅ |

Coverage thresholds are configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    statements: 40,
    branches: 20,
    functions: 40,
    lines: 40,
  },
},
```

Coverage exclusions (also in `jest.config.js`):
- `packages/core/src/presentation/**` — UI components (manual testing during alpha)
- `packages/core/src/infrastructure/api/**` — API clients (manual testing only)

---

## Jest Configuration

`jest.config.js` highlights:

- **Preset**: `ts-jest`
- **Environment**: `node` (default); hook tests needing a DOM opt in via `/** @jest-environment jsdom */` docblock
- **Roots**: `packages/core/src` and `apps/vscode-extension/src`
- **Test match**: `**/__tests__/**/*.test.ts(x)`
- **Aliases**: Generated from `tsconfig.base.json` paths — no hand-mirrored copy to drift
- **Setup**: `packages/core/src/__tests__/setup.ts` (VS Code API mocks)

---

## Mocks

- **`mocks/vscode.ts`** — Mock `acquireVsCodeApi()` for webview hook tests
- **`mocks/platform.ts`** — Mock `Platform` ports for core tests

---

## Manual Testing

```bash
npm run watch   # Build in watch mode
# Press F5 in VS Code → Extension Development Host
```

Follow the manual testing checklists in:
- [Adding Settings Guide](guides/ADDING_SETTINGS.md) — Settings sync + persistence checklist
- Sprint completion notes in `.todo/archive/epics/`

---

## Testing Philosophy

1. **Protect architectural patterns** — every feature depends on these
2. **Test business logic** — algorithms and calculations that matter
3. **Defer UI testing** — presentation layer has high churn during alpha
4. **40% coverage, not 80%** — balance alpha velocity with safety

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design and patterns
- [ADR 2025-11-15: Lightweight Testing Framework](adr/2025-11-15-lightweight-testing-framework.md)
- [Adding Settings Guide](guides/ADDING_SETTINGS.md)
