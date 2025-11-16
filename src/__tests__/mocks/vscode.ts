/**
 * Mock utilities for VSCode API in hooks tests
 *
 * Provides mock implementations of:
 * - VSCode webview API (postMessage, getState, setState)
 * - Persistence state management
 */

/**
 * VSCode webview API interface
 */
export interface MockVSCodeAPI {
  postMessage: jest.Mock;
  getState: jest.Mock;
  setState: jest.Mock;
}

/**
 * Create a mock VSCode API object
 *
 * @returns Mock VSCode API with jest.fn() implementations
 */
export const createMockVSCode = (): MockVSCodeAPI => ({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
});

/**
 * Create a mock persisted state object
 *
 * @param initial - Initial persisted state
 * @returns Mock persisted state
 */
export const createMockPersistedState = <T>(initial?: T): T | undefined => {
  return initial;
};
