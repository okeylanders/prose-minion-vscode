/**
 * PR #177 F-02, through the production `runCraftFlags` command,
 * `CraftFlagsUseCase`, `VsCodeDocumentEditor` and the Craft Flags
 * `VsCodeIssueAnnotator`. VS Code is a controlled double: open documents,
 * their change and close events, and diagnostic collections. The pass's
 * price, or the writer's confirmation, is held while the document closes,
 * reopens or changes language.
 *
 * The gesture is watched from the command's first read: a lifetime that ends
 * while it is priced shows no confirmation, and one that ends while the
 * confirmation is open sends nothing. A URI, a version and a language do not
 * name a lifetime, so a reopen with all three the same is refused too.
 * Controls: an edit made while the price is read is followed, as an edit made
 * while the model reads is; and nothing held, the flag is drawn.
 *
 * Text is synthetic, around *Alice*; nothing reaches a provider.
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
  return {
    workspace: {
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: changes.event,
      onDidCloseTextDocument: closes.event,
      openTextDocument: jest.fn(async () => {
        throw new Error('a closed document must not be reopened');
      })
    },
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
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    CodeAction: class {},
    mockHost: { changes, closes, diagnostics }
  };
}, { virtual: true });

// The whole core barrel cannot load under jest (an ESM dependency), so the
// runtime values the adapters, the command and this test use are required from their modules.
jest.mock('@prose-minion/core', () => ({
  craftFlagCategoriesOf: jest.requireActual('@/domain/models/CraftFlag').craftFlagCategoriesOf,
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  DRAFT_EDIT_PASS_POLICIES: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_PASS_POLICIES,
  reasoningLevelOf: jest.requireActual('@/domain/models/ReasoningLevel').reasoningLevelOf,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges,
  CraftFlagsUseCase: jest.requireActual('@/application/services/draftEdit/CraftFlagsUseCase').CraftFlagsUseCase,
  describeCraftFlagsOutcome: jest.requireActual('@/application/services/draftEdit/craftFlagsSummary').describeCraftFlagsOutcome,
  describeCraftFlagsPlan: jest.requireActual('@/application/services/draftEdit/craftFlagsSummary').describeCraftFlagsPlan
}));

import * as vscode from 'vscode';
import { CraftFlagsUseCase } from '@prose-minion/core';
import { runCraftFlags, type CraftFlagsCommandHost } from '@app/application/commands/craftFlagsCommands';
import type { ProofreadEditorSnapshot } from '@app/application/commands/proofreadCommands';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { CRAFT_FLAGS, VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

interface MockHost {
  changes: { fire(event: unknown): void };
  closes: { fire(event: unknown): void };
  diagnostics: Map<string, Array<{ range: { start: { offset: number }; end: { offset: number } } }>>;
}

const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; openTextDocument: jest.Mock };
const URI = 'file:///workspace/chapter-01.md';
const TEXT = 'When the Rabbit took a watch out, a chill ran down her spine.';

interface FakeDocument {
  uri: { toString(): string };
  version: number;
  languageId: string;
  isClosed: boolean;
  text: string;
  getText(): string;
  positionAt(offset: number): { offset: number };
  offsetAt(position: { offset: number }): number;
}

function openDocument(text: string, version = 1, languageId = 'markdown'): FakeDocument {
  const document: FakeDocument = {
    uri: { toString: () => URI },
    version,
    languageId,
    isClosed: false,
    text,
    getText: () => document.text,
    positionAt: (offset) => ({ offset }),
    offsetAt: (position) => position.offset
  };
  workspace.textDocuments.push(document);
  return document;
}

function close(document: FakeDocument): void {
  document.isClosed = true;
  workspace.textDocuments.splice(workspace.textDocuments.indexOf(document), 1);
  host.closes.fire(document);
}

function edit(document: FakeDocument, offset: number, length: number, text: string): void {
  document.text = document.text.slice(0, offset) + text + document.text.slice(offset + length);
  document.version += 1;
  host.changes.fire({ document, contentChanges: [{ rangeOffset: offset, rangeLength: length, text }] });
}

const held = () => {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

const CHILL = {
  anchor: { quote: 'a chill ran down her spine' },
  category: 'cliche' as const,
  kind: 'cliche' as const,
  why: 'A borrowed shiver stands in for what the watch means to her.'
};
const ESTIMATE = { model: 'placeholder/craft-model', calls: 1, inputTokens: 900, outputTokens: 1500, usd: 0.03 };

/** The command over the real adapters, its price and its confirmation each held until the test lets them go. */
function start(document: FakeDocument) {
  const pricing = held();
  const confirming = held();
  const pass = {
    estimate: jest.fn(async () => {
      await pricing.promise;
      return ESTIMATE;
    }),
    flag: jest.fn(async (request: { passage: string; stillCurrent?: () => boolean }) => {
      if (request.stillCurrent && !request.stillCurrent()) {
        return { kind: 'ended' as const };
      }
      return { kind: 'completed' as const, calls: [{ kind: 'read' as const, findings: [CHILL], malformed: 0, notesWithheld: 0 }] };
    })
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const documentEditor = new VsCodeDocumentEditor(log);
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear' }, CRAFT_FLAGS);
  const useCase = new CraftFlagsUseCase(pass, documentEditor, annotator, log);
  const snapshot: ProofreadEditorSnapshot = { uri: URI, version: document.version, text: document.getText(), languageId: document.languageId, label: 'chapter-01.md' };
  const confirm = jest.fn(async () => {
    await confirming.promise;
    return true;
  });
  const commandHost: CraftFlagsCommandHost = {
    activeEditor: () => snapshot,
    confirm,
    withProgress: (_title, task) => task(new AbortController().signal, () => undefined),
    showInformation: jest.fn(async () => undefined),
    showWarning: jest.fn(async () => undefined),
    executeCommand: jest.fn(),
    craftFlagCategories: () => ['cliche'],
    craftFlagsReasoning: () => undefined
  };
  const ran = runCraftFlags(commandHost, useCase);
  return {
    ran,
    pass,
    confirm,
    useCase,
    letPricingGo: pricing.release,
    letConfirmationGo: confirming.release,
    dispose: () => {
      documentEditor.dispose();
      annotator.dispose();
    }
  };
}

const flagged = () => (host.diagnostics.get(URI) ?? []).map((diagnostic) => [diagnostic.range.start.offset, diagnostic.range.end.offset]);
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('a Craft Flags gesture and its document\'s lifetime (PR #177 F-02)', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    workspace.textDocuments.splice(0);
    workspace.openTextDocument.mockClear();
    host.diagnostics.clear();
  });

  const lifetimeEnds: Array<[string, string, (document: FakeDocument) => void]> = [
    ['closed and reopened at the same URI, version and language', 'markdown', (document) => {
      close(document);
      openDocument(TEXT, document.version, 'markdown');
    }],
    ['changed from Markdown to plain text at the same version', 'markdown', (document) => {
      close(document);
      openDocument(TEXT, document.version, 'plaintext');
    }],
    ['reopened with other text at the same version', 'markdown', (document) => {
      close(document);
      openDocument('A different chapter altogether, and a chill ran down her spine.', document.version, 'markdown');
    }],
    ['changed from plain text to Markdown, now fencing what it sent', 'plaintext', (document) => {
      close(document);
      openDocument(`\`\`\`\n${TEXT}\n\`\`\``, document.version, 'markdown');
    }],
    ['changed from Markdown to JavaScript', 'markdown', (document) => {
      close(document);
      openDocument(TEXT, document.version, 'javascript');
    }]
  ];

  it.each(lifetimeEnds)('shows no confirmation and sends nothing when the document is %s while it is priced', async (_case, language, end) => {
    const document = openDocument(TEXT, 1, language);
    const command = start(document);
    disposers.push(command.dispose);
    end(document);
    command.letPricingGo();

    await expect(command.ran).resolves.toEqual({ kind: 'ran', outcome: { kind: 'changed' } });
    expect(command.confirm).not.toHaveBeenCalled();
    expect(command.pass.flag).not.toHaveBeenCalled();
    expect(flagged()).toEqual([]);
    expect(workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it.each(lifetimeEnds)('sends nothing when the document is %s while the confirmation is open', async (_case, language, end) => {
    const document = openDocument(TEXT, 1, language);
    const command = start(document);
    disposers.push(command.dispose);
    command.letPricingGo();
    await settle();
    expect(command.confirm).toHaveBeenCalledTimes(1);
    end(document);
    command.letConfirmationGo();

    await expect(command.ran).resolves.toEqual({ kind: 'ran', outcome: { kind: 'changed' } });
    expect(command.pass.flag).not.toHaveBeenCalled();
    expect(flagged()).toEqual([]);
  });

  it('sends nothing for a document closed and not reopened, and frees the document for the next gesture', async () => {
    const document = openDocument(TEXT);
    const command = start(document);
    disposers.push(command.dispose);
    close(document);
    command.letPricingGo();

    await expect(command.ran).resolves.toEqual({ kind: 'ran', outcome: { kind: 'changed' } });
    const reopened = openDocument(TEXT, 1);
    const next = command.useCase.begin({ uri: URI, version: reopened.version, text: TEXT, languageId: 'markdown' }, { kind: 'craft', categories: ['cliche'] });
    expect(next.kind).toBe('gesture');
  });

  it('control: an edit made while the price is read is followed, and the flag drawn on its text', async () => {
    const document = openDocument(TEXT);
    const command = start(document);
    disposers.push(command.dispose);
    edit(document, 0, 0, 'So, ');
    command.letPricingGo();
    await settle();
    command.letConfirmationGo();

    await expect(command.ran).resolves.toMatchObject({ kind: 'ran', outcome: { kind: 'completed', flagged: 1 } });
    const start0 = 'So, '.length + TEXT.indexOf('a chill');
    expect(flagged()).toEqual([[start0, start0 + 'a chill ran down her spine'.length]]);
  });

  it('control: nothing held up, the flag is drawn', async () => {
    const document = openDocument(TEXT);
    const command = start(document);
    disposers.push(command.dispose);
    command.letPricingGo();
    command.letConfirmationGo();

    await expect(command.ran).resolves.toMatchObject({ kind: 'ran', outcome: { kind: 'completed', flagged: 1 } });
    expect(flagged()).toEqual([[TEXT.indexOf('a chill'), TEXT.indexOf('a chill') + 'a chill ran down her spine'.length]]);
  });
});
