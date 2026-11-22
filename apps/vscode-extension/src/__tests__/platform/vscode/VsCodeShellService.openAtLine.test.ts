/**
 * `ShellService.openFileInEditor`'s optional `line` (ADR 2026-11-20 D15):
 * the adapter reveals and selects that line, clamps a line past the file's
 * end, and opens a file as it always has when no line is named.
 */

const openTextDocument = jest.fn();
const showTextDocument = jest.fn();

jest.mock('vscode', () => ({
  Uri: { file: (fsPath: string) => ({ fsPath, scheme: 'file' }) },
  ViewColumn: { Two: 2, Beside: -2 },
  TabInputWebview: class {},
  workspace: { openTextDocument: (...args: unknown[]) => openTextDocument(...args) },
  window: {
    showTextDocument: (...args: unknown[]) => showTextDocument(...args),
    visibleTextEditors: [],
    tabGroups: { activeTabGroup: { activeTab: undefined, viewColumn: 1 } }
  }
}), { virtual: true });

import { VsCodeShellService } from '../../../platform/vscode/VsCodeShellService';

const documentOf = (lines: string[]) => ({
  lineCount: lines.length,
  lineAt: (index: number) => ({ range: { line: index, length: lines[index].length } })
});

describe('VsCodeShellService.openFileInEditor at a line', () => {
  beforeEach(() => {
    openTextDocument.mockReset();
    showTextDocument.mockReset().mockResolvedValue(undefined);
  });

  it('reveals and selects the 1-based line', async () => {
    const document = documentOf(['Alice was beginning', 'to get very tired', 'of sitting by her sister']);
    openTextDocument.mockResolvedValue(document);
    await new VsCodeShellService().openFileInEditor('/novel/alice-ch1.md', { line: 2 });
    expect(showTextDocument).toHaveBeenCalledWith(document, { preview: false, selection: { line: 1, length: 17 } });
  });

  it('lands on the last line for a line past the end, and the first for one before the start', async () => {
    const document = documentOf(['Down the', 'rabbit-hole']);
    openTextDocument.mockResolvedValue(document);
    const shell = new VsCodeShellService();
    await shell.openFileInEditor('/novel/alice-ch1.md', { line: 40 });
    await shell.openFileInEditor('/novel/alice-ch1.md', { line: 0 });
    expect(showTextDocument.mock.calls.map(([, options]) => options.selection.line)).toEqual([1, 0]);
  });

  it('opens beside when asked, still at the line', async () => {
    const document = documentOf(['Down the', 'rabbit-hole']);
    openTextDocument.mockResolvedValue(document);
    await new VsCodeShellService().openFileInEditor('/novel/alice-ch1.md', { beside: true, line: 1 });
    expect(showTextDocument).toHaveBeenCalledWith(document, { preview: false, viewColumn: -2, selection: { line: 0, length: 8 } });
  });

  it('opens the file as before when no line is named', async () => {
    await new VsCodeShellService().openFileInEditor('/novel/alice-ch1.md');
    expect(openTextDocument).not.toHaveBeenCalled();
    expect(showTextDocument).toHaveBeenCalledWith({ fsPath: '/novel/alice-ch1.md', scheme: 'file' }, { preview: false });
  });
});
