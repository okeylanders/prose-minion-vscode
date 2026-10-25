/**
 * `VsCodeIssueAnnotator`'s quick fixes and `current` (Draft Edit Slice 2;
 * ADR 2026-10-21 D3, D7). Every action is a command back into core, never a
 * raw edit. VS Code is a controlled double; text is synthetic, around *Alice*.
 */

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
  const diagnostics = new Map<string, unknown[]>();
  class Range {
    constructor(readonly start: { offset: number }, readonly end: { offset: number }) {}
  }
  class Diagnostic {
    source?: string;
    code?: unknown;
    constructor(readonly range: Range, readonly message: string, readonly severity: number) {}
  }
  class CodeAction {
    diagnostics?: unknown[];
    isPreferred?: boolean;
    command?: { title: string; command: string; arguments: unknown[] };
    constructor(readonly title: string, readonly kind: string) {}
  }
  return {
    workspace: { textDocuments: [] as unknown[], onDidChangeTextDocument: changes.event, onDidCloseTextDocument: closes.event },
    languages: {
      createDiagnosticCollection: () => ({
        set: (uri: unknown, list: unknown[]) => diagnostics.set(String(uri), list),
        delete: (uri: unknown) => diagnostics.delete(String(uri)),
        clear: () => diagnostics.clear(),
        dispose: () => diagnostics.clear()
      }),
      registerCodeActionsProvider: () => ({ dispose: () => undefined })
    },
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    Range,
    Diagnostic,
    CodeAction,
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    mockHost: { changes, diagnostics }
  };
}, { virtual: true });

jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges
}));

import * as vscode from 'vscode';
import type { DocumentAnnotation } from '@prose-minion/core';
import { DRAFT_EDIT_DIAGNOSTIC_SOURCE, VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

interface MockHost {
  changes: { fire(event: unknown): void };
  diagnostics: Map<string, Diagnostic[]>;
}
interface Diagnostic {
  range: { start: { offset: number }; end: { offset: number } };
  source?: string;
  code?: unknown;
}
interface Action {
  title: string;
  isPreferred?: boolean;
  command?: { command: string; arguments: unknown[] };
}

const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
const workspace = vscode.workspace as unknown as { textDocuments: unknown[] };
const URI = 'file:///workspace/chapter-01.md';
const TEXT = 'Alice was begining to get vrey tired; her sister is reading.';
const COMMANDS = { dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' };

const document = {
  uri: { toString: () => URI },
  version: 3,
  getText: () => TEXT,
  positionAt: (offset: number) => ({ offset }),
  offsetAt: (position: { offset: number }) => position.offset
};

function annotation(id: string, quote: string, fix?: DocumentAnnotation['fix'], code = 'proofread.spelling'): DocumentAnnotation {
  const start = TEXT.indexOf(quote);
  return { id, start, end: start + quote.length, severity: 'info', code, message: 'A typo.', ...(fix ? { fix } : {}) };
}

function actionsFor(annotator: VsCodeIssueAnnotator): Action[] {
  const diagnostics = host.diagnostics.get(URI) ?? [];
  return annotator.provideCodeActions(document as never, {} as never, { diagnostics } as never) as unknown as Action[];
}

describe('VsCodeIssueAnnotator: quick fixes', () => {
  let annotator: VsCodeIssueAnnotator;

  beforeEach(() => {
    document.version = 3;
    workspace.textDocuments = [document];
    host.diagnostics.clear();
    annotator = new VsCodeIssueAnnotator(COMMANDS);
  });

  afterEach(() => annotator.dispose());

  it('offers Proofread\'s own fix as the preferred quick fix, then Dismiss, Fix all and Clear, each a command into core', () => {
    annotator.show(URI, 3, [annotation('proofread-1', 'vrey', { replacement: 'very', preferred: true })]);

    expect(actionsFor(annotator).map((action) => [action.title, action.isPreferred, action.command?.command, action.command?.arguments])).toEqual([
      ['Replace with “very”', true, 'replace', [URI, 'proofread-1']],
      ['Dismiss this Proofread flag', undefined, 'dismiss', [URI, 'proofread-1']],
      ['Fix all Proofread issues in this file', undefined, 'fixAll', [URI]],
      ['Clear all Proofread flags in this file', undefined, 'clear', [URI]]
    ]);
  });

  it('offers a judgment call\'s suggestion, never preferred, and no Fix all when nothing is Proofread\'s own fix', () => {
    annotator.show(URI, 3, [annotation('proofread-2', 'is reading', { replacement: 'was reading', preferred: false }, 'proofread.tense')]);

    expect(actionsFor(annotator).map((action) => [action.title, action.isPreferred ?? false])).toEqual([
      ['Replace with “was reading”', false],
      ['Dismiss this Proofread flag', false],
      ['Clear all Proofread flags in this file', false]
    ]);
  });

  it('offers only Dismiss and Clear for a flag with no replacement', () => {
    annotator.show(URI, 3, [annotation('proofread-3', 'begining')]);

    expect(actionsFor(annotator).map((action) => action.title)).toEqual(['Dismiss this Proofread flag', 'Clear all Proofread flags in this file']);
  });

  it('titles a deletion plainly, and keeps a long replacement to one line', () => {
    annotator.show(URI, 3, [
      annotation('proofread-4', 'vrey', { replacement: '', preferred: true }),
      annotation('proofread-5', 'begining', { replacement: `beginning\n${'and on '.repeat(10)}`, preferred: false })
    ]);
    const titles = actionsFor(annotator).map((action) => action.title);

    expect(titles).toContain('Delete it');
    const long = titles.find((title) => title.startsWith('Replace with'))!;
    expect(long).not.toMatch(/\n/);
    expect(long.endsWith('…”')).toBe(true);
  });

  it('ignores diagnostics from other sources', () => {
    annotator.show(URI, 3, [annotation('proofread-1', 'vrey', { replacement: 'very', preferred: true })]);
    const theirs = { range: { start: { offset: 0 }, end: { offset: 5 } }, source: 'cSpell', code: 'proofread.spelling' };

    expect(annotator.provideCodeActions(document as never, {} as never, { diagnostics: [theirs] } as never)).toEqual([]);
    expect(DRAFT_EDIT_DIAGNOSTIC_SOURCE).toBe('Prose Minion');
  });
});

describe('VsCodeIssueAnnotator.current', () => {
  let annotator: VsCodeIssueAnnotator;

  beforeEach(() => {
    document.version = 3;
    workspace.textDocuments = [document];
    annotator = new VsCodeIssueAnnotator(COMMANDS);
  });

  afterEach(() => annotator.dispose());

  it('reports where shown flags sit now, at the document\'s version, after the writer types', () => {
    const vrey = annotation('proofread-1', 'vrey', { replacement: 'very', preferred: true });
    annotator.show(URI, 3, [vrey]);
    document.version = 4;
    host.changes.fire({ document, contentChanges: [{ rangeOffset: 0, rangeLength: 0, text: 'Poor ' }] });

    expect(annotator.current(URI)).toEqual({ version: 4, annotations: [{ ...vrey, start: vrey.start + 5, end: vrey.end + 5 }] });
  });

  it('has nothing to report once cleared, or for a document that is not open', () => {
    annotator.show(URI, 3, [annotation('proofread-1', 'vrey')]);
    annotator.clear(URI);

    expect(annotator.current(URI)).toBeUndefined();
    expect(annotator.current('file:///workspace/other.md')).toBeUndefined();
  });
});
