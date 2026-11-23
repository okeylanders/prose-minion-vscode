/**
 * `resource.catalog` as the group inventory (ADR 2026-11-20 S46): the
 * listing a passage search reads, a file under every group it is in, paged
 * by the shared rule, and a `<match>` that lists exactly the files that
 * narrowed scope would search, with each pattern's count. The real resolver
 * walks a made-up *Alice* project.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots and setting keys, keyed by their paths and names. */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { LogSink } from '@/platform';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { WorkshopResourceCapability } from '@/application/services/workshop/WorkshopResourceCapability';
import { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import { aliceProject, type AliceProjectOptions } from '../../contextPaths/aliceProject';

type CatalogRequest = Extract<WorkshopCapabilityRequest, { capability: 'resource.catalog' }>;

const BOOK = [
  'Drafts/chapter-1.md',
  'Drafts/chapter-1.2.md',
  'Drafts/chapter-4.1.md',
  'Drafts/chapter-4.2.md',
  'Drafts/chapter-10.md',
  'Notes/lore.md'
];
const SETTINGS = { 'contextPaths.chapters': 'Drafts/**', 'contextPaths.manuscript': 'Drafts/chapter-4*', 'contextPaths.general': 'Notes/**' };

function catalogOver(files: readonly string[] = BOOK, options: Partial<AliceProjectOptions> = {}) {
  const alice = aliceProject({ roots: { '/alice': [...files] }, settings: { ...SETTINGS }, ...options });
  const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
  const lines: string[] = [];
  const capability = new WorkshopResourceCapability(
    resolver,
    { appendLine: (line: string) => { lines.push(line); } } as unknown as LogSink,
    { requestId: 'host-1', personaId: 'jill', signal: new AbortController().signal }
  );
  const catalog = (request: Omit<CatalogRequest, 'capability'> = {}) => capability.fulfill({ capability: 'resource.catalog', ...request });
  return { alice, resolver, catalog, lines };
}

const entries = (content: string | undefined): string[] => (content ?? '').split('\n').filter((line) => line.startsWith('- ['));

describe('the group inventory', () => {
  it('lists a named group from the search\'s own listing, in natural order', async () => {
    const result = await catalogOver().catalog({ group: 'chapters' });
    expect(result.status).toBe('success');
    expect(entries(result.content)).toEqual([
      '- [chapters] `Drafts/chapter-1.md`',
      '- [chapters] `Drafts/chapter-1.2.md`',
      '- [chapters] `Drafts/chapter-4.1.md`',
      '- [chapters] `Drafts/chapter-4.2.md`',
      '- [chapters] `Drafts/chapter-10.md`'
    ]);
    expect(result.content).toContain('The files a passage search of chapters reads.');
    expect(result.metadata).toMatchObject({ group: 'chapters', fileCount: 5, matchingFiles: 5, page: 1, pages: 1, truncated: false });
  });

  it('without a group, lists each group in turn, a file under every group it is in, where the browse catalog keeps one', async () => {
    const { catalog, resolver } = catalogOver();
    const result = await catalog();
    const listed = entries(result.content);
    expect(listed.filter((line) => line.includes('chapter-4.1.md'))).toEqual(['- [chapters] `Drafts/chapter-4.1.md`', '- [manuscript] `Drafts/chapter-4.1.md`']);
    expect(listed.indexOf('- [chapters] `Drafts/chapter-1.md`')).toBeLessThan(listed.indexOf('- [manuscript] `Drafts/chapter-4.1.md`'));
    expect(listed).toContain('- [general] `Notes/lore.md`');
    // The browse catalog keeps the file in one group only.
    const browse = (await resolver.createProvider(['chapters', 'manuscript'])).listResources().filter((summary) => summary.path === 'Drafts/chapter-4.1.md');
    expect(browse).toHaveLength(1);
  });

  it('names the workspace folder only when several are open', async () => {
    const { catalog } = catalogOver(BOOK, { roots: { '/alice': BOOK, '/looking-glass': ['Drafts/chapter-4.1.md'] } });
    const listed = entries((await catalog({ group: 'chapters' })).content);
    expect(listed.filter((line) => line.includes('chapter-4.1.md'))).toEqual([
      '- [chapters] `Drafts/chapter-4.1.md` · workspace: alice',
      '- [chapters] `Drafts/chapter-4.1.md` · workspace: looking-glass'
    ]);
  });

  it('pages by the shared rule, writing the next page\'s whole call exactly when a later page exists', async () => {
    const pageSize = PROMPT_BUDGETS.workshopResource.catalogItems;
    const many = Array.from({ length: pageSize * 2 + 7 }, (_, index) => `Drafts/chapter-${index + 1}.md`);
    const { catalog } = catalogOver(many);
    const first = await catalog({ group: 'chapters' });
    expect(entries(first.content)).toHaveLength(pageSize);
    expect(first.content).toContain(`Files 1–${pageSize} of ${pageSize * 2 + 7}:`);
    expect(first.content).toContain(`${pageSize + 7} more files. The next page: <prose-minion-tool-call name="resource.catalog"><group>chapters</group><page>2</page></prose-minion-tool-call>`);
    expect(first.metadata).toMatchObject({ page: 1, pages: 3, truncated: true });
    const last = await catalog({ group: 'chapters', page: 3 });
    expect(entries(last.content)).toEqual(['- [chapters] `Drafts/chapter-201.md`', ...many.slice(201).map((file) => `- [chapters] \`${file}\``)]);
    expect(last.content).not.toContain('The next page');
    const past = await catalog({ group: 'chapters', page: 4 });
    expect(past.status).toBe('success');
    expect(past.content).toContain(`Page 4 is past the end: ${pageSize * 2 + 7} files, 3 pages.`);
    expect(entries(past.content)).toEqual([]);
  });

  it('answers an empty project in words, and a page past its end as past the end', async () => {
    const result = await catalogOver([]).catalog();
    expect(result.content).toBe('No configured project resources are available for all configured groups.');
    const past = await catalogOver([]).catalog({ page: 2 });
    expect(past.content).toContain('Page 2 is past the end: no file is listed.');
    expect(past.content).not.toContain('No configured project resources');
  });

  it('names folders whenever several are open, though every file listed is in one of them', async () => {
    const { catalog } = catalogOver(BOOK, { roots: { '/alice': BOOK, '/looking-glass': ['Other/notes.txt'] } });
    const listed = entries((await catalog({ group: 'chapters' })).content);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((line) => line.endsWith(' · workspace: alice'))).toBe(true);
  });

  it('a listing that could not be read lists nothing, never fewer files', async () => {
    const result = await catalogOver(BOOK, { failingGlobs: ['Drafts/**'] }).catalog({ group: 'chapters' });
    expect(result.status).toBe('failed');
    expect(result.content).toBeUndefined();
    expect(result.error).toContain('could not be listed completely');
  });
});

describe('a narrowed group in the inventory', () => {
  it('lists exactly the files the narrowed search reads, with each pattern\'s count', async () => {
    const setup = catalogOver();
    const match = ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'];
    const result = await setup.catalog({ group: 'chapters', match });
    expect(result.content).toContain('## Project resource catalog · chapters, matching Drafts/chapter-4.*.md, Drafts/chapter-1*.md');
    expect(result.content).toContain('- Drafts/chapter-4.*.md finds 2 files of chapters.');
    expect(result.content).toContain('- Drafts/chapter-1*.md finds 3 files of chapters.');
    const listed = entries(result.content).map((line) => /`([^`]+)`/.exec(line)![1]);
    // The search's own resolution of the same narrowing reads the same files, in the same order.
    const scopeFiles = new PassageSearchScopeFiles({
      listing: setup.resolver,
      fileSystem: { readFile: async () => new TextEncoder().encode('The Rabbit hurried.'), stat: setup.alice.fileSystem.stat },
      workspace: setup.alice.workspace,
      editor: { currentSelection: () => undefined }
    });
    const searched = await scopeFiles.resolve([{ kind: 'group', group: 'chapters', match }], { editor: undefined });
    expect(searched.kind === 'files' && searched.files.map((file) => file.displayPath)).toEqual(listed);
    expect(result.metadata).toMatchObject({ fileCount: 5, matchingFiles: 5, patterns: 2, patternsFindingNothing: 0 });
  });

  it('shows a pattern that finds nothing of its group before a search is asked for', async () => {
    const result = await catalogOver().catalog({ group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Notes/*.md'] });
    expect(result.content).toContain('- Notes/*.md finds no file of chapters. A passage search narrowed by it would be dropped (match-found-nothing).');
    expect(entries(result.content)).toHaveLength(2);
    expect(result.metadata).toMatchObject({ patterns: 2, patternsFindingNothing: 1 });
    const none = await catalogOver().catalog({ group: 'chapters', match: ['Notes/*.md'] });
    expect(none.content).toContain('No file is listed.');
  });

  it('pages a narrowing, its continuation carrying the same patterns', async () => {
    const pageSize = PROMPT_BUDGETS.workshopResource.catalogItems;
    const many = Array.from({ length: pageSize + 3 }, (_, index) => `Drafts/book-1/chapter-${index + 1}.md`);
    const result = await catalogOver([...many, 'Drafts/book-2/chapter-1.md']).catalog({ group: 'chapters', match: ['Drafts/book-1/*.md'] });
    expect(result.content).toContain('The next page: <prose-minion-tool-call name="resource.catalog"><group>chapters</group><match>Drafts/book-1/*.md</match><page>2</page></prose-minion-tool-call>');
  });

  it('a walk that did not complete lists nothing and says so', async () => {
    const result = await catalogOver(BOOK, { failingGlobs: ['Drafts/chapter-1*.md'] }).catalog({ group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('could not be listed completely');
  });

  it('logs the group and counts, never a pattern, a path or a file name', async () => {
    const setup = catalogOver();
    await setup.catalog({ group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Notes/*.md'], page: 1 });
    const logged = [...setup.lines, ...setup.alice.lines].join('\n');
    expect(setup.lines.join('\n')).toContain('capability=resource.catalog group=chapters page=1 pages=1 files=2 patterns=2 outcome=listed');
    expect(logged).not.toMatch(/Drafts|Notes|chapter-|lore/);
  });
});
