/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names, and the mocked barrel's exports. */
jest.mock('vscode', () => {
  type Listener = (event: unknown) => void;
  const emitter = () => {
    const listeners = new Set<Listener>();
    return {
      event: (listener: Listener) => {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
      fire: (event: unknown) => listeners.forEach((listener) => listener(event))
    };
  };
  const changes = emitter();
  const closes = emitter();
  const tabsChanged = emitter();
  const groupsChanged = emitter();
  class TabInputText {
    constructor(readonly uri: unknown) {}
  }
  class TabInputTextDiff {
    constructor(readonly original: unknown, readonly modified: unknown) {}
  }
  const diagnostics = new Map<string, unknown[]>();
  // Each named collection keeps its own diagnostics; Proofread's is `diagnostics`.
  const collections = new Map<string, Map<string, unknown[]>>([['prose-minion.draftEdit', diagnostics]]);
  class Range {
    constructor(readonly start: { offset: number }, readonly end: { offset: number }) {}
  }
  class Diagnostic {
    source?: string;
    code?: unknown;
    relatedInformation?: unknown[];
    constructor(readonly range: Range, readonly message: string, readonly severity: number) {}
  }
  class Location {
    constructor(readonly uri: unknown, readonly range: Range) {}
  }
  class DiagnosticRelatedInformation {
    constructor(readonly location: Location, readonly message: string) {}
  }
  class CodeAction {
    diagnostics?: unknown[];
    isPreferred?: boolean;
    command?: { title: string; command: string; arguments: unknown[] };
    constructor(readonly title: string, readonly kind: string) {}
  }
  return {
    window: {
      showTextDocument: jest.fn(),
      tabGroups: { all: [], onDidChangeTabs: tabsChanged.event, onDidChangeTabGroups: groupsChanged.event }
    },
    TabInputText,
    TabInputTextDiff,
    workspace: { openTextDocument: jest.fn(), textDocuments: [] as unknown[], onDidChangeTextDocument: changes.event, onDidCloseTextDocument: closes.event },
    languages: {
      createDiagnosticCollection: (name: string) => {
        const own = collections.get(name) ?? new Map<string, unknown[]>();
        collections.set(name, own);
        return {
          set: (uri: unknown, list: unknown[]) => own.set(String(uri), list),
          delete: (uri: unknown) => own.delete(String(uri)),
          clear: () => own.clear(),
          dispose: () => own.clear()
        };
      },
      registerCodeActionsProvider: () => ({ dispose: () => undefined })
    },
    Uri: { file: (path: string) => ({ toString: () => `file://${path}` }), parse: (value: string) => ({ toString: () => value }) },
    Range,
    Diagnostic,
    Location,
    DiagnosticRelatedInformation,
    CodeAction,
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    mockHost: { changes, closes, tabsChanged, groupsChanged, diagnostics, collections }
  };
}, { virtual: true });

import * as vscode from 'vscode';

interface MockHost {
  changes: { fire(event: unknown): void };
  closes: { fire(event: unknown): void };
  tabsChanged: { fire(event: unknown): void };
  groupsChanged: { fire(event: unknown): void };
  diagnostics: Map<string, Diagnostic[]>;
  collections: Map<string, Map<string, Diagnostic[]>>;
}
export interface Diagnostic {
  severity: number;
  message: string;
  range: { start: { offset: number }; end: { offset: number } };
  source?: string;
  code?: unknown;
  relatedInformation?: Array<{ location: { range: { start: { offset: number }; end: { offset: number } } }; message: string }>;
}
export const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
