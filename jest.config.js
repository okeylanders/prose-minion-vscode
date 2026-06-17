const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.base.json');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // 'jsdom' for React component tests later
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  // Single root jest across the workspace. Tests live in packages/core/src/__tests__;
  // apps/* is included as a root for future app-side adapter tests (none today).
  roots: [
    '<rootDir>/packages/core/src',
    '<rootDir>/apps/vscode-extension/src',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/packages/core/src/__tests__/setup.ts'],
  moduleNameMapper: {
    // The alias table is GENERATED from tsconfig.base.json's `paths` — the single
    // source of truth — so there is no hand-mirrored copy to drift, and it includes
    // every alias (bare `@secrets`/`@standards`/`@messages`, `@prose-minion/core`,
    // `@app/*`, etc.) automatically.
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  },
  collectCoverageFrom: [
    'packages/core/src/**/*.{ts,tsx}',
    'apps/vscode-extension/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**', // Don't cover tests
    '!packages/core/src/presentation/**', // Defer UI testing
    '!packages/core/src/infrastructure/api/**', // Defer API client mocking
  ],
  coverageThreshold: {
    global: {
      statements: 40, // Lightweight target (infrastructure + handlers)
      branches: 20, // Lower for infrastructure testing (route registration focus)
      functions: 40,
      lines: 40,
    },
  },
};
