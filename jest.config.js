/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // 'jsdom' for React component tests later
  roots: ['<rootDir>/src/__tests__'], // All tests in separate directory
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    // Support path aliases in tests (order matters - most specific first)
    '^@messages$': '<rootDir>/src/shared/types/messages/index.ts',
    '^@messages/(.*)$': '<rootDir>/src/shared/types/messages/$1',
    '^@formatters$': '<rootDir>/src/presentation/webview/utils/formatters',
    '^@formatters/(.*)$': '<rootDir>/src/presentation/webview/utils/formatters/$1',
    '^@standards$': '<rootDir>/src/infrastructure/standards',
    '^@secrets$': '<rootDir>/src/infrastructure/secrets',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@handlers/(.*)$': '<rootDir>/src/application/handlers/$1',
    '^@services/(.*)$': '<rootDir>/src/infrastructure/api/services/$1',
    '^@providers/(.*)$': '<rootDir>/src/infrastructure/api/providers/$1',
    '^@orchestration/(.*)$': '<rootDir>/src/infrastructure/api/orchestration/$1',
    '^@parsers/(.*)$': '<rootDir>/src/infrastructure/api/parsers/$1',
    '^@components/(.*)$': '<rootDir>/src/presentation/webview/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/presentation/webview/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/presentation/webview/utils/$1',
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
      branches: 20,   // Lower for infrastructure testing (route registration focus)
      functions: 40,
      lines: 40
    }
  }
};
