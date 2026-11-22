/**
 * A file outside the workspace never shows its real path (PR #294). A host's
 * "relative path" for such a document can be its absolute path; the scope
 * resolver keeps only the file's name for display, the view mapping holds
 * the same rule at the boundary, and the file still opens through the
 * host-held result. Paths are made up, after *Alice*.
 */

import { passageSearchResultView } from '@/application/handlers/domain/PassageSearchViews';
import { PassageSearchScopeFiles, passageSearchDisplayLabel } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import type { PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';
import type { ActiveSelectionInfo } from '@/platform';
import type { PassageSearchResult, PassageSearchSourceFile } from '@services/search/passage/PassageSearchContracts';
import { formatPassageSearchReport } from '@shared/utils/passageSearchReport';
import { aliceResult } from '@/__tests__/application/handlers/domain/passageSearchRouteHarness';

const POSIX = '/home/dodgson/elsewhere/looking-glass.md';
const WINDOWS = 'C:\\Users\\dodgson\\Elsewhere\\looking-glass.md';

/** An editor as VS Code reports a document outside the workspace: its "relative" path is the real one. */
const exteriorEditor = (fsPath: string, overrides: Partial<ActiveSelectionInfo> = {}): ActiveSelectionInfo => ({
  text: '',
  isEmpty: true,
  uriString: `file://${fsPath}`,
  fsPath,
  relativePath: fsPath,
  ...overrides
});

async function resolved(editor: ActiveSelectionInfo, scope: PassageSearchScope): Promise<PassageSearchSourceFile> {
  const scopeFiles = new PassageSearchScopeFiles({
    listing: { listGroupFiles: jest.fn(async () => []), listPatternFiles: jest.fn(async () => []) } as never,
    fileSystem: {
      readFile: jest.fn(async () => new TextEncoder().encode('Alice stepped through the glass.')),
      stat: jest.fn(async () => ({ type: 1, ctime: 0, mtime: 0, size: 10 }))
    } as never,
    workspace: { workspaceFolders: () => [{ path: '/book', name: 'book' }] } as never,
    editor: { currentSelection: () => editor, getActiveSelection: () => editor } as never
  });
  const outcome = await scopeFiles.resolve([scope], scopeFiles.editorNow());
  if (outcome.kind !== 'files') {
    throw new Error(`expected files, got ${outcome.refusal.reason}`);
  }
  return outcome.files[0];
}

/** A result whose one instance stands in `file`, as a run over it would report. */
function resultIn(file: PassageSearchSourceFile): PassageSearchResult {
  const result = aliceResult();
  return {
    ...result,
    instances: [{ ...result.instances[0], file: 'f1', displayPath: file.displayPath }],
    files: {
      ...result.files,
      planned: [{
        key: 'f1',
        displayPath: file.displayPath,
        ...(file.absolutePath !== undefined ? { absolutePath: file.absolutePath } : {}),
        lines: file.lines,
        instances: 1,
        chunks: { planned: 1, admitted: 1, answered: 1 },
        searched: 'full'
      }],
      searched: { full: 1, partial: 0, none: 0 }
    }
  };
}

describe('a file outside the workspace', () => {
  it.each([
    ['POSIX', POSIX],
    ['Windows', WINDOWS]
  ])('shows only its name for an Active File scope (%s), and still opens through the host', async (_form, fsPath) => {
    const file = await resolved(exteriorEditor(fsPath), { kind: 'active-file' });
    expect(file.displayPath).toBe('looking-glass.md');
    expect(file.absolutePath).toBe(fsPath);

    const view = passageSearchResultView(resultIn(file), 'result-1', false);
    expect(view.instances[0]).toMatchObject({ file: 'looking-glass.md', canOpen: true });
    const crossing = JSON.stringify(view) + formatPassageSearchReport(view);
    expect(crossing).not.toContain('dodgson');
    expect(crossing).not.toMatch(/elsewhere/i);
  });

  it.each([
    ['POSIX', POSIX],
    ['Windows', WINDOWS]
  ])('shows only its name for a Selection scope (%s)', async (_form, fsPath) => {
    const selection = exteriorEditor(fsPath, { text: 'Alice stepped through the glass.', isEmpty: false, startLine: 4, endLine: 4 });
    const file = await resolved(selection, { kind: 'selection' });
    expect(file.displayPath).toBe('looking-glass.md');
    expect(file.absolutePath).toBe(fsPath);

    const view = passageSearchResultView(resultIn(file), 'result-1', false);
    const crossing = JSON.stringify(view) + formatPassageSearchReport(view);
    expect(view.instances[0].file).toBe('looking-glass.md');
    expect(crossing).not.toContain('dodgson');
    expect(crossing).not.toMatch(/elsewhere/i);
  });

  it('keeps a workspace-relative label as it is', async () => {
    const inside = exteriorEditor('/book/chapters/alice-ch1.md', { relativePath: 'chapters/alice-ch1.md' });
    expect((await resolved(inside, { kind: 'active-file' })).displayPath).toBe('chapters/alice-ch1.md');
  });

  it('holds the rule at the view boundary too, should a real path ever reach a result', () => {
    const leaked = resultIn({ identity: POSIX, displayPath: POSIX, absolutePath: POSIX, text: '', lineOffset: 0, lines: 'document' });
    const view = passageSearchResultView(leaked, 'result-1', false);
    expect(view.instances[0].file).toBe('looking-glass.md');
    expect(JSON.stringify(view)).not.toContain('dodgson');
  });

  it.each([
    ['chapters/alice-ch1.md', '', 'chapters/alice-ch1.md'],
    ['book/chapters/alice-ch1.md', '/work/book/chapters/alice-ch1.md', 'book/chapters/alice-ch1.md'],
    ['Selected text', '', 'Selected text'],
    [POSIX, POSIX, 'looking-glass.md'],
    [WINDOWS, WINDOWS, 'looking-glass.md'],
    ['\\\\server\\share\\tea-party.md', '', 'tea-party.md'],
    ['~/drafts/tea-party.md', '', 'tea-party.md'],
    ['../outside/tea-party.md', '/home/dodgson/outside/tea-party.md', 'tea-party.md'],
    ['', POSIX, 'looking-glass.md'],
    ['', '', 'Untitled']
  ])('labels %p (file %p) as %p', (label, fsPath, shown) => {
    expect(passageSearchDisplayLabel(label, fsPath)).toBe(shown);
  });
});
