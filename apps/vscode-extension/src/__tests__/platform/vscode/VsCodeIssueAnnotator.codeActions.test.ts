/**
 * `VsCodeIssueAnnotator`'s quick fixes and `current` (Draft Edit Slice 2;
 * ADR 2026-10-21 D3, D7), and a flag's related places (Slice 3c part 4).
 * Every action is a command back into core, never a raw edit. VS Code is a
 * controlled double; text is synthetic, around *Alice*.
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
    workspace: { textDocuments: [] as unknown[], onDidChangeTextDocument: changes.event, onDidCloseTextDocument: closes.event },
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
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    Range,
    Diagnostic,
    Location,
    DiagnosticRelatedInformation,
    CodeAction,
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    mockHost: { changes, diagnostics, collections }
  };
}, { virtual: true });

jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges
}));

import * as vscode from 'vscode';
import type { DocumentAnnotation } from '@prose-minion/core';
import { CRAFT_FLAGS, DRAFT_EDIT_DIAGNOSTIC_SOURCE, VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

interface MockHost {
  changes: { fire(event: unknown): void };
  diagnostics: Map<string, Diagnostic[]>;
  collections: Map<string, Map<string, Diagnostic[]>>;
}
interface Diagnostic {
  range: { start: { offset: number }; end: { offset: number } };
  source?: string;
  code?: unknown;
  relatedInformation?: Array<{ location: { range: { start: { offset: number }; end: { offset: number } } }; message: string }>;
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

/**
 * Craft Flags' family (Draft Edit Slice 3c): a second instance with its own
 * collection, source and words, Dismiss and Clear only, and no reach into
 * Proofread's flags.
 */
describe('VsCodeIssueAnnotator: the Craft Flags family', () => {
  let proofread: VsCodeIssueAnnotator;
  let craft: VsCodeIssueAnnotator;
  const craftDiagnostics = () => host.collections.get(CRAFT_FLAGS.collection)?.get(URI) ?? [];
  const actionsIn = (annotator: VsCodeIssueAnnotator, diagnostics: Diagnostic[]) =>
    annotator.provideCodeActions(document as never, {} as never, { diagnostics } as never) as unknown as Action[];

  beforeEach(() => {
    document.version = 3;
    workspace.textDocuments = [document];
    host.collections.forEach((collection) => collection.clear());
    proofread = new VsCodeIssueAnnotator(COMMANDS);
    craft = new VsCodeIssueAnnotator({ dismiss: 'dismissCraft', clear: 'clearCraft' }, CRAFT_FLAGS);
  });

  afterEach(() => {
    proofread.dispose();
    craft.dispose();
  });

  it('shows its flags under its own collection and source, and offers only Dismiss and Clear, even for a flag with a fix', () => {
    craft.show(URI, 3, [annotation('craft-1', 'get vrey tired', { replacement: 'tire', preferred: true }, 'craft.cliche')]);

    expect(CRAFT_FLAGS).toEqual({ collection: 'prose-minion.craftFlags', source: 'Prose Minion Craft', noun: 'Craft' });
    expect(craftDiagnostics().map((diagnostic) => [diagnostic.source, diagnostic.code])).toEqual([['Prose Minion Craft', 'craft.cliche']]);
    expect(host.diagnostics.get(URI)).toBeUndefined();
    expect(actionsIn(craft, craftDiagnostics()).map((action) => [action.title, action.command?.command, action.command?.arguments])).toEqual([
      ['Dismiss this Craft flag', 'dismissCraft', [URI, 'craft-1']],
      ['Clear all Craft flags in this file', 'clearCraft', [URI]]
    ]);
  });

  it('keeps the two families apart: neither shows, clears nor answers for the other\'s flags', () => {
    proofread.show(URI, 3, [annotation('proofread-1', 'vrey', { replacement: 'very', preferred: true })]);
    craft.show(URI, 3, [annotation('craft-1', 'her sister is reading', undefined, 'craft.cliche')]);
    const proofreadDiagnostics = host.diagnostics.get(URI) ?? [];

    expect(actionsIn(craft, proofreadDiagnostics)).toEqual([]);
    expect(actionsIn(proofread, craftDiagnostics())).toEqual([]);
    craft.clear(URI);
    expect(craftDiagnostics()).toEqual([]);
    expect(proofread.current(URI)?.annotations.map((each) => each.id)).toEqual(['proofread-1']);
    expect(host.diagnostics.get(URI)).toHaveLength(1);
  });
});

/**
 * A flag's related places (Draft Edit Slice 3c part 4): a continuity pair's
 * earlier side, shown under the flag, moved with the writer's edits, and the
 * flag withdrawn when an edit touches it.
 */
describe('VsCodeIssueAnnotator: related places', () => {
  let craft: VsCodeIssueAnnotator;
  const shown = () => host.collections.get(CRAFT_FLAGS.collection)?.get(URI) ?? [];
  const pair = (): DocumentAnnotation => {
    const later = annotation('craft-1', 'her sister is reading', undefined, 'craft.continuity');
    const start = TEXT.indexOf('Alice');
    return { ...later, related: [{ start, end: start + 'Alice'.length, message: 'The other side of this pair: “Alice”' }] };
  };

  beforeEach(() => {
    document.version = 3;
    workspace.textDocuments = [document];
    host.collections.forEach((collection) => collection.clear());
    craft = new VsCodeIssueAnnotator({ dismiss: 'dismissCraft', clear: 'clearCraft' }, CRAFT_FLAGS);
  });

  afterEach(() => craft.dispose());

  it('shows each related place as related information, a link to its range with its line', () => {
    craft.show(URI, 3, [pair()]);

    expect(shown()[0].relatedInformation?.map((each) => [each.location.range.start.offset, each.location.range.end.offset, each.message]))
      .toEqual([[0, 5, 'The other side of this pair: “Alice”']]);
  });

  it('moves a related place with the writer\'s edits, as it moves the flag', () => {
    craft.show(URI, 3, [pair()]);
    document.version = 4;
    host.changes.fire({ document, contentChanges: [{ rangeOffset: 0, rangeLength: 0, text: 'Poor ' }] });

    const [moved] = craft.current(URI)?.annotations ?? [];
    expect(moved.related).toEqual([{ start: 5, end: 10, message: 'The other side of this pair: “Alice”' }]);
    expect(shown()[0].relatedInformation?.[0].location.range.start.offset).toBe(5);
  });

  it('withdraws the flag when an edit touches its related place, though its own text is untouched', () => {
    craft.show(URI, 3, [pair()]);
    document.version = 4;
    host.changes.fire({ document, contentChanges: [{ rangeOffset: 1, rangeLength: 3, text: 'ic' }] });

    expect(craft.current(URI)?.annotations).toEqual([]);
    expect(shown()).toEqual([]);
  });

  it('gives a flag with no related places no related information', () => {
    craft.show(URI, 3, [annotation('craft-2', 'vrey', undefined, 'craft.cliche')]);

    expect(shown()[0].relatedInformation).toBeUndefined();
  });
});
