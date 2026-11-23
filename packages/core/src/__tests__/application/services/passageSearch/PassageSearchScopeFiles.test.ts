/**
 * From scopes to files (ADR 2026-11-20 D3, D3a, D4, D6): one listing per
 * plan, reading order, de-duplication by host identity, and the bounds
 * checked before anything is read. Paths and texts are made up, after
 * *Alice*.
 */
/* eslint-disable @typescript-eslint/naming-convention -- files keyed by their made-up paths. */
import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';
import type { ActiveSelectionInfo } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types/context';
import { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import type { PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';

const bounds = PROMPT_BUDGETS.passageSearch;
const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

function candidate(group: ContextPathGroup, relativePath: string, root = '/book', sizeBytes = 10): ContextResourceCandidate {
  return { group, relativePath, workspaceFolderPath: root, absolutePath: `${root}/${relativePath}`, sizeBytes };
}

interface HostOptions {
  listed?: ContextResourceCandidate[];
  patterns?: ContextResourceCandidate[];
  listingFails?: boolean;
  patternFails?: boolean;
  files?: Record<string, Uint8Array | Error>;
  editor?: ActiveSelectionInfo;
  /** What the port would remember of an earlier selection: never to be read. */
  remembered?: ActiveSelectionInfo;
  roots?: Array<{ path: string; name: string }>;
  statSize?: number;
}

function createHost(options: HostOptions = {}) {
  const listGroupFiles = jest.fn(async (groups: ContextPathGroup[]) => {
    if (options.listingFails) {
      throw new Error('scan failed');
    }
    return (options.listed ?? []).filter((file) => groups.includes(file.group));
  });
  const listPatternFiles = jest.fn(async (_patterns: readonly string[]) => {
    if (options.patternFails) {
      throw new Error('scan failed');
    }
    return options.patterns ?? [];
  });
  const readFile = jest.fn(async (filePath: string) => {
    const found = options.files?.[filePath] ?? encode(`Text of ${filePath}.`);
    if (found instanceof Error) {
      throw found;
    }
    return found;
  });
  const stat = jest.fn(async () => ({ type: 1, ctime: 0, mtime: 0, size: options.statSize ?? 10 }));
  let current = options.editor;
  const editor = { currentSelection: jest.fn(() => current), getActiveSelection: jest.fn(() => options.remembered ?? current) };
  const scopeFiles = new PassageSearchScopeFiles({
    listing: { listGroupFiles, listPatternFiles, matchPatterns: jest.fn(async () => undefined) },
    fileSystem: { readFile, stat },
    workspace: { workspaceFolders: () => options.roots ?? [{ path: '/book', name: 'book' }] },
    editor
  });
  return { scopeFiles, listGroupFiles, listPatternFiles, readFile, stat, editor, setEditor: (next: ActiveSelectionInfo | undefined) => { current = next; } };
}

async function filesOf(host: ReturnType<typeof createHost>, scopes: PassageSearchScope[]) {
  const outcome = await host.scopeFiles.resolve(scopes, host.scopeFiles.editorNow());
  if (outcome.kind !== 'files') {
    throw new Error(`expected files, got ${outcome.refusal.reason}`);
  }
  return outcome;
}

async function refusalOf(host: ReturnType<typeof createHost>, scopes: PassageSearchScope[]) {
  const outcome = await host.scopeFiles.resolve(scopes, host.scopeFiles.editorNow());
  return outcome.kind === 'refused' ? outcome.refusal : undefined;
}

const editorOn = (fsPath: string, overrides: Partial<ActiveSelectionInfo> = {}): ActiveSelectionInfo => ({
  text: '',
  isEmpty: true,
  uriString: `file://${fsPath}`,
  fsPath,
  relativePath: fsPath.replace('/book/', ''),
  ...overrides
});

describe('PassageSearchScopeFiles', () => {
  describe('groups and files', () => {
    const listed = [
      candidate('chapters', 'chapters/6.10.md'),
      candidate('chapters', 'chapters/6.9.2.md'),
      candidate('chapters', 'chapters/6.9.md'),
      candidate('manuscript', 'chapters/6.9.md'),
      candidate('manuscript', 'front/title.md'),
      candidate('characters', 'cast/alice.md')
    ];

    it('asks for one listing per plan, naming every group a scope needs', async () => {
      const host = createHost({ listed });
      await filesOf(host, [{ kind: 'group', group: 'chapters' }, { kind: 'file', file: { group: 'characters', path: 'cast/alice.md' } }, { kind: 'group', group: 'chapters' }]);
      expect(host.listGroupFiles).toHaveBeenCalledTimes(1);
      expect(host.listGroupFiles).toHaveBeenCalledWith(['chapters', 'characters']);
    });

    it('reads a group in natural order of its paths, and scopes in the order given', async () => {
      const host = createHost({ listed });
      const { files } = await filesOf(host, [{ kind: 'file', file: { group: 'characters', path: 'cast/alice.md' } }, { kind: 'group', group: 'chapters' }]);
      expect(files.map((file) => file.displayPath)).toEqual(['cast/alice.md', 'chapters/6.9.md', 'chapters/6.9.2.md', 'chapters/6.10.md']);
      expect(files[0]).toEqual({
        identity: '/book/cast/alice.md',
        displayPath: 'cast/alice.md',
        absolutePath: '/book/cast/alice.md',
        text: 'Text of /book/cast/alice.md.',
        lineOffset: 0,
        lines: 'document'
      });
    });

    it('reads a file two groups hold once, the first scope to name it keeping it', async () => {
      const host = createHost({ listed });
      const { files } = await filesOf(host, [{ kind: 'group', group: 'manuscript' }, { kind: 'group', group: 'chapters' }]);
      expect(files.map((file) => file.displayPath)).toEqual(['chapters/6.9.md', 'front/title.md', 'chapters/6.9.2.md', 'chapters/6.10.md']);
      expect(host.readFile).toHaveBeenCalledTimes(4);
      // Either group alone still reads the shared file.
      expect((await filesOf(createHost({ listed }), [{ kind: 'group', group: 'manuscript' }])).files.map((file) => file.displayPath)).toEqual(['chapters/6.9.md', 'front/title.md']);
      expect((await filesOf(createHost({ listed }), [{ kind: 'group', group: 'chapters' }])).files).toHaveLength(3);
    });

    it('keeps the same relative path in two roots as two files, shown with their roots', async () => {
      const roots = [{ path: '/one', name: 'one' }, { path: '/two', name: 'two' }];
      const twoRoots = [candidate('chapters', 'chapters/1.md', '/two'), candidate('chapters', 'chapters/1.md', '/one')];
      const { files } = await filesOf(createHost({ listed: twoRoots, roots }), [{ kind: 'group', group: 'chapters' }]);
      expect(files.map((file) => [file.identity, file.displayPath])).toEqual([
        ['/one/chapters/1.md', 'one/chapters/1.md'],
        ['/two/chapters/1.md', 'two/chapters/1.md']
      ]);
    });

    it('refuses a file scope two roots both hold as ambiguous, never the first root\'s', async () => {
      const twoRoots = [candidate('chapters', 'chapters/1.md', '/one'), candidate('chapters', 'chapters/1.md', '/two')];
      const host = createHost({ listed: twoRoots, roots: [{ path: '/one', name: 'one' }, { path: '/two', name: 'two' }] });
      expect(await refusalOf(host, [{ kind: 'file', file: { group: 'chapters', path: 'chapters/1.md' } }])).toMatchObject({ reason: 'ambiguous-file' });
      expect(host.readFile).not.toHaveBeenCalled();
    });

    it('finds a file by its exact path, else the one path equal but for case, in its own group only', async () => {
      const host = createHost({ listed });
      expect((await filesOf(host, [{ kind: 'file', file: { group: 'characters', path: 'Cast/Alice.md' } }])).files.map((file) => file.displayPath)).toEqual(['cast/alice.md']);
      expect(await refusalOf(createHost({ listed }), [{ kind: 'file', file: { group: 'chapters', path: 'cast/alice.md' } }])).toMatchObject({ reason: 'unknown-file' });
      const cased = [candidate('chapters', 'a/One.md'), candidate('chapters', 'a/one.md')];
      expect((await filesOf(createHost({ listed: cased }), [{ kind: 'file', file: { group: 'chapters', path: 'a/one.md' } }])).files.map((file) => file.displayPath)).toEqual(['a/one.md']);
      expect(await refusalOf(createHost({ listed: cased }), [{ kind: 'file', file: { group: 'chapters', path: 'A/ONE.md' } }])).toMatchObject({ reason: 'ambiguous-file' });
    });

    it('refuses the plan when the listing fails, reading nothing', async () => {
      const host = createHost({ listed, listingFails: true });
      expect(await refusalOf(host, [{ kind: 'group', group: 'chapters' }])).toMatchObject({ reason: 'catalog-unreadable' });
      expect(host.readFile).not.toHaveBeenCalled();
    });
  });

  describe('a writer-typed pattern', () => {
    it('reads what the authoritative walk matches, in natural order', async () => {
      const host = createHost({ patterns: [candidate('general', 'drafts/10.md'), candidate('general', 'drafts/9.md')] });
      const { files } = await filesOf(host, [{ kind: 'pattern', pattern: ' drafts/*.md ', writerTyped: true }]);
      expect(host.listPatternFiles).toHaveBeenCalledWith(['drafts/*.md']);
      expect(host.listGroupFiles).not.toHaveBeenCalled();
      expect(files.map((file) => file.displayPath)).toEqual(['drafts/9.md', 'drafts/10.md']);
    });

    it('refuses the plan when its scan fails', async () => {
      expect(await refusalOf(createHost({ patternFails: true }), [{ kind: 'pattern', pattern: 'drafts/*.md', writerTyped: true }])).toMatchObject({ reason: 'catalog-unreadable' });
    });
  });

  describe('the editor', () => {
    it('reads the active file from disk, once even when a group also holds it', async () => {
      const host = createHost({ listed: [candidate('chapters', 'chapters/1.md')], editor: editorOn('/book/chapters/1.md') });
      const { files } = await filesOf(host, [{ kind: 'active-file' }, { kind: 'group', group: 'chapters' }]);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({ identity: '/book/chapters/1.md', displayPath: 'chapters/1.md', lines: 'document', lineOffset: 0 });
      expect(host.stat).toHaveBeenCalledWith('/book/chapters/1.md');
    });

    it('refuses with no editor, or an unsaved document', async () => {
      expect(await refusalOf(createHost(), [{ kind: 'active-file' }])).toMatchObject({ reason: 'no-active-file' });
      expect(await refusalOf(createHost({ editor: editorOn('', { uriString: 'untitled:Untitled-1' }) }), [{ kind: 'active-file' }])).toMatchObject({ reason: 'no-active-file' });
    });

    it('reads the current editor, never a remembered selection: a formerly selected A with a live B and no selection (PR #293 F1)', async () => {
      const remembered = editorOn('/book/chapters/a.md', { text: 'The Cat grinned.', isEmpty: false, startLine: 3, endLine: 3 });
      const host = createHost({ editor: editorOn('/book/chapters/b.md'), remembered });
      const { files } = await filesOf(host, [{ kind: 'active-file' }]);
      expect(files.map((file) => file.identity)).toEqual(['/book/chapters/b.md']);
      expect(await refusalOf(host, [{ kind: 'selection' }])).toMatchObject({ reason: 'no-selection' });
      expect(host.readFile).not.toHaveBeenCalledWith('/book/chapters/a.md');
      expect(host.editor.getActiveSelection).not.toHaveBeenCalled();
    });

    it('refuses both scopes once the editor is closed, whatever was selected in it', async () => {
      const remembered = editorOn('/book/chapters/a.md', { text: 'The Cat grinned.', isEmpty: false });
      const host = createHost({ remembered });
      expect(await refusalOf(host, [{ kind: 'active-file' }])).toMatchObject({ reason: 'no-active-file' });
      expect(await refusalOf(host, [{ kind: 'selection' }])).toMatchObject({ reason: 'no-selection' });
      expect(host.readFile).not.toHaveBeenCalled();
    });

    it('reads one snapshot for both scopes: an editor that changes after it is not seen', async () => {
      const host = createHost({ editor: editorOn('/book/chapters/a.md', { text: 'Down, down, down.', isEmpty: false, startLine: 2, endLine: 2 }) });
      const snapshot = host.scopeFiles.editorNow();
      host.setEditor(editorOn('/book/chapters/b.md'));
      const outcome = await host.scopeFiles.resolve([{ kind: 'selection' }, { kind: 'active-file' }], snapshot);
      expect(outcome.kind === 'files' ? outcome.files.map((file) => file.displayPath) : outcome).toEqual(['chapters/a.md', 'chapters/a.md']);
      expect(host.editor.currentSelection).toHaveBeenCalledTimes(1);
    });

    it('reads a selection on the host, with the document\'s lines when the port gives its start', async () => {
      const editor = editorOn('/book/chapters/1.md', { text: 'Down, down, down.', isEmpty: false, startLine: 41, endLine: 41 });
      const host = createHost({ editor });
      const { files } = await filesOf(host, [{ kind: 'selection' }]);
      expect(files).toEqual([{
        identity: 'selection\u0000file:///book/chapters/1.md',
        displayPath: 'chapters/1.md',
        absolutePath: '/book/chapters/1.md',
        text: 'Down, down, down.',
        lineOffset: 40,
        lines: 'document'
      }]);
      expect(host.readFile).not.toHaveBeenCalled();
    });

    it('counts a selection\'s lines within it when the port gives no start line, and says so', async () => {
      const host = createHost({ editor: editorOn('/book/chapters/1.md', { text: 'Down, down, down.', isEmpty: false }) });
      expect((await filesOf(host, [{ kind: 'selection' }])).files[0]).toMatchObject({ lineOffset: 0, lines: 'text' });
    });

    it('refuses an empty selection', async () => {
      expect(await refusalOf(createHost({ editor: editorOn('/book/chapters/1.md') }), [{ kind: 'selection' }])).toMatchObject({ reason: 'no-selection' });
      expect(await refusalOf(createHost(), [{ kind: 'selection' }])).toMatchObject({ reason: 'no-selection' });
    });
  });

  it('carries a text scope by value, with nothing to open', async () => {
    const { files } = await filesOf(createHost(), [{ kind: 'text', label: 'Excerpt', text: 'The Cat grinned.' }, { kind: 'text', label: 'Excerpt', text: 'The Cat grinned.' }]);
    expect(files).toEqual([
      { identity: 'text\u00000', displayPath: 'Excerpt', text: 'The Cat grinned.', lineOffset: 0, lines: 'text' },
      { identity: 'text\u00001', displayPath: 'Excerpt', text: 'The Cat grinned.', lineOffset: 0, lines: 'text' }
    ]);
  });

  describe('bounds (D6)', () => {
    it('refuses more files than the bound, naming the count, before any is read', async () => {
      const listed = Array.from({ length: bounds.files + 1 }, (_unused, index) => candidate('chapters', `chapters/${index}.md`));
      const host = createHost({ listed });
      const refusal = await refusalOf(host, [{ kind: 'group', group: 'chapters' }]);
      expect(refusal).toMatchObject({ reason: 'too-many-files' });
      expect(refusal?.message).toContain(`${bounds.files + 1} files`);
      expect(refusal?.message).toContain(`up to ${bounds.files}`);
      expect(host.readFile).not.toHaveBeenCalled();
    });

    it('refuses a file over the size bound before any file is read', async () => {
      const listed = [candidate('chapters', 'chapters/1.md'), candidate('chapters', 'chapters/2.md', '/book', bounds.fileBytes + 1)];
      const host = createHost({ listed });
      const refusal = await refusalOf(host, [{ kind: 'group', group: 'chapters' }]);
      expect(refusal).toMatchObject({ reason: 'file-too-large' });
      expect(refusal?.message).toContain('1 file is larger than 2 MiB');
      expect(host.readFile).not.toHaveBeenCalled();
      // The active file is sized from the file system, a text by value from itself.
      expect(await refusalOf(createHost({ editor: editorOn('/book/a.md'), statSize: bounds.fileBytes + 1 }), [{ kind: 'active-file' }])).toMatchObject({ reason: 'file-too-large' });
      expect(await refusalOf(createHost(), [{ kind: 'text', label: 'x', text: 'a'.repeat(bounds.fileBytes + 1) }])).toMatchObject({ reason: 'file-too-large' });
    });

    it('refuses a file that grew past the bound since it was listed', async () => {
      const host = createHost({ listed: [candidate('chapters', 'chapters/1.md')], files: { '/book/chapters/1.md': new Uint8Array(bounds.fileBytes + 1) } });
      expect(await refusalOf(host, [{ kind: 'group', group: 'chapters' }])).toMatchObject({ reason: 'file-too-large' });
    });

    it('leaves out a file that is not UTF-8 text or cannot be read, and counts it: never a refusal', async () => {
      const listed = [candidate('chapters', 'chapters/1.md'), candidate('chapters', 'chapters/2.md'), candidate('chapters', 'chapters/3.md')];
      const host = createHost({ listed, files: { '/book/chapters/1.md': new Uint8Array([0xff, 0xfe, 0x00, 0xd8]), '/book/chapters/2.md': new Error('gone') } });
      const outcome = await filesOf(host, [{ kind: 'group', group: 'chapters' }]);
      expect(outcome.files.map((file) => file.displayPath)).toEqual(['chapters/3.md']);
      expect(outcome.leftOut).toEqual([
        { identity: '/book/chapters/1.md', reason: 'unreadable' },
        { identity: '/book/chapters/2.md', reason: 'unreadable' }
      ]);
    });

    it('sets a byte-order mark aside', async () => {
      const host = createHost({ listed: [candidate('chapters', 'chapters/1.md')], files: { '/book/chapters/1.md': new Uint8Array([0xef, 0xbb, 0xbf, ...encode('Alice.')]) } });
      expect((await filesOf(host, [{ kind: 'group', group: 'chapters' }])).files[0].text).toBe('Alice.');
    });
  });
});
