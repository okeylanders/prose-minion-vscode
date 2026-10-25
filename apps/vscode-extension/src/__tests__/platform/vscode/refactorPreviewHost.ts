/**
 * A controlled VS Code for Draft Edit's reviews, built from VS Code's source
 * at 1.82.0 and at main. Suites load it as their `vscode` mock:
 * `jest.mock('vscode', () => jest.requireActual(…).createVsCodeDouble(), { virtual: true })`.
 *
 * - **The pane.** Refactor Preview holds `workspace.applyEdit` until the
 *   writer acts. A request made while the pane is free takes it. One made
 *   while another preview holds it waits until the writer agrees to replace
 *   that one, or refuses (`bulkEdit.contribution.ts` `_previewEdit`).
 * - **Apply** writes the entries if the document's version has not moved. A
 *   language change does not move it.
 * - **A language change** fires the document's close event (then open),
 *   leaving the same document open (`extHostDocuments.$acceptModelLanguageChanged`).
 * - **Documents opening** fire as VS Code fires them for any synced model,
 *   a preview's copy of a file included, whenever a suite says so.
 * - **Commands** are a spy only: Draft Edit sends none (PR #172 F-06).
 *
 * Text is public-domain *Alice*.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names. */
type Listener = (event: unknown) => void;

function emitter() {
  const listeners = new Set<Listener>();
  return {
    event: (listener: Listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    fire: (event: unknown) => listeners.forEach((listener) => listener(event))
  };
}

export interface RecordedEdit {
  readonly files: string[];
  readonly replacements: Array<{ range: { start: { offset: number }; end: { offset: number } }; newText: string; metadata?: { needsConfirmation?: boolean } }>;
}

export interface PreviewSession {
  readonly id: string;
  readonly edit: RecordedEdit;
  done: boolean;
  settle(applied: boolean): void;
}

export function createVsCodeDouble() {
  const changes = emitter();
  const opens = emitter();
  const closes = emitter();
  const diagnostics = new Map<string, unknown[]>();
  let sessions = 0;

  const pane = {
    current: undefined as PreviewSession | undefined,
    waiting: undefined as PreviewSession | undefined,
    /** A preview asks for the pane. */
    request(edit: RecordedEdit): Promise<boolean> {
      return new Promise<boolean>((settle) => {
        const session: PreviewSession = { id: `preview-${++sessions}`, edit, done: false, settle };
        if (pane.current) {
          pane.waiting = session;
        } else {
          pane.take(session);
        }
      });
    },
    take(session: PreviewSession): void {
      pane.current = session;
    },
    /** The preview holding the pane leaves it, as VS Code ends a session. */
    release(session: PreviewSession): void {
      session.done = true;
      if (pane.current === session) {
        pane.current = undefined;
      }
    },
    end(session: PreviewSession, applied: boolean): void {
      pane.release(session);
      session.settle(applied);
    },
    /** The writer agrees that the waiting preview may replace the one shown. */
    replace(): void {
      const waiting = pane.waiting!;
      pane.waiting = undefined;
      if (pane.current) {
        pane.end(pane.current, false);
      }
      pane.take(waiting);
    },
    /** The writer keeps the preview shown: the waiting request makes nothing. */
    refuse(): void {
      const waiting = pane.waiting!;
      pane.waiting = undefined;
      waiting.done = true;
      waiting.settle(false);
    }
  };

  class Range {
    constructor(readonly start: { offset: number }, readonly end: { offset: number }) {}
  }
  class Diagnostic {
    source?: string;
    code?: unknown;
    constructor(readonly range: Range, readonly message: string, readonly severity: number) {}
  }
  class WorkspaceEdit implements RecordedEdit {
    readonly files: string[] = [];
    readonly replacements: RecordedEdit['replacements'] = [];
    replace(uri: { toString(): string }, range: Range, newText: string, metadata?: { needsConfirmation?: boolean }): void {
      if (!this.files.includes(uri.toString())) {
        this.files.push(uri.toString());
      }
      this.replacements.push({ range, newText, ...(metadata ? { metadata } : {}) });
    }
  }

  return {
    workspace: {
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: changes.event,
      onDidOpenTextDocument: opens.event,
      onDidCloseTextDocument: closes.event,
      applyEdit: jest.fn((edit: RecordedEdit) => pane.request(edit))
    },
    commands: { executeCommand: jest.fn() },
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
    WorkspaceEdit,
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    CodeAction: class {},
    mockHost: { changes, opens, closes, diagnostics, pane }
  };
}

export type VsCodeDouble = ReturnType<typeof createVsCodeDouble>;

export interface FakeDocument {
  uri: { scheme: string; authority: string; query: string; toString(): string };
  version: number;
  languageId: string;
  isClosed: boolean;
  text: string;
  getText(): string;
  positionAt(offset: number): { offset: number };
  offsetAt(position: { offset: number }): number;
}

/** What a suite does with the double: documents, the writer's acts, and VS Code's events. */
export function reviewHarness(vscode: unknown) {
  const double = vscode as VsCodeDouble;
  const { workspace, commands, mockHost: host } = double;
  const documents = workspace.textDocuments as FakeDocument[];

  const openDocument = (text: string, languageId: string, uri = 'file:///workspace/chapter-01.md'): FakeDocument => {
    const document: FakeDocument = {
      uri: { scheme: 'file', authority: '', query: '', toString: () => uri },
      version: 1,
      languageId,
      isClosed: false,
      text,
      getText: () => document.text,
      positionAt: (offset) => ({ offset }),
      offsetAt: (position) => position.offset
    };
    documents.push(document);
    return document;
  };

  /** VS Code writing a preview's entries as one change, at an unmoved version: what its Apply does. */
  const write = (document: FakeDocument, edit: RecordedEdit): void => {
    const changes = edit.replacements.map((each) => ({ offset: each.range.start.offset, length: each.range.end.offset - each.range.start.offset, text: each.newText }));
    for (const each of [...changes].sort((a, b) => b.offset - a.offset)) {
      document.text = document.text.slice(0, each.offset) + each.text + document.text.slice(each.offset + each.length);
    }
    document.version += 1;
    host.changes.fire({ document, contentChanges: changes.map((each) => ({ rangeOffset: each.offset, rangeLength: each.length, text: each.text })) });
  };

  /** The writer ticks the file and presses Apply on the preview shown; nothing happens when none is. */
  const writerApplies = (document: FakeDocument): boolean => {
    const shown = host.pane.current;
    if (!shown) {
      return false;
    }
    write(document, shown.edit);
    host.pane.end(shown, true);
    return true;
  };

  const changeLanguage = (document: FakeDocument, languageId: string): void => {
    document.languageId = languageId;
    host.closes.fire(document);
  };

  /** Until the review has asked VS Code: shown, or waiting to replace the preview shown. */
  const asked = async (where: 'current' | 'waiting' = 'current'): Promise<PreviewSession> => {
    for (let turn = 0; turn < 50 && !host.pane[where]; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(host.pane[where]).toBeDefined();
    return host.pane[where]!;
  };

  const reset = (): void => {
    documents.splice(0);
    host.pane.current = undefined;
    host.pane.waiting = undefined;
    host.diagnostics.clear();
    commands.executeCommand.mockClear();
    workspace.applyEdit.mockClear();
  };

  return { host, workspace, commands, documents, openDocument, write, writerApplies, changeLanguage, asked, reset };
}
