const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.base.json');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  // Default env is node; the 8 hook tests that need a DOM opt in per-file via a
  // `/** @jest-environment jsdom */` docblock (PR #60 review #8).
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  // Single root jest across the workspace. Tests live in packages/core/src/__tests__.
  // `apps/vscode-extension/src` is a root for future app-side adapter tests — note
  // there is NO app-side `vscode` mock yet (the mock in core's setup.ts is scoped to
  // core); the first adapter test that touches a `vscode` global must add one
  // (PR #60 review #6).
  roots: [
    '<rootDir>/packages/core/src',
    '<rootDir>/apps/vscode-extension/src',
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.spec.ts',
    '**/__tests__/**/*.spec.tsx',
  ],
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
