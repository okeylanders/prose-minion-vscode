/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // 'jsdom' for React component tests later
  roots: ['<rootDir>/src/__tests__'], // All tests in separate directory
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
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
      branches: 20,   // Lower for infrastructure testing (route registration focus)
      functions: 40,
      lines: 40
    }
  }
};
