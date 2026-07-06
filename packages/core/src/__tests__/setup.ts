/**
 * Jest setup file
 * Mocks VSCode API for testing
 */

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    })),
    workspaceFolders: [],
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    parse: jest.fn((path: string) => ({ fsPath: path, path })),
    // Mirrors vscode.Uri.joinPath enough for tests: append segments to the
    // base path. Needed by getWebviewHtml (script/asset URIs) — PR #66, Cal.
    joinPath: jest.fn((base: { path?: string }, ...segments: string[]) => {
      const joined = [base?.path ?? '', ...segments].join('/');
      return { fsPath: joined, path: joined, toString: () => joined };
    })
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  }
}), { virtual: true });
