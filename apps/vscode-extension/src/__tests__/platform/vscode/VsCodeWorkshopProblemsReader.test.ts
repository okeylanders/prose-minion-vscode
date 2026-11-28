import { host } from './mockIssueAnnotatorHost';
import * as vscode from 'vscode';
import { WORKSHOP_PROBLEMS_BOUNDS, WorkshopHighlightService } from '@prose-minion/core';
import { WORKSHOP_HIGHLIGHTS, VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';
import { VsCodeWorkshopHighlightDocuments } from '@app/platform/vscode/VsCodeWorkshopHighlightDocuments';
import { VsCodeWorkshopProblemsReader } from '@app/platform/vscode/VsCodeWorkshopProblemsReader';

/* eslint-disable @typescript-eslint/naming-convention -- match core's public exports. */
jest.mock('@prose-minion/core', () => ({
  ...jest.requireActual('@/application/services/workshop/problems/WorkshopProblemsPort'),
  WorkshopHighlightService: jest.requireActual('@/application/services/workshop/highlights/WorkshopHighlightService').WorkshopHighlightService,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges
}));
/* eslint-enable @typescript-eslint/naming-convention */

const path = '/book/chapter.md';
const uri = vscode.Uri.file(path);
const workspace = vscode.workspace as unknown as { textDocuments: unknown[] };
const reader = new VsCodeWorkshopProblemsReader();

function buffer(text: string) {
  const positionAt = (requested: number) => {
    const offset = Math.max(0, Math.min(text.length, requested));
    const lines = text.slice(0, offset).split('\n');
    return { offset, line: lines.length - 1, character: lines[lines.length - 1].length } as unknown as vscode.Position;
  };
  const offsetAt = (position: vscode.Position) => (position as unknown as { offset: number }).offset;
  const range = (start: number, end: number) => new vscode.Range(positionAt(start), positionAt(end));
  return {
    uri, version: 4, languageId: 'markdown', isClosed: false, get isDirty() { return true; }, positionAt, offsetAt, range,
    getText: jest.fn((r?: vscode.Range) => r ? text.slice(offsetAt(r.start), offsetAt(r.end)) : text),
    validateRange: (r: vscode.Range) => range(offsetAt(r.start), offsetAt(r.end))
  };
}

beforeEach(() => {
  host.collections.forEach(collection => collection.clear());
  workspace.textDocuments = [];
  jest.clearAllMocks();
});

it('reads highlights from both Workshop tabs and independent publishers on exactly the authorized file', async () => {
  const doc = buffer('Marsh\nHeron');
  workspace.textDocuments = [doc];
  const tabGroups = vscode.window.tabGroups as unknown as { all: unknown[] };
  tabGroups.all = [{ tabs: [{ input: new vscode.TabInputText(uri) }] }];
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear' }, WORKSHOP_HIGHLIGHTS);
  const service = new WorkshopHighlightService(new VsCodeWorkshopHighlightDocuments(), annotator);
  try {
    const first = service.forRoom();
    first.showOpen('same-turn-id', path, 'Jill', { title: 'Voice: dusk', places: [{ start: { quote: 'Marsh' }, note: 'Hold · here.' }] });
    service.forRoom().showOpen('same-turn-id', path, 'Cat', { title: 'Figurative', places: [{ start: { quote: 'Heron' }, note: 'Echo.' }] });
    const other = vscode.languages.createDiagnosticCollection('external');
    const flag = new vscode.Diagnostic(doc.range(2, 8), 'Split this line', vscode.DiagnosticSeverity.Warning);
    flag.source = 'Independent checker';
    flag.code = { value: 'flag', target: vscode.Uri.file('/private/link.md') };
    flag.relatedInformation = [new vscode.DiagnosticRelatedInformation(new vscode.Location(vscode.Uri.file('/private/other.md'), flag.range), 'Other-file text')];
    other.set(uri, [flag]);
    other.set(vscode.Uri.file('/book/elsewhere.md'), [new vscode.Diagnostic(flag.range, 'Another file only')]);

    const result = await reader.read(path, 1);
    expect(result.total).toBe(3);
    expect(result.problems).toEqual(expect.arrayContaining([
      { source: 'Prose Minion Workshop', severity: 'information', message: 'Jill · Voice: dusk: Hold · here.', startLine: 1, startColumn: 1, endLine: 1, endColumn: 6, quote: 'Marsh' },
      { source: 'Prose Minion Workshop', severity: 'information', message: 'Cat · Figurative: Echo.', startLine: 2, startColumn: 1, endLine: 2, endColumn: 6, quote: 'Heron' },
      { source: 'Independent checker', severity: 'warning', message: 'Split this line', startLine: 1, startColumn: 3, endLine: 2, endColumn: 3, quote: 'rsh\nHe' }
    ]));
    expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(1);
    const queriedUris = (vscode.languages.getDiagnostics as jest.Mock).mock.calls.map(args => args.map(String));
    expect(queriedUris).toEqual([[uri.toString()]]);
    first.clear('same-turn-id');
    expect((await reader.read(path, 1)).problems.map(problem => problem.source)).toEqual(['Prose Minion Workshop', 'Independent checker']);
  } finally {
    annotator.dispose();
  }
});

it('pages before extracting quotes and limits every field without breaking UTF-16 pairs', async () => {
  const bounds = WORKSHOP_PROBLEMS_BOUNDS;
  const text = 'Q'.repeat(bounds.quoteCharacters - 1) + '🐇' + 'x'.repeat(60_000);
  const doc = buffer(text);
  workspace.textDocuments = [doc];
  const publisher = vscode.languages.createDiagnosticCollection('long');
  const long = new vscode.Diagnostic(doc.range(0, text.length), 'm'.repeat(bounds.messageCharacters - 1) + '🍏x', vscode.DiagnosticSeverity.Error);
  long.source = 's'.repeat(bounds.sourceCharacters - 1) + '🍏';
  const last = new vscode.Diagnostic(doc.range(0, 0), 'at the caret', vscode.DiagnosticSeverity.Hint);
  publisher.set(uri, [...Array.from({ length: bounds.rowsPerPage }, () => long), last]);

  const page = await reader.read(path, 1);
  expect(page.total).toBe(bounds.rowsPerPage + 1);
  expect(page.problems).toHaveLength(bounds.rowsPerPage);
  expect(page.problems[0]).toMatchObject({ severity: 'error', source: 's'.repeat(bounds.sourceCharacters - 1), message: 'm'.repeat(bounds.messageCharacters - 1),
    quote: 'Q'.repeat(bounds.quoteCharacters - 1), sourceTruncated: true, messageTruncated: true, quoteTruncated: true });
  for (const [range] of doc.getText.mock.calls) {
    expect(range && doc.offsetAt(range.end) - doc.offsetAt(range.start)).toBeLessThanOrEqual(bounds.quoteCharacters + 1);
  }
  expect((await reader.read(path, bounds.rowsPerPage + 1)).problems).toEqual([
    { severity: 'hint', message: 'at the caret', startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 }
  ]);
  expect(await reader.read(path, bounds.rowsPerPage + 2)).toEqual({ total: page.total, problems: [] });
});

it('returns current Problems without opening a closed source and omits quotes for stale ranges', async () => {
  const old = buffer('now shorter');
  const mark = new vscode.Diagnostic(old.range(4, 11), 'Current diagnostic', vscode.DiagnosticSeverity.Hint);
  vscode.languages.createDiagnosticCollection('external').set(uri, [mark]);
  const row = { severity: 'hint', message: mark.message, startLine: 1, startColumn: 5, endLine: 1, endColumn: 12 };
  expect(await reader.read(path, 1)).toEqual({ total: 1, problems: [row] });
  const current = buffer('now');
  workspace.textDocuments = [current];
  expect(await reader.read(path, 1)).toEqual({ total: 1, problems: [row] });
  expect(current.getText).not.toHaveBeenCalled();
  expect(await reader.read('/book/empty.md', 1)).toEqual({ total: 0, problems: [] });
  expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
});
