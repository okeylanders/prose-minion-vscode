/**
 * `VsCodeIssueAnnotator`'s quick fixes and `current` (Draft Edit Slice 2;
 * ADR 2026-10-21 D3, D7), and a flag's related places (Slice 3c part 4).
 * Every action is a command back into core, never a raw edit. VS Code is a
 * controlled double; text is synthetic, around *Alice*.
 */

import './mockIssueAnnotatorHost';

jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  WorkshopHighlightService: jest.requireActual('@/application/services/workshop/highlights/WorkshopHighlightService').WorkshopHighlightService,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges
}));

import * as vscode from 'vscode';
import { WorkshopHighlightService, type DocumentAnnotation } from '@prose-minion/core';
import { VsCodeWorkshopHighlightDocuments } from '@app/platform/vscode/VsCodeWorkshopHighlightDocuments';
import { CRAFT_FLAGS, WORKSHOP_HIGHLIGHTS, DRAFT_EDIT_DIAGNOSTIC_SOURCE, VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

interface MockHost {
  changes: { fire(event: unknown): void };
  closes: { fire(event: unknown): void };
  tabsChanged: { fire(event: unknown): void };
  groupsChanged: { fire(event: unknown): void };
  diagnostics: Map<string, Diagnostic[]>;
  collections: Map<string, Map<string, Diagnostic[]>>;
}
interface Diagnostic {
  severity: number;
  message: string;
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

describe('Workshop highlights in the live editor', () => {
  const path = '/workspace/chapter-01.md';
  const draft = (title: string, ...quotes: string[]) => ({
    title, places: quotes.map(quote => ({ start: { quote }, note: 'Look here.' }))
  });
  const highlights = () => host.collections.get(WORKSHOP_HIGHLIGHTS.collection)?.get(URI) ?? [];
  const openDocument = vscode.workspace.openTextDocument as jest.Mock;
  const showDocument = vscode.window.showTextDocument as jest.Mock;
  const tabGroups = vscode.window.tabGroups as unknown as { all: Array<{ tabs: Array<{ input: unknown }> }> };
  const fileTab = (uri = URI) => ({ input: new vscode.TabInputText(vscode.Uri.parse(uri)) });
  let text: string;
  const doc = { ...document, languageId: 'markdown', getText: () => text };
  let annotator: VsCodeIssueAnnotator;
  let service: WorkshopHighlightService;
  let room: ReturnType<WorkshopHighlightService['forRoom']>;
  let secondRoom: typeof room;

  beforeEach(() => {
    text = TEXT;
    doc.version = 3;
    workspace.textDocuments = [doc];
    tabGroups.all = [{ tabs: [fileTab()] }];
    host.collections.forEach(collection => collection.clear());
    openDocument.mockReset().mockImplementation(async () => {
      workspace.textDocuments = [doc];
      return doc;
    });
    showDocument.mockReset().mockImplementation(async () => { tabGroups.all = [{ tabs: [fileTab()] }]; });
    annotator = new VsCodeIssueAnnotator({ dismiss: 'dismissHighlight', clear: 'clearHighlights' }, WORKSHOP_HIGHLIGHTS);
    service = new WorkshopHighlightService(new VsCodeWorkshopHighlightDocuments(), annotator);
    room = service.forRoom();
    secondRoom = service.forRoom();
  });

  afterEach(() => annotator.dispose());

  it('stacks sets with the same turn id and range across rooms, with independent Dismiss and room cleanup', () => {
    room.showOpen('turn', path, 'Jill', draft('Signature', 'Alice', 'sister'));
    secondRoom.showOpen('turn', path, 'Cat', draft('Names', 'Alice'));
    room.showOpen('another', path, 'Jill', draft('Voice', 'reading'));
    expect(highlights().map(d => [d.source, d.severity, d.message])).toEqual([
      ['Prose Minion Workshop', 2, 'Jill · Signature: Look here.'],
      ['Prose Minion Workshop', 2, 'Jill · Signature: Look here.'],
      ['Prose Minion Workshop', 2, 'Cat · Names: Look here.'],
      ['Prose Minion Workshop', 2, 'Jill · Voice: Look here.']
    ]);
    const actions = annotator.provideCodeActions(doc as never, {} as never, { diagnostics: [highlights()[2]] } as never);
    expect(actions.map(a => a.title)).toEqual(['Dismiss this Workshop highlight', 'Clear all Workshop highlights']);
    expect(actions[1].command?.arguments).toEqual([]);
    const [uri, id] = actions[0].command!.arguments!;
    service.dismiss(uri, id);
    expect(highlights().map(d => d.message)).not.toContain('Cat · Names: Look here.');
    secondRoom.showOpen('turn', path, 'Cat', draft('Names', 'Alice'));
    room.clear('turn');
    room.clear('turn');
    expect(highlights().map(d => d.message)).toEqual(['Jill · Voice: Look here.', 'Cat · Names: Look here.']);
    room.retain(new Set());
    expect(highlights().map(d => d.message)).toEqual(['Cat · Names: Look here.']);
    service.clearAll();
    service.clearAll();
    expect(highlights()).toEqual([]);
  });

  it('retains the updated offsets and withdrawals of earlier sets as new sets arrive', () => {
    room.showOpen('a', path, 'Jill', draft('First', 'Alice', 'sister', 'reading'));
    const mark = annotator.current(URI)!.annotations[1];
    service.dismiss(URI, mark.id);
    text = text.replace('Alice', 'Alicia');
    doc.version++;
    host.changes.fire({ document: doc, contentChanges: [{ rangeOffset: 0, rangeLength: 5, text: 'Alicia' }] });
    secondRoom.showOpen('b', path, 'Cat', draft('Second', 'Alicia'));
    expect(highlights().map(d => [d.range.start.offset, d.message])).toEqual([
      [text.indexOf('reading'), 'Jill · First: Look here.'], [0, 'Cat · Second: Look here.']
    ]);
  });

  it('clears on close and re-anchors the chosen set after reopening or Clear', async () => {
    const set = draft('Names', 'Alice', 'sister');
    room.showOpen('a', path, 'Jill', set);
    host.closes.fire(doc);
    workspace.textDocuments = [];
    expect(highlights()).toEqual([]);
    expect(room.showOpen('b', path, 'Cat', set)).toBeUndefined();
    expect(openDocument).not.toHaveBeenCalled();
    text = 'Her sister spoke.';
    doc.version = 1;
    const counts = await room.show('a', path, 'Jill', set, () => true);
    expect(counts).toMatchObject({ placed: 1, dropped: { unanchored: 1 } });
    expect(highlights().map(d => d.range.start.offset)).toEqual([4]);
    room.clear('a');
    expect(await room.show('a', path, 'Jill', set, () => true)).toEqual(counts);
    expect(highlights()).toHaveLength(1);
  });

  it('keeps background and split tabs and withdraws Workshop marks when the last tab closes despite a cached model', async () => {
    const set = draft('Names', 'Alice');
    const proofread = new VsCodeIssueAnnotator(COMMANDS);
    const other = fileTab('file:///workspace/elsewhere.md');
    try {
      proofread.show(URI, doc.version, [annotation('proofread', 'Alice')]);
      tabGroups.all = [{ tabs: [fileTab(), other] }, { tabs: [fileTab()] }];
      expect(room.showOpen('turn', path, 'Jill', set)?.placed).toBe(1);
      // Closing the split leaves the first group's background copy.
      tabGroups.all.pop();
      host.groupsChanged.fire({});
      expect(highlights()).toHaveLength(1);
      tabGroups.all = [{ tabs: [other] }];
      host.tabsChanged.fire({});
      expect(workspace.textDocuments).toContain(doc);
      expect(highlights()).toHaveLength(0);
      expect(proofread.current(URI)?.annotations).toHaveLength(1);
      expect(room.showOpen('another', path, 'Cat', set)).toBeUndefined();
      expect(openDocument).not.toHaveBeenCalled();
      text = 'Hi, Alice.';
      expect((await room.show('turn', path, 'Jill', set, () => true))?.placed).toBe(1);
      expect(highlights()[0].range.start.offset).toBe(4);
    } finally {
      proofread.dispose();
    }
  });

  it('reads and places again when the annotation host rejects a stale document version', () => {
    jest.spyOn(annotator, 'show').mockImplementationOnce(() => {
      text = 'Hello ' + TEXT;
      doc.version++;
      return false;
    });
    expect(room.showOpen('a', path, 'Jill', draft('Names', 'Alice'))?.placed).toBe(1);
    expect(highlights()[0].range.start.offset).toBe(6);
  });

  it('reports a display failure when both versions are stale', () => {
    jest.spyOn(annotator, 'show').mockReturnValue(false);
    expect(() => room.showOpen('a', path, 'Jill', draft('Names', 'Alice'))).toThrow('document changed');
    expect(highlights()).toEqual([]);
  });

  it.each(['clear', 'all', 'retain', 'room change', 'newer show'])('cancels a Show pending at %s', async action => {
    let current = true;
    const pending = room.show('a', path, 'Jill', draft('Old', 'Alice'), () => current);
    switch (action) {
      case 'clear': room.clear('a'); break;
      case 'all': service.clearAll(); expect(room.clearGeneration).toBe(1); break;
      case 'retain': room.retain(new Set()); break;
      case 'room change': current = false; break;
      case 'newer show': room.showOpen('a', path, 'Jill', draft('New', 'sister')); break;
    }
    expect(await pending).toBeUndefined();
    expect(showDocument).not.toHaveBeenCalled();
    expect(highlights().map(d => d.message)).toEqual(action === 'newer show' ? ['Jill · New: Look here.'] : []);
  });

  it('drops a Show cleared while VS Code is revealing the opened document', async () => {
    showDocument.mockImplementationOnce(async () => service.clearAll());
    expect(await room.show('turn', path, 'Jill', draft('Set', 'Alice'), () => true)).toBeUndefined();
    expect(showDocument).toHaveBeenCalledTimes(1);
    expect(highlights()).toEqual([]);
  });

  it('clears across files and draws a saved set again in a new window service after reload', async () => {
    const otherPath = '/workspace/chapter-02.md';
    const otherUri = vscode.Uri.file(otherPath);
    workspace.textDocuments = [doc, { ...doc, uri: otherUri }];
    tabGroups.all = [{ tabs: [fileTab(), fileTab(otherUri.toString())] }];
    const saved = draft('Names', 'Alice');
    room.showOpen('one', path, 'Jill', saved);
    secondRoom.showOpen('two', otherPath, 'Cat', draft('First line', 'Alice'));
    const collection = host.collections.get(WORKSHOP_HIGHLIGHTS.collection)!;
    expect(collection.get(otherUri.toString())).toHaveLength(1);
    service.clearAll();
    expect(collection.size).toBe(0);
    annotator.dispose();
    annotator = new VsCodeIssueAnnotator({ dismiss: 'dismissHighlight', clear: 'clearHighlights' }, WORKSHOP_HIGHLIGHTS);
    const restored = new WorkshopHighlightService(new VsCodeWorkshopHighlightDocuments(), annotator).forRoom();
    text = 'Restored: ' + TEXT;
    expect((await restored.show('one', path, 'Jill', saved, () => true))?.placed).toBe(1);
    expect(highlights()[0].range.start.offset).toBe(10);
  });

  it('keeps Proofread, Craft and Workshop Clear confined to their own collections', () => {
    const proofread = new VsCodeIssueAnnotator(COMMANDS);
    const craft = new VsCodeIssueAnnotator(COMMANDS, CRAFT_FLAGS);
    try {
      const flag = annotation('one', 'Alice');
      proofread.show(URI, doc.version, [flag]);
      craft.show(URI, doc.version, [flag]);
      room.showOpen('a', path, 'Jill', draft('Names', 'Alice'));
      service.clearAll();
      expect(proofread.current(URI)?.annotations).toEqual([flag]);
      expect(craft.current(URI)?.annotations).toEqual([flag]);
      room.showOpen('a', path, 'Jill', draft('Names', 'Alice'));
      proofread.clear();
      craft.clear();
      expect(highlights()).toHaveLength(1);
    } finally {
      proofread.dispose();
      craft.dispose();
    }
  });
});
